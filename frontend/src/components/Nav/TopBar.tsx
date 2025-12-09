import { AppBar, Toolbar, Typography, IconButton, Tooltip } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../../api/auth";
import { useBankContext } from "../../context/BankContext";
import { usePreferences } from "../../context/PreferencesContext";

type Props = { onMenuClick?: () => void; title?: string };

export default function TopBar({ onMenuClick, title }: Props) {
  const navigate = useNavigate();
  const { refreshAccounts } = useBankContext();
  const { t } = usePreferences();

  const handleLogout = async () => {
    await logoutUser();
    await refreshAccounts();
    navigate("/login");
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar>
        <IconButton edge="start" color="inherit" onClick={onMenuClick} aria-label="menu">
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
          {title || t("appName")}
        </Typography>
        <Tooltip title={t("common.logout")}>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
