import { createContext, useContext, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { BankAccount } from "../api/banks";
import { fetchAccounts } from "../api/banks";
import { isAuthenticated } from "../api/http";

type BankContextType = {
  accounts: BankAccount[];
  loading: boolean;
  selectedAccountIds: number[];
  setSelectedAccountIds: (ids: number[]) => void;
  refreshAccounts: () => Promise<void>;
};

const BankContext = createContext<BankContextType | undefined>(undefined);

export function BankProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);

  const loadAccounts = useCallback(async () => {
    if (!isAuthenticated()) {
      setAccounts([]);
      setSelectedAccountIds([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAccounts();
      setAccounts(data);
      setSelectedAccountIds((current) => {
        if (data.length === 0) {
          return [];
        }
        if (current.length === 0) {
          return data.map((account) => account.id);
        }
        const stillValid = current.filter((id) => data.some((acc) => acc.id === id));
        return stillValid.length > 0 ? stillValid : data.map((acc) => acc.id);
      });
    } catch (err) {
      console.error("Chyba při načítání účtů", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const value: BankContextType = {
    accounts,
    loading,
    selectedAccountIds,
    setSelectedAccountIds,
    refreshAccounts: loadAccounts,
  };

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export const useBankContext = () => {
  const context = useContext(BankContext);
  if (!context) {
    throw new Error("useBankContext musí být použit uvnitř BankProvider");
  }
  return context;
};
