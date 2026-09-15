import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FINAL_DIR } from "../src/catalog.ts";
import {
  ALREADY_FINAL,
  createProject,
  finalizeStep,
  NOT_READY,
  reopenStep,
  signProject,
  skipStep,
  STEP_NOT_SKIPPABLE,
} from "../src/ops.ts";
import { emptyOverlay, saveOverlay } from "../src/overlay.ts";
import { resolveReadableProjectPath } from "../src/projectFiles.ts";
import { STEPS } from "../src/steps.ts";

async function host() {
  const root = await mkdtemp(join(tmpdir(), "dz-more-"));
  const dataDir = join(root, "data");
  await mkdir(dataDir);
  await saveOverlay(dataDir, emptyOverlay());
  return { dataDir, libraryRoot: root };
}

describe("create / skip / reopen / sign", () => {
  it("creates a dated folder and binds a session", async () => {
    const ops = await host();
    const created = await createProject(ops, { company: "星河餐饮", sessionId: "sess-1" });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.project.pill).toBe("第一章 · 画像");
      expect(created.id.startsWith("20")).toBe(true);
    }
  });

  it("rejects skipping 战略屋 and allows skipping 逻辑共识", async () => {
    const ops = await host();
    const created = await createProject(ops, { company: "星河餐饮" });
    if (!created.ok) throw new Error("create failed");
    const blocked = await skipStep(ops, { project: created.id, step: "S1-01" });
    expect(blocked).toMatchObject({ ok: false, code: STEP_NOT_SKIPPABLE });
    const skipped = await skipStep(ops, { project: created.id, step: "S1-02" });
    expect(skipped.ok).toBe(true);
    if (skipped.ok) {
      expect(skipped.project.steps.find((step) => step.id === "S1-02")?.state).toBe("skipped");
    }
  });

  it("does not skip an already final step", async () => {
    const ops = await host();
    const created = await createProject(ops, { company: "星河餐饮" });
    if (!created.ok) throw new Error("create failed");
    await finalizeStep(ops, { project: created.id, step: "S1-00", content: "画像", apply: true });
    await finalizeStep(ops, { project: created.id, step: "S1-01", content: "战略屋", apply: true });
    await finalizeStep(ops, { project: created.id, step: "S1-02", content: "逻辑", apply: true });
    const result = await skipStep(ops, { project: created.id, step: "S1-02" });
    expect(result).toMatchObject({ ok: false, code: ALREADY_FINAL });
  });

  it("reopens a step and marks downstream finals for review", async () => {
    const ops = await host();
    const created = await createProject(ops, { company: "星河餐饮" });
    if (!created.ok) throw new Error("create failed");
    await finalizeStep(ops, { project: created.id, step: "S1-00", content: "画像", apply: true });
    await finalizeStep(ops, { project: created.id, step: "S1-01", content: "战略屋", apply: true });
    const reopened = await reopenStep(ops, { project: created.id, step: "S1-00", reason: "客户变了" });
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.project.currentStep).toBe("S1-00");
      expect(reopened.project.steps.find((step) => step.id === "S1-00")?.state).toBe("reopened");
      expect(reopened.project.steps.find((step) => step.id === "S1-01")?.state).toBe("needsReview");
    }
  });

  it("signs only when every step is done and 责任书 exists", async () => {
    const ops = await host();
    const created = await createProject(ops, { company: "星河餐饮" });
    if (!created.ok) throw new Error("create failed");
    expect(await signProject(ops, { project: created.id })).toMatchObject({ ok: false, code: NOT_READY });
    for (const step of STEPS) {
      await finalizeStep(ops, { project: created.id, step: step.id, content: step.name, apply: true });
    }
    const signed = await signProject(ops, { project: created.id, by: "张三" });
    expect(signed.ok).toBe(true);
    if (signed.ok) {
      expect(signed.project.stage).toBe("done");
      expect(signed.project.pill).toBe("已收官");
    }
  });
});

describe("project file access", () => {
  it("allows 定版 and AGENTS.md only", async () => {
    const root = "/tmp/proj";
    expect(resolveReadableProjectPath(root, "AGENTS.md")).toBe(join(root, "AGENTS.md"));
    expect(resolveReadableProjectPath(root, "定版/画像.md")).toBe(join(root, FINAL_DIR, "画像.md"));
    expect(resolveReadableProjectPath(root, "../secret")).toBeUndefined();
    expect(resolveReadableProjectPath(root, "材料/a.md")).toBeUndefined();
  });
});
