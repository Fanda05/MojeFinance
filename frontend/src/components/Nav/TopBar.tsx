
// Horní lišta s názvem aplikace a tlačítkem pro menu

// Import komponent z Material UI
import { AppBar, Toolbar, Typography, IconButton } from "@mui/material";

// Import ikony menu
import MenuIcon from "@mui/icons-material/Menu";

//Typy vlastností, které komponenta přijímá
type Props = { onMenuClick?: () => void; title?: string };


//Hlavní komponenta TopBar
export default function TopBar({ onMenuClick, title = "MojeFinance" }: Props) {
  return (
    //Horní lišta - fixně nahoře
    <AppBar position="sticky" elevation={0}>
      <Toolbar>
       
        {/* Tlačítko pro otevření bočního menu */}
        <IconButton 
        edge="start"              //Umístění vlevo
        color="inherit"           //Zdědí barvu
        onClick={onMenuClick}     //Otevře sidebar po kliknutí
        aria-label="menu"         //Popis pro čtečky
        >

        {/* Ikona menu (hamburger) */}  
          <MenuIcon />
        </IconButton>

        {/* Název aplikace */}
        <Typography variant="h6" sx={{ ml: 1 }}>{title}</Typography>
      </Toolbar>
    </AppBar>
  );
}