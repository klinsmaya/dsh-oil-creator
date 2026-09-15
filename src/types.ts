import type { ChapterId, StepId } from "./steps.ts";

export type { ChapterId, StepId };

export type StepState = "todo" | "current" | "final" | "skipped" | "reopened" | "needsReview";
export type ProjectStage = ChapterId | "closing" | "done";
export type PillTone = "pending" | "success" | "warning";

export interface PendingItem {
  id: string;
  step: StepId;
  item: string;
  blocking: boolean;
  who?: string;
  when?: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

export interface OverlayProject {
  sessionIds: string[];
  pending: PendingItem[];
  skipped: Partial<Record<StepId, { reason: string; at: string }>>;
  reopened: Partial<Record<StepId, { reason: string; at: string }>>;
  needsReview: Partial<Record<StepId, { because: StepId; at: string }>>;
  finalized: Partial<Record<StepId, { at: string }>>;
  signed?: { by: string; at: string };
  updatedAt: string;
}

export interface OverlayStore {
  version: 1;
  libraryRoot?: string;
  projects: Record<string, OverlayProject>;
}

export interface StepSummary {
  id: StepId;
  name: string;
  file: string;
  chapter: ChapterId;
  state: StepState;
  skippable: boolean;
  hint: string;
}

export interface ProjectSummary {
  id: string;
  folderPath: string;
  company: string;
  date?: string;
  createdMs: number;
  updatedAt: string;
  stage: ProjectStage;
  currentStep?: StepId;
  currentStepName?: string;
  progressLine: string;
  pill: string;
  pillTone: PillTone;
  pendingCount: number;
  blockingCount: number;
  signed?: { by: string; at: string };
  steps: StepSummary[];
}

export type CapabilityState = "ready" | "missing";

export interface Capability {
  state: CapabilityState;
  required: boolean;
  detail: string;
  path?: string;
}

export interface DingzeCapabilities {
  library: Capability;
}

export interface LibrarySettings {
  libraryRoot: string;
}

export interface DingzeSetupStatus {
  platform: NodeJS.Platform;
  dataDir: string;
  settings: LibrarySettings;
  capabilities: DingzeCapabilities;
}

export interface ListProjectsRequest {
  query: string;
}

export interface ListProjectsResult {
  settings: LibrarySettings;
  items: ProjectSummary[];
  revision: number;
}

export interface SetLibraryRootRequest {
  path: string;
}

export interface OpenFolderRequest {
  path: string;
}

export interface ToolFailure {
  ok: false;
  code: string;
  message: string;
  detail?: unknown;
}

export type ToolSuccess<T extends object> = { ok: true } & T;
