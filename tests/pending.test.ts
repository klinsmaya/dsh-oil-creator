import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FINAL_DIR } from "../src/catalog.ts";
import { mutatePending, PENDING_NOT_FOUND, projectStatus } from "../src/ops.ts";
import { emptyOverlay, saveOverlay } from "../src/overlay.ts";

async function seed() {
  const root = await mkdtemp(join(tmpdir(), "dz-pending-"));
  const id = "2026-09-15_星河餐饮";
  await mkdir(join(root, id, FINAL_DIR), { recursive: true });
  const dataDir = join(root, "data");
  await mkdir(dataDir);
  await saveOverlay(dataDir, emptyOverlay());
  return { host: { dataDir, libraryRoot: root }, project: id };
}

describe("mutatePending", () => {
  it("adds, lists blocking first, updates, and resolves", async () => {
    const { host, project } = await seed();
    const added = await mutatePending(host, {
      project,
      action: "add",
      step: "S1-00",
      item: "补门店数",
      blocking: false,
    });
    expect(added.ok).toBe(true);
    const block = await mutatePending(host, {
      project,
      action: "add",
      step: "S1-00",
      item: "补客户名单",
      blocking: true,
      who: "李四",
    });
    expect(block.ok).toBe(true);

    const listed = await mutatePending(host, { project, action: "list" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.pending[0]?.blocking).toBe(true);
      expect(listed.pending[0]?.item).toBe("补客户名单");
    }

    const id = listed.ok ? listed.pending[1]?.id : undefined;
    expect(typeof id).toBe("string");
    if (typeof id !== "string") return;
    const updated = await mutatePending(host, {
      project,
      action: "update",
      id,
      item: "补门店与档口",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.changed?.item).toBe("补门店与档口");

    const resolved = await mutatePending(host, { project, action: "resolve", id });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.changed?.done).toBe(true);

    const status = await projectStatus(host, { project });
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.pending[0]?.blocking).toBe(true);
      expect(status.pending[0]?.done).toBe(false);
      expect(status.nextAction).toContain("卡点");
    }
  });

  it("returns pending_not_found", async () => {
    const { host, project } = await seed();
    const result = await mutatePending(host, { project, action: "resolve", id: "missing" });
    expect(result).toMatchObject({ ok: false, code: PENDING_NOT_FOUND });
  });
});
