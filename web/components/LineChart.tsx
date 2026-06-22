"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[]; // x = ms timestamp, sorted ascending
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LineChart({
  series,
  height = 300,
  yFormat = (v) => v.toFixed(0),
  xFormat = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  yZero = false,
}: {
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (ms: number) => string;
  yZero?: boolean; // force y-axis to include 0
}) {
  const W = 760;
  const H = height;
  const m = { t: 16, r: 16, b: 28, l: 44 };
  const [hoverX, setHoverX] = useState<number | null>(null);

  const { xs, xMin, xMax, yMin, yMax, maps } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const xsSet = Array.from(new Set(all.map((p) => p.x))).sort((a, b) => a - b);
    const ys = all.map((p) => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (yZero) lo = Math.min(lo, 0);
    const pad = (hi - lo) * 0.1 || 1;
    const maps = new Map(series.map((s) => [s.key, new Map(s.points.map((p) => [p.x, p.y]))]));
    return {
      xs: xsSet,
      xMin: xsSet[0] ?? 0,
      xMax: xsSet[xsSet.length - 1] ?? 1,
      yMin: lo - pad,
      yMax: hi + pad,
      maps,
    };
  }, [series, yZero]);

  const px = (x: number) => m.l + ((x - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
  const py = (y: number) => m.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - m.t - m.b);

  const yticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / n);
  }, [yMin, yMax]);

  const xticks = xs.length <= 4 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]];

  const nearest =
    hoverX == null ? null : xs.reduce((b, x) => (Math.abs(x - hoverX) < Math.abs(b - hoverX) ? x : b), xs[0]);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
        {/* y gridlines + labels */}
        {yticks.map((v, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={py(v)} y2={py(v)} stroke="var(--color-line)" strokeWidth="0.5" />
            <text x={m.l - 6} y={py(v) + 3} textAnchor="end" className="mono" fontSize="9" fill="var(--color-faint)">
              {yFormat(v)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xticks.map((x, i) => (
          <text key={i} x={px(x)} y={H - 8} textAnchor="middle" className="mono" fontSize="9" fill="var(--color-faint)">
            {xFormat(x)}
          </text>
        ))}
        {/* series lines */}
        {series.map((s) => {
          const pts = s.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
          return (
            <g key={s.key}>
              <motion.polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, ease: EASE }}
              />
              {s.points.length <= 8 &&
                s.points.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r="2.5" fill={s.color} />)}
            </g>
          );
        })}
        {/* hover crosshair + dots */}
        {nearest != null && (
          <g>
            <line x1={px(nearest)} x2={px(nearest)} y1={m.t} y2={H - m.b} stroke="var(--color-muted)" strokeWidth="0.6" strokeDasharray="3 3" />
            {series.map((s) => {
              const y = maps.get(s.key)?.get(nearest);
              return y == null ? null : <circle key={s.key} cx={px(nearest)} cy={py(y)} r="4" fill={s.color} stroke="var(--color-ink)" strokeWidth="1.5" />;
            })}
          </g>
        )}
        {/* hover capture */}
        <rect
          x={m.l}
          y={m.t}
          width={W - m.l - m.r}
          height={H - m.t - m.b}
          fill="transparent"
          onMouseMove={(e) => {
            const r = (e.target as SVGRectElement).getBoundingClientRect();
            const frac = (e.clientX - r.left) / r.width;
            setHoverX(xMin + frac * (xMax - xMin));
          }}
          onMouseLeave={() => setHoverX(null)}
        />
      </svg>
      {/* tooltip */}
      {nearest != null && (
        <div className="pointer-events-none mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="mono text-[0.62rem] text-[var(--color-muted)]">{xFormat(nearest)}</span>
          {series.map((s) => {
            const y = maps.get(s.key)?.get(nearest);
            return y == null ? null : (
              <span key={s.key} className="mono text-[0.62rem]" style={{ color: s.color }}>
                {s.label} {yFormat(y)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
