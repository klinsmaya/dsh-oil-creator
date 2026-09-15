import { describe, expect, it, vi } from "vitest";

import { conversationInputOf, draftOrSubmit } from "../src/client/conversationInput.ts";

describe("conversation.input 兼容", () => {
  it("优先使用 input.for(scope) 返回的草稿接口", () => {
    const scoped = { setDraft: vi.fn(), submit: vi.fn() };
    const host = { input: { for: vi.fn(() => scoped) } };
    const api = conversationInputOf(host, "session-a");
    expect(host.input.for).toHaveBeenCalledWith("session-a");
    expect(draftOrSubmit(api, "新建定责项目：", "draft")).toBe(true);
    expect(scoped.setDraft).toHaveBeenCalledWith("新建定责项目：");
  });

  it("for 不可用时回退到 input 自身", () => {
    const input = { setDraft: vi.fn(), submit: vi.fn() };
    const api = conversationInputOf({ input });
    expect(draftOrSubmit(api, "我点头，这步定版：画像", "submit")).toBe(true);
    expect(input.submit).toHaveBeenCalledWith("我点头，这步定版：画像");
  });

  it("接口缺失时返回 undefined", () => {
    expect(conversationInputOf(undefined)).toBeUndefined();
    expect(conversationInputOf({})).toBeUndefined();
    expect(draftOrSubmit(undefined, "x", "draft")).toBe(false);
  });
});
