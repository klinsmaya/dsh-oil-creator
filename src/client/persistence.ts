export const DINGZE_STORAGE_KEY = "dsh-dingze/ui/v1";

export type SidebarTab = "sessions" | "content";

export interface DingzeUiState {
  schemaVersion: 1;
  selectedId: string | null;
  query: string;
  sidebarTab: SidebarTab;
  inspectorWidth?: number;
  autoOpenInspector: boolean;
}

export const DEFAULT_UI_STATE: DingzeUiState = {
  schemaVersion: 1,
  selectedId: null,
  query: "",
  sidebarTab: "content",
  autoOpenInspector: true,
};

export interface DingzeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function browserDingzeStorage(): DingzeStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadDingzeUiState(storage: DingzeStorage | undefined): DingzeUiState {
  if (storage === undefined) return { ...DEFAULT_UI_STATE };
  try {
    const raw = storage.getItem(DINGZE_STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_UI_STATE };
    const parsed = JSON.parse(raw) as Partial<DingzeUiState>;
    return {
      schemaVersion: 1,
      selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : null,
      query: typeof parsed.query === "string" ? parsed.query : "",
      sidebarTab: parsed.sidebarTab === "sessions" ? "sessions" : "content",
      ...(typeof parsed.inspectorWidth === "number" && Number.isFinite(parsed.inspectorWidth)
        ? { inspectorWidth: parsed.inspectorWidth }
        : {}),
      autoOpenInspector: parsed.autoOpenInspector !== false,
    };
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
}

export function saveDingzeUiState(
  storage: DingzeStorage | undefined,
  state: DingzeUiState,
): boolean {
  if (storage === undefined) return false;
  try {
    storage.setItem(DINGZE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
