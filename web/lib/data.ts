import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
}

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

export interface Match {
  date: string;
  group: string;
  home: string;
  away: string;
  homeIso: string;
  awayIso: string;
  city: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  projHome?: number;
  projAway?: number;
  likelyHome?: number;
  likelyAway?: number;
  modelProb?: number; // played: prob the model gave the actual result (lower = bigger upset)
  frozen?: boolean; // whether modelProb came from a frozen pre-match snapshot
}

export interface Meta {
  lastUpdated: string;
  dataThrough: string;
  nSims: number;
  groupMatchesPlayed: number;
  groupMatchesTotal: number;
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

export const getTeams = cache((): Team[] => read<Team[]>("teams.json"));
export const getGroups = cache((): Record<string, GroupRow[]> => read("groups.json"));
export const getMatches = cache((): Match[] => read<Match[]>("matches.json"));
export const getMeta = cache((): Meta => read<Meta>("meta.json"));
export const getScorecard = cache((): Scorecard => read<Scorecard>("scorecard.json"));
export const getPaths = cache((): TeamPath[] => read<TeamPath[]>("paths.json"));
export const getHistory = cache((): History => read<History>("history.json"));
export const getRatingsHistory = cache((): RatingsHistory => read<RatingsHistory>("ratings_history.json"));
export const getModelParams = cache((): ModelParams => read<ModelParams>("model.json"));
