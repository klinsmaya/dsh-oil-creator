import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";

import type { Capability, DingzeCapabilities, DingzeSetupStatus, LibrarySettings } from "./types.ts";

interface InspectOptions {
  libraryRoot: string;
  dataDir: string;
  settings: LibrarySettings;
  platform?: NodeJS.Platform;
}

function capability(
  state: Capability["state"],
  required: boolean,
  detail: string,
  path?: string,
): Capability {
  return path === undefined
    ? { state, required, detail }
    : { state, required, detail, path };
}

export async function libraryCapability(path: string): Promise<Capability> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    return capability("missing", true, "项目库目录不存在，需要先选择或创建目录。", path);
  }
  const writable = await access(path, constants.R_OK | constants.W_OK).then(() => true, () => false);
  return writable
    ? capability("ready", true, "项目库目录可读写。", path)
    : capability("missing", true, "项目库目录存在，但当前进程没有读写权限。", path);
}

export async function inspectDingzeSetup(options: InspectOptions): Promise<DingzeSetupStatus> {
  const capabilities: DingzeCapabilities = {
    library: await libraryCapability(options.libraryRoot),
  };
  return {
    platform: options.platform ?? process.platform,
    dataDir: options.dataDir,
    settings: options.settings,
    capabilities,
  };
}
