"use client";
import { motion } from "framer-motion";
import { fadeRise, staggerChildren } from "@/lib/motion";

/** Standard page/section header: staggered eyebrow → title → lede. */
export default function PageHeader({
  eyebrow,
  title,
  lede,
  right,
  as: Tag = "h1",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  right?: React.ReactNode;
  as?: "h1" | "h2";
}) {
  const big = Tag === "h1";
  return (
    <motion.div
      variants={staggerChildren(0.07)}
      initial="hidden"
      animate="show"
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <motion.div variants={fadeRise} className="eyebrow">
          {eyebrow}
        </motion.div>
        <motion.div variants={fadeRise}>
          <Tag className={`display mt-3 ${big ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{title}</Tag>
        </motion.div>
        {lede && (
          <motion.p
            variants={fadeRise}
            className="mt-4 max-w-2xl text-base text-[var(--color-text-secondary)]"
          >
            {lede}
          </motion.p>
        )}
      </div>
      {right && <motion.div variants={fadeRise}>{right}</motion.div>}
    </motion.div>
  );
}

/** Smaller tier for in-page sections. */
export function SectionHeader(props: Omit<Parameters<typeof PageHeader>[0], "as">) {
  return <PageHeader {...props} as="h2" />;
}
