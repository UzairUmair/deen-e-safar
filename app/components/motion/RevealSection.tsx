"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

/** Fades a block up into place the first time it scrolls into view. */
export function RevealSection({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const Tag = motion[as];
  const reduced = useReducedMotion();
  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : Math.min(delay, 0.32), ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}
