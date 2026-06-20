// Shared formatting + color helpers (safe in client and server components).

export const CONFED_COLOR: Record<string, string> = {
  UEFA: "var(--color-uefa)",
  CONMEBOL: "var(--color-conmebol)",
  CONCACAF: "var(--color-concacaf)",
  CAF: "var(--color-caf)",
  AFC: "var(--color-afc)",
  OFC: "var(--color-ofc)",
  UNK: "var(--color-faint)",
};

export function pct(x: number, digits = 1): string {
  if (x >= 0.9995) return "100%";
  if (x > 0 && x < 0.001) return "<0.1%";
  return `${(x * 100).toFixed(digits)}%`;
}

export function flagUrl(iso: string, w = 80): string {
  return `https://flagcdn.com/w${w}/${iso}.png`;
}

// Heatmap: probability -> color (ink -> cyan -> lime -> gold) for advancement cells.
export function heatColor(p: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.0, [17, 22, 31]],
    [0.15, [38, 60, 78]],
    [0.4, [40, 110, 140]],
    [0.65, [120, 190, 90]],
    [0.85, [200, 255, 60]],
    [1.0, [255, 194, 75]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = (p - lo[0]) / (hi[0] - lo[0] || 1);
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function heatText(p: number): string {
  return p >= 0.62 ? "#07090d" : "var(--color-text)";
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
