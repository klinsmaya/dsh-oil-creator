export type StepId =
  | "S1-00"
  | "S1-01"
  | "S1-02"
  | "S1-03"
  | "S2-01"
  | "S2-02"
  | "S2-03"
  | "S3-01"
  | "S3-02"
  | "S3-03"
  | "S3-04";

export type ChapterId = 1 | 2 | 3;

export interface ChapterDef {
  id: ChapterId;
  name: string;
}

export interface StepDef {
  id: StepId;
  chapter: ChapterId;
  order: number;
  name: string;
  file: string;
  skippable: boolean;
  hint: string;
}

export type SkippableOverride = Partial<Record<StepId, boolean>>;

export const CHAPTERS: readonly ChapterDef[] = [
  { id: 1, name: "定战略责" },
  { id: 2, name: "定目标责" },
  { id: 3, name: "定行动责" },
];

export const STEPS: readonly StepDef[] = [
  { id: "S1-00", chapter: 1, order: 0, name: "画像", file: "画像.md", skippable: false, hint: "公司是做什么的、卖给谁、现在的盘子" },
  { id: "S1-01", chapter: 1, order: 1, name: "战略屋（内容共识）", file: "战略屋.md", skippable: false, hint: "往哪打：使命、主战场、必赢之仗、衡量" },
  { id: "S1-02", chapter: 1, order: 2, name: "逻辑共识", file: "逻辑链.md", skippable: true, hint: "战略屋各块串成一条说得通的线" },
  { id: "S1-03", chapter: 1, order: 3, name: "衡量共识", file: "衡量.md", skippable: true, hint: "每场仗怎么算赢，口径统一" },
  { id: "S2-01", chapter: 2, order: 4, name: "路径支撑", file: "路径.md", skippable: false, hint: "每个目标至少一条路径，不只有分数" },
  { id: "S2-02", chapter: 2, order: 5, name: "横向到边（RACI）", file: "RACI.md", skippable: false, hint: "每件事 A 唯一、R 不空" },
  { id: "S2-03", chapter: 2, order: 6, name: "纵向到底", file: "纵向到底.md", skippable: true, hint: "目标层层落到人" },
  { id: "S3-01", chapter: 3, order: 7, name: "环境盘点", file: "环境盘点.md", skippable: true, hint: "资源、约束、风险" },
  { id: "S3-02", chapter: 3, order: 8, name: "三明确（任务 / 节点 / 资源）", file: "三明确.md", skippable: false, hint: "每个节点有验收" },
  { id: "S3-03", chapter: 3, order: 9, name: "一书一会", file: "一书一会.md", skippable: true, hint: "责任书草案与共识会" },
  { id: "S3-04", chapter: 3, order: 10, name: "责任书签约", file: "责任书.md", skippable: false, hint: "签字，收官" },
];

const STEP_BY_ID = new Map<string, StepDef>(STEPS.map((step) => [step.id, step]));

export function isStepId(value: unknown): value is StepId {
  return typeof value === "string" && STEP_BY_ID.has(value);
}

export function stepById(id: string): StepDef | undefined {
  return STEP_BY_ID.get(id);
}

export function chapterById(id: ChapterId): ChapterDef {
  const found = CHAPTERS.find((chapter) => chapter.id === id);
  if (found === undefined) throw new Error(`unknown chapter: ${id}`);
  return found;
}

export function chapterLabel(id: ChapterId): string {
  if (id === 1) return "第一章";
  if (id === 2) return "第二章";
  return "第三章";
}

export function isSkippable(id: StepId, override?: SkippableOverride): boolean {
  const def = stepById(id);
  if (def === undefined) return false;
  return override?.[id] ?? def.skippable;
}

export function skippableOverrideFromList(ids: readonly string[]): SkippableOverride {
  const override: SkippableOverride = {};
  for (const raw of ids) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("!")) {
      const id = trimmed.slice(1);
      if (isStepId(id)) override[id] = false;
      continue;
    }
    if (isStepId(trimmed)) override[trimmed] = true;
  }
  return override;
}
