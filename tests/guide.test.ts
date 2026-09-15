import { describe, expect, it } from "vitest";

import { guideText } from "../src/ops.ts";
import { rowMeta } from "../src/client/sidebar/rowMeta.ts";
import { buildProjectSummary } from "../src/catalog.ts";
import { emptyOverlayProject } from "../src/overlay.ts";
import { zh } from "../src/client/locales.ts";

describe("dz_guide and sidebar copy", () => {
  it("explains preview-then-apply without methodology", () => {
    const text = guideText("/tmp/定责项目");
    expect(text).toContain("dz_finalize");
    expect(text).toContain("apply=true");
    expect(text).not.toContain("假共识");
    expect(text).not.toContain("苏格拉底");
  });

  it("builds a human sidebar meta line", () => {
    const item = buildProjectSummary({
      id: "2026-09-15_星河餐饮",
      folderPath: "/tmp/p",
      company: "星河餐饮",
      createdMs: Date.parse("2026-09-15T00:00:00.000Z"),
      updatedAt: "2026-09-15T00:00:00.000Z",
    }, new Set(), {
      ...emptyOverlayProject(),
      pending: [{
        id: "p1",
        step: "S1-00",
        item: "补客户",
        blocking: true,
        done: false,
        createdAt: "2026-09-15T00:00:00.000Z",
      }],
    });
    const line = rowMeta(item, (key) => zh[key], Date.parse("2026-09-15T00:03:00.000Z"));
    expect(line).toContain("待补 1");
    expect(line).toContain("卡点 1");
    expect(line).not.toContain("S1-00");
  });
});
