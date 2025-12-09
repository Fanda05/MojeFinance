import { getAccessToken, PAYPAL_BASE_URL } from "./paypalClient.js";

// Volá PayPal Transaction Search API pro náš účet a vrací raw JSON.
export async function listTransactions({ startDate, endDate, pageSize = 100, transactionStatus, transactionType }) {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    page_size: String(pageSize),
  });
  if (transactionStatus) params.set("transaction_status", transactionStatus);
  if (transactionType) params.set("transaction_type", transactionType);

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/reporting/transactions?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list PayPal transactions: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getAccountBalance() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const data = await listTransactions({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  return data.ending_balance || null;
}
