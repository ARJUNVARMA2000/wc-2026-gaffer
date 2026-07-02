"use client";
import { MotionConfig } from "framer-motion";
import CommandPalette, { type PaletteTeam } from "@/components/ui/CommandPalette";

/** Root client providers: makes every framer-motion animation respect the
 *  user's reduced-motion preference, and hosts the ⌘K command palette. */
export default function Providers({
  teams,
  children,
}: {
  teams: PaletteTeam[];
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <CommandPalette teams={teams} />
    </MotionConfig>
  );
}
