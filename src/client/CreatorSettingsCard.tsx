import { useEffect, useState } from "react";
import { IconChevronDownOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import type { DingzeCapabilities } from "../types.ts";
import type { DingzeViewFace } from "./face.ts";
import type { DingzeKey } from "./locales.ts";
import {
  browserDingzeStorage,
  loadDingzeUiState,
  saveDingzeUiState,
} from "./persistence.ts";
import { DZ_ICON_SRC } from "./assets/dzIcon.ts";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import { StatusPill, type StatusTone } from "./ui/StatusPill.tsx";
import "./CreatorSettingsCard.css";

export type CreatorSettingsCardProps =
  & PropsRuntime<"settings.plugin.item">
  & PropsLocale<"dsh.dingze">
  & InjectFace<
    Pick<DingzeViewFace, "ready" | "getSettings" | "getCapabilities" | "setLibraryRoot" | "setSkippableSteps" | "pickDirectory">
  >;

function capabilityTone(state: DingzeCapabilities["library"]["state"]): StatusTone {
  return state === "ready" ? "success" : "neutral";
}

export function CreatorSettingsCard({
  t,
  ready,
  getSettings,
  setLibraryRoot,
  setSkippableSteps,
  pickDirectory,
  getCapabilities,
}: CreatorSettingsCardProps) {
  const [open, setOpen] = useState(false);
  const [savedRoot, setSavedRoot] = useState("");
  const [draftRoot, setDraftRoot] = useState("");
  const [savedSkip, setSavedSkip] = useState("");
  const [draftSkip, setDraftSkip] = useState("");
  const [autoOpen, setAutoOpen] = useState(true);
  const [capabilities, setCapabilities] = useState<DingzeCapabilities | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const dirty = draftRoot !== savedRoot || draftSkip !== savedSkip;

  useEffect(() => {
    if (!ready()) return;
    void (async () => {
      try {
        const settings = await getSettings();
        setSavedRoot(settings.libraryRoot);
        setDraftRoot(settings.libraryRoot);
        const skip = settings.skippableSteps.join(", ");
        setSavedSkip(skip);
        setDraftSkip(skip);
        setAutoOpen(loadDingzeUiState(browserDingzeStorage()).autoOpenInspector);
        setCapabilities(await getCapabilities());
      } catch {
        setMessage(t("settings.saveFailed"));
      }
    })();
  }, [ready, getSettings, getCapabilities, t]);

  const onPick = async (): Promise<void> => {
    const path = await pickDirectory();
    if (path === null || path === "") return;
    setDraftRoot(path);
  };

  const onSave = async (): Promise<void> => {
    if (!dirty || busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      if (draftRoot !== savedRoot) await setLibraryRoot(draftRoot);
      const steps = draftSkip.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
      if (draftSkip !== savedSkip) await setSkippableSteps(steps);
      setSavedRoot(draftRoot);
      setSavedSkip(draftSkip);
      setCapabilities(await getCapabilities());
      setMessage(t("settings.saved"));
    } catch {
      setMessage(t("settings.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-plugin="dsh-dingze"
      data-surface="settings-card"
      className={open ? "open" : undefined}
    >
      <button
        type="button"
        className="header"
        aria-expanded={open}
        onClick={() => { setOpen((current) => !current); }}
      >
        <img className="dz-settings-icon" src={DZ_ICON_SRC} alt="" aria-hidden="true" />
        <div className="headText">
          <div className="name">{t("settings.title")}</div>
          <div className="description">{t("settings.description")}</div>
        </div>
        <IconChevronDownOutline14 className={open ? "chevron open" : "chevron"} />
      </button>
      {open && (
        <div className="body">
          <label className="field">
            <span className="fieldLabel">{t("settings.libraryRoot")}</span>
            <span className="fieldHint">{t("settings.libraryRootHint")}</span>
            <div className="pathRow">
              <span className={draftRoot === "" ? "path empty" : "path"}>
                {draftRoot === "" ? t("settings.libraryRootEmpty") : draftRoot}
              </span>
              <ActionButton onClick={() => { void onPick(); }}>{t("settings.pick")}</ActionButton>
            </div>
          </label>
          <label className="field">
            <span className="fieldLabel">{t("settings.skippable")}</span>
            <span className="fieldHint">{t("settings.skippableHint")}</span>
            <input
              className="input"
              value={draftSkip}
              onChange={(event) => { setDraftSkip(event.target.value); }}
            />
          </label>
          <label className="field">
            <span className="fieldLabel">{t("settings.autoOpen")}</span>
            <input
              type="checkbox"
              checked={autoOpen}
              onChange={(event) => {
                const next = event.target.checked;
                setAutoOpen(next);
                const state = loadDingzeUiState(browserDingzeStorage());
                saveDingzeUiState(browserDingzeStorage(), { ...state, autoOpenInspector: next });
              }}
            />
          </label>
          {capabilities !== undefined && (
            <div className="field">
              <span className="fieldLabel">{t("settings.capabilities")}</span>
              <span className="fieldHint">{t("settings.capabilitiesHint")}</span>
              <div className="capabilityGrid">
                <div className="capabilityItem">
                  <span className="capabilityName">{t("settings.capability.library")}</span>
                  <StatusPill tone={capabilityTone(capabilities.library.state)}>
                    {t(capabilities.library.state === "ready" ? "settings.state.ready" : "settings.state.missing")}
                  </StatusPill>
                </div>
              </div>
            </div>
          )}
          {message !== undefined && (
            <p className={message === t("settings.saved") ? "ok" : "failed"}>{message}</p>
          )}
          <ActionBar>
            <ActionButton
              disabled={!dirty || busy}
              onClick={() => {
                setDraftRoot(savedRoot);
                setDraftSkip(savedSkip);
                setMessage(undefined);
              }}
            >
              {t("settings.discard")}
            </ActionButton>
            <ActionButton tone="primary" disabled={!dirty || busy} onClick={() => { void onSave(); }}>
              {busy ? t("settings.saving") : t("settings.save")}
            </ActionButton>
          </ActionBar>
        </div>
      )}
    </div>
  );
}
