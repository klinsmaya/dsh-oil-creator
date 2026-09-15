import { describe, expect, it } from "vitest";

import { DINGZE_INVOCATIONS, PACKAGE_NAME, REMOTE_NAMESPACE } from "../src/remote-contract.ts";
import { TYPERT } from "../src/typert.host.ts";

describe("handwritten TYPERT", () => {
  it("matches the package and host face", () => {
    expect(TYPERT.package).toBe(PACKAGE_NAME);
    expect(TYPERT.face).toBe("host");
    expect(TYPERT.invocations).toBe(DINGZE_INVOCATIONS);
  });

  it("exposes dz methods with zod v4 codecs", () => {
    const methods = DINGZE_INVOCATIONS.map((item) => item.method);
    expect(methods).toEqual([
      "listProjects",
      "getSettings",
      "getCapabilities",
      "getRevision",
      "setLibraryRoot",
      "refreshCatalog",
      "openFolder",
      "projectDetail",
      "readFile",
      "listMaterials",
      "setSkippableSteps",
    ]);
    for (const item of DINGZE_INVOCATIONS) {
      expect(item.service).toBe(REMOTE_NAMESPACE);
      expect(item.namespace).toBe(REMOTE_NAMESPACE);
      expect(item.result.mode).toBe("strict");
      if (item.result.mode !== "strict") continue;
      expect("_zod" in item.result.schema).toBe(true);
      expect(typeof item.result.schema.parse).toBe("function");
    }
  });
});
