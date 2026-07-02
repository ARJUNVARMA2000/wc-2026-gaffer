"use client";
import { motion } from "framer-motion";
import { SPRING } from "@/lib/motion";

/** The one animated probability bar. Width springs to the new value on every
 *  data change (live refresh glides old → new). `value` is 0..1 of the track. */
export default function Bar({
  value,
  color = "var(--color-accent)",
  height = 6,
  className = "",
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`bartrack w-full ${className}`} style={{ height }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={SPRING.bar}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

/** Multi-segment bar (e.g. W/D/L). Segments spring to new proportions. */
export function SegmentedBar({
  segments,
  height = 6,
  className = "",
}: {
  segments: { value: number; color: string; label?: string }[];
  height?: number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={`bartrack flex w-full ${className}`} style={{ height }}>
      {segments.map((s, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{ width: `${(s.value / total) * 100}%` }}
          transition={SPRING.bar}
          className="h-full"
          style={{ background: s.color }}
          title={s.label}
        />
      ))}
    </div>
  );
}
