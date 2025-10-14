
// Vytvoření jednotného layoutu pro všechny hlavní stránky aplikace

import { useState } from "react";
import { Box, Container } from "@mui/material";
import TopBar from "../components/Nav/TopBar";
import AppSidebar from "../components/Nav/AppSidebar";


//Obsah, který se vloží podle aktuální stránky
export default function MainLayout({ children }: { children: React.ReactNode }) {
  
  //Uchovává stav sidebaru - otevřený/zavřený
    const [open, setOpen] = useState(false);

  return (
    
    //Kontejner
    <Box>

        {/* Horní lišta s tlačítkem pro otebření sidebaru */}
      <TopBar onMenuClick={() => setOpen(true)} />

        {/* Boční menu - zobrazí se po kliknutí na tlačítko v liště */}
      <AppSidebar open={open} onClose={() => setOpen(false)} />

        {/* Hlavní obsah stránky (Podle aktuálního routeru) */}
      <Container sx={{ py: 3 }}>{children}</Container> 
    </Box>
  );
}