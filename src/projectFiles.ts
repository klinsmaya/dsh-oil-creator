import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { AGENTS_FILE, FINAL_DIR, MATERIAL_DIR, pathInside } from "./catalog.ts";

export function resolveReadableProjectPath(folderPath: string, relative: string): string | undefined {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized === "" || normalized.includes("..")) return undefined;
  if (normalized === AGENTS_FILE) return join(folderPath, AGENTS_FILE);
  if (normalized.startsWith(`${FINAL_DIR}/`)) {
    const full = join(folderPath, ...normalized.split("/"));
    if (!pathInside(join(folderPath, FINAL_DIR), full) && full !== join(folderPath, FINAL_DIR)) {
      return undefined;
    }
    if (!pathInside(folderPath, full)) return undefined;
    return full;
  }
  return undefined;
}

export async function readProjectFile(folderPath: string, relative: string): Promise<string> {
  const path = resolveReadableProjectPath(folderPath, relative);
  if (path === undefined) {
    throw new Error("只能读取定版文件或 AGENTS.md。");
  }
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isFile()) {
    throw new Error("文件不存在。");
  }
  return readFile(path, "utf8");
}

export async function listMaterialFiles(folderPath: string): Promise<Array<{ name: string; path: string }>> {
  const dir = join(folderPath, MATERIAL_DIR);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, path: join(MATERIAL_DIR, entry.name) }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh"));
}
