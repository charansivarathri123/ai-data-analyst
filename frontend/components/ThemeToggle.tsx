"use client";

import React from "react";
import { motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeContext";
import { pressScale } from "@/lib/motion";

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
    <motion.button
      onClick={toggleTheme}
      whileTap={pressScale.whileTap}
      className={`inline-flex items-center gap-2 rounded-lg p-2 text-caption font-medium transition-colors
        bg-surface-2 text-t-secondary hover:text-t-primary hover:bg-surface-3
        border border-b-subtle hover:border-b-hover
        ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-status-warning" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-accent-violet" />
      )}
      {showLabel && (
        <span className="font-mono text-micro select-none">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </motion.button>
  );
};
