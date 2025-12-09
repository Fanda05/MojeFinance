import express from "express";
import { listTransactions, getAccountBalance } from "../services/paypalReporting.js";

const router = express.Router();

router.get("/paypal/transactions", async (req, res) => {
  try {
    const { from, to, status, type, pageSize } = req.query;

    const start = from ? new Date(`${from}T00:00:00Z`) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(`${to}T23:59:59Z`) : new Date();

    const data = await listTransactions({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      pageSize: pageSize ? Number(pageSize) : undefined,
      transactionStatus: status,
      transactionType: type,
    });

    res.json(data);
  } catch (error) {
    console.error("PayPal transactions failed:", error);
    res.status(500).json({ error: "Failed to load PayPal transactions" });
  }
});

router.get("/paypal/balance", async (req, res) => {
  try {
    const balance = await getAccountBalance();
    res.json({ balance });
  } catch (error) {
    console.error("PayPal balance failed:", error);
    res.status(500).json({ error: "Failed to load PayPal balance" });
  }
});

export default router;
