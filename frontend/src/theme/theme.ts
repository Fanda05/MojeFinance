import { createTheme } from "@mui/material/styles";
import type { ThemeOptions } from "@mui/material/styles";

const componentOverrides: ThemeOptions["components"] = {
  MuiButton: {
    styleOverrides: { root: { textTransform: "none", borderRadius: 12 } },
  },
  MuiPaper: {
    styleOverrides: { root: { borderRadius: 12 } },
  },
  MuiAppBar: {
    styleOverrides: { root: { borderRadius: 0 } },
  },
};

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#9c27b0" },
    background: { default: "#f5f5f5", paper: "#ffffff" },
    text: { primary: "#0f172a" },
  },
  shape: { borderRadius: 12 },
  components: componentOverrides,
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#90caf9" },
    secondary: { main: "#ce93d8" },
    background: { default: "#0f172a", paper: "#1e293b" },
    text: { primary: "#f8fafc" },
  },
  shape: { borderRadius: 12 },
});

export const colorfulTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#ff7043" },
    secondary: { main: "#26c6da" },
    background: { default: "#fff3e0", paper: "#ffffff" },
    text: { primary: "#3e2723" },
  },
  shape: { borderRadius: 16 },
});

export const slateTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#63f5bd" },
    secondary: { main: "#82aaff" },
    background: { default: "#101826", paper: "#162033" },
    text: { primary: "#e2e8f0" },
  },
  shape: { borderRadius: 16 },
});
