"use client";

/** Styled native <select>: keeps native a11y + mobile pickers, loses the OS
 *  default chrome. `color-scheme: dark` makes the dropdown itself dark. */
export default function Select({
  value,
  onChange,
  label,
  className = "",
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string; // accessible name
  className?: string;
  children: React.ReactNode; // <option> elements
}) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={{ colorScheme: "dark" }}
        className="mono min-h-[32px] w-full cursor-pointer appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-1 pl-3 pr-8 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)]"
      >
        {children}
      </select>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden
        className="pointer-events-none absolute right-3 text-[var(--color-text-tertiary)]"
      >
        <path d="M1 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
