import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultDataDir,
  defaultLibraryRoot,
  expandHomePath,
  resolveDataDir,
} from "../src/config.ts";

describe("portable config defaults", () => {
  it("puts the library under Documents/定责项目", () => {
    expect(defaultLibraryRoot()).toBe(join(homedir(), "Documents", "定责项目"));
  });

  it("stores overlay under ~/.dsh-dingze", () => {
    expect(defaultDataDir()).toBe(join(homedir(), ".dsh-dingze"));
  });

  it("resolves empty dataDir to the home-local store", () => {
    expect(resolveDataDir({
      libraryRoot: defaultLibraryRoot(),
      dataDir: "",
      skippableSteps: [],
    })).toBe(defaultDataDir());
  });

  it("expands home prefixes", () => {
    expect(expandHomePath("~/Documents/定责项目")).toBe(join(homedir(), "Documents", "定责项目"));
    expect(expandHomePath("%USERPROFILE%\\Documents\\定责项目")).toBe(join(homedir(), "Documents", "定责项目"));
  });
});
