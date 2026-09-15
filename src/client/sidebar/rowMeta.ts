import type { ProjectSummary } from "../../types.ts";
import type { DingzeKey } from "../locales.ts";
import { formatRelativeTime } from "../relativeTime.ts";

export function rowMeta(item: ProjectSummary, t: (key: DingzeKey) => string, now = Date.now()): string {
  const parts: string[] = [];
  if (item.pendingCount > 0) parts.push(t("meta.pending").replace("{n}", String(item.pendingCount)));
  if (item.blockingCount > 0) parts.push(t("meta.blocking").replace("{n}", String(item.blockingCount)));
  parts.push(formatRelativeTime(Date.parse(item.updatedAt) || item.createdMs, now, t));
  return parts.join(" · ");
}
