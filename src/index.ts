import type { Context } from "@deepseek-ai/cordis";

import { Config } from "./config.ts";
import { registerDingzeWorkbenchSkill } from "./creatorSkill.ts";
import { registerLibraryPrompt } from "./libraryPrompt.ts";
import { DingzeService } from "./service.ts";
import { registerDingzeSettingsNamespace } from "./settingsHost.ts";
import { registerDingzeTools } from "./tools.ts";

export const name = "dsh-dingze";
export { Config };
export type { Config as ConfigType } from "./config.ts";

export function apply(ctx: Context, config: Config): void {
  const service = new DingzeService(ctx, config);
  ctx.inject(["settings"], (settingsCtx) => {
    registerDingzeSettingsNamespace(settingsCtx.settings);
  });
  ctx.inject(["tools"], (toolsCtx) => {
    registerDingzeTools(toolsCtx as never, service);
  });
  ctx.inject(["systemPrompt"], (promptCtx) => {
    registerLibraryPrompt(promptCtx as never, service);
  });
  ctx.inject(["skills"], (skillsCtx) => {
    registerDingzeWorkbenchSkill(skillsCtx as never);
  });
}
