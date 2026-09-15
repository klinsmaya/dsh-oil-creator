import { defineTool, type ToolDefinition, type ToolRunContext } from "@deepseek-ai/dsh-tools";

import { compactScope, finalizeStep, mutatePending, projectStatus } from "./ops.ts";
import type { DingzeService } from "./service.ts";

interface ToolsContext {
  tools: { register: (tool: ToolDefinition) => void };
}

const JSON_VALUE = { type: "json" } as const;

function compactText(title: string, detail: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text: `${title}: ${detail}` }];
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as never;
}

function present(title: string, rawInput: unknown): { card: "generic"; title: string; kind: "other"; rawInput: unknown } {
  return { card: "generic", title, kind: "other", rawInput };
}

function readStringProp(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined;
  const found = Reflect.get(value, key);
  return typeof found === "string" && found.length > 0 ? found : undefined;
}

export function scopeOf(exec: { agent?: object }): { cwd: string; sessionId?: string } {
  const cwd = process.cwd();
  const agent = exec.agent;
  if (agent === undefined) return { cwd };
  const nested = Reflect.get(agent, "session");
  const session = typeof nested === "object" && nested !== null ? nested : undefined;
  const sessionId = readStringProp(agent, "sessionId")
    ?? readStringProp(agent, "id")
    ?? (session === undefined ? undefined : readStringProp(session, "id"));
  return sessionId === undefined ? { cwd } : { cwd, sessionId };
}

function hostOf(service: DingzeService) {
  return {
    dataDir: service.dataDir,
    libraryRoot: service.libraryRoot,
    skippableOverride: service.skippableOverride,
    onWrite: () => {
      service.invalidateCatalog();
    },
  };
}

export function registerDingzeTools(ctx: ToolsContext, service: DingzeService): void {
  ctx.tools.register(defineTool({
    name: "dz_status",
    description:
      "读取当前定责项目的进度、待补、需复核和跳过项。开场或推进前先调用。"
      + "省略 project 时：cwd 在项目内则用该项目，否则用 overlay 绑定的当前会话。",
    parameters: {
      project: { type: "string", description: "项目文件夹名、公司名或路径。省略则按 cwd / 会话解析。" },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const result = value as { ok?: boolean; nextAction?: string; code?: string };
        if (result.ok !== true) return compactText("Status", result.code ?? "failed");
        return compactText("Status", result.nextAction ?? "ok");
      },
    },
    presentCall: (args) => present("定责进度", args),
    async execute(args, exec) {
      const scope = scopeOf(exec);
      return asJson(await projectStatus(hostOf(service), compactScope({
        project: args.project,
        cwd: scope.cwd,
        sessionId: scope.sessionId,
      })));
    },
  }));

  ctx.tools.register(defineTool({
    name: "dz_finalize",
    description:
      "把某一步写入定版/。定版前必须先 apply=false 预览将要写入的文件；"
      + "只有用户明确点头后才允许 apply=true。"
      + "省略 content 且文件已在时表示复核通过，只清 needsReview。"
      + "省略 content 且文件不在时返回 content_required。"
      + "校验顺序：unknown_step → order_violation → blocking_pending → content_required。",
    parameters: {
      step: { type: "string", required: true, description: "步骤编号，如 S1-00。" },
      content: { type: "string", description: "定版正文。复核已有文件时可省略。" },
      apply: { type: "boolean", description: "false 只预览，true 才写入。默认 false。" },
      project: { type: "string", description: "项目文件夹名、公司名或路径。" },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const result = value as { ok?: boolean; apply?: boolean; stepName?: string; code?: string };
        if (result.ok !== true) return compactText("Finalize", result.code ?? "failed");
        return compactText(
          "Finalize",
          `${result.apply === true ? "已定版" : "预览"} ${result.stepName ?? ""}`.trim(),
        );
      },
    },
    presentCall: (args) => present(args.apply === true ? "定版" : "预览定版", args),
    async execute(args, exec) {
      const scope = scopeOf(exec);
      return asJson(await finalizeStep(hostOf(service), {
        step: args.step ?? "",
        ...compactScope({
          project: args.project,
          cwd: scope.cwd,
          sessionId: scope.sessionId,
        }),
        ...(args.content === undefined ? {} : { content: args.content }),
        ...(args.apply === undefined ? {} : { apply: args.apply }),
      }));
    },
  }));

  ctx.tools.register(defineTool({
    name: "dz_pending",
    description:
      "管理待补：add / update / resolve / list。"
      + "卡点待补会挡住定版。省略 project 时按 cwd 或当前会话解析。",
    parameters: {
      action: { type: "string", required: true, description: "add、update、resolve 或 list。" },
      id: { type: "string", description: "update / resolve 时的待补 id。" },
      step: { type: "string", description: "add / update 时的步骤编号。" },
      item: { type: "string", description: "待补内容。" },
      blocking: { type: "boolean", description: "是否卡点。卡点会挡住定版。" },
      who: { type: "string", description: "谁来补。" },
      when: { type: "string", description: "什么时候补。" },
      project: { type: "string", description: "项目文件夹名、公司名或路径。" },
    },
    output: {
      schema: JSON_VALUE,
      render: (_args, value) => {
        const result = value as { ok?: boolean; action?: string; pending?: unknown[]; code?: string };
        if (result.ok !== true) return compactText("Pending", result.code ?? "failed");
        const count = Array.isArray(result.pending) ? result.pending.length : 0;
        return compactText("Pending", `${result.action ?? "list"} ${count}`);
      },
    },
    presentCall: (args) => present("待补", args),
    async execute(args, exec) {
      const scope = scopeOf(exec);
      return asJson(await mutatePending(hostOf(service), {
        action: args.action ?? "",
        ...compactScope({
          project: args.project,
          cwd: scope.cwd,
          sessionId: scope.sessionId,
        }),
        ...(args.id === undefined ? {} : { id: args.id }),
        ...(args.step === undefined ? {} : { step: args.step }),
        ...(args.item === undefined ? {} : { item: args.item }),
        ...(args.blocking === undefined ? {} : { blocking: args.blocking }),
        ...(args.who === undefined ? {} : { who: args.who }),
        ...(args.when === undefined ? {} : { when: args.when }),
      }));
    },
  }));
}
