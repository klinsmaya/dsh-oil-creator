export interface ProjectSummary {
  id: string;
  folderPath: string;
  company: string;
  date?: string;
  createdMs: number;
  updatedAt: string;
}

export interface OverlayStore {
  version: 1;
  libraryRoot?: string;
  projects: Record<string, unknown>;
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
