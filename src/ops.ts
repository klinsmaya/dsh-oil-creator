import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  FINAL_DIR,
  HISTORY_DIR,
  listFinalFiles,
  scanLibrary,
} from "./catalog.ts";
import {
  ensureOverlayProject,
  loadOverlay,
  saveOverlay,
  withOverlayLock,
} from "./overlay.ts";
import { resolveProjectSummary } from "./service.ts";
import { isStepId, stepById, STEPS, type SkippableOverride, type StepId } from "./steps.ts";
import type {
  OverlayProject,
  OverlayStore,
  PendingItem,
  ProjectSummary,
  ToolFailure,
  ToolSuccess,
} from "./types.ts";

export const NO_CURRENT_PROJECT = "no_current_project";
export const UNKNOWN_STEP = "unknown_step";
export const ORDER_VIOLATION = "order_violation";
export const BLOCKING_PENDING = "blocking_pending";
export const CONTENT_REQUIRED = "content_required";
export const PENDING_NOT_FOUND = "pending_not_found";
export const UNKNOWN_PENDING_ACTION = "unknown_pending_action";

export interface OpsHost {
  dataDir: string;
  libraryRoot: string;
  skippableOverride?: SkippableOverride;
  onWrite?: () => void;
}

export interface ProjectScope {
  project?: string;
  cwd?: string;
  sessionId?: string;
}

export function compactScope(scope: {
  project?: string | undefined;
  cwd?: string | undefined;
  sessionId?: string | undefined;
}): ProjectScope {
  return {
    ...(scope.project === undefined || scope.project === "" ? {} : { project: scope.project }),
    ...(scope.cwd === undefined || scope.cwd === "" ? {} : { cwd: scope.cwd }),
    ...(scope.sessionId === undefined || scope.sessionId === "" ? {} : { sessionId: scope.sessionId }),
  };
}

export function fail(code: string, message: string, detail?: unknown): ToolFailure {
  return detail === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, detail };
}

export function ok<T extends object>(value: T): ToolSuccess<T> {
  return { ok: true, ...value };
}

export function nextActionOf(summary: ProjectSummary): string {
  if (summary.stage === "done") return "已经收官，可以打开责任书复核。";
  if (summary.stage === "closing") return "定三责已走完，可以签约。";
  const current = summary.steps.find((step) => step.id === summary.currentStep);
  if (current?.state === "reopened") return `改版「${current.name}」。`;
  if (current?.state === "needsReview") return `复核「${current.name}」。`;
  if (summary.blockingCount > 0) {
    return `先把卡点待补处理完，再定版「${current?.name ?? "这一步"}」。`;
  }
  return `推进「${current?.name ?? "画像"}」。`;
}

function sortPending(items: readonly PendingItem[]): PendingItem[] {
  return [...items].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    if (left.blocking !== right.blocking) return left.blocking ? -1 : 1;
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function humanNeedsReview(project: OverlayProject, summary: ProjectSummary) {
  return Object.entries(project.needsReview).flatMap(([id, mark]) => {
    if (mark === undefined || !isStepId(id)) return [];
    return [{
      step: id,
      name: stepById(id)?.name ?? id,
      because: mark.because,
      becauseName: stepById(mark.because)?.name ?? mark.because,
      at: mark.at,
    }];
  }).filter((row) => summary.steps.some((step) => step.id === row.step && step.state === "needsReview"));
}

function humanSkipped(project: OverlayProject) {
  return Object.entries(project.skipped).flatMap(([id, mark]) => {
    if (mark === undefined || !isStepId(id)) return [];
    return [{
      step: id,
      name: stepById(id)?.name ?? id,
      reason: mark.reason,
      at: mark.at,
    }];
  });
}

interface LoadedProject {
  store: OverlayStore;
  libraryRoot: string;
  summary: ProjectSummary;
  project: OverlayProject;
}

function isFailure(value: LoadedProject | ToolFailure): value is ToolFailure {
  return "ok" in value && value.ok === false;
}

async function loadProject(host: OpsHost, scope: ProjectScope): Promise<LoadedProject | ToolFailure> {
  const store = await loadOverlay(host.dataDir);
  const libraryRoot = store.libraryRoot ?? host.libraryRoot;
  const items = await scanLibrary(libraryRoot, store, host.skippableOverride);
  const summary = resolveProjectSummary(scope, items, store, libraryRoot);
  if (summary === undefined) {
    return fail(NO_CURRENT_PROJECT, "没有当前项目。先指定公司名，或在项目文件夹里打开，或先新建并绑定会话。");
  }
  return {
    store,
    libraryRoot,
    summary,
    project: ensureOverlayProject(store, summary.id),
  };
}

async function refreshSummary(host: OpsHost, store: OverlayStore, libraryRoot: string, id: string): Promise<ProjectSummary> {
  const items = await scanLibrary(libraryRoot, store, host.skippableOverride);
  const found = items.find((item) => item.id === id);
  if (found === undefined) {
    throw new Error(`project disappeared: ${id}`);
  }
  return found;
}

export async function projectStatus(
  host: OpsHost,
  scope: ProjectScope,
): Promise<ToolSuccess<{
  project: ProjectSummary;
  pending: PendingItem[];
  needsReview: ReturnType<typeof humanNeedsReview>;
  skipped: ReturnType<typeof humanSkipped>;
  nextAction: string;
}> | ToolFailure> {
  return withOverlayLock(host.dataDir, async () => {
    const loaded = await loadProject(host, scope);
    if (isFailure(loaded)) return loaded;
    const { summary, project } = loaded;
    return ok({
      project: summary,
      pending: sortPending(project.pending),
      needsReview: humanNeedsReview(project, summary),
      skipped: humanSkipped(project),
      nextAction: nextActionOf(summary),
    });
  });
}

function hasOrderViolation(stepId: StepId, summary: ProjectSummary): boolean {
  const target = stepById(stepId);
  if (target === undefined) return true;
  return summary.steps.some((step) => {
    const def = STEPS.find((item) => item.id === step.id);
    if (def === undefined || def.order >= target.order) return false;
    return step.state !== "final" && step.state !== "skipped";
  });
}

function openBlocking(project: OverlayProject): PendingItem[] {
  return project.pending.filter((item) => item.blocking && !item.done);
}

function finalPath(folderPath: string, file: string): string {
  return join(folderPath, FINAL_DIR, file);
}

async function archiveExisting(path: string): Promise<string | undefined> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isFile()) return undefined;
  const historyDir = join(dirname(path), HISTORY_DIR);
  await mkdir(historyDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const archived = join(historyDir, `${basename(path, ".md")}.${stamp}.md`);
  await rename(path, archived);
  return archived;
}

async function writeFinalFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const body = content.endsWith("\n") ? content : `${content}\n`;
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, body, "utf8");
  await rename(temp, path);
}

export async function finalizeStep(
  host: OpsHost,
  options: ProjectScope & {
    step: string;
    content?: string;
    apply?: boolean;
    now?: Date;
  },
): Promise<ToolSuccess<{
  apply: boolean;
  step: StepId;
  stepName: string;
  file: string;
  path: string;
  action: "write" | "rewrite" | "review";
  archivedTo?: string;
  clearedReopened: boolean;
  clearedNeedsReview: boolean;
  project: ProjectSummary;
}> | ToolFailure> {
  if (!isStepId(options.step)) {
    return fail(UNKNOWN_STEP, "没有这一步。", { step: options.step });
  }
  const def = stepById(options.step);
  if (def === undefined) {
    return fail(UNKNOWN_STEP, "没有这一步。", { step: options.step });
  }

  return withOverlayLock(host.dataDir, async () => {
    const loaded = await loadProject(host, options);
    if (isFailure(loaded)) return loaded;
    const { store, libraryRoot, summary, project } = loaded;
    if (hasOrderViolation(def.id, summary)) {
      const blocker = summary.steps.find((step) => {
        const order = STEPS.find((item) => item.id === step.id)?.order ?? 99;
        return order < def.order && step.state !== "final" && step.state !== "skipped";
      });
      return fail(ORDER_VIOLATION, `还不能定版「${def.name}」，先完成「${blocker?.name ?? "前面的步骤"}」。`, {
        step: def.id,
        blockingStep: blocker?.id,
      });
    }
    const blocking = openBlocking(project);
    if (blocking.length > 0) {
      return fail(BLOCKING_PENDING, "还有卡点待补没处理完，先解决再定版。", {
        pending: blocking.map((item) => item.id),
      });
    }

    const path = finalPath(summary.folderPath, def.file);
    const files = await listFinalFiles(summary.folderPath);
    const exists = files.has(def.file);
    const content = options.content;
    if ((content === undefined || content.trim() === "") && !exists) {
      return fail(CONTENT_REQUIRED, `「${def.name}」还没有定版稿，需要先写出内容。`, { file: def.file });
    }

    const reviewOnly = (content === undefined || content.trim() === "") && exists;
    const action = reviewOnly ? "review" as const : exists ? "rewrite" as const : "write" as const;
    const apply = options.apply === true;
    const now = options.now ?? new Date();
    const stamp = now.toISOString();

    if (!apply) {
      return ok({
        apply: false,
        step: def.id,
        stepName: def.name,
        file: def.file,
        path,
        action,
        clearedReopened: !reviewOnly && project.reopened[def.id] !== undefined,
        clearedNeedsReview: project.needsReview[def.id] !== undefined,
        project: summary,
      });
    }

    let archivedTo: string | undefined;
    if (!reviewOnly && content !== undefined) {
      archivedTo = await archiveExisting(path);
      await writeFinalFile(path, content);
      delete project.reopened[def.id];
      delete project.needsReview[def.id];
      project.finalized[def.id] = { at: stamp };
    } else {
      delete project.needsReview[def.id];
    }
    project.updatedAt = stamp;
    await saveOverlay(host.dataDir, store);
    host.onWrite?.();
    const next = await refreshSummary(host, store, libraryRoot, summary.id);
    return ok({
      apply: true,
      step: def.id,
      stepName: def.name,
      file: def.file,
      path,
      action,
      ...(archivedTo === undefined ? {} : { archivedTo }),
      clearedReopened: !reviewOnly && action !== "review",
      clearedNeedsReview: true,
      project: next,
    });
  });
}

export type PendingAction = "add" | "update" | "resolve" | "list";

export async function mutatePending(
  host: OpsHost,
  options: ProjectScope & {
    action: string;
    id?: string;
    step?: string;
    item?: string;
    blocking?: boolean;
    who?: string;
    when?: string;
    now?: Date;
  },
): Promise<ToolSuccess<{
  action: PendingAction;
  pending: PendingItem[];
  changed?: PendingItem;
}> | ToolFailure> {
  const action = options.action;
  if (action !== "add" && action !== "update" && action !== "resolve" && action !== "list") {
    return fail(UNKNOWN_PENDING_ACTION, "待补只支持 add、update、resolve、list。", { action });
  }
  return withOverlayLock(host.dataDir, async () => {
    const loaded = await loadProject(host, options);
    if (isFailure(loaded)) return loaded;
    const { store, project } = loaded;
    const now = (options.now ?? new Date()).toISOString();

    if (action === "list") {
      return ok({ action: "list" as const, pending: sortPending(project.pending) });
    }

    if (action === "add") {
      if (options.step !== undefined && !isStepId(options.step)) {
        return fail(UNKNOWN_STEP, "没有这一步。", { step: options.step });
      }
      const step = options.step !== undefined && isStepId(options.step)
        ? options.step
        : loaded.summary.currentStep ?? "S1-00";
      const text = options.item?.trim() ?? "";
      if (text === "") {
        return fail("item_required", "补一条待补，需要先写清缺什么。");
      }
      const changed: PendingItem = {
        id: randomUUID(),
        step,
        item: text,
        blocking: options.blocking === true,
        done: false,
        createdAt: now,
      };
      if (options.who !== undefined && options.who.trim() !== "") changed.who = options.who.trim();
      if (options.when !== undefined && options.when.trim() !== "") changed.when = options.when.trim();
      project.pending.push(changed);
      project.updatedAt = now;
      await saveOverlay(host.dataDir, store);
      host.onWrite?.();
      return ok({ action: "add" as const, pending: sortPending(project.pending), changed });
    }

    const id = options.id?.trim() ?? "";
    const found = project.pending.find((item) => item.id === id);
    if (found === undefined) {
      return fail(PENDING_NOT_FOUND, "找不到这条待补。", { id });
    }

    if (action === "resolve") {
      found.done = true;
      found.doneAt = now;
    } else {
      if (options.item !== undefined && options.item.trim() !== "") found.item = options.item.trim();
      if (options.blocking !== undefined) found.blocking = options.blocking;
      if (options.who !== undefined) {
        if (options.who.trim() === "") delete found.who;
        else found.who = options.who.trim();
      }
      if (options.when !== undefined) {
        if (options.when.trim() === "") delete found.when;
        else found.when = options.when.trim();
      }
      if (options.step !== undefined) {
        if (!isStepId(options.step)) return fail(UNKNOWN_STEP, "没有这一步。", { step: options.step });
        found.step = options.step;
      }
    }
    project.updatedAt = now;
    await saveOverlay(host.dataDir, store);
    host.onWrite?.();
    return ok({ action, pending: sortPending(project.pending), changed: found });
  });
}

