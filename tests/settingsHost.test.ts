import { describe, expect, it, vi } from "vitest";

import { DINGZE_SETTINGS_NAMESPACE } from "../src/settingsContract.ts";
import {
  DINGZE_SETTINGS_DISCOVERY_SCHEMA,
  registerDingzeSettingsNamespace,
} from "../src/settingsHost.ts";

describe("dingze settings namespace", () => {
  it("registers the namespace that rc.7 uses to dispatch the settings card", () => {
    const register = vi.fn();

    registerDingzeSettingsNamespace({ register } as never);

    expect(register).toHaveBeenCalledOnce();
    expect(String(register.mock.calls[0]?.[0])).toBe(DINGZE_SETTINGS_NAMESPACE);
    expect(register.mock.calls[0]?.[1]).toBe(DINGZE_SETTINGS_DISCOVERY_SCHEMA);
  });
});
