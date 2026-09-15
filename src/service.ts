import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { inspectDingzeSetup } from "./capabilities.ts";
import {
  matchProjectByCwd,
  matchProjectBySession,
  matchProjectRef,
  matchesQuery,
  scanLibrary,
} from "./catalog.ts";
import { listMaterialFiles, readProjectFile } from "./projectFiles.ts";
import { expandHomePath, resolveDataDir, type Config } from "./config.ts";
import { startLibraryWatch } from "./libraryWatch.ts";
import {
  ensureOverlayProject,
  loadOverlay,
  overlayPath,
  saveOverlay,
  withOverlayLock,
} from "./overlay.ts";
import { skippableOverrideFromList, type SkippableOverride } from "./steps.ts";
import type {
  DingzeCapabilities,
  DingzeSetupStatus,
  LibrarySettings,
  ListProjectsRequest,
  ListProjectsResult,
  ListMaterialsResult,
  OpenFolderRequest,
  OverlayProject,
  OverlayStore,
  ProjectDetail,
  ProjectIdRequest,
  ProjectSummary,
  ReadFileRequest,
  ReadFileResult,
  SetLibraryRootRequest,
} from "./types.ts";

export const DINGZE_SERVICE = "dz";
export const NO_CURRENT_PROJECT = "no_current_project";

export class DingzeError extends Error {
  readonly code: string;
  readonly detail?: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = "DingzeError";
    this.code = code;
    this.detail = detail;
  }
}

export interface ResolvedProject {
  summary: ProjectSummary;
  overlay: OverlayProject;
  store: OverlayStore;
  libraryRoot: string;
}

export class DingzeService extends TypertRemoteService {
  libraryRoot: string;
  readonly dataDir: string;
  readonly skippableOverride: SkippableOverride;
  cache: { libraryRoot: string; items: ProjectSummary[] } | undefined;
  catalogRevision = 0;
  watchClose: (() => void) | undefined;
  watchedRoot: string | undefined;

  constructor(ctx: Context, config: Config) {
    super(ctx, DINGZE_SERVICE);
    this.libraryRoot = resolveUserPath(config.libraryRoot);
    this.dataDir = resolveUserPath(resolveDataDir(config));
    this.skippableOverride = skippableOverrideFromList(config.skippableSteps);
    ctx.effect(() => async () => {
      this.stopWatch();
    }, "dsh-dingze: library watch");
  }

  invalidateCatalog(): void {
    this.cache = undefined;
    this.catalogRevision += 1;
  }

  stopWatch(): void {
    this.watchClose?.();
    this.watchClose = undefined;
    this.watchedRoot = undefined;
  }

  ensureWatch(libraryRoot: string): void {
    if (this.watchedRoot === libraryRoot && this.watchClose !== undefined) return;
    this.stopWatch();
    this.watchedRoot = libraryRoot;
    try {
      mkdirSync(this.dataDir, { recursive: true });
    } catch {
      // Watch can still attach to an existing library root.
    }
    this.watchClose = startLibraryWatch({
      libraryRoot,
      overlayPath: overlayPath(this.dataDir),
      onChange: () => {
        this.invalidateCatalog();
      },
    }).close;
  }

  async scanned() {
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      const libraryRoot = overlay.libraryRoot ?? this.libraryRoot;
      this.ensureWatch(libraryRoot);
      if (this.cache?.libraryRoot === libraryRoot) {
        return { overlay, libraryRoot, items: this.cache.items };
      }
      const items = await scanLibrary(
        libraryRoot,
        overlay,
        skippableOverrideFromList([
          ...Object.entries(this.skippableOverride).flatMap(([id, value]) => value ? [id] : [`!${id}`]),
          ...(overlay.skippableSteps ?? []),
        ]),
      );
      this.cache = { libraryRoot, items };
      return { overlay, libraryRoot, items };
    });
  }

  async resolveProject(options: {
    project?: string;
    cwd?: string;
    sessionId?: string;
  }): Promise<ResolvedProject> {
    const { overlay, libraryRoot, items } = await this.scanned();
    const summary = resolveProjectSummary(options, items, overlay, libraryRoot);
    if (summary === undefined) {
      throw new DingzeError(NO_CURRENT_PROJECT, "没有当前项目。先指定公司名，或在项目文件夹里打开，或先新建并绑定会话。");
    }
    return {
      summary,
      overlay: ensureOverlayProject(overlay, summary.id),
      store: overlay,
      libraryRoot,
    };
  }

  async getRevision(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<{ revision: number }> {
    signal.throwIfAborted();
    if (this.watchClose === undefined) await this.scanned();
    return { revision: this.catalogRevision };
  }

  async listProjects(
    request: ListProjectsRequest,
    signal: AbortSignal,
  ): Promise<ListProjectsResult> {
    signal.throwIfAborted();
    const { overlay, libraryRoot, items: scanned } = await this.scanned();
    const items = scanned.filter((item) => matchesQuery(item, request.query));
    return {
      settings: settingsOf(libraryRoot, overlay),
      items,
      revision: this.catalogRevision,
    };
  }

  async getSettings(_request: Record<string, never>, signal: AbortSignal): Promise<LibrarySettings> {
    signal.throwIfAborted();
    const overlay = await loadOverlay(this.dataDir);
    return settingsOf(overlay.libraryRoot ?? this.libraryRoot, overlay);
  }

  async setLibraryRoot(
    request: SetLibraryRootRequest,
    signal: AbortSignal,
  ): Promise<LibrarySettings> {
    signal.throwIfAborted();
    const libraryRoot = resolveUserPath(request.path);
    const info = await stat(libraryRoot).catch(() => undefined);
    if (info === undefined || !info.isDirectory()) {
      throw new Error(`library root is not a directory: ${libraryRoot}`);
    }
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      overlay.libraryRoot = libraryRoot;
      await saveOverlay(this.dataDir, overlay);
      this.libraryRoot = libraryRoot;
      this.stopWatch();
      this.invalidateCatalog();
      return settingsOf(libraryRoot, overlay);
    });
  }

  async getCapabilities(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<{ capabilities: DingzeCapabilities }> {
    signal.throwIfAborted();
    const status = await this.getSetupStatus(signal);
    return { capabilities: status.capabilities };
  }

  async getSetupStatus(signal: AbortSignal): Promise<DingzeSetupStatus> {
    signal.throwIfAborted();
    const settings = await this.getSettings({}, signal);
    return inspectDingzeSetup({
      libraryRoot: settings.libraryRoot,
      dataDir: this.dataDir,
      settings,
    });
  }

  async refreshCatalog(
    _request: Record<string, never>,
    signal: AbortSignal,
  ): Promise<ListProjectsResult> {
    this.invalidateCatalog();
    return this.listProjects({ query: "" }, signal);
  }

  async setSkippableSteps(
    request: { skippableSteps: string[] },
    signal: AbortSignal,
  ): Promise<LibrarySettings> {
    signal.throwIfAborted();
    return withOverlayLock(this.dataDir, async () => {
      const overlay = await loadOverlay(this.dataDir);
      overlay.skippableSteps = request.skippableSteps;
      await saveOverlay(this.dataDir, overlay);
      this.invalidateCatalog();
      return settingsOf(overlay.libraryRoot ?? this.libraryRoot, overlay);
    });
  }

  async openFolder(request: OpenFolderRequest, signal: AbortSignal): Promise<Record<string, never>> {
    signal.throwIfAborted();
    await openExternalPath(request.path);
    return {};
  }

  async projectDetail(request: ProjectIdRequest, signal: AbortSignal): Promise<ProjectDetail> {
    signal.throwIfAborted();
    const { overlay, items } = await this.scanned();
    const summary = items.find((item) => item.id === request.id);
    if (summary === undefined) throw new Error("这个项目已被移动或删除。");
    return {
      project: summary,
      pending: overlay.projects[summary.id]?.pending.filter((item) => !item.done) ?? [],
    };
  }

  async readFile(request: ReadFileRequest, signal: AbortSignal): Promise<ReadFileResult> {
    signal.throwIfAborted();
    const { items } = await this.scanned();
    const summary = items.find((item) => item.id === request.id);
    if (summary === undefined) throw new Error("这个项目已被移动或删除。");
    const content = await readProjectFile(summary.folderPath, request.path);
    return { path: request.path, content };
  }

  async listMaterials(request: ProjectIdRequest, signal: AbortSignal): Promise<ListMaterialsResult> {
    signal.throwIfAborted();
    const { items } = await this.scanned();
    const summary = items.find((item) => item.id === request.id);
    if (summary === undefined) throw new Error("这个项目已被移动或删除。");
    return { items: await listMaterialFiles(summary.folderPath) };
  }
}

export function resolveProjectSummary(
  options: { project?: string; cwd?: string; sessionId?: string },
  items: readonly ProjectSummary[],
  overlay: OverlayStore,
  libraryRoot: string,
): ProjectSummary | undefined {
  if (options.project !== undefined && options.project.trim() !== "") {
    return matchProjectRef(options.project, items);
  }
  if (options.cwd !== undefined && options.cwd.trim() !== "") {
    const byCwd = matchProjectByCwd(options.cwd, items, libraryRoot);
    if (byCwd !== undefined) return byCwd;
  }
  if (options.sessionId !== undefined) {
    return matchProjectBySession(options.sessionId, overlay, items);
  }
  return undefined;
}

function settingsOf(libraryRoot: string, overlay: OverlayStore): LibrarySettings {
  return { libraryRoot, skippableSteps: overlay.skippableSteps ?? [] };
}

function resolveUserPath(path: string): string {
  const expanded = expandHomePath(path);
  if (!isAbsolute(expanded)) throw new Error(`path must be absolute: ${path}`);
  return expanded;
}

function openExternalPath(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "darwin"
      ? { file: "open", args: [path] }
      : process.platform === "win32"
        ? { file: "explorer.exe", args: [path] }
        : { file: "xdg-open", args: [path] };
    const child = spawn(command.file, command.args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`${command.file} failed: ${code}`));
    });
  });
}
