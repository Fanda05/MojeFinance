import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { ChartOptions } from "chart.js";
import { fetchSummary, fetchMonthly, fetchBudgetStatus, type MonthlyPoint } from "../api/analytics";
import { useBankContext } from "../context/BankContext";
import { loadBudgets } from "../utils/budgets";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { usePreferences } from "../context/PreferencesContext";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type SummaryData = {
  total: number;
  income: number;
  expenses: number;
  balance: number;
  count: number;
};

type CardProps = {
  title: string;
  value: string;
  icon: JSX.Element;
  color: string;
};

function DashboardCard({ title, value, icon, color }: CardProps) {
  return (
    <Card sx={{ display: "flex", alignItems: "center", px: 2, py: 3 }}>
      <div style={{ color, marginRight: 16 }}>{icon}</div>
      <CardContent sx={{ padding: 0 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h6">{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { accounts, selectedAccountIds, setSelectedAccountIds, loading } = useBankContext();
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([]);
  const [pending, setPending] = useState(false);
  const { t, monthNames, language } = usePreferences();
  const navigate = useNavigate();
  const [budgetAlerts, setBudgetAlerts] = useState<
    { id: string; categoryKey: string; level: "error" | "warning"; message: string }[]
  >([]);
  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(`budgetAlerts_${monthKey}`) || "[]");
    } catch (err) {
      return [];
    }
  });

  const accountIdFilter = useMemo(() => {
    if (selectedAccountIds.length === 0 && accounts.length > 0) {
      return accounts.map((acc) => acc.id);
    }
    return selectedAccountIds;
  }, [accounts, selectedAccountIds]);

  const dismissAlert = (id: string) => {
    setBudgetAlerts((prev) => prev.filter((alert) => alert.id !== id));
    setDismissedAlertIds((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`budgetAlerts_${monthKey}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (accounts.length === 0) {
        setSummaryData(null);
        setMonthlyData([]);
        return;
      }
      setPending(true);
      try {
        const [summary, monthly] = await Promise.all([
          fetchSummary(accountIdFilter),
          fetchMonthly(accountIdFilter),
        ]);
        if (!ignore) {
          setSummaryData(summary);
          setMonthlyData(monthly);
        }
      } catch (err) {
        console.error("Chyba při načítání přehledu", err);
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

  useEffect(() => {
    if (accounts.length === 0 || typeof window === "undefined") {
      setBudgetAlerts([]);
      return;
    }
    let ignore = false;
    fetchBudgetStatus(monthKey, accountIdFilter)
      .then((statuses) => {
        if (ignore) return;
        const budgets = loadBudgets(monthKey);
        const alerts = statuses.reduce(
          (acc, status) => {
            const budget = budgets.find((b) => b.categoryKey === status.category);
            if (!budget || !budget.limit) {
              return acc;
            }
            const ratio = status.spent / budget.limit;
            const amountOver = Math.max(0, status.spent - budget.limit);
            const percent = Math.round(ratio * 100);
            if (ratio >= 1) {
              acc.push({
                id: `${status.category}-error-${monthKey}`,
                categoryKey: status.category,
                level: "error",
                message: t("dashboard.alerts.exceeded", {
                  category: t(`categories.${status.category}`),
                  amount: amountOver.toFixed(0),
                }),
              });
            }
            if (ratio >= 0.85) {
              acc.push({
                id: `${status.category}-warn-${monthKey}`,
                categoryKey: status.category,
                level: "warning",
                message: t("dashboard.alerts.warning", {
                  category: t(`categories.${status.category}`),
                  percent,
                }),
              });
            }
            return acc;
          },
          [] as { id: string; categoryKey: string; level: "error" | "warning"; message: string }[]
        );
        const filtered = alerts.filter((alert) => !dismissedAlertIds.includes(alert.id));
        setBudgetAlerts(filtered);
      })
      .catch((err) => console.error("Budget alerts failed", err));
    return () => {
      ignore = true;
    };
  }, [accountIdFilter, accounts.length, monthKey, dismissedAlertIds, t]);

  if (loading || (accounts.length > 0 && pending)) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 6 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t("common.loading")}</Typography>
      </Box>
    );
  }

  if (!summaryData) {
    return (
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          {t("common.addBankPrompt")}
        </Typography>
      </Box>
    );
  }

  const { income, expenses, balance, count } = summaryData;
  const locale = language === "cz" ? "cs-CZ" : "en-US";
  const formatCurrency = (amount: number) =>
    `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} Kč`;

  const incomeData = new Array(12).fill(0);
  const expenseData = new Array(12).fill(0);
  monthlyData.forEach((item) => {
    incomeData[item.month] = item.income;
    expenseData[item.month] = item.expenses;
  });

  const currentYear = new Date().getFullYear();
  const chartData = {
    labels: monthNames,
    datasets: [
      {
        label: t("dashboard.income"),
        data: incomeData,
        backgroundColor: "#2e7d32",
      },
      {
        label: t("dashboard.expenses"),
        data: expenseData,
        backgroundColor: "#d32f2f",
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    plugins: { legend: { position: "bottom" } },
    scales: {
      y: {
        ticks: {
          callback(value: any) {
            return value.toLocaleString(locale);
          },
        },
      },
    },
  };

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("dashboard.title")}
      </Typography>

      {budgetAlerts.length > 0 && (
        <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          {budgetAlerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.level}
              action={
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
              sx={{ cursor: "pointer" }}
              onClick={() => navigate("/budgets", { state: { focusCategory: alert.categoryKey } })}
            >
              {alert.message}
            </Alert>
          ))}
        </Box>
      )}

      <Box sx={{ maxWidth: "1000px", margin: "0 auto", mb: 4 }}>
        <FormControl fullWidth size="small">
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
      </Box>

      <Box sx={{ maxWidth: "1000px", margin: "0 auto", mt: 4 }}>
        <Grid container spacing={3}>
          <Grid sx={{ flexBasis: "23%", maxWidth: "23%" }}>
            <DashboardCard
              title={t("dashboard.balance")}
              value={formatCurrency(balance)}
              icon={<AccountBalanceIcon fontSize="large" />}
              color="#1976d2"
            />
          </Grid>
          <Grid sx={{ flexBasis: "23%", maxWidth: "23%" }}>
            <DashboardCard
              title={t("dashboard.income")}
              value={formatCurrency(income)}
              icon={<TrendingUpIcon fontSize="large" />}
              color="#2e7d32"
            />
          </Grid>
          <Grid sx={{ flexBasis: "23%", maxWidth: "23%" }}>
            <DashboardCard
              title={t("dashboard.expenses")}
              value={formatCurrency(Math.abs(expenses))}
              icon={<TrendingDownIcon fontSize="large" />}
              color="#d32f2f"
            />
          </Grid>
          <Grid sx={{ flexBasis: "23%", maxWidth: "23%" }}>
            <DashboardCard
              title={t("dashboard.transactions")}
              value={count.toString()}
              icon={<ReceiptLongIcon fontSize="large" />}
              color="#9c27b0"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" gutterBottom>
            {t("dashboard.chartTitle", { year: currentYear.toString() })}
          </Typography>
          <Bar data={chartData} options={chartOptions} />
        </Box>
      </Box>
    </>
  );
}
