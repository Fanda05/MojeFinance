import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import {
  lightTheme,
  darkTheme,
  colorfulTheme,
  slateTheme,
} from "../theme/theme";

const themes = {
  light: lightTheme,
  dark: darkTheme,
  colorful: colorfulTheme,
  slate: slateTheme,
};

type ThemeKey = keyof typeof themes;
type LanguageKey = "cz" | "en";

type PreferencesContextType = {
  themeKey: ThemeKey;
  setThemeKey: (theme: ThemeKey) => void;
  language: LanguageKey;
  setLanguage: (lang: LanguageKey) => void;
  t: (key: string, values?: Record<string, string | number>, fallback?: string) => string;
  monthNames: string[];
};

const monthNamesMap: Record<LanguageKey, string[]> = {
  cz: [
    "Leden",
    "Únor",
    "Březen",
    "Duben",
    "Květen",
    "Červen",
    "Červenec",
    "Srpen",
    "Září",
    "Říjen",
    "Listopad",
    "Prosinec",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const translations: Record<LanguageKey, Record<string, any>> = {
  cz: {
    appName: "MojeFinance",
    common: {
      loading: "Načítání dat...",
      addCategory: "Přidat kategorii",
      addBankPrompt: "Přidejte bankovní účet v Nastavení",
      cancel: "Zrušit",
      save: "Uložit",
      close: "Zavřít",
      accounts: "Účty",
      allAccounts: "Všechny účty",
      logout: "Odhlásit se",
    },
    login: {
      title: "Přihlášení",
      username: "Uživatelské jméno",
      password: "Heslo",
      submit: "Přihlásit se",
      toRegister: "Chcete si založit účet? Registrace",
      error: "Přihlášení selhalo.",
    },
    register: {
      title: "Registrace",
      username: "Uživatelské jméno",
      password: "Heslo",
      selectBanks: "Vyberte banky pro připojení:",
      submit: "Registrovat",
      toLogin: "Máte účet? Přihlaste se",
      error: "Registrace selhala.",
    },
    dashboard: {
      title: "Přehled",
      balance: "Zůstatek",
      income: "Příjmy",
      expenses: "Výdaje",
      transactions: "Transakcí",
      chartTitle: "Vývoj za období {year} (v CZK) - Filtrováno dle výběru",
      alerts: {
        exceeded: "Rozpočet {category} byl překročen o {amount} Kč.",
        warning: "Rozpočet {category} je na {percent}% limitu.",
      },
    },
    transactions: {
      title: "Transakce",
      empty: "Přidejte bankovní účet pro zobrazení transakcí.",
      originalAmount: "Původní částka",
    },
    budgets: {
      title: "Rozpočty",
      empty: "Zatím nemáte žádné kategorie. Přidejte je pro sledování výdajů.",
      spent: "Utraceno",
      limit: "Limit",
      edit: "Upravit",
      add: "Přidat kategorii",
      dialogTitleEdit: "Upravit kategorii",
      dialogTitleAdd: "Přidat kategorii",
      categoryLabel: "Název kategorie",
      limitLabel: "Měsíční limit (Kč)",
      delete: "Smazat kategorii",
    },
    settings: {
      title: "Nastavení",
      appearance: "Vzhled",
      themeLabel: "Téma",
      themes: {
        light: "Světlé",
        dark: "Tmavé",
        colorful: "Oranžové (světlé)",
        slate: "Moderní",
      },
      languageLabel: "Jazyk",
      languages: {
        cz: "Čeština",
        en: "English",
      },
      currency: {
        title: "Měna a kurz",
        current: "Aktuální kurz",
        eurCzk: "1 EUR = {rate} Kč",
      },
      data: {
        title: "Data",
        refresh: "Obnovit data z bank",
      },
      banks: {
        title: "Správa bankovních účtů",
        addTitle: "Přidat nový účet",
        selectBank: "Vyberte banku",
        connect: "Připojit",
        none: "Žádný bankovní účet není připojen.",
      },
    },
    nav: {
      dashboard: "Přehled",
      transactions: "Transakce",
      budgets: "Rozpočty",
      settings: "Nastavení",
    },
    notFound: {
      title: "Stránka nenalezena",
      back: "Zpět na přehled",
      description: "Omlouváme se, ale stránka, kterou hledáte, neexistuje nebo byla přesunuta.",
    },
    categories: {
      rent: "Bydlení",
      groceries: "Potraviny a domácnost",
      transport: "Doprava a palivo",
      entertainment: "Stravování a zábava",
      travel: "Cestování",
      education: "Vzdělání a rozvoj",
      health: "Zdraví a péče",
    },
  },
  en: {
    appName: "MyFinance",
    common: {
      loading: "Loading data...",
      addCategory: "Add category",
      addBankPrompt: "Please connect a bank account in Settings",
      cancel: "Cancel",
      save: "Save",
      close: "Close",
      accounts: "Accounts",
      allAccounts: "All accounts",
      logout: "Logout",
    },
    login: {
      title: "Sign in",
      username: "Username",
      password: "Password",
      submit: "Sign in",
      toRegister: "Need an account? Register",
      error: "Sign-in failed.",
    },
    register: {
      title: "Register",
      username: "Username",
      password: "Password",
      selectBanks: "Select banks to connect:",
      submit: "Register",
      toLogin: "Already have an account? Sign in",
      error: "Registration failed.",
    },
    dashboard: {
      title: "Dashboard",
      balance: "Balance",
      income: "Income",
      expenses: "Expenses",
      transactions: "Transactions",
      chartTitle: "Yearly trend {year} (CZK) - filtered selection",
      alerts: {
        exceeded: "{category} budget exceeded by {amount} CZK.",
        warning: "{category} budget is at {percent}% of the limit.",
      },
    },
    transactions: {
      title: "Transactions",
      empty: "Connect a bank account to load transactions.",
      originalAmount: "Original amount",
    },
    budgets: {
      title: "Budgets",
      empty: "No categories yet. Add one to start tracking.",
      spent: "Spent",
      limit: "Limit",
      edit: "Edit",
      add: "Add category",
      dialogTitleEdit: "Edit category",
      dialogTitleAdd: "Add category",
      categoryLabel: "Category",
      limitLabel: "Monthly limit (CZK)",
      delete: "Delete category",
    },
    settings: {
      title: "Settings",
      appearance: "Appearance",
      themeLabel: "Theme",
      themes: {
        light: "Light",
        dark: "Dark",
        colorful: "Orange (light)",
        slate: "Modern",
      },
      languageLabel: "Language",
      languages: {
        cz: "Czech",
        en: "English",
      },
      currency: {
        title: "Currency & exchange rate",
        current: "Current rate",
        eurCzk: "1 EUR = {rate} CZK",
      },
      data: {
        title: "Data",
        refresh: "Reload bank data",
      },
      banks: {
        title: "Bank accounts",
        addTitle: "Add new account",
        selectBank: "Select bank",
        connect: "Connect",
        none: "No bank account connected.",
      },
    },
    nav: {
      dashboard: "Dashboard",
      transactions: "Transactions",
      budgets: "Budgets",
      settings: "Settings",
    },
    notFound: {
      title: "Page not found",
      back: "Back to dashboard",
      description: "Sorry, the page you are looking for does not exist or was moved.",
    },
    categories: {
      rent: "Housing",
      groceries: "Groceries & home",
      transport: "Transport & fuel",
      entertainment: "Dining & leisure",
      travel: "Travel",
      education: "Education & growth",
      health: "Health & care",
    },
  },
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

function getNestedValue(obj: Record<string, any>, path: string) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(values, token) ? String(values[token]) : match
  );
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(() => (localStorage.getItem("themeKey") as ThemeKey) || "light");
  const [language, setLanguageState] = useState<LanguageKey>(() => (localStorage.getItem("lang") as LanguageKey) || "cz");

  useEffect(() => {
    localStorage.setItem("themeKey", themeKey);
  }, [themeKey]);

  useEffect(() => {
    localStorage.setItem("lang", language);
    document.documentElement.lang = language;
  }, [language]);

  const setThemeKey = (value: ThemeKey) => setThemeKeyState(value);
  const setLanguage = (value: LanguageKey) => setLanguageState(value);

  const translate = useCallback(
    (key: string, values?: Record<string, string | number>, fallback?: string) => {
      const langTable = translations[language] || translations.cz;
      const raw = getNestedValue(langTable, key);
      let template: string;
      if (raw === undefined || raw === null) {
        template = fallback ?? key;
      } else if (typeof raw === "string") {
        template = raw;
      } else if (typeof raw === "number") {
        template = String(raw);
      } else {
        template = fallback ?? key;
      }
      return interpolate(template, values);
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      themeKey,
      setThemeKey,
      language,
      setLanguage,
      t: translate,
      monthNames: monthNamesMap[language],
    }),
    [themeKey, language, translate]
  );

  const activeTheme = themes[themeKey] || lightTheme;

  return (
    <PreferencesContext.Provider value={contextValue}>
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};
