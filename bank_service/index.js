const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const fetch = require("node-fetch");
require("dotenv").config(); // načte .env, pokud existuje

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/finance_db",
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Přihlášení je vyžadováno." });
  }
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token je neplatný." });
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/banks/providers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, name, provider_type FROM bank_providers ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Chyba při načítání providerů", err);
    res.status(500).json({ error: "Nepodařilo se načíst seznam bank." });
  }
});

app.get("/banks/accounts", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uba.id, uba.alias, uba.currency, uba.external_account_id, uba.created_at,
              bp.name AS provider_name, bp.code AS provider_code
         FROM user_bank_accounts uba
         JOIN bank_providers bp ON bp.id = uba.provider_id
        WHERE uba.user_id = $1
        ORDER BY uba.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Chyba při získávání účtů", err);
    res.status(500).json({ error: "Nepodařilo se načíst bankovní účty." });
  }
});

app.post("/banks/accounts", authMiddleware, async (req, res) => {
  const { providerCode, alias } = req.body;
  if (!providerCode) {
    return res.status(400).json({ error: "providerCode je povinný." });
  }
  try {
    const providerResult = await pool.query(
      "SELECT id, code, name, provider_type FROM bank_providers WHERE code = $1",
      [providerCode]
    );
    if (providerResult.rowCount === 0) {
      return res.status(404).json({ error: "Banka nebyla nalezena." });
    }
    const provider = providerResult.rows[0];

    const externalAccountId = `${provider.code}-${Date.now()}`;
    const accountResult = await pool.query(
      `INSERT INTO user_bank_accounts (user_id, provider_id, external_account_id, alias)
       VALUES ($1, $2, $3, $4) RETURNING id, alias, currency, external_account_id, created_at`,
      [req.user.id, provider.id, externalAccountId, alias || provider.name]
    );

    const account = accountResult.rows[0];
    if (provider.code === "paypal") {
      await seedPaypalTransactions(account.id);
    } else if (provider.provider_type === "real") {
      return res.status(501).json({
        error:
          "Reálné banky nejsou bez PSD2 certifikace dostupné. Připojte prosím zatím mock banku.",
      });
    } else {
      await seedMockTransactions(account.id, provider.code);
    }

    res.status(201).json({
      account: {
        ...account,
        provider_name: provider.name,
        provider_code: provider.code,
      },
      seeded: true,
    });
  } catch (err) {
    console.error("Chyba při vytváření účtu", err);
    res.status(500).json({ error: "Nepodařilo se přidat banku." });
  }
});

app.delete("/banks/accounts/:id", authMiddleware, async (req, res) => {
  const accountId = Number(req.params.id);
  if (Number.isNaN(accountId)) {
    return res.status(400).json({ error: "Neplatné ID účtu." });
  }
  try {
    const ownership = await pool.query(
      "SELECT id FROM user_bank_accounts WHERE id = $1 AND user_id = $2",
      [accountId, req.user.id]
    );
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Účet nebyl nalezen." });
    }
    await pool.query("DELETE FROM user_bank_accounts WHERE id = $1", [accountId]);
    res.json({ message: "Účet byl odstraněn." });
  } catch (err) {
    console.error("Chyba při mazání účtu", err);
    res.status(500).json({ error: "Nepodařilo se odstranit banku." });
  }
});

app.get("/transactions", authMiddleware, async (req, res) => {
  const { accountIds } = req.query;
  try {
    const ownedAccounts = await pool.query(
      "SELECT id FROM user_bank_accounts WHERE user_id = $1",
      [req.user.id]
    );
    const accountIdList = ownedAccounts.rows.map((row) => row.id);
    if (accountIdList.length === 0) {
      return res.json([]);
    }
    let filterIds = accountIdList;
    if (accountIds) {
      const requested = accountIds
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => accountIdList.includes(id));
      if (requested.length > 0) {
        filterIds = requested;
      }
    }
    const result = await pool.query(
      `SELECT t.id,
              t.account_id,
              t.occurred_at AS date,
              t.description,
              t.currency,
              t.amount,
              t.metadata,
              uba.alias,
              bp.name AS bank
         FROM transactions t
         JOIN user_bank_accounts uba ON uba.id = t.account_id
         JOIN bank_providers bp ON bp.id = uba.provider_id
        WHERE t.account_id = ANY($1::int[])
        ORDER BY t.occurred_at DESC`,
      [filterIds]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Chyba při načítání transakcí", err);
    res.status(500).json({ error: "Nepodařilo se načíst transakce." });
  }
});

const incomeTemplates = [
  { key: "salary", description: "Výplata", currency: "CZK", min: 32000, max: 42000, fixedDay: 5 },
  { key: "bonus", description: "Bonus", currency: "CZK", min: 4000, max: 9000 },
  { key: "freelance", description: "Freelance projekt", currency: "EUR", min: 250, max: 600 },
  { key: "rent_income", description: "Pronájem", currency: "CZK", min: 6000, max: 12000 },
  { key: "dividends", description: "Dividendy", currency: "CZK", min: 2000, max: 5000 },
];

const expenseTemplates = [
  { key: "rent", description: "Platba nájem", currency: "CZK", min: 12000, max: 16000, fixedDay: 12 },
  { key: "groceries", description: "Potraviny a domácnost", currency: "CZK", min: 3500, max: 7500 },
  { key: "transport", description: "Doprava a palivo", currency: "CZK", min: 800, max: 1800 },
  { key: "entertainment", description: "Stravování a zábava", currency: "CZK", min: 1500, max: 4500 },
  { key: "travel", description: "Cestování (EUR)", currency: "EUR", min: 100, max: 280 },
  { key: "education", description: "Vzdělání a rozvoj", currency: "CZK", min: 800, max: 2500 },
  { key: "health", description: "Zdraví a péče", currency: "CZK", min: 700, max: 2000 },
];

function randomAmount(template) {
  const amount = template.min + Math.random() * (template.max - template.min);
  return Number(amount.toFixed(2));
}

function pickTemplates(list, count, excludeKeys = []) {
  const available = list.filter((item) => !excludeKeys.includes(item.key));
  const shuffled = available.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function seedMockTransactions(accountId, providerCode) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const entries = [];

  for (let month = 0; month < 12; month += 1) {
    const incomesTarget = Math.floor(Math.random() * 3) + 3; // 3-5
    const expensesTarget = Math.floor(Math.random() * 3) + 3; // 3-5

    const baseIncomeTemplates = [incomeTemplates[0]]; // salary always
    const additionalIncome = pickTemplates(incomeTemplates.slice(1), incomesTarget - 1);
    const monthIncomeTemplates = [...baseIncomeTemplates, ...additionalIncome];

    monthIncomeTemplates.forEach((template, index) => {
      const day =
        template.fixedDay ||
        Math.min(27, 3 + Math.floor(Math.random() * 24)) + (index % 2 === 0 ? 0 : 1);
      entries.push({
        account_id: accountId,
        occurred_at: new Date(Date.UTC(currentYear, month, day)),
        description: `Příjem - ${template.description}`,
        currency: template.currency,
        amount: randomAmount(template),
        source: "mock",
        metadata: { month, kind: "income", category: template.key },
      });
    });

    const baseExpenseTemplates = [expenseTemplates[0]]; // rent always
    const additionalExpenses = pickTemplates(expenseTemplates.slice(1), expensesTarget - 1);
    const monthExpenseTemplates = [...baseExpenseTemplates, ...additionalExpenses];

    monthExpenseTemplates.forEach((template, index) => {
      const day =
        template.fixedDay ||
        Math.min(28, 10 + Math.floor(Math.random() * 18)) + (index % 2 === 0 ? 0 : 1);
      entries.push({
        account_id: accountId,
        occurred_at: new Date(Date.UTC(currentYear, month, day)),
        description: `Výdaj - ${template.description}`,
        currency: template.currency,
        amount: Number((-randomAmount(template)).toFixed(2)),
        source: "mock",
        metadata: { month, kind: "expense", category: template.key },
      });
    });
  }

  for (const entry of entries) {
    await pool.query(
      `INSERT INTO transactions (account_id, occurred_at, description, currency, amount, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.account_id,
        entry.occurred_at,
        entry.description,
        entry.currency,
        entry.amount,
        entry.source,
        JSON.stringify(entry.metadata),
      ]
    );
  }
}

const PAYPAL_SAMPLE_TRANSACTIONS = [
  {
    description: "PayPal - Subscription",
    occurred_at: "2025-01-12T08:00:00Z",
    amount: -18.5,
    currency: "EUR",
    category: "entertainment",
  },
  {
    description: "PayPal - Grocery Market",
    occurred_at: "2025-02-06T09:30:00Z",
    amount: -62.4,
    currency: "EUR",
    category: "groceries",
  },
  {
    description: "PayPal - Fuel",
    occurred_at: "2025-03-15T07:20:00Z",
    amount: -38.2,
    currency: "EUR",
    category: "transport",
  },
  {
    description: "PayPal - Freelance payout",
    occurred_at: "2025-04-10T12:10:00Z",
    amount: 420,
    currency: "EUR",
    category: "freelance",
  },
];

async function fetchPaypalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error("Chybí PayPal přihlašovací údaje.");
  }
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`PayPal token selhal (${response.status})`);
  }
  const data = await response.json();
  return data.access_token;
}

function mapPaypalCategory(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("rent")) return "rent";
  if (lower.includes("fuel") || lower.includes("uber") || lower.includes("transport")) return "transport";
  if (lower.includes("grocery") || lower.includes("market")) return "groceries";
  if (lower.includes("subscription") || lower.includes("netflix") || lower.includes("spotify")) return "entertainment";
  if (lower.includes("travel") || lower.includes("hotel") || lower.includes("airbnb")) return "travel";
  if (lower.includes("course") || lower.includes("education")) return "education";
  if (lower.includes("clinic") || lower.includes("health")) return "health";
  return "entertainment";
}

async function fetchPaypalTransactionsFromApi() {
  const token = await fetchPaypalAccessToken();
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const qs = new URLSearchParams({
    start_date: start.toISOString().slice(0, 19) + "Z",
    end_date: end.toISOString().slice(0, 19) + "Z",
    fields: "all",
    page_size: "100",
  });
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/reporting/transactions?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`PayPal API selhalo (${response.status})`);
  }
  const data = await response.json();
  if (!data.transaction_details) {
    return PAYPAL_SAMPLE_TRANSACTIONS;
  }
  return data.transaction_details.map((detail) => {
    const info = detail.transaction_info || {};
    const amountInfo = info.transaction_amount || {};
    const value = Number(amountInfo.value || 0);
    const currency = amountInfo.currency_code || "EUR";
    const description =
      info.transaction_subject ||
      detail.payer_info?.payer_name?.given_name ||
      info.transaction_event_code ||
      "PayPal transakce";
    const category = mapPaypalCategory(description);
    const occurred_at =
      info.transaction_initiation_date ||
      info.transaction_updated_date ||
      new Date().toISOString();
    return {
      description,
      occurred_at,
      amount: value,
      currency,
      category,
    };
  });
}

async function seedPaypalTransactions(accountId) {
  let transactions = PAYPAL_SAMPLE_TRANSACTIONS;
  if (PAYPAL_CLIENT_ID && PAYPAL_SECRET) {
    try {
      transactions = await fetchPaypalTransactionsFromApi();
    } catch (err) {
      console.warn("PayPal API selhalo, používám ukázková data:", err.message);
    }
  }
  for (const tx of transactions) {
    await pool.query(
      `INSERT INTO transactions (account_id, occurred_at, description, currency, amount, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        accountId,
        new Date(tx.occurred_at),
        `PayPal - ${tx.description}`,
        tx.currency,
        tx.amount,
        PAYPAL_CLIENT_ID ? "paypal_api" : "paypal_mock",
        JSON.stringify({ category: tx.category || "entertainment" }),
      ]
    );
  }
}

const PORT = process.env.BANK_SERVICE_PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Bank service běží na http://localhost:${PORT}`);
});
