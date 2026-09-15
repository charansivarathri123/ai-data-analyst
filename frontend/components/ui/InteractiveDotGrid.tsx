"use client";

import React, { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

interface Dot {
  x: number;
  y: number;
  baseAlpha: number;
  currentAlpha: number;
  targetAlpha: number;
  blinkOffset: number;
  blinkSpeed: number;
  scale: number;
}

interface InteractiveDotGridProps {
  dotSpacing?: number;
  dotRadius?: number;
  glowRadius?: number;
  className?: string;
}

export function InteractiveDotGrid({
  dotSpacing = 28,
  dotRadius = 1.2,
  glowRadius = 120,
  className = "absolute inset-0 pointer-events-none",
}: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;

    const initDots = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      dots = [];
      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: c * dotSpacing,
            y: r * dotSpacing,
            baseAlpha: 0.12,
            currentAlpha: 0.12,
            targetAlpha: 0.12,
            blinkOffset: Math.random() * Math.PI * 2,
            blinkSpeed: 0.05 + Math.random() * 0.04,
            scale: 1,
          });
        }
      }
    };

    initDots();

    // Mouse movement listeners on window so movement anywhere reacts
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    const handleResize = () => {
      initDots();
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const isMouseActive = mouseRef.current.active;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const dx = dot.x - mouseX;
        const dy = dot.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!prefersReduced && isMouseActive && dist < glowRadius) {
          // Calculate proximity factor (1 at center, 0 at outer edge)
          const proximity = 1 - dist / glowRadius;
          
          // Fast twinkling blink oscillation when cursor is near
          const blink = Math.sin(time * dot.blinkSpeed * 4 + dot.blinkOffset);
          const blinkFactor = 0.5 + 0.5 * blink; // 0 to 1

          // Target opacity brightens significantly with flickering blink
          dot.targetAlpha = Math.min(
            1.0,
            dot.baseAlpha + proximity * 0.75 + blinkFactor * proximity * 0.35
          );
          dot.scale = 1 + proximity * 1.4;
        } else {
          // Fade back to resting base alpha
          dot.targetAlpha = dot.baseAlpha;
          dot.scale = 1;
        }

        // Smoothly interpolate current alpha toward target
        dot.currentAlpha += (dot.targetAlpha - dot.currentAlpha) * 0.12;

        // Draw dot
        ctx.beginPath();
        const radius = dotRadius * dot.scale;
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);

        if (!prefersReduced && isMouseActive && dist < glowRadius) {
          // Warm amber / cool cyan interactive twinkling hue
          const proximity = 1 - dist / glowRadius;
          if (proximity > 0.4) {
            // Bright amber glow
            ctx.fillStyle = `rgba(233, 162, 59, ${dot.currentAlpha})`;
          } else {
            // Soft slate-blue glow transition
            ctx.fillStyle = `rgba(200, 215, 235, ${dot.currentAlpha})`;
          }
        } else {
          // Resting subtle dot
          ctx.fillStyle = `rgba(255, 255, 255, ${dot.currentAlpha})`;
        }

        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, [dotSpacing, dotRadius, glowRadius, prefersReduced]);

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} />;
}

export default InteractiveDotGrid;
