import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isStepId } from "./steps.ts";
import type { OverlayProject, OverlayStore, PendingItem, StepId } from "./types.ts";

export const OVERLAY_VERSION = 1 as const;

export function overlayPath(dataDir: string): string {
  return join(dataDir, "overlay.json");
}

export function emptyOverlay(): OverlayStore {
  return { version: OVERLAY_VERSION, projects: {}, skippableSteps: [] };
}

export function emptyOverlayProject(now = new Date()): OverlayProject {
  return {
    sessionIds: [],
    pending: [],
    skipped: {},
    reopened: {},
    needsReview: {},
    finalized: {},
    updatedAt: now.toISOString(),
  };
}

export function ensureOverlayProject(
  store: OverlayStore,
  id: string,
  now = new Date(),
): OverlayProject {
  const existing = store.projects[id];
  if (existing !== undefined) return existing;
  const created = emptyOverlayProject(now);
  store.projects[id] = created;
  return created;
}

export class OverlayVersionError extends Error {
  readonly version: unknown;

  constructor(version: unknown) {
    super(`unknown overlay version: ${String(version)}`);
    this.name = "OverlayVersionError";
    this.version = version;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value as Record<string, unknown>;
}

function decodePending(value: unknown): PendingItem | undefined {
  const raw = asRecord(value);
  if (raw === undefined) return undefined;
  if (typeof raw.id !== "string" || raw.id.length === 0) return undefined;
  if (!isStepId(raw.step) || typeof raw.item !== "string") return undefined;
  if (typeof raw.blocking !== "boolean" || typeof raw.done !== "boolean") return undefined;
  if (typeof raw.createdAt !== "string") return undefined;
  const item: PendingItem = {
    id: raw.id,
    step: raw.step,
    item: raw.item,
    blocking: raw.blocking,
    done: raw.done,
    createdAt: raw.createdAt,
  };
  if (typeof raw.who === "string" && raw.who.length > 0) item.who = raw.who;
  if (typeof raw.when === "string" && raw.when.length > 0) item.when = raw.when;
  if (typeof raw.doneAt === "string" && raw.doneAt.length > 0) item.doneAt = raw.doneAt;
  return item;
}

function decodeStamp(value: unknown): { reason: string; at: string } | undefined {
  const raw = asRecord(value);
  if (raw === undefined) return undefined;
  if (typeof raw.reason !== "string" || typeof raw.at !== "string") return undefined;
  return { reason: raw.reason, at: raw.at };
}

function decodeReview(value: unknown): { because: StepId; at: string } | undefined {
  const raw = asRecord(value);
  if (raw === undefined) return undefined;
  if (!isStepId(raw.because) || typeof raw.at !== "string") return undefined;
  return { because: raw.because, at: raw.at };
}

function decodeFinalized(value: unknown): { at: string } | undefined {
  const raw = asRecord(value);
  if (raw === undefined) return undefined;
  if (typeof raw.at !== "string") return undefined;
  return { at: raw.at };
}

function decodeStepMap<T>(
  value: unknown,
  decode: (item: unknown) => T | undefined,
): Partial<Record<StepId, T>> {
  const raw = asRecord(value);
  if (raw === undefined) return {};
  const next: Partial<Record<StepId, T>> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (!isStepId(key)) continue;
    const decoded = decode(item);
    if (decoded !== undefined) next[key] = decoded;
  }
  return next;
}

export function decodeOverlayProject(value: unknown, now = new Date()): OverlayProject {
  const raw = asRecord(value);
  const project = emptyOverlayProject(now);
  if (raw === undefined) return project;
  if (Array.isArray(raw.sessionIds)) {
    project.sessionIds = raw.sessionIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  if (Array.isArray(raw.pending)) {
    project.pending = raw.pending.flatMap((item) => {
      const decoded = decodePending(item);
      return decoded === undefined ? [] : [decoded];
    });
  }
  project.skipped = decodeStepMap(raw.skipped, decodeStamp);
  project.reopened = decodeStepMap(raw.reopened, decodeStamp);
  project.needsReview = decodeStepMap(raw.needsReview, decodeReview);
  project.finalized = decodeStepMap(raw.finalized, decodeFinalized);
  const signed = asRecord(raw.signed);
  if (signed !== undefined && typeof signed.by === "string" && typeof signed.at === "string") {
    project.signed = { by: signed.by, at: signed.at };
  }
  if (typeof raw.updatedAt === "string" && raw.updatedAt.length > 0) {
    project.updatedAt = raw.updatedAt;
  }
  return project;
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
  if (Array.isArray(raw.skippableSteps)) {
    store.skippableSteps = raw.skippableSteps.filter((item): item is string => typeof item === "string");
  }
  const projects = asRecord(raw.projects);
  if (projects !== undefined) {
    for (const [id, item] of Object.entries(projects)) {
      if (id.length === 0) continue;
      store.projects[id] = decodeOverlayProject(item);
    }
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
