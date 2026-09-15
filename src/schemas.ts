import { z } from "zod";

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  folderPath: z.string().min(1),
  company: z.string(),
  date: z.string().optional(),
  createdMs: z.number(),
  updatedAt: z.string(),
});

export const librarySettingsSchema = z.object({
  libraryRoot: z.string().min(1),
});

export const listProjectsRequestSchema = z.object({
  query: z.string(),
});

export const listProjectsResultSchema = z.object({
  settings: librarySettingsSchema,
  items: z.array(projectSummarySchema),
  revision: z.number(),
});

export const setLibraryRootRequestSchema = z.object({
  path: z.string().min(1),
});

export const revisionResultSchema = z.object({
  revision: z.number(),
});

export const capabilitiesResultSchema = z.object({
  capabilities: z.object({
    library: z.object({
      state: z.union([z.literal("ready"), z.literal("missing")]),
      required: z.boolean(),
      detail: z.string(),
      path: z.string().optional(),
    }),
  }),
});

export const openFolderRequestSchema = z.object({
  path: z.string().min(1),
});
