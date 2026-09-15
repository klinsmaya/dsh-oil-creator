import { useEffect, useRef, useState } from "react";
import {
  IconCloseOutline16,
  IconFolderOpenOutline16,
  MarkdownText,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";

import { CHAPTERS, chapterLabel } from "../steps.ts";
import type { ProjectDetail, ProjectSummary, StepState } from "../types.ts";
import {
  applyConversationInset,
  clearConversationInset,
  getInspectorWidth,
  INSPECTOR_MAX,
  INSPECTOR_MIN,
  setInspectorWidth,
  useLibraryEpoch,
  useSelectedContentId,
} from "./contentSelection.ts";
import type { DingzeViewFace } from "./face.ts";
import type { DingzeKey } from "./locales.ts";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import { StatusPill, type StatusTone } from "./ui/StatusPill.tsx";
import { Surface } from "./ui/Surface.tsx";
import "./DzInspector.css";

const TABS = ["overview", "ch1", "ch2", "ch3", "materials"] as const;
type InspectorTab = (typeof TABS)[number];

const TAB_KEY: Record<InspectorTab, DingzeKey> = {
  overview: "inspector.tab.overview",
  ch1: "inspector.tab.ch1",
  ch2: "inspector.tab.ch2",
  ch3: "inspector.tab.ch3",
  materials: "inspector.tab.materials",
};

const STATE_KEY: Record<StepState, DingzeKey> = {
  todo: "inspector.state.todo",
  current: "inspector.state.current",
  final: "inspector.state.final",
  skipped: "inspector.state.skipped",
  reopened: "inspector.state.reopened",
  needsReview: "inspector.state.needsReview",
};

const STATE_TONE: Record<StepState, StatusTone> = {
  todo: "neutral",
  current: "active",
  final: "success",
  skipped: "neutral",
  reopened: "pending",
  needsReview: "pending",
};

export type DzInspectorProps =
  & PropsRuntime<"shell.overlay">
  & InjectFace<DingzeViewFace>
  & PropsLocale<"dsh.dingze">
  & { closeDetails: () => void };

function pillTone(tone: ProjectSummary["pillTone"]): StatusTone {
  if (tone === "success") return "success";
  if (tone === "warning") return "pending";
  return "pending";
}

export function DzInspector({
  t,
  ready,
  projectDetail,
  readProjectFile,
  listMaterials,
  openPath,
  talk,
  closeDetails,
}: DzInspectorProps) {
  const [selectedId, setSelectedId] = useSelectedContentId();
  const libraryEpoch = useLibraryEpoch();
  const [detail, setDetail] = useState<ProjectDetail | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<InspectorTab>("overview");
  const [panelWidth, setPanelWidth] = useState(getInspectorWidth);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileText, setFileText] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Array<{ name: string; path: string }>>([]);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    setTab("overview");
    setFileText({});
    setMaterials([]);
  }, [selectedId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { setExpanded(true); });
    return () => { window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      loadedId.current = null;
      setDetail(undefined);
      setError(undefined);
      return;
    }
    if (!ready()) {
      setError(t("empty.remote"));
      return;
    }
    let cancelled = false;
    setError(undefined);
    void projectDetail(selectedId).then((next) => {
      if (cancelled) return;
      loadedId.current = selectedId;
      setDetail(next);
    }, (cause: unknown) => {
      if (cancelled) return;
      setDetail(undefined);
      setError(cause instanceof Error ? cause.message : t("empty.error"));
    });
    return () => { cancelled = true; };
  }, [selectedId, libraryEpoch, ready, projectDetail, t]);

  useEffect(() => {
    if (detail === undefined) return;
    if (tab === "overview") return;
    let cancelled = false;
    if (tab === "materials") {
      void listMaterials(detail.project.id).then((next) => {
        if (!cancelled) setMaterials(next.items);
      }, () => {
        if (!cancelled) setMaterials([]);
      });
      void readProjectFile(detail.project.id, "AGENTS.md").then((next) => {
        if (!cancelled) setFileText((prev) => ({ ...prev, "AGENTS.md": next.content }));
      }, () => undefined);
      return () => { cancelled = true; };
    }
    const chapter = tab === "ch1" ? 1 : tab === "ch2" ? 2 : 3;
    for (const step of detail.project.steps.filter((item) => item.chapter === chapter && item.state === "final")) {
      const path = `定版/${step.file}`;
      void readProjectFile(detail.project.id, path).then((next) => {
        if (!cancelled) setFileText((prev) => ({ ...prev, [path]: next.content }));
      }, () => undefined);
    }
    return () => { cancelled = true; };
  }, [tab, detail, listMaterials, readProjectFile]);

  const shownWidth = expanded ? panelWidth : 0;
  useEffect(() => {
    applyConversationInset(shownWidth, !dragging);
  }, [shownWidth, dragging]);

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      if (drag.current === null) return;
      const next = Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, drag.current.startWidth + (event.clientX - drag.current.startX)));
      setPanelWidth(next);
      setInspectorWidth(next);
    };
    const onUp = (): void => {
      drag.current = null;
      setDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (selectedId === null) return null;
  const project = detail?.project;
  const current = project?.steps.find((step) => step.id === project.currentStep);

  return (
    <div
      data-plugin="dsh-dingze"
      data-surface="inspector"
      className={["docked", expanded ? "open" : "", dragging ? "dragging" : ""].filter(Boolean).join(" ")}
      style={{ width: shownWidth }}
    >
      <div
        className="dz-resize"
        onPointerDown={(event) => {
          drag.current = { startX: event.clientX, startWidth: panelWidth };
          setDragging(true);
        }}
      />
      <header className="dz-insp-header">
        <div className="dz-insp-title-row">
          <div className="dz-insp-title">{project?.company ?? (error === undefined ? t("empty.loading") : "")}</div>
          <div className="dz-insp-actions">
            {project !== undefined && (
              <button
                type="button"
                className="dz-insp-icon"
                aria-label={t("inspector.openFolder")}
                onClick={() => { void openPath(project.folderPath); }}
              >
                <IconFolderOpenOutline16 size={14} />
              </button>
            )}
            <button
              type="button"
              className="dz-insp-icon"
              aria-label={t("inspector.close")}
              onClick={() => {
                setSelectedId(null);
                clearConversationInset();
                closeDetails();
              }}
            >
              <IconCloseOutline16 size={14} />
            </button>
          </div>
        </div>
        {project !== undefined && (
          <div className="dz-insp-progress">{project.progressLine}</div>
        )}
        <div className="dz-insp-tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "dz-insp-tab active" : "dz-insp-tab"}
              onClick={() => { setTab(id); }}
            >
              {t(TAB_KEY[id])}
            </button>
          ))}
        </div>
      </header>
      <div className="dz-insp-body">
        {error !== undefined && <div className="dz-insp-empty">{error}</div>}
        {error === undefined && project === undefined && (
          <div className="dz-insp-empty">{t("empty.loading")}</div>
        )}
        {project !== undefined && tab === "overview" && (
          <>
            <div className="dz-insp-lede">
              <StatusPill tone={pillTone(project.pillTone)}>{project.pill}</StatusPill>
            </div>
            {CHAPTERS.map((chapter) => (
              <Surface key={chapter.id} title={`${chapterLabel(chapter.id)} ${chapter.name}`}>
                {project.steps.filter((step) => step.chapter === chapter.id).map((step) => (
                  <div key={step.id} className="dz-step-row">
                    <span className="dz-step-name">{step.name}</span>
                    <StatusPill tone={STATE_TONE[step.state]}>{t(STATE_KEY[step.state])}</StatusPill>
                  </div>
                ))}
              </Surface>
            ))}
            {current !== undefined && project.stage !== "done" && project.stage !== "closing" && (
              <Surface title={t("inspector.current")} hint={current.hint}>
                <div className="dz-current-name">{current.name}</div>
                <ActionBar>
                  <ActionButton
                    tone="primary"
                    onClick={() => { talk(`我点头，这步定版：${current.name}`, "submit"); }}
                  >
                    {t("inspector.action.finalize")}
                  </ActionButton>
                  <ActionButton onClick={() => { talk(`改版${current.name}：`, "draft"); }}>
                    {t("inspector.action.reopen")}
                  </ActionButton>
                  <ActionButton onClick={() => { talk(`标待补：${current.name} `, "draft"); }}>
                    {t("inspector.action.pending")}
                  </ActionButton>
                </ActionBar>
              </Surface>
            )}
            <Surface title={t("inspector.pending")}>
              {(detail?.pending.length ?? 0) === 0 && <div className="dz-insp-empty">{t("empty.pending")}</div>}
              {detail?.pending.map((item) => (
                <div key={item.id} className="dz-step-row">
                  <span className="dz-step-name">{item.item}</span>
                  {item.blocking && <StatusPill tone="pending">{t("meta.blocking").replace("{n}", "1")}</StatusPill>}
                </div>
              ))}
            </Surface>
          </>
        )}
        {project !== undefined && (tab === "ch1" || tab === "ch2" || tab === "ch3") && (
          project.steps.filter((step) => step.chapter === (tab === "ch1" ? 1 : tab === "ch2" ? 2 : 3)).map((step) => {
            const path = `定版/${step.file}`;
            const text = fileText[path];
            return (
              <Surface key={step.id} title={step.name}>
                {text === undefined
                  ? <div className="dz-insp-empty">{t("empty.step")}</div>
                  : <MarkdownText text={text} />}
              </Surface>
            );
          })
        )}
        {project !== undefined && tab === "materials" && (
          <>
            <Surface title={t("inspector.tab.materials")}>
              {materials.length === 0 && <div className="dz-insp-empty">{t("empty.materials")}</div>}
              {materials.map((item) => (
                <div key={item.path} className="dz-step-row">
                  <span className="dz-step-name">{item.name}</span>
                </div>
              ))}
            </Surface>
            <Surface title={t("inspector.agents")}>
              {fileText["AGENTS.md"] === undefined
                ? <div className="dz-insp-empty">{t("empty.step")}</div>
                : <MarkdownText text={fileText["AGENTS.md"]} />}
            </Surface>
          </>
        )}
      </div>
    </div>
  );
}
