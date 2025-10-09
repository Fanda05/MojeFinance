import express from "express";

const app = express(); //Vytvoření aplikace
const PORT = 4000; // Port na kterém běží server

//Mock data banky
const transakce = [
    {id: 1, date: "2025-10-01", description: "Potraviny", amount: -850, currency: "CZK"},
    {id: 2, date: "2025-04-03", description: "Výplata", amount: 25000, currency: "CZK"},
    {id: 3, date: "2025-08-10", description: "Benzín", amount: -1300, currency: "CZK"},
    {id: 4, date: "2025-09-11", description: "Potraviny", amount: -10, currency: "EUR"}
];

//Nastavení endpointu pro získání všech transakcí
app.get("/transakce", (req, res) => {
    res.json(transakce);
});

//Server se spustí na daném portu
app.listen(PORT, () => {
    console.log(`✅ Bank service běží na http://localhost:${PORT}`);
});