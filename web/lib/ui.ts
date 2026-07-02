// Shared formatting + color helpers (safe in client and server components).

export const CONFED_COLOR: Record<string, string> = {
  UEFA: "var(--color-uefa)",
  CONMEBOL: "var(--color-conmebol)",
  CONCACAF: "var(--color-concacaf)",
  CAF: "var(--color-caf)",
  AFC: "var(--color-afc)",
  OFC: "var(--color-ofc)",
  UNK: "var(--color-text-tertiary)",
};

/** Low-chroma line palette for multi-series charts (title race etc). */
export const CHART_PALETTE = [
  "#828bfa", // accent indigo
  "#57c99b", // mint
  "#d3b862", // gold
  "#64aede", // sky
  "#d97883", // rose
  "#a98fe0", // violet
  "#55bfa0", // teal
  "#d69261", // amber
  "#7d9bee", // periwinkle
  "#9299a8", // grey
];

export function pct(x: number, digits = 1): string {
  if (x >= 0.9995) return "100%";
  if (x > 0 && x < 0.001) return "<0.1%";
  return `${(x * 100).toFixed(digits)}%`;
}

export function flagUrl(iso: string, w = 80): string {
  return `https://flagcdn.com/w${w}/${iso}.png`;
}

// Heat ramp: probability -> color, deep ink -> indigo (accent) -> teal ->
// mint -> gold ("trophy" stays at the top). Returns raw channels so callers
// can compose any alpha without producing invalid CSS.
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0.0, [16, 18, 26]],
  [0.15, [40, 47, 88]],
  [0.4, [84, 98, 201]],
  [0.65, [86, 166, 178]],
  [0.85, [87, 201, 155]],
  [1.0, [211, 184, 98]],
];

/** "r g b" channel triple for the heat ramp at probability p. */
export function heatChannels(p: number): string {
  let lo = HEAT_STOPS[0],
    hi = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (p >= HEAT_STOPS[i][0] && p <= HEAT_STOPS[i + 1][0]) {
      lo = HEAT_STOPS[i];
      hi = HEAT_STOPS[i + 1];
      break;
    }
  }
  const t = (p - lo[0]) / (hi[0] - lo[0] || 1);
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * t));
  return `${c[0]} ${c[1]} ${c[2]}`;
}

/** Valid CSS color for the heat ramp, at any alpha. */
export function heat(p: number, alpha = 1): string {
  return alpha >= 1 ? `rgb(${heatChannels(p)})` : `rgb(${heatChannels(p)} / ${alpha})`;
}

/** Text color that stays legible on a heat-tinted background. */
export function heatText(p: number): string {
  return p >= 0.62 ? "var(--color-on-accent)" : "var(--color-text-primary)";
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
