import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress } from "@mui/material";
import { loginUser } from "../api/auth";
import { useBankContext } from "../context/BankContext";
import { usePreferences } from "../context/PreferencesContext";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAccounts } = useBankContext();
  const { t, language } = usePreferences();

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser({ username, password });
      await refreshAccounts();
      const redirectTo = (location.state as any)?.from?.pathname || "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error("Chyba přihlášení", err);
      if (!err.response && err.message?.includes("Network")) {
        setError(language === "cz" ? "API není dostupné. Spusťte backend služby." : "API unavailable. Start the backend services.");
      } else {
        setError(err.response?.data?.error || t("login.error"));
      }
    } finally {
      setLoading(false);
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
      <Paper elevation={3} sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" align="center" gutterBottom>
          {t("login.title")}
        </Typography>

        <form onSubmit={handleLogin}>
          <TextField
            label={t("login.username")}
            variant="outlined"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label={t("login.password")}
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 3 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t("login.submit")}
          </Button>
        </form>

        <Button
          variant="text"
          color="secondary"
          fullWidth
          sx={{ mt: 1, textTransform: "none" }}
          onClick={() => navigate("/register")}
        >
          {t("login.toRegister")}
        </Button>
      </Paper>
    </Box>
  );
};

export default Login;
