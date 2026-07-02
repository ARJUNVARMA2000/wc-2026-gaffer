"use client";
import { useEffect } from "react";
import type { Meta } from "@/lib/types";
import { startPolling } from "@/lib/live";

/** Mounts once in the root layout; seeds the live store with the build-time
 *  meta and starts the visibility-aware poll loop. Renders nothing. */
export default function LiveUpdater({ meta }: { meta: Meta }) {
  useEffect(() => startPolling(meta), [meta]);
  return null;
}
