import Schema from "@deepseek-ai/schemastery";
import { settingsNamespace, type SettingsProvider } from "@deepseek-ai/dsh-settings";

import { DINGZE_SETTINGS_NAMESPACE } from "./settingsContract.ts";

export const DINGZE_SETTINGS_DISCOVERY_SCHEMA = Schema.object({});

export function registerDingzeSettingsNamespace(
  settings: Pick<SettingsProvider, "register">,
): void {
  settings.register(
    settingsNamespace(DINGZE_SETTINGS_NAMESPACE),
    DINGZE_SETTINGS_DISCOVERY_SCHEMA,
  );
}
