import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectDingzeSetup } from "../src/capabilities.ts";

describe("dingze setup inspection", () => {
  it("only reports whether the project library exists and is writable", async () => {
    const root = await mkdtemp(join(tmpdir(), "dz-capabilities-"));
    const libraryRoot = join(root, "library");
    await mkdir(libraryRoot);

    const result = await inspectDingzeSetup({
      libraryRoot,
      dataDir: join(root, "data"),
      settings: { libraryRoot },
      platform: "linux",
    });

    expect(Object.keys(result.capabilities)).toEqual(["library"]);
    expect(result.capabilities.library.state).toBe("ready");
    expect(result.capabilities.library.path).toBe(libraryRoot);
  });

  it("marks a missing library directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "dz-capabilities-missing-"));
    const libraryRoot = join(root, "missing");
    const result = await inspectDingzeSetup({
      libraryRoot,
      dataDir: join(root, "data"),
      settings: { libraryRoot },
    });
    expect(result.capabilities.library.state).toBe("missing");
    expect(result.capabilities.library.detail).toContain("不存在");
  });
});
