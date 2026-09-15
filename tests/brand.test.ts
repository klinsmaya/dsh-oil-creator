import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DZ_ICON_FILE, DZ_ICON_SRC } from "../src/client/assets/dzIcon.ts";
import { en, zh } from "../src/client/locales.ts";

const ROOT = process.cwd();

describe("sidebar brand", () => {
  it("keeps the dz icon path and 项目库 title", () => {
    expect(zh.tab).toBe("项目库");
    expect(DZ_ICON_FILE).toBe("src/client/assets/dz-icon-48.png");
    expect(existsSync(join(ROOT, DZ_ICON_FILE))).toBe(true);
    expect(existsSync(join(ROOT, "src/client/assets/oil-icon-48.png"))).toBe(false);
    expect(DZ_ICON_SRC.startsWith("data:image/png;base64,")).toBe(true);

    const brand = readFileSync(join(ROOT, "src/client/sidebar/DzBrand.tsx"), "utf8");
    const settings = readFileSync(join(ROOT, "src/client/CreatorSettingsCard.tsx"), "utf8");
    expect(brand).toContain("DZ_ICON_SRC");
    expect(settings).toContain("DZ_ICON_SRC");
    expect(brand).not.toMatch(/oil/i);
    expect(settings).not.toMatch(/oil/i);
  });

  it("keeps ordinary-user copy free of oil and StepId", () => {
    expect(zh["empty.library"]).toBe("项目会出现在这里；新建走对话");
    expect(zh["empty.step"]).toBe("这一步还没定版");
    expect(zh["inspector.action.finalize"]).toBe("定版");
    expect(zh["inspector.action.reopen"]).toBe("改版");
    expect(zh["inspector.action.pending"]).toBe("标待补");
    expect(en.tab).toBe("Projects");

    for (const [key, value] of Object.entries(zh)) {
      expect(value, key).not.toMatch(/oil/i);
      expect(value, key).not.toMatch(/S\d-\d{2}/);
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value, key).not.toMatch(/oil/i);
      expect(value, key).not.toMatch(/S\d-\d{2}/);
    }
  });
});
