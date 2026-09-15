import { useEffect, useState } from "react";
import { IconChevronDownOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import type { DingzeCapabilities } from "../types.ts";
import type { DingzeViewFace } from "./face.ts";
import type { DingzeKey } from "./locales.ts";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import { StatusPill, type StatusTone } from "./ui/StatusPill.tsx";
import "./CreatorSettingsCard.css";

export type CreatorSettingsCardProps =
  & PropsRuntime<"settings.plugin.item">
  & PropsLocale<"dsh.dingze">
  & InjectFace<
    Pick<DingzeViewFace, "ready" | "getSettings" | "getCapabilities" | "setLibraryRoot" | "pickDirectory">
  >;

function capabilityTone(state: DingzeCapabilities["library"]["state"]): StatusTone {
  return state === "ready" ? "success" : "neutral";
}

export function CreatorSettingsCard({
  t,
  ready,
  getSettings,
  setLibraryRoot,
  pickDirectory,
  getCapabilities,
}: CreatorSettingsCardProps) {
  const [open, setOpen] = useState(false);
  const [savedRoot, setSavedRoot] = useState("");
  const [draftRoot, setDraftRoot] = useState("");
  const [capabilities, setCapabilities] = useState<DingzeCapabilities | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const dirty = draftRoot !== savedRoot;

  useEffect(() => {
    if (!ready()) return;
    void (async () => {
      try {
        const settings = await getSettings();
        setSavedRoot(settings.libraryRoot);
        setDraftRoot(settings.libraryRoot);
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
      await setLibraryRoot(draftRoot);
      setSavedRoot(draftRoot);
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
