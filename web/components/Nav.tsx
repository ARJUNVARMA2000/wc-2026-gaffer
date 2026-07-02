"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import type { Meta } from "@/lib/data";
import { DUR, EASE_OUT, SPRING } from "@/lib/motion";
import LiveStatus from "@/components/LiveStatus";
import Kbd from "@/components/ui/Kbd";

const LINKS = [
  ["/", "Projections"],
  ["/strength", "Strength"],
  ["/groups", "Groups"],
  ["/matches", "Matches"],
  ["/trends", "Trends"],
  ["/h2h", "Matchup"],
  ["/paths", "Paths"],
  ["/bracket", "Bracket"],
  ["/accuracy", "vs Market"],
  ["/method", "Method"],
];

const isActive = (href: string, path: string) => (href === "/" ? path === "/" : path.startsWith(href));

export default function Nav({ meta }: { meta: Meta }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  // Close the mobile menu on navigation ("adjust state during render" —
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setOpen(false);
  }

  // Escape closes the menu and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300"
      style={{
        background: scrolled || open ? "var(--color-bg-overlay)" : "transparent",
        borderBottom: `1px solid ${scrolled || open ? "var(--color-border)" : "transparent"}`,
        backdropFilter: scrolled || open ? "blur(16px) saturate(1.4)" : "none",
        WebkitBackdropFilter: scrolled || open ? "blur(16px) saturate(1.4)" : "none",
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="display text-lg tracking-tight text-[var(--color-text-primary)]">GAFFER</span>
          <span className="live-dot hidden h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] sm:block" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) => {
            const active = isActive(href, path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={SPRING.snappy}
                    className="absolute inset-0 rounded-full bg-[var(--color-accent-muted)]"
                  />
                )}
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LiveStatus initialMeta={meta} />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("gaffer:palette"))}
            aria-label="Open command palette"
            className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-2xs text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)] md:flex"
          >
            <Kbd>⌘K</Kbd>
          </button>
          <button
            ref={toggleRef}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Site navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE_OUT }}
            className="overflow-hidden border-t hairline lg:hidden"
          >
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
              className="flex flex-col gap-1 px-4 py-3"
            >
              {LINKS.map(([href, label]) => {
                const active = isActive(href, path);
                return (
                  <motion.div
                    key={href}
                    variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                  >
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {label}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
