"use client";
import { useId } from "react";
import { motion } from "framer-motion";
import { SPRING } from "@/lib/motion";

/** Segmented control with a sliding active pill (shared layoutId). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative min-h-[26px] cursor-pointer rounded-full px-3 font-[family-name:var(--font-mono)] text-2xs uppercase tracking-[0.08em] transition-colors ${
              active
                ? "text-[var(--color-on-accent)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING.snappy}
                className="absolute inset-0 rounded-full bg-[var(--color-accent)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
