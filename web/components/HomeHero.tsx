"use client";
import { motion } from "framer-motion";
import { fadeRise, staggerChildren } from "@/lib/motion";
import { useLiveData } from "@/lib/live";
import type { Meta } from "@/lib/types";
import StatCard from "@/components/ui/StatCard";

/** Home hero: eyebrow with live dot, the site's one gradient-text headline,
 *  lede, and a staggered row of live model stats. */
export default function HomeHero({ meta: initial }: { meta: Meta }) {
  const meta = useLiveData("meta", initial);

  return (
    <motion.div variants={staggerChildren(0.07)} initial="hidden" animate="show">
      <motion.div variants={fadeRise} className="eyebrow flex items-center gap-3">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        FIFA World Cup 2026 · Live Forecast
      </motion.div>

      <motion.h1
        variants={fadeRise}
        className="display mt-4 text-[clamp(2.6rem,6vw,4.5rem)] text-[var(--color-text-primary)]"
        // .display owns letter-spacing (unlayered class beats utilities) — inline wins.
        style={{ letterSpacing: "-0.03em" }}
      >
        Who wins the
        <br />
        <span className="text-gradient">World Cup?</span>
      </motion.h1>

      <motion.p
        variants={fadeRise}
        className="mt-5 max-w-xl text-base text-[var(--color-text-secondary)]"
      >
        GAFFER rates every national team from 150 years of international results, blends in
        Transfermarkt squad value, turns it into goal expectations with a Dixon-Coles model, and
        plays the tournament out{" "}
        <span className="text-[var(--color-text-primary)]">
          {meta.nSims.toLocaleString("en-US")} times
        </span>
        . These are the odds it spits back — updated as the games are played.
      </motion.p>

      <motion.div variants={staggerChildren(0.05)} className="mt-8 flex flex-wrap gap-x-10 gap-y-6">
        <StatCard label="Simulations" value={meta.nSims / 1000} suffix="k" />
        <StatCard
          label="Group games"
          value={meta.groupMatchesPlayed}
          suffix={`/${meta.groupMatchesTotal}`}
        />
        <StatCard label="Teams" value={meta.nTeams} />
        <StatCard label="Goals / game" value={meta.avgGoals} decimals={2} />
        <StatCard label="Home edge" value={meta.homeAdv} prefix="×" decimals={2} />
      </motion.div>
    </motion.div>
  );
}
