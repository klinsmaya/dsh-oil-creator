import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { OverlayStore, ProjectSummary } from "./types.ts";

export const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
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

async function looksLikeProject(folderPath: string, folderName: string): Promise<boolean> {
  if (isDatedProjectName(folderName)) return true;
  const names = await readdir(folderPath).catch((): string[] => []);
  return names.includes("定版") || names.includes("AGENTS.md");
}

export async function scanLibrary(
  libraryRoot: string,
  _overlay: OverlayStore,
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
    const item: ProjectSummary = {
      id: entry.name,
      folderPath,
      company,
      createdMs,
      updatedAt: new Date(info.mtimeMs).toISOString(),
    };
    if (date !== undefined) item.date = date;
    items.push(item);
  }
  items.sort((left, right) => {
    if (left.createdMs !== right.createdMs) return right.createdMs - left.createdMs;
    return basename(right.folderPath).localeCompare(basename(left.folderPath), "zh");
  });
  return items;
}
