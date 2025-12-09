// Vytvoření jednotného layoutu pro všechny hlavní stránky aplikace

import { useState } from "react";
import { Box, Container } from "@mui/material";
import { Outlet } from "react-router-dom"; // Import komponenty Outlet
import TopBar from "../components/Nav/TopBar";
import AppSidebar from "../components/Nav/AppSidebar";

//Layout pro všechny stránky aplikace
export default function MainLayout() {
  
  //Uchovává stav sidebaru - otevřený/zavřený
  const [open, setOpen] = useState(false);

  return (
    //Kontejner celé stránky
    <Box>
      
      {/* Horní lišta s tlačítkem pro otevření sidebaru */}
      <TopBar onMenuClick={() => setOpen(true)} />

      {/* Boční menu - zobrazí se po kliknutí na tlačítko */}
      <AppSidebar open={open} onClose={() => setOpen(false)} />

      {/* Hlavní obsah stránky podle aktuální URL */}
      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}