"use client";
import { motion } from "framer-motion";
import { heat, pct } from "@/lib/ui";
import { DUR } from "@/lib/motion";

/** Probability pill tinted by the heat ramp. Background/text animate on data
 *  changes. (Replaces the old invalid rgb()+hex-alpha suffix idiom.) */
export default function HeatPill({
  p,
  digits = 1,
  className = "",
}: {
  p: number;
  digits?: number;
  className?: string;
}) {
  return (
    <motion.span
      animate={{
        backgroundColor: heat(p, 0.14),
        color: p >= 0.62 ? heat(p) : "var(--color-text-secondary)",
      }}
      transition={{ duration: DUR.base }}
      className={`mono inline-block min-w-[52px] rounded-md px-1.5 py-0.5 text-center text-xs ${className}`}
    >
      {pct(p, digits)}
    </motion.span>
  );
}
