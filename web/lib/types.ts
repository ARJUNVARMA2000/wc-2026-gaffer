// Shared data-shape types for the JSON contract in public/data/.
// Client-safe: no imports, no server-only. The getters live in lib/data.ts.

export type Confed = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC" | "UNK";

export interface Team {
  name: string;
  iso: string;
  confederation: Confed;
  group: string;
  host: boolean;
  elo: number;
  eloRank: number;
  rr: number;
  value: number;
  valueRank: number;
  attack: number;
  defense: number;
  tilt: number;
  champion: number;
  final: number;
  sf: number;
  qf: number;
  r16: number;
  ko: number;
  current: { played: number; points: number; gd: number; gf: number };
}

export interface GroupRow {
  name: string;
  iso: string;
  host: boolean;
  winGroup: number;
  advance: number;
  xPts: number;
  played: number;
  points: number;
  gd: number;
  gf: number;
  ga?: number;
}

export type MatchRound = "R32" | "R16" | "QF" | "SF" | "3P" | "F";

export interface Match {
  date: string;
  group: string | null; // null for knockout matches
  round?: MatchRound; // knockout matches only
  matchNo?: number; // knockout matches only (73..104)
  home: string;
  away: string;
  homeIso: string;
  awayIso: string;
  city: string;
  played: boolean;
  homeScore?: number; // knockout: includes extra time
  awayScore?: number;
  pens?: boolean; // knockout draw decided on penalties
  penWinner?: string;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  projHome?: number;
  projAway?: number;
  likelyHome?: number;
  likelyAway?: number;
  advHome?: number; // unplayed knockout: P(home advances), draws -> 50/50 pens
  modelProb?: number; // played: prob the model gave the actual result (lower = bigger upset)
  frozen?: boolean; // whether modelProb came from a frozen pre-match snapshot
}

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL" | "DONE";

export interface Meta {
  lastUpdated: string;
  dataThrough: string;
  nSims: number;
  groupMatchesPlayed: number;
  groupMatchesTotal: number;
  koMatchesPlayed?: number;
  koMatchesTotal?: number;
  stage?: Stage;
  nTeams: number;
  modelVersion: string;
  homeAdv: number;
  avgGoals: number;
  valuesLoaded?: number;
}

// ---- Kalshi comparison scorecard (scorecard.json) ----
export interface ScoreMetrics {
  n: number;
  logloss: number;
  brier: number;
  acc: number;
}

export interface Quote {
  ask: number | null;
  bid: number | null;
  mid: number | null;
}

export type Leg = "HOME" | "DRAW" | "AWAY";

export interface LedgerRow {
  date: string;
  home: string;
  away: string;
  homeIso: string;
  awayIso: string;
  homeScore: number;
  awayScore: number;
  outcome: number; // 0 home, 1 draw, 2 away
  gaffer: Record<Leg, number>;
  market: Record<Leg, Quote>;
  devig: Record<Leg, number> | null;
  bet: {
    leg: Leg;
    ask: number;
    edge: number;
    won: boolean;
    netFlat: number;
    stakeKelly: number;
    netKelly: number;
  } | null;
}

export interface Scorecard {
  meta: {
    generatedAt: string;
    nPlayed: number;
    nScored: number;
    nAccuracy: number;
    skipped: { noPrediction: number; noMarket: number };
    edgeMin: number;
    flatStake: number;
    kellyStart: number;
    kellyFraction: number;
  };
  accuracy: { n: number; gaffer: ScoreMetrics; kalshi: ScoreMetrics } | null;
  pnl: {
    flat: {
      staked: number;
      net: number;
      roi: number;
      nBets: number;
      wins: number;
      winRate: number;
      curve: number[];
    };
    kelly: { start: number; final: number; roi: number; curve: number[] };
  };
  ledger: LedgerRow[];
}

// ---- Paths (paths.json) ----
export interface PathOpp {
  opp: string;
  oppIso: string;
  prob: number; // P(face this opponent | reached this round)
  winProb: number; // this team's win prob vs that opponent
}
export interface TeamPath {
  name: string;
  iso: string;
  confederation: Confed;
  group: string;
  reachR32: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  champion: number;
  pathDifficulty: number; // 0 (kindest draw) .. 100 (cruelest)
  pathRank: number; // 1 = kindest
  expOppR32: number;
  expOppR16: number;
  rounds: { R32: PathOpp[]; R16: PathOpp[]; QF: PathOpp[]; SF: PathOpp[] };
}

// ---- History (history.json) ----
export interface SnapTeam {
  c: number; f: number; s: number; q: number; r: number; k: number; e: number;
}
export interface Snapshot {
  ts: string;
  date: string;
  played: number;
  teams: Record<string, SnapTeam>;
}
export interface Mover {
  name: string;
  from: number;
  to: number;
  delta: number;
}
export interface MoverSet {
  champ: { risers: Mover[]; fallers: Mover[] };
  elo: { risers: Mover[]; fallers: Mover[] };
}
export interface History {
  generatedAt: string;
  snapshots: Snapshot[];
  movers: { sinceStart: MoverSet; sinceLast: MoverSet };
}

// ---- Ratings history (ratings_history.json): {team: [{d,e}]} ----
export type RatingsHistory = Record<string, { d: string; e: number }[]>;

// ---- Model params (model.json) for client-side head-to-head ----
export interface ModelTeam {
  atk: number;
  dfn: number;
  gap: number;
  confederation: Confed;
  iso: string;
}
export interface ModelParams {
  homeAdv: number;
  rho: number;
  avgGoals: number;
  wSame: number;
  wCross: number;
  teams: Record<string, ModelTeam>;
}

// ---- Projected knockout bracket (bracket.json) ----
export type BracketRound = "R32" | "R16" | "QF" | "SF";

export interface BracketCandidate {
  name: string;
  iso: string;
  prob: number; // P(this team occupies this slot)
}
export interface BracketSlot {
  name: string;
  iso: string;
  seed: number; // strength seed = overall Elo rank
  group: string;
  slotLabel: string; // "Winner Grp E" (R32 only; "" for filled rounds)
  winPct: number; // P(beat the OTHER team in this match) — a.winPct + b.winPct = 1
  fav: boolean; // favourite (projected to advance)
  result?: "won" | "lost"; // set once the match is decided in reality
  candidates: BracketCandidate[]; // who else could fill this slot, for hover
}
export interface BracketMatch {
  match: number;
  round: BracketRound | "Final";
  a: BracketSlot;
  b: BracketSlot;
  decided?: boolean; // played and decided in reality
  aScore?: number; // final score (includes extra time)
  bScore?: number;
  pens?: boolean; // decided on penalties
  winner?: "a" | "b";
}
export type BracketSide = Record<BracketRound, BracketMatch[]>;
export interface BracketChampion {
  name: string;
  iso: string;
  seed: number;
  group: string;
  champion: number; // title odds (headline)
  winPct: number; // win-the-final, head-to-head
  candidates: BracketCandidate[]; // title contenders, for hover
}
export interface Bracket {
  nSims: number;
  left: BracketSide; // R32(8)/R16(4)/QF(2)/SF(1), top to bottom
  right: BracketSide;
  final: BracketMatch;
  champion: BracketChampion;
}
