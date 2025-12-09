import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Divider,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";

import { fetchTransactions } from "../api/banks";
import { useBankContext } from "../context/BankContext";
import { convertAmountToCZK } from "../utils/currency";
import { usePreferences } from "../context/PreferencesContext";

type Transaction = {
  id: string | number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  amountCZK?: number;
};

export default function Transactions() {
  const { accounts, selectedAccountIds, setSelectedAccountIds, loading } = useBankContext();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const theme = useTheme();
  const [pending, setPending] = useState(false);
  const { t, monthNames, language } = usePreferences();

  const accountIdFilter = useMemo(() => {
    if (selectedAccountIds.length === 0 && accounts.length > 0) {
      return accounts.map((acc) => acc.id);
    }
    return selectedAccountIds;
  }, [accounts, selectedAccountIds]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (accounts.length === 0) {
        setTransactions([]);
        return;
      }
      setPending(true);
      try {
        const data = await fetchTransactions(accountIdFilter);
        if (ignore) return;
        const enriched = await Promise.all(
          data.map(async (tx) => {
            const dateKey = new Date(tx.date).toISOString().split("T")[0];
            const amount = Number(tx.amount);
            const amountCZK = await convertAmountToCZK(amount, tx.currency, dateKey);
            return { ...tx, id: tx.id.toString(), amount, amountCZK };
          })
        );
        if (!ignore) {
          setTransactions(enriched);
        }
      } catch (err) {
        console.error("Chyba při načítání transakcí", err);
      } finally {
        if (!ignore) {
          setPending(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [accountIdFilter, accounts.length]);

  if (loading || transactions === null) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (accounts.length === 0) {
    return (
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          {t("transactions.empty")}
        </Typography>
      </Box>
    );
  }

  if (pending) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 6 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t("common.loading")}</Typography>
      </Box>
    );
  }

  const groupedByMonth: { [key: string]: Transaction[] } = {};

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    if (!groupedByMonth[monthYear]) {
      groupedByMonth[monthYear] = [];
    }
    groupedByMonth[monthYear].push(t);
  });

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
    const [ma, ya] = a.split(" ");
    const [mb, yb] = b.split(" ");
    const monthIndex = (m: string) => monthNames.indexOf(m);
    return (
      new Date(parseInt(yb), monthIndex(mb)).getTime() -
      new Date(parseInt(ya), monthIndex(ma)).getTime()
    );
  });

  const locale = language === "cz" ? "cs-CZ" : "en-US";
  const formatAmount = (value: number, currency: string) =>
    `${value >= 0 ? "+" : ""}${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;

  return (
    <Box sx={{ maxWidth: "900px", margin: "0 auto", mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("transactions.title")}
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
        <InputLabel>{t("common.accounts")}</InputLabel>
        <Select
          multiple
          label={t("common.accounts")}
          value={accountIdFilter}
          onChange={(e) => {
            const value = e.target.value;
            const ids = Array.isArray(value) ? value.map((v) => Number(v)) : [];
            setSelectedAccountIds(ids);
          }}
          renderValue={(selected) => {
            const values = selected as number[];
            if (values.length === accounts.length) {
              return t("common.allAccounts");
            }
            return (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {values.map((id) => {
                  const account = accounts.find((acc) => acc.id === id);
                  return account ? <Chip key={id} label={account.alias || account.provider_name} /> : null;
                })}
              </Box>
            );
          }}
        >
          {accounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.alias || account.provider_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Paper elevation={2} sx={{ overflow: "hidden" }}>
        {sortedMonths.map((month) => (
          <Box key={month}>
            <Box
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                px: 2,
                py: 1,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {month}
              </Typography>
            </Box>

            {groupedByMonth[month]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    px: 2,
                    py: 1.2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="body2" sx={{ width: "20%", color: theme.palette.text.secondary }}>
                    {new Date(t.date).toLocaleDateString(locale)}
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{ flexGrow: 1, textAlign: "left", color: theme.palette.text.primary, ml: 2 }}
                  >
                    {t.description}
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      color: t.amount >= 0 ? theme.palette.success.main : theme.palette.error.main,
                      fontWeight: 600,
                      textAlign: "right",
                      width: "30%",
                    }}
                  >
                    {formatAmount(t.amount, t.currency)}
                    {t.currency !== "CZK" && (
                      <Typography
                        variant="caption"
                        component="span"
                        sx={{ display: "block", color: theme.palette.text.secondary }}
                      >
                        ≈ {t.amountCZK?.toLocaleString(locale, { maximumFractionDigits: 2 })} CZK
                      </Typography>
                    )}
                  </Typography>
                </Box>
              ))}

            <Divider />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
