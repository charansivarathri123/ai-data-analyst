"use client";

import React from "react";

export type LogoMarkState = "idle" | "think" | "done" | "static";

interface LogoMarkProps {
  size?: number;
  state?: LogoMarkState;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  onClick?: () => void;
}

export function LogoMark({
  size = 32,
  state = "idle",
  className = "",
  withWordmark = false,
  wordmarkClassName = "",
  onClick,
}: LogoMarkProps) {
  const isDone = state === "done";
  const stateClass = state === "static" ? "" : state;

  const svgContent = (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={`brand-mark shrink-0 ${stateClass} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bar 1: Left */}
      <rect className="b1" x="4" y="24" width="8" height="15" rx="2.4" />
      {/* Bar 2: Center signal bar */}
      <rect className="b2" x="18" y="12" width="8" height="27" rx="2.4" />
      {/* Bar 3: Right */}
      <rect className="b3" x="32" y="19" width="8" height="20" rx="2.4" />

      {/* Done State Ring */}
      {isDone && (
        <circle
          className="ring"
          cx="22"
          cy="7"
          r="7"
          fill="none"
          strokeWidth="1.6"
        />
      )}

      {/* Signal Dot */}
      <circle className="dot" cx="22" cy="7" r="4" />
    </svg>
  );

  if (!withWordmark) {
    return svgContent;
  }

  return (
    <div
      onClick={onClick}
      className={`brand-lockup flex items-center gap-2.5 cursor-pointer select-none group ${wordmarkClassName}`}
    >
      {svgContent}
      <div className="font-semibold tracking-tight text-t-primary leading-none">
        <span className="font-semibold text-t-primary">DataAnalyst</span>
        <span className="font-medium text-t-secondary opacity-75">.Ai</span>
      </div>
    </div>
  );
}

export default LogoMark;
