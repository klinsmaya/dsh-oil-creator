import { readdir, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

import { emptyOverlayProject } from "./overlay.ts";
import {
  chapterLabel,
  isSkippable,
  STEPS,
  type SkippableOverride,
  type StepId,
} from "./steps.ts";
import type {
  OverlayProject,
  OverlayStore,
  PillTone,
  ProjectStage,
  ProjectSummary,
  StepState,
  StepSummary,
} from "./types.ts";

export const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
export const FINAL_DIR = "定版";
export const HISTORY_DIR = "历史";
export const MATERIAL_DIR = "材料";
export const AGENTS_FILE = "AGENTS.md";

const SKIP_DIRS = new Set([".dsh-dingze"]);

export function formatDay(now: Date): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readableCompany(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|\n\r]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function folderNameForCompany(company: string, now: Date): string {
  const safe = readableCompany(company);
  if (safe === "") throw new Error("empty company");
  return `${formatDay(now)}_${safe}`;
}

export function folderDateAndCompany(folderName: string): {
  date?: string;
  company: string;
} {
  const matched = DATE_PREFIX.exec(folderName);
  if (matched === null || matched[1] === undefined || matched[2] === undefined) {
    return { company: folderName };
  }
  return { date: matched[1], company: matched[2] };
}

export function isDatedProjectName(folderName: string): boolean {
  return DATE_PREFIX.test(folderName);
}

export function matchesQuery(item: ProjectSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return item.company.toLowerCase().includes(needle)
    || item.id.toLowerCase().includes(needle);
}

export function pathInside(parent: string, child: string): boolean {
  const root = resolve(parent);
  const target = resolve(child);
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function projectIdUnderLibrary(cwd: string, libraryRoot: string): string | undefined {
  if (!pathInside(libraryRoot, cwd)) return undefined;
  const rel = relative(resolve(libraryRoot), resolve(cwd));
  if (rel === "") return undefined;
  const first = rel.split(sep)[0];
  return first === undefined || first === "" ? undefined : first;
}

export async function listFinalFiles(folderPath: string): Promise<Set<string>> {
  const names = await readdir(join(folderPath, FINAL_DIR)).catch((): string[] => []);
  return new Set(names.filter((name) => name.endsWith(".md")));
}

function firstByOrder(ids: readonly StepId[]): StepId | undefined {
  const found = STEPS.find((step) => ids.includes(step.id));
  return found?.id;
}

function stateOf(
  files: ReadonlySet<string>,
  overlay: OverlayProject,
  id: StepId,
): Exclude<StepState, "current"> {
  if (overlay.reopened[id] !== undefined) return "reopened";
  const def = STEPS.find((step) => step.id === id);
  const hasFile = def !== undefined && files.has(def.file);
  if (hasFile && overlay.needsReview[id] !== undefined) return "needsReview";
  if (hasFile) return "final";
  if (overlay.skipped[id] !== undefined) return "skipped";
  return "todo";
}

function pillFor(
  stage: ProjectStage,
  current: StepSummary | undefined,
): { pill: string; pillTone: PillTone } {
  if (stage === "done") return { pill: "已收官", pillTone: "success" };
  if (stage === "closing") return { pill: "待签约", pillTone: "pending" };
  const chapter = current?.chapter ?? 1;
  const name = current?.name ?? "画像";
  const pillTone: PillTone = current?.state === "needsReview" ? "warning" : "pending";
  return { pill: `${chapterLabel(chapter)} · ${name}`, pillTone };
}

function progressLineFor(
  stage: ProjectStage,
  current: StepSummary | undefined,
  steps: readonly StepSummary[],
): string {
  if (stage === "done") return "进度：已收官";
  if (stage === "closing") return "进度：定三责已走完 · 待签约";
  const chapter = current?.chapter ?? 1;
  const finals = steps.filter((step) => step.chapter === chapter && step.state === "final").length;
  return `进度：${chapterLabel(chapter)} · ${current?.name ?? "画像"} · 已定版 ${finals}`;
}

export function summarizeProject(
  files: ReadonlySet<string>,
  overlay: OverlayProject,
  skippableOverride?: SkippableOverride,
): Pick<
  ProjectSummary,
  | "stage"
  | "currentStep"
  | "currentStepName"
  | "progressLine"
  | "pill"
  | "pillTone"
  | "pendingCount"
  | "blockingCount"
  | "signed"
  | "steps"
> {
  const rawStates = STEPS.map((def) => ({
    def,
    state: stateOf(files, overlay, def.id),
  }));
  const reopened = rawStates.filter((row) => row.state === "reopened").map((row) => row.def.id);
  const todos = rawStates.filter((row) => row.state === "todo").map((row) => row.def.id);
  const reviews = rawStates.filter((row) => row.state === "needsReview").map((row) => row.def.id);
  const currentId = firstByOrder(reopened) ?? firstByOrder(todos) ?? firstByOrder(reviews);
  const complete = rawStates.every((row) => row.state === "final" || row.state === "skipped");
  const stage: ProjectStage = complete
    ? overlay.signed === undefined ? "closing" : "done"
    : (STEPS.find((step) => step.id === currentId)?.chapter ?? 1);

  const steps: StepSummary[] = rawStates.map(({ def, state }) => ({
    id: def.id,
    name: def.name,
    file: def.file,
    chapter: def.chapter,
    state: state === "todo" && def.id === currentId ? "current" : state,
    skippable: isSkippable(def.id, skippableOverride),
    hint: def.hint,
  }));

  const current = steps.find((step) => step.id === currentId);
  const { pill, pillTone } = pillFor(stage, current);
  const openPending = overlay.pending.filter((item) => !item.done);
  return {
    stage,
    ...(currentId === undefined ? {} : { currentStep: currentId }),
    ...(current?.name === undefined ? {} : { currentStepName: current.name }),
    progressLine: progressLineFor(stage, current, steps),
    pill,
    pillTone,
    pendingCount: openPending.length,
    blockingCount: openPending.filter((item) => item.blocking).length,
    ...(overlay.signed === undefined ? {} : { signed: overlay.signed }),
    steps,
  };
}

export function buildProjectSummary(
  identity: {
    id: string;
    folderPath: string;
    company: string;
    date?: string;
    createdMs: number;
    updatedAt: string;
  },
  files: ReadonlySet<string>,
  overlay: OverlayProject,
  skippableOverride?: SkippableOverride,
): ProjectSummary {
  return {
    ...identity,
    ...summarizeProject(files, overlay, skippableOverride),
  };
}

async function looksLikeProject(folderPath: string, folderName: string): Promise<boolean> {
  if (isDatedProjectName(folderName)) return true;
  const names = await readdir(folderPath).catch((): string[] => []);
  return names.includes(FINAL_DIR) || names.includes(AGENTS_FILE);
}

export async function scanLibrary(
  libraryRoot: string,
  overlay: OverlayStore,
  skippableOverride?: SkippableOverride,
): Promise<ProjectSummary[]> {
  const root = await stat(libraryRoot).catch(() => undefined);
  if (root === undefined || !root.isDirectory()) return [];

  const entries = await readdir(libraryRoot, { withFileTypes: true });
  const items: ProjectSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const folderPath = join(libraryRoot, entry.name);
    if (!await looksLikeProject(folderPath, entry.name)) continue;
    const info = await stat(folderPath).catch(() => undefined);
    if (info === undefined || !info.isDirectory()) continue;
    const { date, company } = folderDateAndCompany(entry.name);
    const createdMs = info.birthtimeMs > 0 ? info.birthtimeMs : info.mtimeMs;
    const project = overlay.projects[entry.name] ?? emptyOverlayProject();
    const overlayMs = Date.parse(project.updatedAt);
    const updatedMs = Number.isNaN(overlayMs) ? info.mtimeMs : Math.max(info.mtimeMs, overlayMs);
    const identity = {
      id: entry.name,
      folderPath,
      company,
      createdMs,
      updatedAt: new Date(updatedMs).toISOString(),
      ...(date === undefined ? {} : { date }),
    };
    items.push(buildProjectSummary(
      identity,
      await listFinalFiles(folderPath),
      project,
      skippableOverride,
    ));
  }
  items.sort((left, right) => {
    if (left.createdMs !== right.createdMs) return right.createdMs - left.createdMs;
    return basename(right.folderPath).localeCompare(basename(left.folderPath), "zh");
  });
  return items;
}

export function matchProjectRef(
  project: string,
  items: readonly ProjectSummary[],
): ProjectSummary | undefined {
  const needle = project.trim();
  if (needle === "") return undefined;
  return items.find((item) =>
    item.id === needle
    || item.folderPath === needle
    || item.company === needle
  );
}

export function matchProjectByCwd(
  cwd: string,
  items: readonly ProjectSummary[],
  libraryRoot: string,
): ProjectSummary | undefined {
  const under = projectIdUnderLibrary(cwd, libraryRoot);
  if (under !== undefined) {
    const found = items.find((item) => item.id === under);
    if (found !== undefined) return found;
  }
  return items.find((item) => pathInside(item.folderPath, cwd));
}

export function matchProjectBySession(
  sessionId: string,
  overlay: OverlayStore,
  items: readonly ProjectSummary[],
): ProjectSummary | undefined {
  if (sessionId.length === 0) return undefined;
  const bound = items.filter((item) => overlay.projects[item.id]?.sessionIds.includes(sessionId));
  if (bound.length === 0) return undefined;
  return [...bound].sort((left, right) => {
    const leftAt = overlay.projects[left.id]?.updatedAt ?? left.updatedAt;
    const rightAt = overlay.projects[right.id]?.updatedAt ?? right.updatedAt;
    return rightAt.localeCompare(leftAt);
  })[0];
}
