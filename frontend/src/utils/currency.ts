import { analyticsClient } from "../api/http";

const rateCache = new Map<string, number>();

function getDateKey(date: string | Date) {
  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }
  return date?.split("T")[0] || new Date().toISOString().split("T")[0];
}

export async function getRateToCZK(currency: string, date: string | Date) {
  if (currency === "CZK") return 1;
  const key = `${currency}-${getDateKey(date)}`;
  if (rateCache.has(key)) {
    return rateCache.get(key)!;
  }
  const { data } = await analyticsClient.get("/convert", {
    params: { amount: 1, from: currency, to: "CZK", date: getDateKey(date) },
  });
  rateCache.set(key, data.result);
  return data.result;
}

export async function convertAmountToCZK(amount: number, currency: string, date: string | Date) {
  if (currency === "CZK") return amount;
  const rate = await getRateToCZK(currency, date);
  return Number((rate * amount).toFixed(2));
}
