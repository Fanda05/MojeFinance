import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import dotenv from "dotenv";
import paypalRouter from "./routes/paypal.js";

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/finance_db",
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";

const BASE_CURRENCY = "CZK";
const SUPPORTED_CURRENCIES = ["CZK", "EUR", "USD", "GBP", "CHF", "PLN"];
const ratesCache = new Map();
const fallbackRates = new Map([
  ["CZK", 1],
  ["EUR", 25.0],
  ["USD", 23.0],
  ["GBP", 29.0],
  ["CHF", 26.0],
  ["PLN", 6.0],
]);

function formatDateKey(input) {
  if (!input) {
    return new Date().toISOString().split("T")[0];
  }
  if (input instanceof Date) {
    return input.toISOString().split("T")[0];
  }
  return input.split("T")[0];
}

function formatDayParam(dateKey) {
  if (!dateKey) return "";
  return dateKey.replace(/-/g, "");
}

async function fetchRatesFromKurzy(dateKey) {
  const dayParam = formatDayParam(dateKey);
  const url = `https://data.kurzy.cz/json/meny/b[6]${dayParam ? `den[${dayParam}]` : ""}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Kurzy.cz API status ${response.status}`);
  }
  const data = await response.json();
  const rates = new Map([[BASE_CURRENCY, 1]]);
  const source = data?.kurzy || data?.data?.kurzy;
  const entries = Array.isArray(source) ? source : Object.values(source || {});
  entries.forEach((entry) => {
    const code = (entry.kod || entry.code || entry.mena || "").toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(code) || code === BASE_CURRENCY) return;
    const jednotka = Number(entry.jednotka || entry.unit || 1) || 1;
    const raw = entry.dev_stred || entry.kurz || entry.mid || entry.rate;
    if (!raw) return;
    const value = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
    if (Number.isNaN(value) || value <= 0) return;
    rates.set(code, value / jednotka);
  });
  return rates;
}

// Vrátí mapu kurzů pro dané datum; pokud selže API, použije cache/fallback.
async function loadKurzyRates(dateInput) {
  const dateKey = formatDateKey(dateInput);
  if (ratesCache.has(dateKey)) {
    return ratesCache.get(dateKey);
  }
  try {
    const rates = await fetchRatesFromKurzy(dateKey);
    SUPPORTED_CURRENCIES.forEach((currency) => {
      if (!rates.has(currency) && fallbackRates.has(currency)) {
        rates.set(currency, fallbackRates.get(currency));
      }
    });
    ratesCache.set(dateKey, rates);
    return rates;
  } catch (err) {
    console.warn(`Kurzy.cz API (${dateKey}) nedostupné (${err.message}), zkouším aktuální kurz.`);
    try {
      const rates = await fetchRatesFromKurzy(undefined);
      SUPPORTED_CURRENCIES.forEach((currency) => {
        if (!rates.has(currency) && fallbackRates.has(currency)) {
          rates.set(currency, fallbackRates.get(currency));
        }
      });
      ratesCache.set(dateKey, rates);
      return rates;
    } catch (latestErr) {
      console.error("FX API nedostupné, používám fallback kurzy:", latestErr.message);
      if (ratesCache.size > 0) {
        return ratesCache.values().next().value;
      }
      return fallbackRates;
    }
  }
}

function convertWithRates(amount, from, to, rates) {
  const origin = from.toUpperCase();
  const target = to.toUpperCase();
  if (!rates.has(origin) || !rates.has(target)) {
    throw new Error(`Měna ${origin}/${target} není podporovaná.`);
  }
  const originRate = rates.get(origin);
  const targetRate = rates.get(target);
  const amountInCZK = origin === BASE_CURRENCY ? amount : amount * originRate;
  if (target === BASE_CURRENCY) {
    return amountInCZK;
  }
  return amountInCZK / targetRate;
}

async function convertAmount(amount, from, to, dateKey) {
  const rates = await loadKurzyRates(dateKey);
  return convertWithRates(amount, from, to, rates);
}

function convertToCZKWithRates(amount, currency, rates) {
  if (currency === BASE_CURRENCY) return amount;
  try {
    return convertWithRates(amount, currency, BASE_CURRENCY, rates);
  } catch (err) {
    console.warn(`Nelze převést ${currency} -> CZK, vracím původní částku.`, err.message);
    return amount;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token chybí." });
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token je neplatný." });
  }
}

async function resolveAccountIds(userId, raw) {
  const accountsRes = await pool.query(
    "SELECT id FROM user_bank_accounts WHERE user_id = $1",
    [userId]
  );
  const owned = accountsRes.rows.map((row) => row.id);
  if (owned.length === 0) return [];
  if (!raw) return owned;
  const requested = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => owned.includes(value));
  return requested.length > 0 ? requested : owned;
}

async function fetchTransactions(userId, accountIds) {
  if (accountIds.length === 0) return [];
  const result = await pool.query(
    `SELECT t.id, t.account_id, t.occurred_at, t.description, t.currency, t.amount
       FROM transactions t
       JOIN user_bank_accounts uba ON uba.id = t.account_id
      WHERE uba.user_id = $1 AND t.account_id = ANY($2::int[])
      ORDER BY t.occurred_at DESC`,
    [userId, accountIds]
  );
  return result.rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));
}

app.get("/summary", authMiddleware, async (req, res) => {
  try {
    const accountIds = await resolveAccountIds(req.user.id, req.query.accountIds);
    if (accountIds.length === 0) {
      return res.json({ total: 0, income: 0, expenses: 0, balance: 0, count: 0 });
    }
    const transactions = await fetchTransactions(req.user.id, accountIds);
    const groupedByDate = transactions.reduce((acc, tx) => {
      const key = formatDateKey(tx.occurred_at);
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});
    const dateKeys = Object.keys(groupedByDate);
    const rateMap = {};
    await Promise.all(
      dateKeys.map(async (dateKey) => {
        rateMap[dateKey] = await loadKurzyRates(dateKey);
      })
    );
    let income = 0;
    let expenses = 0;
    for (const tx of transactions) {
      const dateKey = formatDateKey(tx.occurred_at);
      const rates = rateMap[dateKey];
      const amountCZK = convertToCZKWithRates(Number(tx.amount), tx.currency, rates);
      if (amountCZK >= 0) {
        income += amountCZK;
      } else {
        expenses += amountCZK;
      }
    }
    const balance = income + expenses;
    res.json({
      total: Math.round(balance * 100) / 100,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      count: transactions.length,
    });
  } catch (err) {
    console.error("Chyba summary", err);
    res.status(500).json({ error: "Nepodařilo se spočítat souhrny." });
  }
});

app.get("/monthly", authMiddleware, async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const accountIds = await resolveAccountIds(req.user.id, req.query.accountIds);
    const transactions = await fetchTransactions(req.user.id, accountIds);
    const months = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 }));
    await Promise.all(
      transactions.map(async (tx) => {
        const date = new Date(tx.occurred_at);
        if (date.getFullYear() !== year) return;
        const dateKey = formatDateKey(date);
        const rates = await loadKurzyRates(dateKey);
        const amountCZK = convertToCZKWithRates(Number(tx.amount), tx.currency, rates);
        const monthIndex = date.getMonth();
        if (amountCZK >= 0) {
          months[monthIndex].income += amountCZK;
        } else {
          months[monthIndex].expenses += Math.abs(amountCZK);
        }
      })
    );
    const payload = months.map((month, index) => ({
      month: index,
      income: Math.round(month.income * 100) / 100,
      expenses: Math.round(month.expenses * 100) / 100,
    }));
    res.json(payload);
  } catch (err) {
    console.error("Chyba monthly", err);
    res.status(500).json({ error: "Nepodařilo se spočítat měsíční data." });
  }
});

app.get("/budgets/status", authMiddleware, async (req, res) => {
  const monthParam = req.query.month;
  const targetDate = monthParam ? new Date(`${monthParam}-01T00:00:00Z`) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: "Neplatný parametr month. Použijte formát YYYY-MM." });
  }
  const year = targetDate.getFullYear();
  const monthIndex = targetDate.getMonth();
  try {
    const accountIds = await resolveAccountIds(req.user.id, req.query.accountIds);
    const transactions = await fetchTransactions(req.user.id, accountIds);
    const totals = {};
    await Promise.all(
      transactions.map(async (tx) => {
        const date = new Date(tx.occurred_at);
        if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return;
        if (Number(tx.amount) >= 0) return;
        const category = tx.metadata?.category;
        if (!category) return;
        const rates = await loadKurzyRates(formatDateKey(date));
        const amountCZK = Math.abs(convertToCZKWithRates(Number(tx.amount), tx.currency, rates));
        totals[category] = (totals[category] || 0) + amountCZK;
      })
    );
    const payload = Object.entries(totals).map(([category, spent]) => ({
      category,
      spent: Math.round(spent * 100) / 100,
    }));
    res.json(payload);
  } catch (err) {
    console.error("Chyba budget status", err);
    res.status(500).json({ error: "Nepodařilo se načíst přehled rozpočtů." });
  }
});

app.get("/convert", async (req, res) => {
  const amount = Number(req.query.amount || 0);
  const from = (req.query.from || "CZK").toUpperCase();
  const to = (req.query.to || "CZK").toUpperCase();
  const dateKey = req.query.date;
  try {
    const result = await convertAmount(amount, from, to, dateKey);
    res.json({ amount, from, to, date: formatDateKey(dateKey), result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use("/api", paypalRouter);

const PORT = process.env.ANALYTICS_SERVICE_PORT || 4001;
app.listen(PORT, () => {
  console.log(`✅ Analytics service běží na http://localhost:${PORT}`);
});
