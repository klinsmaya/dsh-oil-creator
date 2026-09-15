import { CHAPTERS, STEPS, chapterLabel } from "./steps.ts";

export interface LibraryPromptSource {
  libraryRoot: string;
  dataDir: string;
  cache?: { libraryRoot: string } | undefined;
}

interface PromptSectionHost {
  systemPrompt: {
    section: (section: {
      name: string;
      order: number;
      text: string | (() => string);
    }) => () => void;
  };
}

export function resolvePromptLibraryRoot(source: LibraryPromptSource): string {
  return source.cache?.libraryRoot ?? source.libraryRoot;
}

function stepTable(): string {
  const lines = [
    "步骤（对人只说人话名，不要念编号）：",
    ...CHAPTERS.map((chapter) => {
      const rows = STEPS.filter((step) => step.chapter === chapter.id)
        .map((step) => `- ${chapterLabel(chapter.id)} · ${step.name} → 定版/${step.file}${step.skippable ? "（可跳过）" : ""}：${step.hint}`);
      return [`${chapterLabel(chapter.id)} ${chapter.name}`, ...rows].join("\n");
    }),
  ];
  return lines.join("\n");
}

export function libraryConventionText(libraryRoot: string, dataDir: string): string {
  return [
    `这是定责工作台。项目库在 ${libraryRoot}，overlay 在 ${dataDir}/overlay.json。`,
    "每个项目一个子文件夹，默认名字是 YYYY-MM-DD_公司名。文件夹里有 AGENTS.md、定版/、材料/。插件只列出材料/，不解析内容。",
    "识别项目：文件夹名符合日期_公司名；或者里面有 定版/ 或 AGENTS.md。",
    stepTable(),
    "五条规矩：",
    "1. 定版只能经 dz_finalize 写入 定版/。先 apply=false 预览，用户明确点头后再 apply=true。",
    "2. 待补、跳过、改版、签约只能经 dz_pending / dz_skip / dz_reopen / dz_sign，不要直接改 overlay。",
    "3. 还没定版时，不要用写文件工具往 定版/ 里写。",
    "4. 开场先调用 dz_status，看当前步、待补和下一步。",
    "5. 当前项目等于 cwd 所在的项目文件夹；否则看 overlay 绑定的会话；再否则请用户指定公司名。",
    "用户问工作台怎么用时调用 dz_guide。侧栏和对话只用中文人话名。",
  ].join("\n");
}

export function registerLibraryPrompt(ctx: PromptSectionHost, source: LibraryPromptSource): () => void {
  return ctx.systemPrompt.section({
    name: "dingze-library",
    order: 120,
    text: () => libraryConventionText(resolvePromptLibraryRoot(source), source.dataDir),
  });
}
