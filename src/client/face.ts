import type { DingzeCapabilities, LibrarySettings, ListProjectsResult, ProjectSummary } from "../types.ts";

export interface DingzeViewFace {
  ready: () => boolean;
  listProjects: (query: string) => Promise<ListProjectsResult>;
  getRevision: () => Promise<number>;
  pickDirectory: () => Promise<string | null>;
  openPath: (path: string) => Promise<void>;
  getSettings: () => Promise<LibrarySettings>;
  getCapabilities: () => Promise<DingzeCapabilities>;
  setLibraryRoot: (path: string) => Promise<void>;
  refreshCatalog: () => Promise<ListProjectsResult>;
  draftNewProject: () => void;
}

export type { ProjectSummary };
