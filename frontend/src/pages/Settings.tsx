import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
  InputLabel,
  FormControl,
  Alert,
} from "@mui/material";
import { useEffect, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import { connectAccount, fetchProviders, removeAccount, type BankProvider } from "../api/banks";
import { useBankContext } from "../context/BankContext";
import { usePreferences } from "../context/PreferencesContext";
import { analyticsClient } from "../api/http";

export default function Settings() {
  const { accounts, refreshAccounts } = useBankContext();
  const { themeKey, setThemeKey, language, setLanguage, t } = usePreferences();
  const [providers, setProviders] = useState<BankProvider[]>([]);
  const [selectedBankOption, setSelectedBankOption] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch((err) => console.error("Chyba providerů", err));
  }, []);

  const loadRate = async () => {
    setRateLoading(true);
    try {
      const { data } = await analyticsClient.get("/convert", {
        params: { amount: 1, from: "EUR", to: "CZK" },
      });
      setRate(data.result);
    } catch (err) {
      console.error("Chyba při načítání kurzu", err);
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    loadRate();
  }, []);

  const handleReloadData = async () => {
    await refreshAccounts();
    setFeedback(language === "cz" ? "Data byla obnovena." : "Data refreshed.");
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleAddBank = async () => {
    const provider = providers.find((p) => p.code === selectedBankOption);
    if (!provider) {
      alert(language === "cz" ? "Vyberte banku." : "Select a bank.");
      return;
    }
    try {
      await connectAccount(provider.code);
      await refreshAccounts();
      setSelectedBankOption("");
      setFeedback(language === "cz" ? `Banka ${provider.name} byla připojena.` : `Bank ${provider.name} connected.`);
    } catch (err: any) {
      alert(err.response?.data?.error || (language === "cz" ? "Připojení banky selhalo." : "Connection failed."));
    }
  };

  const handleDeleteAccount = async (id: number) => {
    await removeAccount(id);
    await refreshAccounts();
  };

  return (
    <Box sx={{ maxWidth: "650px", margin: "0 auto", mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t("settings.title")}
      </Typography>

      {feedback && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {feedback}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("settings.appearance")}
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>{t("settings.themeLabel")}</InputLabel>
        <Select value={themeKey} label={t("settings.themeLabel")}
          onChange={(e) => setThemeKey(e.target.value as any)}
        >
          <MenuItem value="light">{t("settings.themes.light")}</MenuItem>
          <MenuItem value="dark">{t("settings.themes.dark")}</MenuItem>
          <MenuItem value="colorful">{t("settings.themes.colorful")}</MenuItem>
          <MenuItem value="slate">{t("settings.themes.slate")}</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>{t("settings.languageLabel")}</InputLabel>
        <Select value={language} label={t("settings.languageLabel")}
          onChange={(e) => setLanguage(e.target.value as any)}
        >
          <MenuItem value="cz">{t("settings.languages.cz")}</MenuItem>
          <MenuItem value="en">{t("settings.languages.en")}</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("settings.banks.title")}
      </Typography>

      {accounts.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("settings.banks.none")}
        </Typography>
      ) : (
        <List dense sx={{ border: "1px solid #ccc", borderRadius: 1, mb: 2 }}>
          {accounts.map((acc) => (
            <ListItem
              key={acc.id}
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteAccount(acc.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText primary={acc.alias || acc.provider_name} secondary={acc.provider_name} />
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
        {t("settings.banks.addTitle")}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>{t("settings.banks.selectBank")}</InputLabel>
          <Select
            value={selectedBankOption}
            label={t("settings.banks.selectBank")}
            onChange={(e) => setSelectedBankOption(e.target.value as string)}
          >
            {providers.map((bank) => (
              <MenuItem key={bank.code} value={bank.code} disabled={bank.provider_type !== "mock"}>
                {bank.name} {bank.provider_type !== "mock" ? "(PSD2 soon)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={handleAddBank}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          disabled={!selectedBankOption}
        >
          {t("settings.banks.connect")}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("settings.currency.title")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography>{t("settings.currency.current")}</Typography>
        {rateLoading ? (
          <CircularProgress size={20} />
        ) : (
          <Typography fontWeight={600}>
            {rate ? t("settings.currency.eurCzk", { rate: rate.toFixed(2) }) : "--"}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t("settings.data.title")}
      </Typography>

      <Button
        variant="contained"
        startIcon={<RefreshIcon />}
        onClick={handleReloadData}
        sx={{
          backgroundColor: "#64b5f6",
          textTransform: "none",
          "&:hover": { backgroundColor: "#42a5f5" },
        }}
      >
        {t("settings.data.refresh")}
      </Button>
    </Box>
  );
}
