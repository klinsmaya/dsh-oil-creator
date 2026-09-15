import { describe, expect, it } from "vitest";

import { registerProjectTriggers } from "../src/client/projectTriggers.ts";
import { setSelectedContentId } from "../src/client/contentSelection.ts";

describe("project triggers", () => {
  it("offers 当前项目 and step names without exposing ids in the insert text", async () => {
    setSelectedContentId("2026-09-15_星河餐饮");
    let atCandidates: ((session: unknown, req: { query: string; signal: AbortSignal }) => Promise<ReadonlyArray<{ name: string }>>) | undefined;
    let slashPick: ((pick: { candidate: { name: string } }) => { text?: string } | undefined) | undefined;
    const stop = registerProjectTriggers({
      registerSource: (src) => {
        if (src.name === "当前项目") atCandidates = src.candidates;
        if (src.name === "current project") slashPick = src.onPick;
        return () => undefined;
      },
    }, async () => [{ id: "2026-09-15_星河餐饮", company: "星河餐饮" }]);
    expect(atCandidates).toBeDefined();
    const rows = await atCandidates?.(undefined, { query: "", signal: new AbortController().signal });
    expect(rows?.some((row) => row.name === "当前项目")).toBe(true);
    expect(slashPick?.({ candidate: { name: "step 画像" } })?.text).toBe("看要点：画像");
    stop();
    setSelectedContentId(null);
  });
});
