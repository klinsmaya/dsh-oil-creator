import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FINAL_DIR, HISTORY_DIR } from "../src/catalog.ts";
import {
  BLOCKING_PENDING,
  CONTENT_REQUIRED,
  finalizeStep,
  mutatePending,
  ORDER_VIOLATION,
  UNKNOWN_STEP,
} from "../src/ops.ts";
import { emptyOverlay, saveOverlay } from "../src/overlay.ts";

async function seedProject(company = "星河餐饮") {
  const root = await mkdtemp(join(tmpdir(), "dz-final-"));
  const id = `2026-09-15_${company}`;
  const folderPath = join(root, id);
  await mkdir(join(folderPath, FINAL_DIR), { recursive: true });
  await mkdir(join(folderPath, "材料"), { recursive: true });
  const dataDir = join(root, "data");
  await mkdir(dataDir);
  await saveOverlay(dataDir, emptyOverlay());
  return {
    host: { dataDir, libraryRoot: root },
    id,
    folderPath,
    project: id,
  };
}

describe("finalizeStep", () => {
  it("rejects unknown_step first", async () => {
    const { host, project } = await seedProject();
    const result = await finalizeStep(host, { project, step: "S9-99", content: "x", apply: false });
    expect(result).toMatchObject({ ok: false, code: UNKNOWN_STEP });
  });

  it("rejects order_violation when 画像 is not final", async () => {
    const { host, project } = await seedProject();
    const result = await finalizeStep(host, { project, step: "S1-01", content: "战略屋", apply: false });
    expect(result).toMatchObject({ ok: false, code: ORDER_VIOLATION });
    expect(result.ok === false && result.message.includes("画像")).toBe(true);
  });

  it("rejects blocking_pending after earlier steps are final", async () => {
    const { host, project, folderPath } = await seedProject();
    await writeFile(join(folderPath, FINAL_DIR, "画像.md"), "画像\n");
    await mutatePending(host, {
      project,
      action: "add",
      step: "S1-01",
      item: "补使命",
      blocking: true,
    });
    const result = await finalizeStep(host, { project, step: "S1-01", content: "战略屋", apply: true });
    expect(result).toMatchObject({ ok: false, code: BLOCKING_PENDING });
  });

  it("rejects content_required when the file is missing", async () => {
    const { host, project } = await seedProject();
    const result = await finalizeStep(host, { project, step: "S1-00", apply: false });
    expect(result).toMatchObject({ ok: false, code: CONTENT_REQUIRED });
  });

  it("previews without writing, then apply writes and archives", async () => {
    const { host, project, folderPath } = await seedProject();
    const preview = await finalizeStep(host, {
      project,
      step: "S1-00",
      content: "第一稿",
      apply: false,
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.apply).toBe(false);
      expect(preview.action).toBe("write");
    }
    await expect(readdir(join(folderPath, FINAL_DIR))).resolves.toEqual([]);

    const applied = await finalizeStep(host, {
      project,
      step: "S1-00",
      content: "第一稿",
      apply: true,
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.apply).toBe(true);
      expect(applied.project.steps.find((step) => step.id === "S1-00")?.state).toBe("final");
      expect(applied.project.currentStep).toBe("S1-01");
    }
    expect(await readFile(join(folderPath, FINAL_DIR, "画像.md"), "utf8")).toBe("第一稿\n");

    const rewrite = await finalizeStep(host, {
      project,
      step: "S1-00",
      content: "第二稿",
      apply: true,
    });
    expect(rewrite.ok).toBe(true);
    if (rewrite.ok) {
      expect(rewrite.action).toBe("rewrite");
      expect(rewrite.archivedTo).toContain(HISTORY_DIR);
    }
    expect(await readFile(join(folderPath, FINAL_DIR, "画像.md"), "utf8")).toBe("第二稿\n");
    const history = await readdir(join(folderPath, FINAL_DIR, HISTORY_DIR));
    expect(history.some((name) => name.startsWith("画像."))).toBe(true);
  });

  it("clears needsReview only when content is omitted and the file exists", async () => {
    const { host, project, folderPath } = await seedProject();
    await writeFile(join(folderPath, FINAL_DIR, "画像.md"), "画像定稿\n");
    await writeFile(join(folderPath, FINAL_DIR, "战略屋.md"), "战略屋定稿\n");
    const { emptyOverlayProject, decodeOverlay, overlayPath } = await import("../src/overlay.ts");
    const store = emptyOverlay();
    store.projects[project] = {
      ...emptyOverlayProject(),
      needsReview: {
        "S1-01": { because: "S1-00", at: "2026-09-15T00:00:00.000Z" },
      },
      reopened: {
        "S1-01": { reason: "改使命", at: "2026-09-15T00:00:00.000Z" },
      },
    };
    const { writeFile: write } = await import("node:fs/promises");
    await write(overlayPath(host.dataDir), `${JSON.stringify(store, null, 2)}\n`);

    const result = await finalizeStep(host, { project, step: "S1-01", apply: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action).toBe("review");
      expect(result.project.steps.find((step) => step.id === "S1-01")?.state).toBe("reopened");
    }
    expect(await readFile(join(folderPath, FINAL_DIR, "战略屋.md"), "utf8")).toBe("战略屋定稿\n");
    const raw = JSON.parse(await readFile(overlayPath(host.dataDir), "utf8")) as unknown;
    const overlay = decodeOverlay(raw);
    expect(overlay.projects[project]?.needsReview["S1-01"]).toBeUndefined();
    expect(overlay.projects[project]?.reopened["S1-01"]).toBeDefined();
  });
});
