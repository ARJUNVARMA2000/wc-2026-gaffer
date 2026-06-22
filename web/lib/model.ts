// Client-side port of the GAFFER goal model (goals/blend.py + goals/dixon_coles.py)
// so the Head-to-Head tab can compute ANY matchup live. Kept in lock-step with the
// Python so model.json round-trips identically (verified in the build steps).

import type { ModelParams } from "./data";

const MAX = 10; // scoreline grid is (MAX+1) x (MAX+1)
const FACT: number[] = (() => {
  const f = [1];
  for (let i = 1; i <= MAX; i++) f[i] = f[i - 1] * i;
  return f;
})();

function poisson(lambda: number): number[] {
  const l = Math.max(lambda, 1e-6);
  const out: number[] = [];
  for (let k = 0; k <= MAX; k++) out[k] = (Math.exp(-l) * Math.pow(l, k)) / FACT[k];
  return out;
}

/** Confederation-weighted effective (attack, defense) for a team. */
function eff(p: ModelParams, team: string, w: number): [number, number] {
  const t = p.teams[team];
  if (!t) return [1, p.avgGoals];
  const f = Math.exp(0.5 * w * t.gap);
  return [t.atk * f, t.dfn / f];
}

export function expectedGoals(
  p: ModelParams,
  home: string,
  away: string,
  host: "home" | "away" | null = null
): [number, number] {
  const ch = p.teams[home]?.confederation;
  const ca = p.teams[away]?.confederation;
  const w = ch && ca && ch !== ca ? p.wCross : p.wSame;
  const [atkH, dfnH] = eff(p, home, w);
  const [atkA, dfnA] = eff(p, away, w);
  const lh = (host === "home" ? p.homeAdv : 1) * atkH * dfnA;
  const la = (host === "away" ? p.homeAdv : 1) * atkA * dfnH;
  return [lh, la];
}

/** Dixon-Coles scoreline matrix mat[h][a] = P(home h, away a). */
export function scorelineMatrix(lh: number, la: number, rho: number): number[][] {
  const ph = poisson(lh);
  const pa = poisson(la);
  const mat: number[][] = [];
  let sum = 0;
  for (let h = 0; h <= MAX; h++) {
    mat[h] = [];
    for (let a = 0; a <= MAX; a++) {
      let tau = 1;
      if (h === 0 && a === 0) tau = 1 - lh * la * rho;
      else if (h === 0 && a === 1) tau = 1 + lh * rho;
      else if (h === 1 && a === 0) tau = 1 + la * rho;
      else if (h === 1 && a === 1) tau = 1 - rho;
      const v = Math.max(ph[h] * pa[a] * tau, 0);
      mat[h][a] = v;
      sum += v;
    }
  }
  for (let h = 0; h <= MAX; h++) for (let a = 0; a <= MAX; a++) mat[h][a] /= sum;
  return mat;
}

export function outcomeProbs(mat: number[][]): { home: number; draw: number; away: number } {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h <= MAX; h++)
    for (let a = 0; a <= MAX; a++) {
      if (h > a) home += mat[h][a];
      else if (h === a) draw += mat[h][a];
      else away += mat[h][a];
    }
  return { home, draw, away };
}

export function mostLikelyScore(mat: number[][]): { h: number; a: number; p: number } {
  let best = { h: 0, a: 0, p: -1 };
  for (let h = 0; h <= MAX; h++)
    for (let a = 0; a <= MAX; a++)
      if (mat[h][a] > best.p) best = { h, a, p: mat[h][a] };
  return best;
}

export interface Matchup {
  lh: number;
  la: number;
  probs: { home: number; draw: number; away: number };
  likely: { h: number; a: number; p: number };
  matrix: number[][];
}

export function matchup(
  p: ModelParams,
  home: string,
  away: string,
  host: "home" | "away" | null = null
): Matchup {
  const [lh, la] = expectedGoals(p, home, away, host);
  const matrix = scorelineMatrix(lh, la, p.rho);
  return { lh, la, probs: outcomeProbs(matrix), likely: mostLikelyScore(matrix), matrix };
}
