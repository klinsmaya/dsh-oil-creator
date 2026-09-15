import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { OverlayStore } from "./types.ts";

export const OVERLAY_VERSION = 1 as const;

export function overlayPath(dataDir: string): string {
  return join(dataDir, "overlay.json");
}

export function emptyOverlay(): OverlayStore {
  return { version: OVERLAY_VERSION, projects: {} };
}

export class OverlayVersionError extends Error {
  readonly version: unknown;

  constructor(version: unknown) {
    super(`unknown overlay version: ${String(version)}`);
    this.name = "OverlayVersionError";
    this.version = version;
  }
}

export function decodeOverlay(value: unknown): OverlayStore {
  if (typeof value !== "object" || value === null) return emptyOverlay();
  const raw = value as Record<string, unknown>;
  if (raw.version !== undefined && raw.version !== OVERLAY_VERSION) {
    throw new OverlayVersionError(raw.version);
  }
  const store = emptyOverlay();
  if (typeof raw.libraryRoot === "string" && raw.libraryRoot.length > 0) {
    store.libraryRoot = raw.libraryRoot;
  }
  if (raw.projects !== null && typeof raw.projects === "object") {
    store.projects = { ...(raw.projects as Record<string, unknown>) };
  }
  return store;
}

export async function loadOverlay(dataDir: string): Promise<OverlayStore> {
  try {
    const raw = await readFile(overlayPath(dataDir), "utf8");
    return decodeOverlay(JSON.parse(raw) as unknown);
  } catch (cause) {
    if (cause instanceof OverlayVersionError) throw cause;
    return emptyOverlay();
  }
}

const overlayTails = new Map<string, Promise<void>>();

export function withOverlayLock<T>(dataDir: string, work: () => Promise<T>): Promise<T> {
  const previous = overlayTails.get(dataDir) ?? Promise.resolve();
  const run = previous.then(work, work);
  overlayTails.set(dataDir, run.then(() => undefined, () => undefined));
  return run;
}

export async function saveOverlay(dataDir: string, store: OverlayStore): Promise<void> {
  const path = overlayPath(dataDir);
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temp, path);
}
