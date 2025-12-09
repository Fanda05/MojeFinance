import { bankClient } from "./http";

export type BankProvider = {
  id: number;
  code: string;
  name: string;
  provider_type: "real" | "mock" | string;
};

export type BankAccount = {
  id: number;
  alias: string;
  currency: string;
  external_account_id: string;
  provider_name: string;
  provider_code: string;
  created_at: string;
};

export type Transaction = {
  id: number;
  account_id: number;
  date: string;
  description: string;
  currency: string;
  amount: number;
  alias: string;
  bank: string;
  metadata?: { category?: string };
};

export async function fetchProviders() {
  const { data } = await bankClient.get<BankProvider[]>("/banks/providers");
  return data;
}

export async function fetchAccounts() {
  const { data } = await bankClient.get<BankAccount[]>("/banks/accounts");
  return data;
}

export async function connectAccount(providerCode: string, alias?: string) {
  const { data } = await bankClient.post("/banks/accounts", { providerCode, alias });
  return data;
}

export async function removeAccount(accountId: number) {
  const { data } = await bankClient.delete(`/banks/accounts/${accountId}`);
  return data;
}

export async function fetchTransactions(accountIds?: number[]) {
  const params = accountIds && accountIds.length > 0 ? { accountIds: accountIds.join(",") } : undefined;
  const { data } = await bankClient.get<Transaction[]>("/transactions", { params });
  return data;
}
