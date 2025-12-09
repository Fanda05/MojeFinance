import axios from "axios";
import { analyticsClient } from "./http";

type Summary = {
  total: number;
  income: number;
  expenses: number;
  balance: number;
  count: number;
};

export type MonthlyPoint = {
  month: number;
  income: number;
  expenses: number;
};

export type BudgetStatus = {
  category: string;
  spent: number;
};

const buildParams = (accountIds?: number[]) =>
  accountIds && accountIds.length > 0 ? { accountIds: accountIds.join(",") } : undefined;

export const fetchSummary = async (accountIds?: number[]): Promise<Summary> => {
  const { data } = await analyticsClient.get<Summary>("/summary", { params: buildParams(accountIds) });
  return data;
};

export const fetchMonthly = async (accountIds?: number[]): Promise<MonthlyPoint[]> => {
  const { data } = await analyticsClient.get<MonthlyPoint[]>("/monthly", { params: buildParams(accountIds) });
  return data;
};

export const fetchBudgetStatus = async (month: string, accountIds?: number[]): Promise<BudgetStatus[]> => {
  const params: any = { month };
  if (accountIds && accountIds.length > 0) {
    params.accountIds = accountIds.join(",");
  }
  const { data } = await analyticsClient.get<BudgetStatus[]>("/budgets/status", { params });
  return data;
};

export const fetchCnbRateEur = async (): Promise<number | null> => {
  try {
    const res = await axios.get("https://api.cnb.cz/cnbapi/exrates/daily?lang=cz");
    const eur = res.data?.rates?.find((r: any) => r.code === "EUR");
    return eur?.rate ? Number(eur.rate) : null;
  } catch (err) {
    console.error("Chyba při načítání kurzu z ČNB:", err);
    return null;
  }
};
