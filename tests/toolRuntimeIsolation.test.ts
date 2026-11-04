import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const SCHEDULER_DESCRIPTION = "@deepseek-ai/dsh-tools.scheduler";

interface ToolRuntime {
  symbol: symbol;
  registry: Record<symbol, { prepare: (input: unknown) => string }>;
}

/**
 * Each physical copy of `@deepseek-ai/dsh-tools` mints its scheduler with
 * `Symbol(description)`, not `Symbol.for`. The description matches; the
 * identity does not.
 */
function loadToolRuntime(label: string): ToolRuntime {
  const symbol = Symbol(SCHEDULER_DESCRIPTION);
  return {
    symbol,
    registry: {
      [symbol]: {
        prepare: () => `prepared-by-${label}`,
      },
    },
  };
}

function installedToolRuntimePackages(root = process.cwd()): string[] {
  const store = join(root, "node_modules/.pnpm");
  return readdirSync(store, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("@deepseek-ai+dsh-tools@"))
    .map((entry) => entry.name);
}

describe("creator tool runtime isolation", () => {
  it("breaks every tool call when the plugin holds a second scheduler symbol", () => {
    const host = loadToolRuntime("host");
    const plugin = loadToolRuntime("plugin");

    expect(String(host.symbol)).toBe(`Symbol(${SCHEDULER_DESCRIPTION})`);
    expect(String(plugin.symbol)).toBe(String(host.symbol));
    expect(plugin.symbol).not.toBe(host.symbol);

    const scheduler = host.registry[plugin.symbol];
    expect(scheduler).toBeUndefined();
    expect(() => scheduler!.prepare({})).toThrow(TypeError);
    expect(() => scheduler!.prepare({})).toThrow(/prepare/);
  });

  it("keeps prepare reachable when the plugin uses the host symbol", () => {
    const host = loadToolRuntime("host");
    expect(host.registry[host.symbol]?.prepare({})).toBe("prepared-by-host");
  });

  it("installs one dsh-tools copy and one scheduler symbol", async () => {
    const copies = installedToolRuntimePackages();
    expect(copies).toEqual([
      expect.stringMatching(/^@deepseek-ai\+dsh-tools@0\.1\.0-rc\.7_/),
    ]);

    const entry = join(
      process.cwd(),
      "node_modules/.pnpm",
      copies[0]!,
      "node_modules/@deepseek-ai/dsh-tools/lib/index.js",
    );
    const installed = await import(pathToFileURL(entry).href) as {
      TOOL_RUNTIME_SCHEDULER: symbol;
    };
    const resolved = await import("@deepseek-ai/dsh-tools") as {
      TOOL_RUNTIME_SCHEDULER: symbol;
    };
    expect(resolved.TOOL_RUNTIME_SCHEDULER).toBe(installed.TOOL_RUNTIME_SCHEDULER);
    expect(String(resolved.TOOL_RUNTIME_SCHEDULER)).toBe(`Symbol(${SCHEDULER_DESCRIPTION})`);
  });
});
