import Link from "next/link";
import type { Meta } from "@/lib/data";

export default function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1240px] border-t hairline px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-6 sm:flex-row">
        <div className="max-w-md">
          <div className="display text-xl">GAFFER</div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            A team-strength forecast for the 2026 FIFA World Cup. Methodology inspired by
            Michael Caley&apos;s PADDLIN&apos; and the Double Pivot podcast. Built on public
            international results data.
          </p>
        </div>
        <div className="mono text-xs text-[var(--color-faint)]">
          <div>model v{meta.modelVersion}</div>
          <div>{meta.nSims.toLocaleString()} simulations</div>
          <div>data through {meta.dataThrough}</div>
          <Link href="/method" className="mt-2 inline-block text-[var(--color-lime)] hover:underline">
            How it works →
          </Link>
        </div>
      </div>
    </footer>
  );
}
