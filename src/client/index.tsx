import type { ClientContext, WorkspaceId } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-api-remotes/client";
import type {} from "@deepseek-ai/dsh-client-connection/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import { TYPERT_REMOTE } from "../remote.ts";
import { DINGZE_SETTINGS_NAMESPACE } from "../settingsContract.ts";
import { startLibraryLiveSync } from "./catalogSync.ts";
import { remountPluginCss, releasePluginCss } from "./pluginCss.ts";
import { releaseShellChrome } from "./contentSelection.ts";
import type {
  DingzeCapabilities,
  LibrarySettings,
  ListMaterialsResult,
  ListProjectsResult,
  ProjectDetail,
  ReadFileResult,
} from "../types.ts";
import {
  bumpLibrary,
  bumpProfile,
  getSelectedContentId,
  setSelectedContentId,
  subscribeSelectedContentId,
} from "./contentSelection.ts";
import { conversationInputOf, draftOrSubmit } from "./conversationInput.ts";
import { CreatorSettingsCard } from "./CreatorSettingsCard.tsx";
import { DzInspector } from "./DzInspector.tsx";
import { registerProjectTriggers } from "./projectTriggers.ts";
import type { DingzeViewFace } from "./face.ts";
import { en, NS, type DingzeKey, zh } from "./locales.ts";
import { DzSidebarRoot } from "./sidebar/DzSidebarRoot.tsx";
import { startSidebarSession } from "./sidebar/startSession.ts";
import type { DzSidebarInjected, DzSidebarSlotProps } from "./sidebar/slots.ts";
import {
  registerCreatorSettingsCard,
  type CompatibleSettingsSlots,
} from "./settingsSlot.ts";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "dsh.dingze": DingzeKey;
  }
}

interface RemoteAnswer<T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string };
}

interface DingzeRemote {
  listProjects: (request: { query: string }) => Promise<RemoteAnswer<ListProjectsResult>>;
  getSettings: (request: Record<string, never>) => Promise<RemoteAnswer<LibrarySettings>>;
  getCapabilities: (request: Record<string, never>) => Promise<RemoteAnswer<{ capabilities: DingzeCapabilities }>>;
  getRevision: (request: Record<string, never>) => Promise<RemoteAnswer<{ revision: number }>>;
  setLibraryRoot: (request: { path: string }) => Promise<RemoteAnswer<LibrarySettings>>;
  setSkippableSteps: (request: { skippableSteps: string[] }) => Promise<RemoteAnswer<LibrarySettings>>;
  refreshCatalog: (request: Record<string, never>) => Promise<RemoteAnswer<ListProjectsResult>>;
  openFolder: (request: { path: string }) => Promise<RemoteAnswer<Record<string, never>>>;
  projectDetail: (request: { id: string }) => Promise<RemoteAnswer<ProjectDetail>>;
  readFile: (request: { id: string; path: string }) => Promise<RemoteAnswer<ReadFileResult>>;
  listMaterials: (request: { id: string }) => Promise<RemoteAnswer<ListMaterialsResult>>;
}

function unwrap<T>(answer: RemoteAnswer<T>, fallback: string): T {
  if (!answer.ok || answer.value === undefined) {
    throw new Error(answer.error?.message ?? fallback);
  }
  return answer.value;
}

export const inject = ["slots", "locale", "remote", "workspaces", "layout", "connection"];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-dingze: dictionaries");
  ctx.effect(() => {
    remountPluginCss();
    return () => {
      releasePluginCss();
      releaseShellChrome();
    };
  }, "dsh-dingze: chrome");
  const remoteOf = (): DingzeRemote | undefined =>
    ctx.get("remote.dz") as DingzeRemote | undefined;

  const face = (): DingzeViewFace => ({
    ready: () => remoteOf() !== undefined,
    listProjects: async (query) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.listProjects({ query }), "list failed");
    },
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    openPath: (path) => ctx.workspaces.openPath(path),
    getSettings: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getSettings({}), "settings failed");
    },
    getCapabilities: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getCapabilities({}), "capabilities failed").capabilities;
    },
    getRevision: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.getRevision({}), "revision failed").revision;
    },
    setLibraryRoot: async (path) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      unwrap(await remote.setLibraryRoot({ path }), "set root failed");
      bumpLibrary();
    },
    setSkippableSteps: async (steps) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      unwrap(await remote.setSkippableSteps({ skippableSteps: steps }), "set skippable failed");
      bumpLibrary();
    },
    refreshCatalog: async () => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      const listed = unwrap(await remote.refreshCatalog({}), "refresh failed");
      bumpLibrary();
      return listed;
    },
    draftNewProject: () => {
      const conversation = ctx.get("conversation");
      const input = conversationInputOf(conversation);
      input?.setDraft("新建定责项目：");
    },
    projectDetail: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.projectDetail({ id }), "detail failed");
    },
    readProjectFile: async (id, path) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.readFile({ id, path }), "read failed");
    },
    listMaterials: async (id) => {
      const remote = remoteOf();
      if (remote === undefined) throw new Error("remote unavailable");
      return unwrap(await remote.listMaterials({ id }), "materials failed");
    },
    talk: (text, mode) => {
      const conversation = ctx.get("conversation");
      draftOrSubmit(conversationInputOf(conversation), text, mode);
    },
  });

  const contentFace = face();

  ctx.effect(() => {
    const triggers = ctx.get("inputTriggers") as
      | Parameters<typeof registerProjectTriggers>[0]
      | undefined;
    return registerProjectTriggers(triggers, async () => {
      const listed = await contentFace.listProjects("");
      return listed.items.map((item) => ({ id: item.id, company: item.company }));
    });
  }, "dsh-dingze: triggers");

  const injectSidebar = (): DzSidebarInjected => ({
    startSession: (workspaceId?: WorkspaceId) => {
      startSidebarSession(ctx, workspaceId);
    },
    toggleSidebar: () => {
      ctx.layout.toggleSidebar();
    },
  });

  function BoundSidebar(props: DzSidebarSlotProps) {
    const contentT = ctx.locale.bind(NS);
    return (
      <DzSidebarRoot
        {...props}
        tabLabels={{
          sessions: contentT("tab.sessions"),
          content: contentT("tab"),
        }}
        contentFace={contentFace}
        contentT={contentT}
      />
    );
  }

  ctx.slots.inject("sidebar", () =>
    ctx.slots.register({
      name: "sidebar",
      locale: NS,
      priority: -1,
      children: {
        "sidebar.workspaces": { kind: "single", scope: "root" },
        "sidebar.settings": { kind: "single", scope: "root" },
        "sidebar.footer.action": { kind: "list", scope: "root" },
      },
      inject: injectSidebar,
    }, BoundSidebar),
  );

  ctx.effect(async () => {
    const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
    if (ctx.fiber.state >= 5) {
      await disposeRemote();
      return () => {};
    }
    bumpProfile();

    const stopOverlay = ctx.slots.inject("shell.overlay", () => {
      let disposeOccupant: (() => void) | undefined;
      const release = (): void => {
        disposeOccupant?.();
        disposeOccupant = undefined;
      };
      const sync = (): void => {
        if (getSelectedContentId() === null) {
          release();
          return;
        }
        if (disposeOccupant !== undefined) return;
        disposeOccupant = ctx.slots.register({
          name: "shell.overlay",
          id: "dingze-inspector",
          order: 20,
          locale: NS,
          inject: () => ({
            ...face(),
            closeDetails: () => {
              setSelectedContentId(null);
            },
          }),
        }, DzInspector);
      };
      const stop = subscribeSelectedContentId(sync);
      sync();
      return () => {
        stop();
        release();
      };
    });
    const stopSettings = ctx.slots.inject("settings.plugin.item", () =>
      registerCreatorSettingsCard(
        ctx.slots as unknown as CompatibleSettingsSlots,
        CreatorSettingsCard,
        {
          namespace: DINGZE_SETTINGS_NAMESPACE,
          legacyId: "dsh-dingze",
          legacyOrder: 40,
          locale: NS,
          inject: () => face(),
        },
      ));
    const stopLive = startLibraryLiveSync(() => contentFace.getRevision());

    return async () => {
      stopLive();
      stopOverlay();
      stopSettings();
      await disposeRemote();
    };
  }, "dsh-dingze: remote-view");
}
