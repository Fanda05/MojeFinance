export type BudgetCategoryKey =
  | "rent"
  | "groceries"
  | "transport"
  | "entertainment"
  | "travel"
  | "education"
  | "health";

export type Budget = {
  id: number;
  categoryKey: BudgetCategoryKey;
  limit: number;
  spent: number;
  customName?: string;
};

export const CATEGORY_DEFS: Record<BudgetCategoryKey, { defaultLimit: number }> = {
  rent: { defaultLimit: 16000 },
  groceries: { defaultLimit: 6000 },
  transport: { defaultLimit: 2500 },
  entertainment: { defaultLimit: 5000 },
  travel: { defaultLimit: 7000 },
  education: { defaultLimit: 3000 },
  health: { defaultLimit: 2000 },
};

const ADMIN_DEFAULT_BUDGETS: Budget[] = [
  { id: 1, categoryKey: "rent", limit: 16000, spent: 0 },
  { id: 2, categoryKey: "groceries", limit: 6000, spent: 0 },
  { id: 3, categoryKey: "transport", limit: 2500, spent: 0 },
  { id: 4, categoryKey: "entertainment", limit: 5500, spent: 0 },
  { id: 5, categoryKey: "travel", limit: 8000, spent: 0 },
  { id: 6, categoryKey: "education", limit: 3200, spent: 0 },
  { id: 7, categoryKey: "health", limit: 1800, spent: 0 },
];

const getUserInfo = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch (err) {
    return null;
  }
};

const getStorageKey = () => {
  const user = getUserInfo();
  return `budgets_${user?.id ?? "default"}`;
};

const readStore = () => {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(getStorageKey());
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return { __legacy: parsed };
    }
    return parsed;
  } catch (err) {
    console.warn("Nelze načíst rozpočty ze storage", err);
    return {};
  }
};

const writeStore = (data: Record<string, Budget[]>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(), JSON.stringify(data));
};

const getDefaultBudgets = (): Budget[] => {
  const user = getUserInfo();
  if (user?.username === "admin") {
    return ADMIN_DEFAULT_BUDGETS;
  }
  return [];
};

export const getMonthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

const cloneBudgets = (budgets: Budget[]) => budgets.map((budget) => ({ ...budget }));

export const loadBudgets = (monthKey: string): Budget[] => {
  const store = readStore();
  if (store.__legacy) {
    const legacy = cloneBudgets(store.__legacy);
    delete store.__legacy;
    store[monthKey] = legacy;
    writeStore(store);
    return legacy;
  }
  if (!store[monthKey] || store[monthKey].length === 0) {
    const defaults = cloneBudgets(getDefaultBudgets());
    store[monthKey] = defaults;
    writeStore(store);
    return defaults;
  }
  return store[monthKey];
};

export const saveBudgets = (monthKey: string, budgets: Budget[]) => {
  const store = readStore();
  store[monthKey] = budgets;
  delete store.__legacy;
  writeStore(store);
};

export const getAvailableCategoryKeys = (current: Budget[]): BudgetCategoryKey[] => {
  const taken = new Set(current.map((b) => b.categoryKey));
  return (Object.keys(CATEGORY_DEFS) as BudgetCategoryKey[]).filter((key) => !taken.has(key));
};
