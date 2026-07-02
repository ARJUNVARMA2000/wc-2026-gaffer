"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/** Animated number that writes textContent imperatively (no per-frame React
 *  re-renders) and tweens from the previously displayed value on data
 *  changes, so live refreshes glide old → new instead of re-counting from 0. */
export default function CountUp({
  value,
  duration = 1.1,
  decimals = 1,
  suffix = "",
  prefix = "",
  delay = 0,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const shown = useRef(0);
  // MotionConfig doesn't govern the imperative animate() API — check locally.
  const reduced = useReducedMotion();

  const fmt = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduced) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    const from = shown.current;
    const controls = animate(from, value, {
      duration,
      delay: from === 0 ? delay : 0, // stagger only on first reveal
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, duration, delay, decimals, prefix, suffix, reduced]);

  // Always hydrate from 0 (matches SSR HTML); the effect immediately writes
  // the final value for reduced-motion users via textContent.
  return (
    <span ref={ref} className="mono tabular-nums">
      {fmt(0)}
    </span>
  );
}
