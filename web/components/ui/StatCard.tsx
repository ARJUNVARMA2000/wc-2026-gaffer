"use client";
import { motion } from "framer-motion";
import { fadeRise } from "@/lib/motion";
import CountUp from "@/components/CountUp";

/** Labeled stat with an animated value. Designed to sit inside a
 *  staggerChildren parent (it's a `fadeRise` item). */
export default function StatCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  sub,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  sub?: string;
}) {
  return (
    <motion.div variants={fadeRise}>
      <div className="display text-2xl text-[var(--color-text-primary)]">
        <CountUp value={value} decimals={decimals} suffix={suffix} prefix={prefix} />
      </div>
      <div className="eyebrow mt-1.5">{label}</div>
      {sub && <div className="mono mt-0.5 text-2xs text-[var(--color-text-tertiary)]">{sub}</div>}
    </motion.div>
  );
}
