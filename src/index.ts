import type { Context } from "@deepseek-ai/cordis";

import { Config } from "./config.ts";
import { DingzeService } from "./service.ts";
import { registerDingzeSettingsNamespace } from "./settingsHost.ts";

export const name = "dsh-dingze";
export { Config };
export type { Config as ConfigType } from "./config.ts";

export function apply(ctx: Context, config: Config): void {
  new DingzeService(ctx, config);
  ctx.inject(["settings"], (settingsCtx) => {
    registerDingzeSettingsNamespace(settingsCtx.settings);
  });
}
