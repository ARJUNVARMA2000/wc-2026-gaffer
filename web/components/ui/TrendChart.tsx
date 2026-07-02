"use client";
// TrendChart — the single time-series primitive (replaces the old LineChart
// and ScorecardView's hand-rolled Spark).
//
// Prop surface (minimal; serves every call site):
//   series     TrendSeries[]: { key, label, color, points: {x, y}[] } — x
//              ascending (ms timestamps for axis charts; any monotonic number,
//              e.g. bet index, for sparklines).
//   height     plot height in px (default 300).
//   yFormat    y-tick / tooltip value formatter (default v.toFixed(0)).
//   xFormat    x-tick / tooltip formatter (default "Jun 12" from ms).
//   yZero      force the y domain to include 0.
//   baseline   dashed reference line at this y, included in the y domain
//              (equity-curve break-even).
//   area       gradient fill (series color → transparent) under each line.
//   sparkline  minimal mode: no axes / gridlines / crosshair; fixed viewBox
//              stretched to the container (preserveAspectRatio="none") with a
//              non-scaling stroke — like the old Spark.
//   ariaLabel  accessible name (axis mode: focusable SVG with role="img").
//
// Responsive: a ResizeObserver measures the container and the SVG renders at
// real pixel width, so fontSize-10 axis labels stay crisp (no blurry scaled
// fixed-760 viewBox). Motion: lines draw on via pathLength once in view;
// same-shape data changes tween the path (framer animates `d`) instead of
// re-firing the entrance; gridlines fade in. Crosshair: pointer events
// (mouse + touch) with nearest-x snap and a spring-chasing vertical line;
// values render in a floating TooltipFloat anchored at the crosshair — no
// layout shift. Keyboard: focus the SVG, ←/→ step through points,
// Escape/blur clears.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useSpring } from "framer-motion";
import { DUR, EASE_OUT, SPRING } from "@/lib/motion";
import { TooltipFloat } from "@/components/ui/Tooltip";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[]; // sorted ascending by x
}

const AXIS_M = { t: 12, r: 12, b: 26, l: 46 };
const SPARK_W = 100; // sparkline viewBox width, stretched to the container

export default function TrendChart({
  series,
  height = 300,
  yFormat = (v: number) => v.toFixed(0),
  xFormat = (x: number) =>
    new Date(x).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  yZero = false,
  baseline,
  area = false,
  sparkline = false,
  ariaLabel,
}: {
  series: TrendSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (x: number) => string;
  yZero?: boolean;
  baseline?: number;
  area?: boolean;
  sparkline?: boolean;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(wrapRef, { once: true, margin: "-40px" });
  const [drawn, setDrawn] = useState(false); // first draw-on finished → later remounts snap
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // ---- responsive width (axis mode only; sparklines stretch a fixed box) ----
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || sparkline) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width ?? 0;
      setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sparkline]);

  const W = sparkline ? SPARK_W : w;
  const H = height;
  const m = sparkline ? { t: 0, r: 0, b: 0, l: 0 } : AXIS_M;

  // ---- domain ----
  const { xs, xMin, xMax, yMin, yMax, byKey } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const xsArr = Array.from(new Set(all.map((p) => p.x))).sort((a, b) => a - b);
    const ys = all.map((p) => p.y);
    if (baseline !== undefined) ys.push(baseline);
    if (yZero) ys.push(0);
    const lo = ys.length ? Math.min(...ys) : 0;
    const hi = ys.length ? Math.max(...ys) : 1;
    const pad = (hi - lo) * (sparkline ? 0.12 : 0.1) || 1;
    return {
      xs: xsArr,
      xMin: xsArr[0] ?? 0,
      xMax: xsArr[xsArr.length - 1] ?? 1,
      yMin: lo - pad,
      yMax: hi + pad,
      byKey: new Map(series.map((s) => [s.key, new Map(s.points.map((p) => [p.x, p.y]))])),
    };
  }, [series, yZero, baseline, sparkline]);

  const px = useCallback(
    (x: number) => m.l + ((x - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r),
    [m.l, m.r, xMin, xMax, W],
  );
  const py = useCallback(
    (y: number) => m.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b),
    [m.t, m.b, yMin, yMax, H],
  );

  const lineD = useCallback(
    (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`).join(" "),
    [px, py],
  );
  const areaD = useCallback(
    (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return "";
      const bottom = H - m.b;
      return `${lineD(pts)} L${px(pts[pts.length - 1].x)},${bottom} L${px(pts[0].x)},${bottom} Z`;
    },
    [lineD, px, H, m.b],
  );

  // ---- crosshair (axis mode) ----
  const [ci, setCi] = useState<number | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, below: false });
  const springX = useSpring(0, {
    stiffness: SPRING.gentle.stiffness,
    damping: SPRING.gentle.damping,
  });

  const moveTo = useCallback(
    (i: number) => {
      const svg = svgRef.current;
      if (!svg || xs.length === 0) return;
      const idx = Math.max(0, Math.min(xs.length - 1, i));
      const cx = px(xs[idx]);
      if (ci === null) springX.jump(cx);
      else springX.set(cx);
      const rect = svg.getBoundingClientRect();
      const below = rect.top + m.t < 170; // flip under the plot near the viewport top
      setAnchor({ x: rect.left + cx, y: below ? rect.top + H - m.b : rect.top + m.t, below });
      setCi(idx);
    },
    [xs, px, ci, springX, m.t, m.b, H],
  );

  const clear = useCallback(() => setCi(null), []);

  // Escape clears the crosshair even when it was opened by hover (SVG unfocused).
  const open = ci !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clear();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, clear]);

  const onPointer = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const svg = svgRef.current;
      if (!svg || xs.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const fx = xMin + ((e.clientX - rect.left - m.l) / (W - m.l - m.r || 1)) * (xMax - xMin);
      let best = 0;
      for (let i = 1; i < xs.length; i++) {
        if (Math.abs(xs[i] - fx) < Math.abs(xs[best] - fx)) best = i;
      }
      moveTo(best);
    },
    [xs, xMin, xMax, m.l, m.r, W, moveTo],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (xs.length === 0) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.key === "ArrowLeft" ? -1 : 1;
        moveTo(ci === null ? (step === -1 ? xs.length - 1 : 0) : ci + step);
      } else if (e.key === "Escape") {
        clear();
      }
    },
    [xs.length, ci, moveTo, clear],
  );

  // ---- ticks (axis mode) ----
  const yTicks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / n);
  }, [yMin, yMax]);

  const xTicks = useMemo(() => {
    if (xs.length === 0) return [];
    const n = Math.max(2, Math.min(6, Math.floor(W / 130)));
    if (xs.length <= n) return xs;
    return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
  }, [xs, W]);

  // Shared per-series line: draws on once in view, then tweens `d` on data
  // changes with the same shape; remounts (shape/width change) snap instead
  // of re-firing the entrance.
  const renderLine = (s: TrendSeries) => {
    const d = lineD(s.points);
    return (
      <motion.path
        key={`${s.key}:${s.points.length}:${W}`}
        d={d}
        initial={drawn ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: inView ? 1 : 0, opacity: inView ? 1 : 0, d }}
        transition={{
          pathLength: { duration: DUR.draw, ease: EASE_OUT },
          opacity: { duration: DUR.base, ease: EASE_OUT },
          d: { duration: DUR.slow, ease: EASE_OUT },
        }}
        onAnimationComplete={() => {
          if (inView && !drawn) setDrawn(true);
        }}
        fill="none"
        style={{ stroke: s.color }}
        strokeWidth={sparkline ? 1.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect={sparkline ? "non-scaling-stroke" : undefined}
      />
    );
  };

  const renderArea = (s: TrendSeries) => {
    const gid = `${uid}-${s.key.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const d = areaD(s.points);
    return (
      <g key={`a-${s.key}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <motion.path
          key={`${s.key}:${s.points.length}:${W}`}
          d={d}
          initial={drawn ? false : { opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0, d }}
          transition={{
            opacity: { duration: DUR.slow, ease: EASE_OUT, delay: 0.15 },
            d: { duration: DUR.slow, ease: EASE_OUT },
          }}
          fill={`url(#${gid})`}
          stroke="none"
        />
      </g>
    );
  };

  // ================= sparkline mode =================
  if (sparkline) {
    return (
      <div ref={wrapRef} className="w-full">
        <svg
          viewBox={`0 0 ${SPARK_W} ${H}`}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height: H }}
          role={ariaLabel ? "img" : undefined}
          aria-label={ariaLabel}
          aria-hidden={ariaLabel ? undefined : true}
        >
          {baseline !== undefined && (
            <line
              x1={0}
              x2={SPARK_W}
              y1={py(baseline)}
              y2={py(baseline)}
              style={{ stroke: "var(--color-border-strong)" }}
              strokeWidth={1}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {area && series.filter((s) => s.points.length > 1).map(renderArea)}
          {series.filter((s) => s.points.length > 1).map(renderLine)}
        </svg>
      </div>
    );
  }

  // ================= axis mode =================
  const ready = W > 0 && xs.length > 0;
  const cx = ci !== null && ci < xs.length ? xs[ci] : null;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
      <svg
        ref={svgRef}
        width={Math.max(W, 0)}
        height={H}
        className="block"
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onBlur={clear}
        onFocus={() => {
          if (ci === null && xs.length > 0) moveTo(xs.length - 1);
        }}
      >
        {ready && (
          <>
            {/* gridlines + labels fade in */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: inView ? 1 : 0 }}
              transition={{ duration: DUR.slow, ease: EASE_OUT }}
            >
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line
                    x1={m.l}
                    x2={W - m.r}
                    y1={py(v)}
                    y2={py(v)}
                    style={{ stroke: "var(--color-border)" }}
                    strokeWidth={1}
                  />
                  <text
                    x={m.l - 8}
                    y={py(v) + 3}
                    textAnchor="end"
                    className="mono"
                    fontSize={10}
                    style={{ fill: "var(--color-text-tertiary)" }}
                  >
                    {yFormat(v)}
                  </text>
                </g>
              ))}
              {xTicks.map((x, i) => (
                <text
                  key={i}
                  x={px(x)}
                  y={H - 8}
                  textAnchor="middle"
                  className="mono"
                  fontSize={10}
                  style={{ fill: "var(--color-text-tertiary)" }}
                >
                  {xFormat(x)}
                </text>
              ))}
              {baseline !== undefined && (
                <line
                  x1={m.l}
                  x2={W - m.r}
                  y1={py(baseline)}
                  y2={py(baseline)}
                  style={{ stroke: "var(--color-border-strong)" }}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              )}
            </motion.g>

            {/* area fills under lines */}
            {area && series.filter((s) => s.points.length > 1).map(renderArea)}

            {/* series lines */}
            {series.filter((s) => s.points.length > 0).map(renderLine)}

            {/* crosshair: spring-chasing vertical line + per-series dots */}
            {cx !== null && (
              <motion.g style={{ x: springX }}>
                <line
                  x1={0}
                  x2={0}
                  y1={m.t}
                  y2={H - m.b}
                  style={{ stroke: "var(--color-border-strong)" }}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {series.map((s) => {
                  const yv = byKey.get(s.key)?.get(cx);
                  return yv === undefined ? null : (
                    <motion.circle
                      key={s.key}
                      cx={0}
                      initial={false}
                      animate={{ cy: py(yv) }}
                      transition={{ duration: DUR.fast, ease: EASE_OUT }}
                      r={3.5}
                      style={{ fill: s.color, stroke: "var(--color-bg)" }}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </motion.g>
            )}

            {/* pointer capture (mouse + touch) */}
            <rect
              x={m.l}
              y={m.t}
              width={Math.max(0, W - m.l - m.r)}
              height={Math.max(0, H - m.t - m.b)}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={clear}
            />
          </>
        )}
      </svg>

      {/* floating values at the crosshair — never shifts layout */}
      <TooltipFloat
        open={cx !== null}
        x={anchor.x}
        y={anchor.y}
        placement={anchor.below ? "below" : "above"}
      >
        {cx !== null && (
          <div className="flex min-w-[140px] flex-col gap-1">
            <div className="mono text-2xs text-[var(--color-text-tertiary)]">{xFormat(cx)}</div>
            {series.map((s) => {
              const yv = byKey.get(s.key)?.get(cx);
              return yv === undefined ? null : (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="text-xs text-[var(--color-text-secondary)]">{s.label}</span>
                  <span className="mono ml-auto pl-3 text-xs text-[var(--color-text-primary)]">
                    {yFormat(yv)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </TooltipFloat>

      {/* keyboard crosshair values for screen readers */}
      <span className="sr-only" aria-live="polite">
        {cx !== null
          ? `${xFormat(cx)}: ${series
              .map((s) => {
                const yv = byKey.get(s.key)?.get(cx);
                return yv === undefined ? null : `${s.label} ${yFormat(yv)}`;
              })
              .filter(Boolean)
              .join(", ")}`
          : ""}
      </span>
    </div>
  );
}
