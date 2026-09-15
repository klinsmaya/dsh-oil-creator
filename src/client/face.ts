import type {
  DingzeCapabilities,
  LibrarySettings,
  ListMaterialsResult,
  ListProjectsResult,
  ProjectDetail,
  ProjectSummary,
  ReadFileResult,
} from "../types.ts";

export interface DingzeViewFace {
  ready: () => boolean;
  listProjects: (query: string) => Promise<ListProjectsResult>;
  getRevision: () => Promise<number>;
  pickDirectory: () => Promise<string | null>;
  openPath: (path: string) => Promise<void>;
  getSettings: () => Promise<LibrarySettings>;
  getCapabilities: () => Promise<DingzeCapabilities>;
  setLibraryRoot: (path: string) => Promise<void>;
  setSkippableSteps: (steps: string[]) => Promise<void>;
  refreshCatalog: () => Promise<ListProjectsResult>;
  draftNewProject: () => void;
  projectDetail: (id: string) => Promise<ProjectDetail>;
  readProjectFile: (id: string, path: string) => Promise<ReadFileResult>;
  listMaterials: (id: string) => Promise<ListMaterialsResult>;
  talk: (text: string, mode: "draft" | "submit") => void;
}

export type { ProjectSummary };
