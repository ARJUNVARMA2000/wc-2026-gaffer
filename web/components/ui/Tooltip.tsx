"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING } from "@/lib/motion";

const PAD = 8; // min gap to the viewport edge

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** Controlled floating layer (charts, bracket slots): position it at a fixed
 *  viewport anchor; it clamps horizontally and animates in/out. */
export function TooltipFloat({
  open,
  x,
  y,
  placement = "above",
  children,
}: {
  open: boolean;
  x: number; // anchor center, viewport px
  y: number; // anchor edge, viewport px
  placement?: "above" | "below";
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const [half, setHalf] = useState(130);

  useLayoutEffect(() => {
    if (open && ref.current) setHalf(ref.current.offsetWidth / 2);
  }, [open, children]);

  if (!mounted) return null;
  const vw = window.innerWidth;
  const left = Math.min(Math.max(x, half + PAD), vw - half - PAD);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.96, y: placement === "above" ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
          transition={SPRING.gentle}
          role="tooltip"
          className="panel-glass pointer-events-none fixed z-[70] px-3 py-2.5 text-sm"
          style={{
            left,
            top: y,
            transform: undefined, // motion owns transform; offset via margins below
            translate: `-50% ${placement === "above" ? "-100%" : "0"}`,
            marginTop: placement === "above" ? -8 : 8,
            boxShadow: "var(--shadow-pop)",
            maxWidth: 280,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Hover/focus tooltip wrapper for arbitrary triggers. */
export default function Tooltip({
  content,
  className = "",
  children,
}: {
  content: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.top < 180; // flip under the trigger near the viewport top
    setState({ x: r.left + r.width / 2, y: below ? r.bottom : r.top, below });
  }, []);
  const hide = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, hide]);

  return (
    <span
      ref={anchorRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <TooltipFloat open={state !== null} x={state?.x ?? 0} y={state?.y ?? 0} placement={state?.below ? "below" : "above"}>
        {content}
      </TooltipFloat>
    </span>
  );
}
