"use client";
import { motion } from "framer-motion";

/** Filter chip. Interactive when onClick is given; static badge otherwise.
 *  `color` is the active background (defaults to the accent). */
export default function Chip({
  active = false,
  onClick,
  color = "var(--color-accent)",
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  color?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const style = {
    color: active ? "var(--color-on-accent)" : "var(--color-text-secondary)",
    background: active ? color : "transparent",
    borderColor: active ? "transparent" : "var(--color-border)",
  };
  if (!onClick) {
    return (
      <span className="chip inline-flex min-h-[24px] items-center" style={style} title={title}>
        {children}
      </span>
    );
  }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      aria-pressed={active}
      title={title}
      className="chip inline-flex min-h-[28px] cursor-pointer items-center transition-colors hover:text-[var(--color-text-primary)]"
      style={style}
    >
      {children}
    </motion.button>
  );
}
