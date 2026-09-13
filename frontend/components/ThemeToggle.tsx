"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeContext";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  showLabel = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-xl p-2 text-xs font-medium transition-all duration-200 ${
        isDark
          ? "bg-zinc-800 text-yellow-400 hover:bg-zinc-700 hover:text-yellow-300 border border-zinc-700"
          : "bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 border border-subtleBorder shadow-subtle"
      } ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-yellow-400 transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-accent-violet transition-transform duration-300 rotate-0" />
      )}
      {showLabel && (
        <span className="font-mono text-[11px] select-none">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
};
