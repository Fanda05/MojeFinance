import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { usePreferences } from "../context/PreferencesContext";

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <Box
      sx={{
        height: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#444",
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 80, color: "#64b5f6", mb: 2 }} />

      <Typography variant="h3" fontWeight={600} gutterBottom>
        {t("notFound.title")}
      </Typography>

      <Typography variant="body1" sx={{ maxWidth: 400, mb: 3 }}>
        {t("notFound.description")}
      </Typography>

      <Button
        variant="contained"
        sx={{
          backgroundColor: "#64b5f6",
          textTransform: "none",
          fontWeight: 600,
          "&:hover": { backgroundColor: "#42a5f5" },
        }}
        onClick={() => navigate("/")}
      >
        {t("notFound.back")}
      </Button>
    </Box>
  );
}
