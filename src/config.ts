import { homedir } from "node:os";
import { join } from "node:path";

import Schema from "@deepseek-ai/schemastery";

export interface Config {
  libraryRoot: string;
  dataDir: string;
}

export function defaultLibraryRoot(): string {
  return join(homedir(), "Documents", "定责项目");
}

export function defaultDataDir(): string {
  return join(homedir(), ".dsh-dingze");
}

function joinUnderHome(home: string, rest: string): string {
  return join(home, ...rest.replaceAll("\\", "/").split("/").filter(Boolean));
}

export function expandHomePath(path: string, home = homedir()): string {
  const trimmed = path.trim();
  if (trimmed === "~" || trimmed === "%USERPROFILE%" || trimmed === "%HOME%") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return joinUnderHome(home, trimmed.slice(2));
  const windowsHome = /^%(?:USERPROFILE|HOME)%([\\/].*)?$/.exec(trimmed);
  if (windowsHome !== null) {
    const rest = windowsHome[1];
    return rest === undefined || rest === "" ? home : joinUnderHome(home, rest);
  }
  return trimmed;
}

export const Config: Schema<Config> = Schema.object({
  libraryRoot: Schema.string().default(defaultLibraryRoot()),
  dataDir: Schema.string().default(defaultDataDir()),
});

export function resolveDataDir(config: Config): string {
  return config.dataDir === "" ? defaultDataDir() : config.dataDir;
}
