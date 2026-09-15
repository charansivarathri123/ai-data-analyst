"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  formatFn?: (val: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  durationMs = 800,
  formatFn,
  className = "",
}: AnimatedNumberProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [currentValue, setCurrentValue] = useState(prefersReduced ? value : 0);

  useEffect(() => {
    if (prefersReduced) {
      setCurrentValue(value);
      return;
    }

    let start = 0;
    const startTime = performance.now();
    let frameId: number;

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextVal = Math.round(start + (value - start) * easeProgress);

      setCurrentValue(nextVal);

      if (progress < 1) {
        frameId = requestAnimationFrame(updateCount);
      } else {
        setCurrentValue(value);
      }
    };

    frameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs, prefersReduced]);

  const display = formatFn ? formatFn(currentValue) : currentValue.toLocaleString();

  return <span className={`font-mono tabular-nums ${className}`}>{display}</span>;
}

export default AnimatedNumber;
