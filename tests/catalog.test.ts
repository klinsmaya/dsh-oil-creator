import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProjectSummary,
  FINAL_DIR,
  folderNameForCompany,
  matchProjectByCwd,
  matchProjectBySession,
  matchProjectRef,
  scanLibrary,
  summarizeProject,
} from "../src/catalog.ts";
import { emptyOverlay, emptyOverlayProject } from "../src/overlay.ts";
import { STEPS } from "../src/steps.ts";
import type { OverlayProject, StepId } from "../src/types.ts";

function overlayWith(partial: Partial<OverlayProject>): OverlayProject {
  return { ...emptyOverlayProject(new Date("2026-09-15T00:00:00.000Z")), ...partial };
}

function filesOf(...ids: StepId[]): Set<string> {
  return new Set(ids.map((id) => STEPS.find((step) => step.id === id)?.file ?? id));
}

const identity = {
  id: "2026-09-15_星河餐饮",
  folderPath: "/tmp/2026-09-15_星河餐饮",
  company: "星河餐饮",
  date: "2026-09-15",
  createdMs: 0,
  updatedAt: "2026-09-15T00:00:00.000Z",
};

describe("summarizeProject", () => {
  it("treats an empty folder as chapter 1 画像", () => {
    const summary = summarizeProject(new Set(), overlayWith({}));
    expect(summary.stage).toBe(1);
    expect(summary.currentStep).toBe("S1-00");
    expect(summary.currentStepName).toBe("画像");
    expect(summary.steps.find((step) => step.id === "S1-00")?.state).toBe("current");
    expect(summary.steps.filter((step) => step.state === "todo")).toHaveLength(STEPS.length - 1);
    expect(summary.progressLine).toBe("进度：第一章 · 画像 · 已定版 0");
    expect(summary.pill).toBe("第一章 · 画像");
    expect(summary.pillTone).toBe("pending");
  });

  it("uses closing when every step is final or skipped but unsigned", () => {
    const skipped = overlayWith({
      skipped: {
        "S1-02": { reason: "后补", at: "2026-09-15T00:00:00.000Z" },
      },
    });
    const files = filesOf("S1-00", "S1-01", "S1-03", "S2-01", "S2-02", "S2-03", "S3-01", "S3-02", "S3-03", "S3-04");
    const summary = summarizeProject(files, skipped);
    expect(summary.steps.find((step) => step.id === "S1-02")?.state).toBe("skipped");
    expect(summary.stage).toBe("closing");
    expect(summary.progressLine).toBe("进度：定三责已走完 · 待签约");
    expect(summary.pill).toBe("待签约");
  });

  it("uses done after signing", () => {
    const files = new Set(STEPS.map((step) => step.file));
    const summary = summarizeProject(files, overlayWith({
      signed: { by: "张三", at: "2026-09-15T12:00:00.000Z" },
    }));
    expect(summary.stage).toBe("done");
    expect(summary.progressLine).toBe("进度：已收官");
    expect(summary.pill).toBe("已收官");
    expect(summary.pillTone).toBe("success");
    expect(summary.signed?.by).toBe("张三");
  });

  it("keeps a middle skipped step and continues to the next todo", () => {
    const summary = summarizeProject(filesOf("S1-00", "S1-01"), overlayWith({
      skipped: {
        "S1-02": { reason: "逻辑后补", at: "2026-09-15T00:00:00.000Z" },
      },
    }));
    expect(summary.steps.find((step) => step.id === "S1-02")?.state).toBe("skipped");
    expect(summary.currentStep).toBe("S1-03");
    expect(summary.currentStepName).toBe("衡量共识");
    expect(summary.progressLine).toBe("进度：第一章 · 衡量共识 · 已定版 2");
    expect(summary.stage).toBe(1);
  });

  it("makes a reopened step current even if later todos exist", () => {
    const summary = summarizeProject(filesOf("S1-00", "S1-01", "S1-02"), overlayWith({
      reopened: {
        "S1-01": { reason: "使命改了", at: "2026-09-15T00:00:00.000Z" },
      },
    }));
    expect(summary.steps.find((step) => step.id === "S1-01")?.state).toBe("reopened");
    expect(summary.currentStep).toBe("S1-01");
    expect(summary.pill).toBe("第一章 · 战略屋（内容共识）");
    expect(summary.stage).toBe(1);
  });

  it("keeps needsReview on a file and continues to the next todo", () => {
    const summary = summarizeProject(filesOf("S1-00", "S1-01"), overlayWith({
      needsReview: {
        "S1-01": { because: "S1-00", at: "2026-09-15T00:00:00.000Z" },
      },
    }));
    expect(summary.steps.find((step) => step.id === "S1-00")?.state).toBe("final");
    expect(summary.steps.find((step) => step.id === "S1-01")?.state).toBe("needsReview");
    expect(summary.currentStep).toBe("S1-02");
    expect(summary.stage).toBe(1);
  });

  it("makes needsReview current when nothing else is open", () => {
    const files = filesOf("S1-00", "S1-01", "S1-03", "S2-01", "S2-02", "S2-03", "S3-01", "S3-02", "S3-03", "S3-04");
    const summary = summarizeProject(files, overlayWith({
      skipped: {
        "S1-02": { reason: "后补", at: "2026-09-15T00:00:00.000Z" },
      },
      needsReview: {
        "S1-01": { because: "S1-00", at: "2026-09-15T00:00:00.000Z" },
      },
    }));
    expect(summary.currentStep).toBe("S1-01");
    expect(summary.steps.find((step) => step.id === "S1-01")?.state).toBe("needsReview");
    expect(summary.pill).toBe("第一章 · 战略屋（内容共识）");
    expect(summary.pillTone).toBe("warning");
    expect(summary.stage).toBe(1);
  });

  it("counts pending and blocking items that are still open", () => {
    const summary = summarizeProject(new Set(), overlayWith({
      pending: [
        {
          id: "p1",
          step: "S1-00",
          item: "补客户名单",
          blocking: true,
          done: false,
          createdAt: "2026-09-15T00:00:00.000Z",
        },
        {
          id: "p2",
          step: "S1-00",
          item: "补门店数",
          blocking: false,
          done: false,
          createdAt: "2026-09-15T00:00:00.000Z",
        },
        {
          id: "p3",
          step: "S1-00",
          item: "已补完",
          blocking: true,
          done: true,
          createdAt: "2026-09-15T00:00:00.000Z",
          doneAt: "2026-09-15T01:00:00.000Z",
        },
      ],
    }));
    expect(summary.pendingCount).toBe(2);
    expect(summary.blockingCount).toBe(1);
  });

  it("honors skippable override", () => {
    const summary = summarizeProject(new Set(), overlayWith({}), { "S1-01": true, "S1-02": false });
    expect(summary.steps.find((step) => step.id === "S1-01")?.skippable).toBe(true);
    expect(summary.steps.find((step) => step.id === "S1-02")?.skippable).toBe(false);
  });
});

describe("buildProjectSummary + scan", () => {
  it("builds identity plus progress", () => {
    const summary = buildProjectSummary(identity, new Set(), overlayWith({}));
    expect(summary.company).toBe("星河餐饮");
    expect(summary.pill).toBe("第一章 · 画像");
  });

  it("scans dated folders and folders with 定版/", async () => {
    const root = await mkdtemp(join(tmpdir(), "dz-catalog-"));
    const dated = folderNameForCompany("星河餐饮", new Date("2026-09-15T00:00:00.000Z"));
    const datedPath = join(root, dated);
    await mkdir(join(datedPath, FINAL_DIR), { recursive: true });
    await writeFile(join(datedPath, FINAL_DIR, "画像.md"), "ok\n");
    const loose = join(root, "临时项目");
    await mkdir(join(loose, FINAL_DIR), { recursive: true });
    await writeFile(join(root, "readme.txt"), "skip\n");

    const items = await scanLibrary(root, emptyOverlay());
    expect(items.map((item) => item.company).sort()).toEqual(["临时项目", "星河餐饮"]);
    const xinghe = items.find((item) => item.company === "星河餐饮");
    expect(xinghe?.currentStep).toBe("S1-01");
    expect(xinghe?.pill).toBe("第一章 · 战略屋（内容共识）");
    expect(xinghe?.steps.find((step) => step.id === "S1-00")?.state).toBe("final");
  });
});

describe("project matching", () => {
  const items = [
    buildProjectSummary(identity, new Set(), overlayWith({})),
    buildProjectSummary({
      ...identity,
      id: "2026-09-16_另一家",
      folderPath: "/tmp/2026-09-16_另一家",
      company: "另一家",
    }, new Set(), overlayWith({})),
  ];

  it("matches by id, path, or company", () => {
    expect(matchProjectRef("星河餐饮", items)?.id).toBe(identity.id);
    expect(matchProjectRef(identity.folderPath, items)?.id).toBe(identity.id);
    expect(matchProjectRef(identity.id, items)?.id).toBe(identity.id);
  });

  it("matches cwd inside the project or library", () => {
    expect(matchProjectByCwd("/tmp/2026-09-15_星河餐饮/定版", items, "/tmp")?.id).toBe(identity.id);
    expect(matchProjectByCwd("/tmp/2026-09-15_星河餐饮", items, "/other")?.id).toBe(identity.id);
  });

  it("matches the latest session binding", () => {
    const store = emptyOverlay();
    store.projects[identity.id] = overlayWith({
      sessionIds: ["sess-a"],
      updatedAt: "2026-09-16T00:00:00.000Z",
    });
    store.projects["2026-09-16_另一家"] = overlayWith({
      sessionIds: ["sess-a"],
      updatedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(matchProjectBySession("sess-a", store, items)?.id).toBe("2026-09-16_另一家");
  });
});
