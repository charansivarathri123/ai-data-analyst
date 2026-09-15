"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "bi_studio_theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Dark-first: default is dark
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeState(savedTheme);
        // Dark is default (no class). Light mode adds `.light` class.
        document.documentElement.classList.toggle("light", savedTheme === "light");
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        setThemeState("light");
        document.documentElement.classList.add("light");
      }
      // If no preference detected, stays dark (no class needed)
    } catch (e) {
      console.warn("Unable to access localStorage for theme preference:", e);
    }
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      // Dark is default (no class). Light adds `.light`.
      document.documentElement.classList.toggle("light", newTheme === "light");
    } catch (e) {
      console.warn("Unable to save theme preference:", e);
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
