import { describe, expect, it } from "vitest";

import { scopeOf } from "../src/tools.ts";

describe("tool scope", () => {
  it("reads cwd and optional sessionId without guessing extra fields", () => {
    const cwd = process.cwd();
    expect(scopeOf({})).toEqual({ cwd });
    expect(scopeOf({ agent: { sessionId: "sess-1" } as object })).toEqual({ cwd, sessionId: "sess-1" });
  });
});
