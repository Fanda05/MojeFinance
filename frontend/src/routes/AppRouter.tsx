
//Definování všech cest a komponent, které se mají zobrazit podle url

//Import potřebných funkcí z react Routeru
import { createBrowserRouter, RouterProvider } from "react-router-dom";

//Import hlavního layoutu
import MainLayout from "../layouts/MainLayout";

//Import jednotlivých stránek
import Dashboard from "../pages/Dashboard";
import Transactions from "../pages/Transactions";
import Budgets from "../pages/Budgets";
import Settings from "../pages/Settings";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";

//Definice všech tras aplikace
const router = createBrowserRouter([
  //Hlavní stránka
  {
    path: "/",
    element: (
      <MainLayout>
        <Dashboard />
      </MainLayout>
    ),
  },

  //Stránka s transakcemi
  {
    path: "/transactions",
    element: (
      <MainLayout>
        <Transactions />
      </MainLayout>
    ),
  },

  //Stránka s rozpočty
  {
    path: "/budgets",
    element: (
      <MainLayout>
        <Budgets />
      </MainLayout>
    ),
  },

  //Nastavení aplikace
  {
    path: "/settings",
    element: (
      <MainLayout>
        <Settings />
      </MainLayout>
    ),
  },

  //Přihlašovací stránka - bez layoutu
  {
    path: "/login",
    element: <Login />, 
  },

  //Stránka 404 - když adresa neexistuje - bez layoutu
  {
    path: "*",
    element: <NotFound />,
  },
]);

//Aktivace celého routeru v aplikaci
export default function AppRouter() {
  return <RouterProvider router={router} />;
}
