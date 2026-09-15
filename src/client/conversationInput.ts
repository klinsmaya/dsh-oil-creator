export interface ConversationDraftApi {
  setDraft: (text: string) => void;
  submit: (text: string) => void;
}

interface ConversationInputHost {
  for?: (scope: unknown) => unknown;
  setDraft?: (text: string) => void;
  submit?: (text: string) => void;
}

function isTextFn(value: unknown): value is (text: string) => void {
  return typeof value === "function";
}

function asDraftApi(value: unknown): ConversationDraftApi | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!isTextFn(record.setDraft) && !isTextFn(record.submit)) return undefined;
  return {
    setDraft: (text: string) => {
      if (isTextFn(record.setDraft)) record.setDraft(text);
    },
    submit: (text: string) => {
      if (isTextFn(record.submit)) record.submit(text);
    },
  };
}

export function conversationInputOf(host: unknown, scope?: unknown): ConversationDraftApi | undefined {
  if (typeof host !== "object" || host === null) return undefined;
  const conversation = host as { input?: ConversationInputHost };
  const input = conversation.input;
  if (input === undefined) return asDraftApi(host);
  if (typeof input.for === "function") {
    try {
      const scoped = asDraftApi(input.for(scope));
      if (scoped !== undefined) return scoped;
    } catch {
      // rc 差异：for 可能要求特定 scope。
    }
  }
  return asDraftApi(input) ?? asDraftApi(host);
}

export function draftOrSubmit(
  api: ConversationDraftApi | undefined,
  text: string,
  mode: "draft" | "submit",
): boolean {
  if (api === undefined) return false;
  if (mode === "submit") api.submit(text);
  else api.setDraft(text);
  return true;
}
