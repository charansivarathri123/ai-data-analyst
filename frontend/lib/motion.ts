"use client";

import { useEffect, useState } from "react";
import type { Transition, Variants } from "motion/react";

// ---------------------------------------------------------------------------
// Durations (seconds for Framer Motion)
// ---------------------------------------------------------------------------
export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  entrance: 0.5,
  slow: 0.8,
  pipeline: 1.2,
} as const;

// ---------------------------------------------------------------------------
// Easings
// ---------------------------------------------------------------------------
export const ease = {
  /** Primary deceleration curve */
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Symmetric ease-in-out */
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Spring for interactive elements */
  spring: { type: "spring" as const, stiffness: 400, damping: 30 },
  /** Bouncy spring for playful interactions */
  bounce: { type: "spring" as const, stiffness: 600, damping: 15 },
} as const;

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------
export const transition = {
  fast: { duration: duration.fast, ease: ease.out } satisfies Transition,
  normal: { duration: duration.normal, ease: ease.out } satisfies Transition,
  entrance: { duration: duration.entrance, ease: ease.out } satisfies Transition,
  slow: { duration: duration.slow, ease: ease.out } satisfies Transition,
  spring: ease.spring satisfies Transition,
  bounce: ease.bounce satisfies Transition,
} as const;

// ---------------------------------------------------------------------------
// Shared Variants
// ---------------------------------------------------------------------------

/** Fade up: opacity 0→1, y 8→0 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.entrance, ease: ease.out },
  },
  exit: { opacity: 0, y: -8, transition: { duration: duration.normal, ease: ease.out } },
};

/** Fade in: opacity only */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal, ease: ease.out },
  },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

/** Scale in: for modals, popovers */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.normal, ease: ease.out },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: duration.fast },
  },
};

/** Tab panel content swap: cross-fade + 8px translate */
export const tabPanel: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.normal, ease: ease.out },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: duration.fast },
  },
};

/** Stagger container */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

/** Stagger item — used inside a staggerContainer */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.entrance, ease: ease.out },
  },
};

/** Word-by-word stagger for hero headline */
export const wordStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

export const wordItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.entrance, ease: ease.out },
  },
};

/** Press interaction: scale 0.97 */
export const pressScale = {
  whileTap: { scale: 0.97 },
  transition: { duration: duration.instant },
} as const;

/** Hover lift for cards */
export const hoverLift = {
  whileHover: { y: -1 },
  transition: { duration: duration.fast },
} as const;

// ---------------------------------------------------------------------------
// Pipeline node states
// ---------------------------------------------------------------------------
export type PipelineNodeState = "pending" | "active" | "complete" | "error";

export const pipelineNode: Record<PipelineNodeState, Variants["visible"]> = {
  pending: { scale: 1, opacity: 0.5 },
  active: { scale: 1.05, opacity: 1 },
  complete: { scale: 1, opacity: 1 },
  error: { scale: 1, opacity: 1 },
};

/** Checkmark draw-in for completed pipeline node */
export const checkDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: duration.entrance, ease: ease.out },
  },
};

/** Ring draw for active pipeline node */
export const ringDraw: Variants = {
  hidden: { pathLength: 0 },
  visible: {
    pathLength: 1,
    transition: { duration: duration.slow, ease: ease.out },
  },
};

/** Energy pulse traveling along connector */
export const energyPulse: Variants = {
  hidden: { x: "0%", opacity: 0 },
  visible: {
    x: "100%",
    opacity: [0, 1, 1, 0],
    transition: { duration: duration.pipeline, ease: ease.inOut },
  },
};

// ---------------------------------------------------------------------------
// Breathing animation for skeleton/empty states
// ---------------------------------------------------------------------------
export const breathe: Variants = {
  initial: { opacity: 0.3 },
  animate: {
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 2.5,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

export const breatheScale: Variants = {
  initial: { scaleY: 0.6, opacity: 0.3 },
  animate: {
    scaleY: [0.6, 1, 0.6],
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 2.5,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

// ---------------------------------------------------------------------------
// Block reveal for streamed content (paragraph-level)
// ---------------------------------------------------------------------------
export const blockReveal: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.out },
  },
};

// ---------------------------------------------------------------------------
// Error shake for form validation
// ---------------------------------------------------------------------------
export const errorShake: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -4, 4, -4, 4, 0],
    transition: { duration: 0.15 },
  },
};

// ---------------------------------------------------------------------------
// Floating label for form fields
// ---------------------------------------------------------------------------
export const floatingLabel: Variants = {
  rest: { y: 0, scale: 1, opacity: 0.5 },
  active: {
    y: -24,
    scale: 0.75,
    opacity: 1,
    transition: { duration: duration.fast, ease: ease.out },
  },
};

// ---------------------------------------------------------------------------
// Proof strip cycling (for auth screen)
// ---------------------------------------------------------------------------
export const proofCycle: Variants = {
  enter: { opacity: 0, y: 12 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.entrance, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: duration.normal, ease: ease.out },
  },
};

// ---------------------------------------------------------------------------
// Reduced Motion Hook
// ---------------------------------------------------------------------------

/**
 * Returns true when the user prefers reduced motion.
 * All animation variants should degrade to simple opacity fades when this is true.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

// ---------------------------------------------------------------------------
// Reduced-motion-aware variants helper
// ---------------------------------------------------------------------------

/**
 * Returns the given variants if motion is not reduced, otherwise returns
 * a simple opacity fade variant. Use this in components:
 *
 * ```tsx
 * const reduced = usePrefersReducedMotion();
 * <motion.div variants={safeVariants(fadeUp, reduced)} />
 * ```
 */
export function safeVariants(variants: Variants, prefersReduced: boolean): Variants {
  if (!prefersReduced) return variants;
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: duration.normal } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: duration.normal } },
  };
}
