import { useEffect, useRef, useState } from "react";
import {
  IconCloseFill14,
  IconProjectAddOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
  Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";

import type { ProjectSummary } from "../../types.ts";
import type { DingzeViewFace } from "../face.ts";
import { useLibraryEpoch, useSelectedContentId } from "../contentSelection.ts";
import type { DingzeKey } from "../locales.ts";
import { formatRelativeTime } from "../relativeTime.ts";
import { StatusPill, type StatusTone } from "../ui/StatusPill.tsx";
import "./DzSidebarPanel.css";

function pillTone(tone: ProjectSummary["pillTone"]): StatusTone {
  if (tone === "success") return "success";
  return "pending";
}

export function rowMeta(item: ProjectSummary, t: (key: DingzeKey) => string, now = Date.now()): string {
  const parts: string[] = [];
  if (item.pendingCount > 0) parts.push(t("meta.pending").replace("{n}", String(item.pendingCount)));
  if (item.blockingCount > 0) parts.push(t("meta.blocking").replace("{n}", String(item.blockingCount)));
  parts.push(formatRelativeTime(Date.parse(item.updatedAt) || item.createdMs, now, t));
  return parts.join(" · ");
}

function sortByRecency(items: ProjectSummary[]): ProjectSummary[] {
  return [...items].sort((a, b) => {
    if (a.createdMs !== b.createdMs) return b.createdMs - a.createdMs;
    return a.company.localeCompare(b.company, "zh");
  });
}

export function DzSidebarPanel({
  t,
  ready,
  listProjects,
  refreshCatalog,
  draftNewProject,
}: DingzeViewFace & {
  t: (key: DingzeKey) => string;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRoot = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const libraryEpoch = useLibraryEpoch();
  const [selectedId, setSelectedId] = useSelectedContentId();
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [items, setItems] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const loadList = async (nextQuery = query) => {
    if (!ready()) {
      setError(t("empty.remote"));
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await listProjects(nextQuery);
      setItems(sortByRecency(result.items));
      const currentId = selectedIdRef.current;
      if (nextQuery === "" && currentId !== null && !result.items.some((item) => item.id === currentId)) {
        setSelectedId(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("empty.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadList(query);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, [query, libraryEpoch]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInput.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) {
        return;
      }
      searchInput.current?.blur();
      if (query !== "") return;
      setSearchOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); };
  }, [searchOpen, query]);

  const closeSearch = (): void => {
    setQuery("");
    setSearchOpen(false);
  };

  return (
    <div className="dz-panel" data-surface="content-panel">
      <div className="dz-panel-header">
        <div className={searchOpen ? "dz-search-slot expanded" : "dz-search-slot"}>
          <div
            ref={searchRoot}
            className={searchOpen ? "dz-search expanded" : "dz-search"}
            onClick={() => {
              if (searchOpen) return;
              setSearchOpen(true);
            }}
          >
            <Tooltip label={t("toolbar.search")} delayMs={500} disabled={searchOpen}>
              <button
                type="button"
                className="dz-search-button"
                aria-label={t("toolbar.search.aria")}
                aria-expanded={searchOpen}
                onClick={() => { setSearchOpen(true); }}
              >
                <IconSearchOutline16 size={searchOpen ? 11 : 14} />
              </button>
            </Tooltip>
            <input
              ref={searchInput}
              className="dz-search-input"
              value={query}
              placeholder={t("toolbar.search")}
              tabIndex={searchOpen ? 0 : -1}
              onChange={(event) => { setQuery(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                closeSearch();
              }}
            />
            {searchOpen && (
              <button
                type="button"
                className="dz-clear-button"
                aria-label={t("toolbar.search.clear")}
                onClick={(event) => {
                  event.stopPropagation();
                  closeSearch();
                }}
              >
                <IconCloseFill14 />
              </button>
            )}
          </div>
        </div>
        <div className={searchOpen ? "dz-header-actions hidden" : "dz-header-actions"}>
          <Tooltip label={t("toolbar.refresh")} delayMs={500}>
            <button
              type="button"
              className="dz-icon-button"
              aria-label={t("toolbar.refresh")}
              onClick={() => {
                void refreshCatalog().then(() => loadList(query));
              }}
            >
              <IconRefreshOutline16 size={16} />
            </button>
          </Tooltip>
          <Tooltip label={t("toolbar.create")} delayMs={500}>
            <button
              type="button"
              className="dz-icon-button"
              aria-label={t("toolbar.create.aria")}
              onClick={() => { draftNewProject(); }}
            >
              <IconProjectAddOutline16 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="dz-list">
        {error !== undefined && <div className="dz-empty">{error}</div>}
        {error === undefined && items.length === 0 && !loading && (
          <div className="dz-empty">{t("empty.library")}</div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === selectedId ? "dz-row selected" : "dz-row"}
            onClick={() => {
              setSelectedId(item.id === selectedId ? null : item.id);
            }}
          >
            <span className="dz-row-body">
              <span className="dz-row-title">{item.company}</span>
              <span className="dz-row-pill">
                <StatusPill tone={pillTone(item.pillTone)}>{item.pill}</StatusPill>
              </span>
              <span className="dz-row-meta">
                <span className="dz-row-date">{rowMeta(item, t)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
