/** Mono caption row under panels/tables. */
export default function Footnote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`mono mt-3 text-2xs text-[var(--color-text-tertiary)] ${className}`}>{children}</p>
  );
}
