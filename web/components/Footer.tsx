"use client";
import Link from "next/link";
import type { Meta } from "@/lib/data";
import { useLiveData } from "@/lib/live";

const FORECAST = [
  ["/", "Projections"],
  ["/groups", "Groups"],
  ["/matches", "Matches"],
  ["/bracket", "Bracket"],
  ["/trends", "Trends"],
];

const MODEL = [
  ["/method", "Method"],
  ["/accuracy", "vs Market"],
  ["/strength", "Strength"],
  ["/h2h", "Matchup"],
  ["/paths", "Paths"],
];

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{title}</div>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls =
    "text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} inline-flex items-center gap-1`}>
        {children}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-[var(--color-text-tertiary)]">
          <path d="M2.5 7.5l5-5M4 2.5h3.5V6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export default function Footer({ meta: initialMeta }: { meta: Meta }) {
  const meta = useLiveData("meta", initialMeta);
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1240px] border-t hairline px-4 py-12 sm:px-6">
      <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
        <div className="col-span-2 max-w-sm sm:col-span-1">
          <div className="display text-lg">GAFFER</div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            A team-strength forecast engine for the 2026 FIFA World Cup — Elo ratings, a
            Dixon-Coles goal model and Monte Carlo simulation, refreshed automatically.
          </p>
        </div>
        <Column title="Forecast">
          {FORECAST.map(([href, label]) => (
            <li key={href}>
              <FooterLink href={href}>{label}</FooterLink>
            </li>
          ))}
        </Column>
        <Column title="Model">
          {MODEL.map(([href, label]) => (
            <li key={href}>
              <FooterLink href={href}>{label}</FooterLink>
            </li>
          ))}
        </Column>
        <Column title="Elsewhere">
          <li>
            <FooterLink href="https://github.com/ARJUNVARMA2000/wc-2026-gaffer" external>
              GitHub
            </FooterLink>
          </li>
          <li>
            <FooterLink href="https://arjun-varma.com/" external>
              arjun-varma.com
            </FooterLink>
          </li>
          <li className="pt-1 text-2xs leading-relaxed text-[var(--color-text-tertiary)]">
            Methodology after Michael Caley&apos;s PADDLIN&apos; and the Double Pivot podcast.
          </li>
        </Column>
      </div>
      <div className="mono mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-t hairline pt-5 text-2xs text-[var(--color-text-tertiary)]">
        <span>model v{meta.modelVersion}</span>
        <span aria-hidden>·</span>
        <span>{meta.nSims.toLocaleString("en-US")} simulations</span>
        <span aria-hidden>·</span>
        <span>data through {meta.dataThrough}</span>
        <span aria-hidden>·</span>
        <span>built with Next.js</span>
      </div>
    </footer>
  );
}
