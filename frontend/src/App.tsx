import { useEffect } from "react";
import AppRouter from "./routes/AppRouter";
import { BankProvider } from "./context/BankContext";
import { PreferencesProvider } from "./context/PreferencesContext";

const performAutoRefresh = () => {
  const lastRefresh = localStorage.getItem("lastRefreshDate");
  const now = new Date();
  if (lastRefresh) {
    const lastRefreshDate = new Date(lastRefresh);
    const oneDay = 24 * 60 * 60 * 1000;
    if (now.getTime() - lastRefreshDate.getTime() < oneDay) {
      return;
    }
  }
  localStorage.setItem("lastRefreshDate", now.toISOString());
  console.log("✅ Proběhla automatická denní aktualizace dat.");
};

export default function App() {
  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      performAutoRefresh();
    }
  }, []);

  return (
    <PreferencesProvider>
      <BankProvider>
        <AppRouter />
      </BankProvider>
    </PreferencesProvider>
  );
}
