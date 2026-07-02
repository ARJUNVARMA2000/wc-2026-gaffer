"use client";
// Live-data store: the exported static site polls /data/meta.json and, when a
// newer deploy is detected, hot-swaps the interested datasets in one atomic
// emit. Server snapshot is always null, so SSR/hydration render the
// build-time props and runtime data can only arrive post-mount.

import { useEffect, useSyncExternalStore } from "react";
import type { Meta } from "./types";

export type DatasetKey =
  | "teams"
  | "groups"
  | "matches"
  | "meta"
  | "scorecard"
  | "paths"
  | "history"
  | "ratings_history"
  | "model"
  | "bracket";

const FILES: Record<DatasetKey, string> = {
  teams: "teams.json",
  groups: "groups.json",
  matches: "matches.json",
  meta: "meta.json",
  scorecard: "scorecard.json",
  paths: "paths.json",
  history: "history.json",
  ratings_history: "ratings_history.json",
  model: "model.json",
  bracket: "bracket.json",
};

export type LiveStatusKind = "idle" | "live" | "updating" | "error";

export interface LiveState {
  baseline: string | null; // build-time meta.lastUpdated (seeded by LiveUpdater)
  version: string | null; // lastUpdated of runtime-fetched data (null until first swap)
  data: Partial<Record<DatasetKey, unknown>>;
  status: LiveStatusKind;
  updatedAt: number | null; // Date.now() of the last successful swap
}

let state: LiveState = { baseline: null, version: null, data: {}, status: "idle", updatedAt: null };
const listeners = new Set<() => void>();
const interest = new Map<DatasetKey, number>(); // ref-counted per mounted consumer

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnap = () => state;
const getServerSnap = () => null;

async function fetchDataset(key: DatasetKey, version: string): Promise<unknown> {
  const res = await fetch(`/data/${FILES[key]}?v=${encodeURIComponent(version)}`);
  if (!res.ok) throw new Error(`${FILES[key]}: ${res.status}`);
  return res.json();
}

function registerInterest(key: DatasetKey): () => void {
  interest.set(key, (interest.get(key) ?? 0) + 1);
  // Lazy fill-in: a view mounted via client navigation after a swap should
  // upgrade to the already-known version instead of showing build-time data.
  if (state.version !== null && !(key in state.data)) {
    const v = state.version;
    fetchDataset(key, v)
      .then((json) => {
        if (state.version === v) set({ data: { ...state.data, [key]: json } });
      })
      .catch(() => {}); // next poll reconciles
  }
  return () => {
    const n = (interest.get(key) ?? 1) - 1;
    if (n <= 0) interest.delete(key);
    else interest.set(key, n);
  };
}

/** Returns the freshest known copy of a dataset: the runtime-fetched one if a
 *  newer deploy has been swapped in, otherwise the build-time prop. */
export function useLiveData<T>(key: DatasetKey, initial: T): T {
  useEffect(() => registerInterest(key), [key]);
  const s = useSyncExternalStore(subscribe, getSnap, getServerSnap);
  return (s?.data[key] as T | undefined) ?? initial;
}

/** Live-refresh status for indicators: status dot, last-swap time, version. */
export function useLiveStatus(): Pick<LiveState, "status" | "version" | "baseline" | "updatedAt"> {
  const s = useSyncExternalStore(subscribe, getSnap, getServerSnap);
  return s ?? state;
}

const POLL_MS = process.env.NODE_ENV === "development" ? 5_000 : 120_000;
const MAX_BACKOFF_MS = 900_000;

let polling = false;

/** Idempotent: starts the poll loop once (called from LiveUpdater's effect).
 *  Returns a disposer that stops the loop. */
export function startPolling(buildMeta: Meta): () => void {
  if (state.baseline === null) {
    set({ baseline: buildMeta.lastUpdated, data: { ...state.data, meta: buildMeta } });
  }
  if (polling) return () => {};
  polling = true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let lastCheck = 0;
  let disposed = false;

  const schedule = (ms: number) => {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  };

  async function swapTo(meta: Meta) {
    set({ status: "updating" });
    const keys = [...interest.keys()].filter((k) => k !== "meta");
    const fetched = await Promise.all(keys.map((k) => fetchDataset(k, meta.lastUpdated)));
    const data: LiveState["data"] = { ...state.data, meta };
    keys.forEach((k, i) => {
      data[k] = fetched[i];
    });
    // One emit — all consumers swap in a single render pass.
    set({ version: meta.lastUpdated, data, status: "live", updatedAt: Date.now() });
  }

  async function tick() {
    if (disposed) return;
    if (document.visibilityState === "hidden") return schedule(POLL_MS);
    lastCheck = Date.now();
    try {
      // Minute bucket: defeats browser + 5-min CDN cache while letting all
      // clients in the same minute share one CDN entry.
      const bucket = Math.floor(Date.now() / 60_000);
      const res = await fetch(`/data/meta.json?v=${bucket}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const meta = (await res.json()) as Meta;
      const known = state.version ?? state.baseline;
      if (known && meta.lastUpdated !== known) await swapTo(meta);
      failures = 0;
      if (state.status !== "live") set({ status: "live" });
      schedule(POLL_MS);
    } catch {
      failures++;
      set({ status: "error" });
      schedule(Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
    }
  }

  const onVisible = () => {
    if (document.visibilityState === "visible" && Date.now() - lastCheck > POLL_MS) tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  schedule(POLL_MS);

  return () => {
    disposed = true;
    polling = false;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
