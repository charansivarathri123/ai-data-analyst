"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { pressScale } from "@/lib/motion";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "cool";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none select-none";

  const variants: Record<string, string> = {
    primary:
      "bg-accent-warm text-canvas hover:bg-accent-warm/90 border border-accent-warm/30 font-semibold shadow-sm",
    cool:
      "bg-accent-cool text-canvas hover:bg-accent-cool/90 border border-accent-cool/30 font-semibold shadow-sm",
    secondary:
      "bg-surface-2 text-t-primary hover:bg-surface-3 border border-b-subtle hover:border-b-hover",
    ghost:
      "bg-transparent text-t-secondary hover:text-t-primary hover:bg-surface-2 border border-transparent",
    danger:
      "bg-accent-danger/10 text-accent-danger hover:bg-accent-danger/20 border border-accent-danger/30",
  };

  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-caption rounded-md gap-1.5",
    md: "px-4 py-2 text-body rounded-lg gap-2",
    lg: "px-5 py-2.5 text-body rounded-lg gap-2.5",
  };

  const disabledClass = disabled
    ? "opacity-45 cursor-not-allowed pointer-events-none"
    : "cursor-pointer";

  return (
    <motion.button
      className={`${base} ${variants[variant]} ${sizes[size]} ${disabledClass} ${className}`}
      disabled={disabled}
      whileTap={disabled ? undefined : pressScale.whileTap}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export default Button;
