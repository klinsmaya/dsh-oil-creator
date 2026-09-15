import type { InvocationDescriptor } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";

import {
  capabilitiesResultSchema,
  librarySettingsSchema,
  listProjectsRequestSchema,
  listProjectsResultSchema,
  openFolderRequestSchema,
  revisionResultSchema,
  setLibraryRootRequestSchema,
} from "./schemas.ts";

export const PACKAGE_NAME = "dsh-dingze";
export const REMOTE_NAMESPACE = "dz";

const emptyObjectSchema = z.object({});

function codec(typeSymbol: string, schema: z.ZodType<unknown>) {
  return { mode: "strict" as const, typeSymbol, schema };
}

function jsonParam(
  name: string,
  typeSymbol: string,
  schema: z.ZodType<unknown>,
): InvocationDescriptor["parameters"][number] {
  return {
    name,
    wire: name,
    source: "json",
    codec: codec(typeSymbol, schema),
  };
}

function invocation(
  method: string,
  request: z.ZodType<unknown>,
  result: z.ZodType<unknown>,
): InvocationDescriptor {
  return {
    id: `${PACKAGE_NAME}#${REMOTE_NAMESPACE}/${method}`,
    service: REMOTE_NAMESPACE,
    namespace: REMOTE_NAMESPACE,
    method,
    invocation: { kind: "direct" },
    parameters: [jsonParam("request", `${PACKAGE_NAME}#${method}Request`, request)],
    cancellation: { parameter: "signal" },
    result: codec(`${PACKAGE_NAME}#${method}Result`, result),
    sourceLocation: { file: "src/service.ts", line: 1, column: 1 },
  };
}

export const DINGZE_INVOCATIONS: readonly InvocationDescriptor[] = [
  invocation("listProjects", listProjectsRequestSchema, listProjectsResultSchema),
  invocation("getSettings", emptyObjectSchema, librarySettingsSchema),
  invocation("getCapabilities", emptyObjectSchema, capabilitiesResultSchema),
  invocation("getRevision", emptyObjectSchema, revisionResultSchema),
  invocation("setLibraryRoot", setLibraryRootRequestSchema, librarySettingsSchema),
  invocation("refreshCatalog", emptyObjectSchema, listProjectsResultSchema),
  invocation("openFolder", openFolderRequestSchema, emptyObjectSchema),
];
