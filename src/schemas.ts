import { z } from "zod";

export const stepIdSchema = z.enum([
  "S1-00",
  "S1-01",
  "S1-02",
  "S1-03",
  "S2-01",
  "S2-02",
  "S2-03",
  "S3-01",
  "S3-02",
  "S3-03",
  "S3-04",
]);

export const chapterIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const stepStateSchema = z.enum([
  "todo",
  "current",
  "final",
  "skipped",
  "reopened",
  "needsReview",
]);

export const projectStageSchema = z.union([
  chapterIdSchema,
  z.literal("closing"),
  z.literal("done"),
]);

export const stepSummarySchema = z.object({
  id: stepIdSchema,
  name: z.string(),
  file: z.string(),
  chapter: chapterIdSchema,
  state: stepStateSchema,
  skippable: z.boolean(),
  hint: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string().min(1),
  folderPath: z.string().min(1),
  company: z.string(),
  date: z.string().optional(),
  createdMs: z.number(),
  updatedAt: z.string(),
  stage: projectStageSchema,
  currentStep: stepIdSchema.optional(),
  currentStepName: z.string().optional(),
  progressLine: z.string(),
  pill: z.string(),
  pillTone: z.enum(["pending", "success", "warning"]),
  pendingCount: z.number(),
  blockingCount: z.number(),
  signed: z.object({
    by: z.string(),
    at: z.string(),
  }).optional(),
  steps: z.array(stepSummarySchema),
});

export const librarySettingsSchema = z.object({
  libraryRoot: z.string().min(1),
  skippableSteps: z.array(z.string()),
});

export const setSkippableStepsRequestSchema = z.object({
  skippableSteps: z.array(z.string()),
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

export const projectIdRequestSchema = z.object({
  id: z.string().min(1),
});

export const readFileRequestSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
});

export const readFileResultSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const listMaterialsResultSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    path: z.string(),
  })),
});

export const projectDetailSchema = z.object({
  project: projectSummarySchema,
  pending: z.array(z.object({
    id: z.string(),
    step: stepIdSchema,
    item: z.string(),
    blocking: z.boolean(),
    who: z.string().optional(),
    when: z.string().optional(),
    done: z.boolean(),
    createdAt: z.string(),
    doneAt: z.string().optional(),
  })),
});
