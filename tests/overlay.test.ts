import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decodeOverlay,
  emptyOverlay,
  emptyOverlayProject,
  ensureOverlayProject,
  loadOverlay,
  OverlayVersionError,
  overlayPath,
  saveOverlay,
} from "../src/overlay.ts";

describe("overlay decode", () => {
  it("returns an empty store for junk", () => {
    expect(decodeOverlay(null)).toEqual(emptyOverlay());
    expect(decodeOverlay("nope")).toEqual(emptyOverlay());
  });

  it("rejects an unknown version", () => {
    expect(() => decodeOverlay({ version: 9, projects: {} })).toThrow(OverlayVersionError);
  });

  it("keeps libraryRoot and typed project fields", () => {
    const store = decodeOverlay({
      version: 1,
      libraryRoot: "/tmp/定责项目",
      projects: {
        "2026-09-15_星河餐饮": {
          sessionIds: ["s1", 3, ""],
          pending: [{
            id: "p1",
            step: "S1-00",
            item: "补客户",
            blocking: true,
            done: false,
            createdAt: "2026-09-15T00:00:00.000Z",
            who: "李四",
          }, { id: "bad" }],
          skipped: {
            "S1-02": { reason: "后补", at: "2026-09-15T00:00:00.000Z" },
            "NOPE": { reason: "x", at: "t" },
          },
          reopened: {
            "S1-01": { reason: "改使命", at: "2026-09-15T01:00:00.000Z" },
          },
          needsReview: {
            "S1-02": { because: "S1-01", at: "2026-09-15T01:00:00.000Z" },
          },
          finalized: {
            "S1-00": { at: "2026-09-15T00:30:00.000Z" },
          },
          signed: { by: "张三", at: "2026-09-16T00:00:00.000Z" },
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
      },
    });
    expect(store.libraryRoot).toBe("/tmp/定责项目");
    const project = store.projects["2026-09-15_星河餐饮"];
    expect(project?.sessionIds).toEqual(["s1"]);
    expect(project?.pending).toHaveLength(1);
    expect(project?.pending[0]?.who).toBe("李四");
    expect(project?.skipped["S1-02"]?.reason).toBe("后补");
    expect(project?.skipped).not.toHaveProperty("NOPE");
    expect(project?.reopened["S1-01"]?.reason).toBe("改使命");
    expect(project?.needsReview["S1-02"]?.because).toBe("S1-01");
    expect(project?.finalized["S1-00"]?.at).toBe("2026-09-15T00:30:00.000Z");
    expect(project?.signed?.by).toBe("张三");
  });

  it("creates a project on demand", () => {
    const store = emptyOverlay();
    const created = ensureOverlayProject(store, "p1", new Date("2026-09-15T00:00:00.000Z"));
    expect(created.updatedAt).toBe("2026-09-15T00:00:00.000Z");
    expect(store.projects.p1).toBe(created);
    expect(ensureOverlayProject(store, "p1")).toBe(created);
  });
});

describe("overlay persistence", () => {
  it("loads empty when the file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dz-overlay-missing-"));
    await expect(loadOverlay(dir)).resolves.toEqual(emptyOverlay());
  });

  it("writes atomically and round-trips", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dz-overlay-save-"));
    const store = emptyOverlay();
    store.libraryRoot = "/tmp/lib";
    store.projects.demo = emptyOverlayProject(new Date("2026-09-15T00:00:00.000Z"));
    store.projects.demo.sessionIds.push("sess");
    await saveOverlay(dir, store);
    const raw = await readFile(overlayPath(dir), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toMatchObject({ version: 1, libraryRoot: "/tmp/lib" });
    const loaded = await loadOverlay(dir);
    expect(loaded.projects.demo?.sessionIds).toEqual(["sess"]);
  });

  it("rejects a stored unknown version", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dz-overlay-ver-"));
    await writeFile(overlayPath(dir), `${JSON.stringify({ version: 2, projects: {} })}\n`);
    await expect(loadOverlay(dir)).rejects.toBeInstanceOf(OverlayVersionError);
  });
});
