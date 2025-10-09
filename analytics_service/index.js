import express from "express";
import cors from "cors";
import axios from "axios";

const app = express(); //Vytvoření aplikace
app.use(cors());

const PORT = 4001; // Port na kterém běží server

//adresa bankovní služby
const BANK_SERVICE_URL = "http://localhost:4000/transakce";


// endpoint pro souhrny - Z dat banky spočítá příjmy/výdaje:
app.get("/summary", async (requestAnimationFrame, res) => {
    try{
        const {data: transakce } = await axios.get(BANK_SERVICE_URL);

        const income = transakce
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

        const expenses = transakce
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0);

        const total = income + expenses;

        res.json({
            total,
            income,
            expenses,
            count: transakce.length
        });

        //Chybová hláška
    } catch(err) {
        console.error("Chyba při načítání/počítání:", err.message);
        res.status(500).json({error: "Nepodařilo se načíst transakce z banky."});
    }
});

//Jednoduchý převod měn, zatím s fiktivním kurzem
app.get("/convert", (req, res) => {
  const amount = Number(req.query.amount || 0);
  const from = (req.query.from || "CZK").toUpperCase();
  const to = (req.query.to || "CZK").toUpperCase();

  // Dočasné kurzy jen pro ukázku (později nahradím reálným API)
  const mockRates = {
    CZK: { CZK: 1, EUR: 0.041, USD: 0.043 },
    EUR: { CZK: 24.3, EUR: 1, USD: 1.05 },
    USD: { CZK: 23.1, EUR: 0.95, USD: 1 }
  };

  if (!mockRates[from] || !mockRates[from][to]) {
    return res.status(400).json({ error: "Nepodporovaná měna pro ukázkový převod." });
  }
  const rate = mockRates[from][to];
  const result = Math.round((amount * rate + Number.EPSILON) * 100) / 100;

  res.json({ amount, from, to, rate, result });
});


// spuštění služby
app.listen(PORT, () => {
  console.log(`✅ Analytics service běží na http://localhost:${PORT}`);
});