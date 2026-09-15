import { getSelectedContentId, subscribeSelectedContentId } from "./contentSelection.ts";
import { CHAPTERS, STEPS, chapterLabel } from "../steps.ts";

interface TriggerCandidate {
  name: string;
  description?: string;
}

interface TriggerPick {
  candidate: TriggerCandidate;
}

type PickOutcome = { text: string } | undefined;

interface TriggerSource {
  trigger: "@" | "/";
  name: string;
  order?: number;
  candidates: (
    session: unknown,
    req: { query: string; signal: AbortSignal },
  ) => Promise<readonly TriggerCandidate[]>;
  onPick: (pick: TriggerPick) => PickOutcome;
}

interface TriggerService {
  registerSource: (src: TriggerSource) => () => void;
}

export function registerProjectTriggers(
  inputTriggers: TriggerService | undefined,
  list: () => Promise<ReadonlyArray<{ id: string; company: string }>>,
): () => void {
  if (inputTriggers === undefined) return () => undefined;

  const atSource: TriggerSource = {
    trigger: "@",
    name: "当前项目",
    order: 30,
    async candidates(_session, req) {
      const query = req.query.trim().toLowerCase();
      const items = await list();
      const selected = getSelectedContentId();
      const rows: TriggerCandidate[] = [];
      if (selected !== null && (query === "" || "当前项目".includes(query))) {
        const current = items.find((item) => item.id === selected);
        rows.push({ name: "当前项目", description: current?.company ?? selected });
      }
      for (const item of items) {
        if (query !== "" && !item.company.toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) {
          continue;
        }
        rows.push({ name: item.company, description: item.id });
      }
      return rows.slice(0, 20);
    },
    onPick({ candidate }) {
      return { text: candidate.name === "当前项目" ? "@当前项目" : `@${candidate.name}` };
    },
  };

  const slashSource: TriggerSource = {
    trigger: "/",
    name: "current project",
    order: 31,
    async candidates() {
      return [
        { name: "current project", description: "当前项目" },
        ...STEPS.map((step) => ({
          name: `step ${step.name}`,
          description: `${chapterLabel(step.chapter)} · ${step.name}`,
        })),
      ];
    },
    onPick({ candidate }) {
      if (candidate.name === "current project") return { text: "/current project" };
      const step = STEPS.find((item) => candidate.name === `step ${item.name}`);
      if (step === undefined) return { text: candidate.name };
      return { text: `看要点：${step.name}` };
    },
  };

  const stopAt = inputTriggers.registerSource(atSource);
  const stopSlash = inputTriggers.registerSource(slashSource);
  const stopLexicon = subscribeSelectedContentId(() => undefined);
  void CHAPTERS;
  return () => {
    stopAt();
    stopSlash();
    stopLexicon();
  };
}
