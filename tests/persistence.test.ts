import { describe, expect, it } from "vitest";

import {
  DINGZE_STORAGE_KEY,
  DEFAULT_UI_STATE,
  loadDingzeUiState,
  saveDingzeUiState,
  type DingzeStorage,
} from "../src/client/persistence.ts";

function memoryStorage(seed: Record<string, string> = {}): DingzeStorage {
  const data = { ...seed };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("loadDingzeUiState", () => {
  it("returns defaults when storage is missing", () => {
    expect(loadDingzeUiState(undefined)).toEqual(DEFAULT_UI_STATE);
  });

  it("returns defaults for broken json", () => {
    expect(loadDingzeUiState(memoryStorage({ [DINGZE_STORAGE_KEY]: "{" }))).toEqual(
      DEFAULT_UI_STATE,
    );
  });

  it("keeps only known fields", () => {
    const storage = memoryStorage({
      [DINGZE_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        selectedId: "2026-09-15_星河餐饮",
        query: "星河",
        extra: true,
      }),
    });
    expect(loadDingzeUiState(storage)).toEqual({
      schemaVersion: 1,
      selectedId: "2026-09-15_星河餐饮",
      query: "星河",
      sidebarTab: "content",
      autoOpenInspector: true,
    });
  });

  it("keeps a saved sidebar tab", () => {
    const storage = memoryStorage({
      [DINGZE_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        selectedId: null,
        query: "",
        sidebarTab: "sessions",
      }),
    });
    expect(loadDingzeUiState(storage).sidebarTab).toBe("sessions");
  });
});

describe("saveDingzeUiState", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const state = {
      schemaVersion: 1 as const,
      selectedId: "demo",
      query: "定责",
      sidebarTab: "content" as const,
      autoOpenInspector: true,
    };
    expect(saveDingzeUiState(storage, state)).toBe(true);
    expect(loadDingzeUiState(storage)).toEqual(state);
  });
});
