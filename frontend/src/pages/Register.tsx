import { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Paper,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";
import { connectAccount, fetchProviders, type BankProvider } from "../api/banks";
import { useBankContext } from "../context/BankContext";
import { usePreferences } from "../context/PreferencesContext";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [providers, setProviders] = useState<BankProvider[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refreshAccounts } = useBankContext();
  const { t, language } = usePreferences();

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch((err) => console.error("Chyba providerů", err));
  }, []);

  // Přidání/odebrání banky v seznamu při registraci
  const handleToggle = (code: string, checked: boolean) => {
    setSelectedProviders((current) =>
      checked ? [...current, code] : current.filter((item) => item !== code)
    );
  };

  const handleSubmit = async () => {
    if (!username || !password) {
      setError(
        language === "cz" ? "Vyplňte prosím uživatelské jméno a heslo." : "Please fill in username and password."
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await registerUser({ username, password });
      for (const providerCode of selectedProviders) {
        try {
          await connectAccount(providerCode);
        } catch (err: any) {
          console.warn("Nelze připojit banku", providerCode, err);
        }
      }
      await refreshAccounts();
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Chyba registrace", err);
      if (!err.response && err.message?.includes("Network")) {
        setError(
          language === "cz"
            ? "API není dostupné. Ujistěte se, že běží auth a bank služby."
            : "API unavailable. Make sure backend services are running."
        );
      } else {
        setError(err.response?.data?.error || t("register.error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: 420 }}>
        <Typography variant="h5" gutterBottom>
          {t("register.title")}
        </Typography>
        <TextField
          label={t("register.username")}
          fullWidth
          margin="normal"
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label={t("register.password")}
          type="password"
          fullWidth
          margin="normal"
          onChange={(e) => setPassword(e.target.value)}
        />
        <Typography variant="subtitle1" sx={{ mt: 2 }}>
          {t("register.selectBanks")}
        </Typography>
        {providers.map((provider) => (
          <FormControlLabel
            key={provider.code}
            control={
              <Checkbox
                onChange={(e) => handleToggle(provider.code, e.target.checked)}
                disabled={provider.provider_type !== "mock"}
              />
            }
            label={`${provider.name} ${provider.provider_type !== "mock" ? "(dostupné po PSD2)" : ""}`}
          />
        ))}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          sx={{ mt: 2 }}
          disabled={submitting}
          fullWidth
        >
          {submitting ? <CircularProgress size={24} /> : t("register.submit")}
        </Button>
        <Button variant="text" fullWidth sx={{ mt: 1 }} onClick={() => navigate("/login")}>
          {t("register.toLogin")}
        </Button>
      </Paper>
    </Box>
  );
}
