import { createTheme } from "@mui/material/styles";

// Nastavení vlastního vzhledu pro celou aplikaci
const theme = createTheme({
    //Barevné schéma
  palette: {
    mode: "light", // světlí režim
    primary: { main: "#1976d2" },     // modrá – hlavní barva
    secondary: { main: "#9c27b0" },   // fialová – doplňková barva
  },

  //Nastavení tvaru prvků
  //Používá se pro komponenty, které mají borderRadius
  shape: { borderRadius: 12 },
  components: {

    //Tlačítka
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 12 },
      },
    },
    
    //Karty, panely, pozadí
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 0 },
      },
    },
  },
});

export default theme;