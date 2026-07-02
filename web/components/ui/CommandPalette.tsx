"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING } from "@/lib/motion";
import { flagUrl } from "@/lib/ui";

export interface PaletteTeam {
  name: string;
  iso: string;
}

const PAGES: { label: string; href: string; hint: string }[] = [
  { label: "Projections", href: "/", hint: "title odds board" },
  { label: "Strength", href: "/strength", hint: "elo · attack · defense" },
  { label: "Groups", href: "/groups", hint: "group standings + odds" },
  { label: "Matches", href: "/matches", hint: "fixtures + results" },
  { label: "Trends", href: "/trends", hint: "odds over time" },
  { label: "Matchup", href: "/h2h", hint: "head-to-head simulator" },
  { label: "Paths", href: "/paths", hint: "road to the final" },
  { label: "Bracket", href: "/bracket", hint: "projected knockout tree" },
  { label: "vs Market", href: "/accuracy", hint: "model vs kalshi" },
  { label: "Method", href: "/method", hint: "how it works" },
];

type Item =
  | { kind: "page"; label: string; href: string; hint: string }
  | { kind: "team"; label: string; href: string; iso: string };

const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

/** ⌘K command palette: jump to any page or team. Hand-rolled, no deps. */
export default function CommandPalette({ teams }: { teams: PaletteTeam[] }) {
  const mounted = useMounted();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcuts: ⌘K / Ctrl+K anywhere, "/" outside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (
        e.key === "/" &&
        !open &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("gaffer:palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("gaffer:palette", onOpenEvent);
    };
  }, [open]);

  // Reset the query/selection when the palette opens ("adjust state during
  // render" pattern — avoids a cascading setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSel(0);
    }
  }

  // Lock body scroll + focus the input while open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // autoFocus is unreliable inside AnimatePresence — focus explicitly.
      requestAnimationFrame(() => inputRef.current?.focus());
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.hint.includes(q),
    ).map((p): Item => ({ kind: "page", ...p }));
    const teamItems = teams
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : false))
      .slice(0, 8)
      .map(
        (t): Item => ({ kind: "team", label: t.name, href: `/h2h?a=${t.iso}`, iso: t.iso }),
      );
    return [...pages, ...teamItems];
  }, [query, teams]);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && items[sel]) {
      e.preventDefault();
      go(items[sel]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      e.preventDefault(); // single-field dialog: keep focus in the input
    }
  };

  // Keep the active option in view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-[var(--color-bg-overlay)] px-4 pt-[14vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.12 } }}
            transition={SPRING.gentle}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="panel-glass w-full max-w-[560px] overflow-hidden !rounded-[var(--radius-xl)]"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-[var(--color-text-tertiary)]">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSel(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Jump to a page or team…"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={items[sel] ? `palette-item-${sel}` : undefined}
                className="w-full bg-transparent py-3.5 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
              <span className="eyebrow shrink-0">esc</span>
            </div>
            <div ref={listRef} id="palette-list" role="listbox" className="max-h-[46vh] overflow-y-auto p-1.5">
              {items.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                  No matches for “{query}”
                </div>
              )}
              {items.map((item, i) => (
                <div
                  key={item.href + item.label}
                  id={`palette-item-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(item);
                  }}
                  className="relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5"
                >
                  {i === sel && (
                    <motion.div
                      layoutId="palette-highlight"
                      transition={SPRING.snappy}
                      className="absolute inset-0 rounded-md bg-[var(--color-accent-muted)]"
                    />
                  )}
                  {item.kind === "team" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={flagUrl(item.iso, 40)}
                      alt=""
                      width={18}
                      height={13.5}
                      className="relative rounded-[2px] ring-1 ring-white/10"
                    />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="relative text-[var(--color-text-tertiary)]">
                      <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      <path d="M4.5 7.5l2 2 3-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span className="relative text-sm text-[var(--color-text-primary)]">{item.label}</span>
                  <span className="relative ml-auto text-2xs text-[var(--color-text-tertiary)]">
                    {item.kind === "page" ? item.hint : "matchup"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
