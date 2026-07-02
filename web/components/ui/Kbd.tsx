/** Keyboard key cap, e.g. <Kbd>⌘K</Kbd>. */
export default function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mono inline-flex items-center rounded-[var(--radius-xs)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-2xs text-[var(--color-text-secondary)]">
      {children}
    </kbd>
  );
}
