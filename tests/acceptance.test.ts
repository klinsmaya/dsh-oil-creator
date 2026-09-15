import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BLOCKING_PENDING,
  createProject,
  finalizeStep,
  mutatePending,
  NOT_READY,
  ORDER_VIOLATION,
  reopenStep,
  signProject,
  skipStep,
  STEP_NOT_SKIPPABLE,
} from "../src/ops.ts";
import { emptyOverlay, saveOverlay } from "../src/overlay.ts";
import { STEPS } from "../src/steps.ts";

async function fresh() {
  const root = await mkdtemp(join(tmpdir(), "dz-accept-"));
  const dataDir = join(root, "data");
  await mkdir(dataDir);
  await saveOverlay(dataDir, emptyOverlay());
  return { dataDir, libraryRoot: root };
}

describe("规格第6节可自动验收项", () => {
  it("2-7: 新建、顺序、卡点、跳过、改版复核、签约", async () => {
    const host = await fresh();
    const created = await createProject(host, { company: "星河餐饮" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.project.pill).toBe("第一章 · 画像");

    expect(await finalizeStep(host, {
      project: created.id,
      step: "S1-01",
      content: "战略屋",
      apply: true,
    })).toMatchObject({ ok: false, code: ORDER_VIOLATION });

    await finalizeStep(host, { project: created.id, step: "S1-00", content: "画像", apply: true });
    await mutatePending(host, {
      project: created.id,
      action: "add",
      item: "补使命",
      blocking: true,
    });
    expect(await finalizeStep(host, {
      project: created.id,
      step: "S1-01",
      content: "战略屋",
      apply: true,
    })).toMatchObject({ ok: false, code: BLOCKING_PENDING });

    const listed = await mutatePending(host, { project: created.id, action: "list" });
    const pendingId = listed.ok ? listed.pending[0]?.id : undefined;
    expect(typeof pendingId).toBe("string");
    if (typeof pendingId === "string") {
      await mutatePending(host, { project: created.id, action: "resolve", id: pendingId });
    }
    const house = await finalizeStep(host, {
      project: created.id,
      step: "S1-01",
      content: "战略屋",
      apply: true,
    });
    expect(house.ok).toBe(true);
    if (house.ok) expect(house.project.pill).toBe("第一章 · 逻辑共识");

    expect(await skipStep(host, { project: created.id, step: "S1-01" }))
      .toMatchObject({ ok: false, code: STEP_NOT_SKIPPABLE });
    const skipped = await skipStep(host, { project: created.id, step: "S1-02" });
    expect(skipped.ok).toBe(true);
    if (skipped.ok) {
      expect(skipped.project.steps.find((step) => step.id === "S1-02")?.state).toBe("skipped");
    }

    const reopened = await reopenStep(host, { project: created.id, step: "S1-01" });
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.project.currentStep).toBe("S1-01");
      expect(reopened.project.steps.find((step) => step.id === "S1-01")?.state).toBe("reopened");
    }
    await finalizeStep(host, {
      project: created.id,
      step: "S1-01",
      content: "战略屋改版",
      apply: true,
    });
    expect(await signProject(host, { project: created.id }))
      .toMatchObject({ ok: false, code: NOT_READY });

    for (const step of STEPS) {
      await finalizeStep(host, { project: created.id, step: step.id, content: step.name, apply: true });
    }
    const signed = await signProject(host, { project: created.id, by: "张三" });
    expect(signed.ok).toBe(true);
    if (signed.ok) {
      expect(signed.project.stage).toBe("done");
      expect(signed.project.pill).toBe("已收官");
    }
  });
});
