"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Meta } from "@/lib/data";
import { timeAgo } from "@/lib/ui";

const LINKS = [
  ["/", "Projections"],
  ["/strength", "Strength"],
  ["/groups", "Groups"],
  ["/matches", "Matches"],
  ["/trends", "Trends"],
  ["/h2h", "Matchup"],
  ["/paths", "Paths"],
  ["/accuracy", "vs Market"],
  ["/method", "Method"],
];

export default function Nav({ meta }: { meta: Meta }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-[rgba(7,9,13,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="display text-2xl tracking-tight text-[var(--color-text)]">
            GAFFER
          </span>
          <span className="hidden h-1.5 w-1.5 rounded-full bg-[var(--color-lime)] sm:block live-dot" />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              data-active={href === "/" ? path === "/" : path.startsWith(href)}
              className="navlink text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border hairline px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lime)] live-dot" />
            <span className="mono text-[0.62rem] uppercase tracking-wider text-[var(--color-muted)]">
              Live · {timeAgo(meta.lastUpdated)}
            </span>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/[0.06] text-[var(--color-text)] transition-colors hover:border-[var(--color-lime)] hover:text-[var(--color-lime)] lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t hairline px-4 py-3 lg:hidden">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
