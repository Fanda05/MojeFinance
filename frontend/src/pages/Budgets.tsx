import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Button,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useTheme } from "@mui/material/styles";

import { fetchTransactions, type Transaction } from "../api/banks";
import { useBankContext } from "../context/BankContext";
import { useLocation, useNavigate } from "react-router-dom";
import { usePreferences } from "../context/PreferencesContext";
import {
  CATEGORY_DEFS,
  getAvailableCategoryKeys,
  loadBudgets,
  saveBudgets,
  getMonthKey,
  type Budget as StoredBudget,
  type BudgetCategoryKey,
} from "../utils/budgets";
import { convertAmountToCZK } from "../utils/currency";
import DeleteIcon from "@mui/icons-material/Delete";

type Budget = StoredBudget & { customName?: string };

type EnrichedTransaction = Transaction & { amountCZK?: number };

export default function Budgets() {
  const { accounts, selectedAccountIds, setSelectedAccountIds, loading } = useBankContext();
  const theme = useTheme();
  const [transactionsInCZK, setTransactionsInCZK] = useState<EnrichedTransaction[] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [lastMonth, setLastMonth] = useState<number | null>(null);
  const [lastYear, setLastYear] = useState<number | null>(null);
  const [firstMonth, setFirstMonth] = useState<number | null>(null);
  const [firstYear, setFirstYear] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => {
    const now = new Date();
    return getMonthKey(now.getFullYear(), now.getMonth());
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editDialog, setEditDialog] = useState<{ open: boolean; id: number | null; name: string; limit: string }>({
    open: false,
    id: null,
    name: "",
    limit: "",
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState<BudgetCategoryKey | "">("");
  const [newCategoryLimit, setNewCategoryLimit] = useState<string>("");
  const { t, monthNames, themeKey } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  const accountIdFilter = useMemo(() => {
    if (selectedAccountIds.length === 0 && accounts.length > 0) {
      return accounts.map((acc) => acc.id);
    }
    return selectedAccountIds;
  }, [accounts, selectedAccountIds]);

  const availableCategoryKeys = useMemo(
    () => getAvailableCategoryKeys(budgets),
    [budgets]
  );
  const getBudgetLabel = (budget: Budget) =>
    budget.customName?.trim() || t(`categories.${budget.categoryKey}`);

useEffect(() => {
  let ignore = false;
    const loadTransactions = async () => {
      if (accounts.length === 0) {
        setTransactionsInCZK([]);
        return;
      }
      setPending(true);
      try {
        const data = await fetchTransactions(accountIdFilter);
        if (ignore) return;
        if (data.length > 0) {
          const dates = data.map((t) => new Date(t.date).getTime());
          const lastDate = new Date(Math.max(...dates));
          const firstDate = new Date(Math.min(...dates));
          setSelectedMonth(lastDate.getMonth());
          setSelectedYear(lastDate.getFullYear());
          setLastMonth(lastDate.getMonth());
          setLastYear(lastDate.getFullYear());
          setFirstMonth(firstDate.getMonth());
          setFirstYear(firstDate.getFullYear());
        } else {
          setSelectedMonth(null);
          setSelectedYear(null);
          setLastMonth(null);
          setLastYear(null);
          setFirstMonth(null);
          setFirstYear(null);
        }
        const convertedTransactions: EnrichedTransaction[] = await Promise.all(
          data.map(async (t) => {
            const amountCZK = await convertAmountToCZK(t.amount, t.currency, t.date);
            return { ...t, amountCZK };
          })
        );
        if (!ignore) {
          setTransactionsInCZK(convertedTransactions);
        }
      } catch (err) {
        console.error("Chyba při načítání transakcí pro rozpočty:", err);
      } finally {
        if (!ignore) {
          setPending(false);
        }
      }
    };
    loadTransactions();
    return () => {
      ignore = true;
    };
}, [accountIdFilter, accounts.length]);

  useEffect(() => {
    const focusCategory = (location.state as any)?.focusCategory;
    if (focusCategory) {
      setFocusedCategory(focusCategory);
      navigate(location.pathname, { replace: true });
      const timeout = setTimeout(() => setFocusedCategory(null), 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [location, navigate]);

  const filteredTransactions = useMemo(() => {
    if (!transactionsInCZK || selectedMonth === null || selectedYear === null) return [];
    return transactionsInCZK.filter((t) => {
      const date = new Date(t.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [transactionsInCZK, selectedMonth, selectedYear]);

  const spendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions
      .filter((t) => Number(t.amount) < 0 && t.metadata?.category)
      .forEach((t) => {
        const category = t.metadata?.category as string;
        const amountCZK = Math.abs(t.amountCZK ?? Number(t.amount));
        map[category] = (map[category] || 0) + amountCZK;
      });
    Object.keys(map).forEach((key) => {
      map[key] = Math.round(map[key] * 100) / 100;
    });
    return map;
  }, [filteredTransactions]);

  const applySpent = useMemo(
    () => (list: Budget[]) =>
      list.map((budget) => {
        const spent = spendingMap[budget.categoryKey] || 0;
        if (spent === budget.spent) {
          return budget;
        }
        return { ...budget, spent };
      }),
    [spendingMap]
  );

  useEffect(() => {
    setBudgets(applySpent(loadBudgets(activeMonthKey)));
  }, [activeMonthKey, applySpent]);

  useEffect(() => {
    setBudgets((current) => applySpent(current));
  }, [applySpent]);

  const updateBudgets = (updater: (prev: Budget[]) => Budget[]) => {
    setBudgets((prev) => {
      const next = applySpent(updater(prev));
      saveBudgets(activeMonthKey, next);
      return next;
    });
  };

  const openEditDialog = (budget: Budget) => {
    setEditDialog({
      open: true,
      id: budget.id,
      name: budget.customName || "",
      limit: budget.limit.toString(),
    });
  };

  const closeEditDialog = () => {
    setEditDialog({ open: false, id: null, name: "", limit: "" });
  };

  const handleSaveBudget = () => {
    if (editDialog.id === null) {
      closeEditDialog();
      return;
    }
    const numericLimit = Number(editDialog.limit);
    updateBudgets((current) =>
      current.map((budget) =>
        budget.id === editDialog.id
          ? {
              ...budget,
              customName: editDialog.name.trim() || undefined,
              limit: Number.isNaN(numericLimit) || numericLimit <= 0 ? budget.limit : numericLimit,
            }
          : budget
      )
    );
    closeEditDialog();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === null || selectedYear === null) return;
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === null || selectedYear === null || lastMonth === null || lastYear === null) return;
    if (selectedYear > lastYear || (selectedYear === lastYear && selectedMonth >= lastMonth)) {
      return;
    }
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  useEffect(() => {
    if (selectedMonth === null || selectedYear === null) return;
    const key = getMonthKey(selectedYear, selectedMonth);
    setActiveMonthKey(key);
  }, [selectedMonth, selectedYear]);

  const handleDeleteBudget = (id: number) => {
    updateBudgets((current) => current.filter((budget) => budget.id !== id));
  };

  const openAddDialog = () => {
    const firstAvailable = availableCategoryKeys[0] || "";
    setNewCategoryKey(firstAvailable);
    setNewCategoryLimit(
      firstAvailable ? CATEGORY_DEFS[firstAvailable].defaultLimit.toString() : ""
    );
    setAddDialogOpen(true);
  };

  const handleAddCategory = () => {
    if (!newCategoryKey) return;
    const numericLimit = Number(newCategoryLimit);
    updateBudgets((current) => [
      ...current,
      {
        id: Date.now(),
        categoryKey: newCategoryKey,
        limit:
          Number.isNaN(numericLimit) || numericLimit <= 0
            ? CATEGORY_DEFS[newCategoryKey].defaultLimit
            : numericLimit,
        spent: 0,
      },
    ]);
    setAddDialogOpen(false);
    setNewCategoryKey("");
    setNewCategoryLimit("");
  };

  const isNextDisabled =
    lastMonth !== null &&
    lastYear !== null &&
    selectedMonth !== null &&
    selectedYear !== null &&
    (selectedYear > lastYear || (selectedYear === lastYear && selectedMonth >= lastMonth));

  const isPrevDisabled =
    firstMonth !== null &&
    firstYear !== null &&
    selectedMonth !== null &&
    selectedYear !== null &&
    (selectedYear < firstYear || (selectedYear === firstYear && selectedMonth <= firstMonth));

  if (loading || pending) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 6 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t("common.loading")}</Typography>
      </Box>
    );
  }

  if (accounts.length === 0) {
    return (
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          {t("common.addBankPrompt")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: "1000px", margin: "0 auto", mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("budgets.title")}
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddCircleOutlineIcon />}
          onClick={openAddDialog}
          disabled={availableCategoryKeys.length === 0}
        >
          {t("budgets.add")}
        </Button>
      </Box>

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

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <IconButton onClick={handlePrevMonth} disabled={isPrevDisabled}>
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h6">
          {selectedMonth !== null && selectedYear !== null
            ? `${monthNames[selectedMonth]} ${selectedYear}`
            : t("common.loading")}
        </Typography>
        <IconButton onClick={handleNextMonth} disabled={isNextDisabled}>
          <ArrowForwardIosIcon />
        </IconButton>
      </Box>

      {budgets.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          {t("budgets.empty")}
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          {budgets.map((budget) => {
            const label = getBudgetLabel(budget);
            const ratio = budget.limit > 0 ? budget.spent / budget.limit : 0;
            const baseColor =
              themeKey === "colorful" ? theme.palette.success.main : theme.palette.success.main;
            const borderColor =
              ratio >= 1
                ? theme.palette.error.main
                : ratio >= 0.85
                  ? theme.palette.warning.main
                  : "divider";
            const progressColor =
              ratio >= 1
                ? theme.palette.error.main
                : ratio >= 0.85
                  ? theme.palette.warning.main
                  : baseColor;
            return (
              <Card
                key={budget.id}
                sx={{
                  border: 2,
                  borderColor,
                  boxShadow: focusedCategory === budget.categoryKey ? `0 0 0 3px ${theme.palette.info.main}` : undefined,
                }}
              >
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="h6">{label}</Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button variant="text" size="small" onClick={() => openEditDialog(budget)}>
                        {t("budgets.edit")}
                      </Button>
                      <Tooltip title={t("budgets.delete")}>
                        <IconButton size="small" onClick={() => handleDeleteBudget(budget.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    {t("budgets.limit")}: {budget.limit.toLocaleString()} Kč
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {t("budgets.spent")}: {budget.spent.toLocaleString()} Kč
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(ratio * 100, 100)}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      "& .MuiLinearProgress-bar": { backgroundColor: progressColor },
                    }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={editDialog.open} onClose={closeEditDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t("budgets.dialogTitleEdit")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label={t("budgets.categoryLabel")}
            placeholder={
              editDialog.id
                ? getBudgetLabel(budgets.find((b) => b.id === editDialog.id)!)
                : undefined
            }
            value={editDialog.name}
            onChange={(e) => setEditDialog((prev) => ({ ...prev, name: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ "& .MuiInputLabel-root": { textTransform: "none" } }}
          />
          <TextField
            label={t("budgets.limitLabel")}
            type="number"
            value={editDialog.limit}
            onChange={(e) => setEditDialog((prev) => ({ ...prev, limit: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>{t("common.cancel")}</Button>
          <Button onClick={handleSaveBudget} variant="contained">
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("budgets.dialogTitleAdd")}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>{t("budgets.categoryLabel")}</InputLabel>
            <Select
              label={t("budgets.categoryLabel")}
              value={newCategoryKey}
              onChange={(e) => {
                const key = e.target.value as BudgetCategoryKey;
                setNewCategoryKey(key);
                setNewCategoryLimit(CATEGORY_DEFS[key]?.defaultLimit.toString() || "");
              }}
            >
              {availableCategoryKeys.map((key) => (
                <MenuItem key={key} value={key}>
                  {t(`categories.${key}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t("budgets.limitLabel")}
            type="number"
            value={newCategoryLimit}
            onChange={(e) => setNewCategoryLimit(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ "& .MuiInputLabel-root": { textTransform: "none" } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleAddCategory} variant="contained" disabled={!newCategoryKey}>
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
