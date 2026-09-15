import { describe, expect, it } from "vitest";

import { buildProjectSummary } from "../src/catalog.ts";
import { emptyOverlay, emptyOverlayProject } from "../src/overlay.ts";
import { DingzeError, NO_CURRENT_PROJECT, resolveProjectSummary } from "../src/service.ts";
import { skippableOverrideFromList, stepById, STEPS } from "../src/steps.ts";

const xinghe = buildProjectSummary({
  id: "2026-09-15_星河餐饮",
  folderPath: "/lib/2026-09-15_星河餐饮",
  company: "星河餐饮",
  createdMs: 1,
  updatedAt: "2026-09-15T00:00:00.000Z",
}, new Set(), emptyOverlayProject());

describe("resolveProjectSummary", () => {
  const items = [xinghe];
  const overlay = emptyOverlay();

  it("prefers an explicit project name", () => {
    expect(resolveProjectSummary(
      { project: "星河餐饮", cwd: "/other", sessionId: "s" },
      items,
      overlay,
      "/lib",
    )?.id).toBe(xinghe.id);
  });

  it("uses cwd when project is omitted", () => {
    expect(resolveProjectSummary(
      { cwd: "/lib/2026-09-15_星河餐饮/材料" },
      items,
      overlay,
      "/lib",
    )?.company).toBe("星河餐饮");
  });

  it("falls back to the session binding", () => {
    const store = emptyOverlay();
    store.projects[xinghe.id] = {
      ...emptyOverlayProject(),
      sessionIds: ["sess-1"],
    };
    expect(resolveProjectSummary(
      { sessionId: "sess-1" },
      items,
      store,
      "/lib",
    )?.id).toBe(xinghe.id);
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveProjectSummary({}, items, overlay, "/lib")).toBeUndefined();
  });
});

describe("DingzeError", () => {
  it("carries no_current_project", () => {
    const error = new DingzeError(NO_CURRENT_PROJECT, "没有当前项目");
    expect(error.code).toBe("no_current_project");
  });
});

describe("steps registry", () => {
  it("registers eleven steps across three chapters", () => {
    expect(STEPS).toHaveLength(11);
    expect(STEPS.map((step) => step.id)).toEqual([
      "S1-00", "S1-01", "S1-02", "S1-03",
      "S2-01", "S2-02", "S2-03",
      "S3-01", "S3-02", "S3-03", "S3-04",
    ]);
    expect(stepById("S2-02")?.file).toBe("RACI.md");
    expect(stepById("missing")).toBeUndefined();
    expect(skippableOverrideFromList(["S1-01", "!S1-02"])).toEqual({
      "S1-01": true,
      "S1-02": false,
    });
  });
});
