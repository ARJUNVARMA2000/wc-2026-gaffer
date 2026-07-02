"use client";

import { motion } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";

export default function Reveal({
  children,
  delay = 0,
  y = 10,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
