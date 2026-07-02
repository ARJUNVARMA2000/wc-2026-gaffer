"use client";
import { motion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/** Re-mounts per navigation: gives every page a single entrance without
 *  per-page choreography. Enter-only — no exit hacks under static export. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
