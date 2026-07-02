// Shared motion vocabulary. Rules:
//  - Entrances: `fadeRise`/`scaleIn` variants inside a `staggerChildren`
//    parent — never hand-computed per-item `delay: i * x` math.
//  - Reorders: `layout` prop + SPRING.snappy, keyed by a stable id.
//  - Data changes (live refresh): tween old -> new via `animate` on
//    width/value with SPRING.bar — never re-fire an `initial` from zero.
//  - Enter/exit of filtered lists: <AnimatePresence mode="popLayout">.
//  - Hover <= 0.15s, entrances <= 0.5s.
import type { Variants } from "framer-motion";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DUR = { fast: 0.15, base: 0.25, slow: 0.5, draw: 0.9 } as const;

export const SPRING = {
  /** layout FLIP for table rows / list reorders */
  snappy: { type: "spring", stiffness: 520, damping: 42 } as const,
  /** tooltips, popovers, palette */
  gentle: { type: "spring", stiffness: 300, damping: 34 } as const,
  /** bar widths / data value tweens */
  bar: { type: "spring", stiffness: 180, damping: 26 } as const,
};

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING.gentle },
};

export const staggerChildren = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Spread onto interactive cards/buttons: subtle lift + press. */
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
} as const;
