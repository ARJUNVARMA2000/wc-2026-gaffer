import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";
import type {
  Team,
  GroupRow,
  Match,
  Meta,
  Scorecard,
  TeamPath,
  History,
  RatingsHistory,
  ModelParams,
  Bracket,
} from "./types";

// Data-shape types live in ./types (client-safe); re-export so existing
// `import type { X } from "@/lib/data"` sites keep compiling.
export type * from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
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
export const getBracket = cache((): Bracket => read<Bracket>("bracket.json"));
