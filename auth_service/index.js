const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/finance_db",
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret"; // fallback for hashing
const ACCESS_TTL = parseDuration(process.env.JWT_ACCESS_EXPIRES_IN || "15m");
const REFRESH_TTL = parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || "7d");

async function ensureDefaultAdmin() {
  const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  if (!username || !password) {
    return;
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rowCount > 0) {
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [
      username,
      passwordHash,
    ]);
    console.log(`✅ Vytvořen výchozí uživatel ${username}`);
  } catch (err) {
    console.error("Nepodařilo se vytvořit výchozího administrátora:", err.message);
  }
}

ensureDefaultAdmin();

function parseDuration(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value) * 1000; // seconds
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) return Number(value) * 1000;
  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return num * (multipliers[unit] || 1000);
}

async function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, username: user.username },
    ACCESS_SECRET,
    { expiresIn: Math.floor(ACCESS_TTL / 1000) }
  );

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL);
  await pool.query(
    "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [crypto.createHmac("sha256", REFRESH_SECRET).update(refreshToken).digest("hex"), user.id, expiresAt]
  );

  return { accessToken, refreshToken, expiresAt };
}

async function verifyRefreshToken(rawToken) {
  if (!rawToken) return null;
  const hashed = crypto.createHmac("sha256", REFRESH_SECRET).update(rawToken).digest("hex");
  const result = await pool.query(
    "SELECT token, user_id, expires_at FROM refresh_tokens WHERE token = $1",
    [hashed]
  );
  if (result.rowCount === 0) return null;
  const tokenRow = result.rows[0];
  if (new Date(tokenRow.expires_at) < new Date()) {
    await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [hashed]);
    return null;
  }
  const userResult = await pool.query("SELECT id, username FROM users WHERE id = $1", [tokenRow.user_id]);
  if (userResult.rowCount === 0) return null;
  return { user: userResult.rows[0], hashedToken: hashed };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Přístup odepřen." });
  }
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Neplatný nebo expirovaný token." });
  }
}

app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Uživatelské jméno a heslo jsou povinné." });
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "Uživatel již existuje." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash]
    );
    const user = insertResult.rows[0];
    const tokens = await issueTokens(user);
    res.status(201).json({ user, ...tokens });
  } catch (err) {
    console.error("Registrace selhala", err);
    res.status(500).json({ error: "Registrace selhala." });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Uživatelské jméno a heslo jsou povinné." });
  }
  try {
    const userResult = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username]
    );
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }
    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Neplatné přihlašovací údaje." });
    }
    const tokens = await issueTokens(user);
    res.json({ user: { id: user.id, username: user.username }, ...tokens });
  } catch (err) {
    console.error("Login selhal", err);
    res.status(500).json({ error: "Přihlášení selhalo." });
  }
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken je povinný." });
  }
  try {
    const verified = await verifyRefreshToken(refreshToken);
    if (!verified) {
      return res.status(401).json({ error: "Refresh token není platný." });
    }
    await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [verified.hashedToken]);
    const tokens = await issueTokens(verified.user);
    res.json({ user: verified.user, ...tokens });
  } catch (err) {
    console.error("Refresh selhal", err);
    res.status(500).json({ error: "Nepodařilo se obnovit přihlášení." });
  }
});

app.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(200).json({ message: "Odhlášeno." });
  }
  try {
    const hashed = crypto.createHmac("sha256", REFRESH_SECRET).update(refreshToken).digest("hex");
    await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [hashed]);
    res.json({ message: "Odhlášeno." });
  } catch (err) {
    console.error("Odhlášení selhalo", err);
    res.status(500).json({ error: "Odhlášení selhalo." });
  }
});

app.get("/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

const PORT = process.env.AUTH_SERVICE_PORT || 4002;
app.listen(PORT, () => {
  console.log(`✅ Auth service běží na http://localhost:${PORT}`);
});
