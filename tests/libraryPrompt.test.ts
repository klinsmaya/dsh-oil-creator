import { describe, expect, it } from "vitest";

import { libraryConventionText, registerLibraryPrompt, resolvePromptLibraryRoot } from "../src/libraryPrompt.ts";
import { DINGZE_WORKBENCH_SKILL } from "../src/creatorSkill.ts";

describe("library prompt", () => {
  it("names the section dingze-library and states the five rules", () => {
    const sections: Array<{ name: string; text: string }> = [];
    registerLibraryPrompt({
      systemPrompt: {
        section: (section) => {
          sections.push({
            name: section.name,
            text: typeof section.text === "function" ? section.text() : section.text,
          });
          return () => {};
        },
      },
    }, {
      libraryRoot: "/tmp/定责项目",
      dataDir: "/tmp/.dsh-dingze",
    });
    expect(sections[0]?.name).toBe("dingze-library");
    const text = libraryConventionText("/tmp/定责项目", "/tmp/.dsh-dingze");
    expect(text).toContain("/tmp/定责项目");
    expect(text).toContain("YYYY-MM-DD_公司名");
    expect(text).toContain("画像");
    expect(text).toContain("战略屋（内容共识）");
    expect(text).toContain("定版只能经 dz_finalize");
    expect(text).toContain("dz_pending");
    expect(text).toContain("不要用写文件工具往 定版/");
    expect(text).toContain("开场先调用 dz_status");
    expect(text).toContain("当前项目等于 cwd");
    expect(resolvePromptLibraryRoot({
      libraryRoot: "/a",
      dataDir: "/d",
      cache: { libraryRoot: "/cached" },
    })).toBe("/cached");
  });
});

describe("dingze-workbench skill", () => {
  it("is invocable and stays short without methodology", () => {
    expect(DINGZE_WORKBENCH_SKILL.name).toBe("dingze-workbench");
    expect(DINGZE_WORKBENCH_SKILL.invocation).toEqual({
      modelInvocable: true,
      userInvocable: true,
    });
    const lines = DINGZE_WORKBENCH_SKILL.content.split("\n");
    expect(lines.length).toBeLessThanOrEqual(30);
    expect(DINGZE_WORKBENCH_SKILL.content).toContain("dz_finalize");
    expect(DINGZE_WORKBENCH_SKILL.content).not.toContain("苏格拉底");
    expect(DINGZE_WORKBENCH_SKILL.content).not.toContain("假共识");
    expect(DINGZE_WORKBENCH_SKILL.content).not.toContain("IPOOC");
  });
});
