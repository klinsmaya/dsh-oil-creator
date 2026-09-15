interface SkillsContext {
  skills: {
    register: (skill: {
      name: string;
      description: string;
      source: "runtime";
      content: string;
      invocation: { modelInvocable: boolean; userInvocable: boolean };
    }) => () => void;
  };
}

export const DINGZE_WORKBENCH_SKILL = {
  name: "dingze-workbench",
  description: "配置和使用定责工作台。开场看进度、定版、待补、改版或签约时使用。",
  source: "runtime" as const,
  invocation: { modelInvocable: true, userInvocable: true },
  content: `# 定责工作台

1. 开场先调用 \`dz_status\`，用返回的人话名和 nextAction 说话，不要念步骤编号。
2. 定版只能走 \`dz_finalize\`。先 \`apply=false\` 预览，用户明确点头后再 \`apply=true\`。
3. 待补用 \`dz_pending\`，跳过用 \`dz_skip\`，改版用 \`dz_reopen\`，签约用 \`dz_sign\`。
4. 还没定版时，不要用写文件工具改 \`定版/\`。
5. 当前项目看 cwd；没有就请用户给出公司名，或先 \`dz_create_project\`。
6. 对用户只说定版、待补、改版、复核；空态用「这一步还没定版」。
`,
};

export function registerDingzeWorkbenchSkill(ctx: SkillsContext): () => void {
  return ctx.skills.register(DINGZE_WORKBENCH_SKILL);
}
