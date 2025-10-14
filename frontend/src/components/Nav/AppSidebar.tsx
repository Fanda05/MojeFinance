
// Boční panel s odkazy na hlavní stránky

// Import komponent Material UI
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";

//Import ikon pro jednotlivé sekce
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SettingsIcon from "@mui/icons-material/Settings";

//Import funkcí pro práci s trasami
import { Link, useLocation } from "react-router-dom";

//Typy vlastností, které komponenta přijímá
type Props = { open: boolean; onClose: () => void };

//Definice položek menu
const items = [
  { to: "/", label: "Přehled", icon: <DashboardIcon /> },
  { to: "/transactions", label: "Transakce", icon: <ReceiptLongIcon /> },
  { to: "/budgets", label: "Rozpočty", icon: <AccountBalanceWalletIcon /> },
  { to: "/settings", label: "Nastavení", icon: <SettingsIcon /> },
];

//Hlavní komponenta AppSidebar
export default function AppSidebar({ open, onClose }: Props) {
 
  //Získání aktuální cesty url - zvýraznění aktivní položky
  const { pathname } = useLocation();
  return (
   
    // Boční vysouvající se panel
    <Drawer open={open} onClose={onClose}>
      
      {/* Seznam navigačních položek */}
      <List sx={{ width: 260 }}>
        {items.map((it) => (
          <ListItemButton
            key={it.to}                      // Unikátní klíč pro react
            component={Link}                 // Použití Link
            to={it.to}                       // Kam položka odkazuje
            selected={pathname === it.to}    // Zvýraznění aktivní položky
            onClick={onClose}                // Zavře panel po kliknutí na položku
          >

            {/* Ikona položky (např. dashboard, rozpočet...) */}
            <ListItemIcon>{it.icon}</ListItemIcon>

            {/* Textový popisek položky */}
            <ListItemText primary={it.label} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}