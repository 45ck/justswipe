import { capsule, endpoint, mutation, query, string, table, text } from "lakebed/server";
import {
  brandName,
  brandSymbolSvg,
} from "../shared/branding";
import {
  cleanText,
  defaultCodexThreadId,
  defaultConnectionId,
  defaultCustomPrompt,
  demoCards,
  normalizeCard,
  normalizeSwipeAction,
  parseCards,
  parseResponses,
  requiredFieldsForAction,
  type CodexThread,
  type CodexThreadStatus,
  type DeviceSessionPayload,
  type Handoff,
  type HandoffResponse,
  type Integration,
  type PairedDevice,
  type SwipeAction,
  type SwipeCard,
} from "../shared/decision";
import { justSwipeInstallMarkdown } from "../shared/install";

function nowIso(): string {
  return new Date().toISOString();
}

function isFutureIso(value: string): boolean {
  return Boolean(value) && value > nowIso();
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPairCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";

  for (let index = 0; index < 6; index += 1) {
    raw += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

function cleanBridgeResponse(value: string): string {
  return value
    .trim()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 1600);
}

function cleanDeviceValue(value: unknown, maxLength = 80): string {
  return cleanText(typeof value === "string" ? value : "", maxLength);
}

function parseDeviceSessionPayload(deviceJson = ""): DeviceSessionPayload {
  try {
    const value = JSON.parse(deviceJson);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const payload = value as Record<string, unknown>;
      const deviceId = cleanDeviceValue(payload.deviceId, 90).replace(/[^a-zA-Z0-9_-]/g, "");
      const browser = cleanDeviceValue(payload.browser, 48);
      const platform = cleanDeviceValue(payload.platform, 64);
      const label = cleanDeviceValue(payload.label, 90) || [browser, platform].filter(Boolean).join(" on ");

      return {
        deviceId,
        label: label || "Unknown browser",
        browser,
        platform,
      };
    }
  } catch {
    // Older bridge commands do not send device metadata.
  }

  return {
    deviceId: "",
    label: "Unknown browser",
    browser: "",
    platform: "",
  };
}

function devicePatch(device: DeviceSessionPayload, timestamp: string) {
  return {
    deviceId: device.deviceId,
    deviceLabel: device.label,
    deviceBrowser: device.browser,
    devicePlatform: device.platform,
    lastSeenAt: timestamp,
  };
}

function normalizeThreadStatus(value: string): CodexThreadStatus {
  if (
    value === "idle" ||
    value === "running" ||
    value === "awaiting_justswipe" ||
    value === "queued" ||
    value === "failed" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function shortThreadId(threadId: string): string {
  if (!threadId) return "new";
  return threadId.length > 8 ? threadId.slice(0, 8) : threadId;
}

function projectNameFromCwd(cwd: string): string {
  const normalized = cleanText(cwd || "", 240).replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  return cleanText(parts[parts.length - 1] || "Project", 80);
}

function fallbackThreadTitle(threadId: string, cwd: string, title = ""): string {
  const cleanTitle = cleanText(title, 140);

  if (cleanTitle && cleanTitle !== "New thread" && !/\bthread new$/i.test(cleanTitle)) {
    return cleanTitle;
  }

  return `${projectNameFromCwd(cwd)} thread ${shortThreadId(threadId)}`;
}

function parseThreadMetadata(metadataJson = "") {
  try {
    const value = JSON.parse(metadataJson);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const meta = value as Record<string, unknown>;
      const cwd = cleanText(String(meta.cwd || ""), 240);
      const threadId = cleanText(String(meta.threadId || ""), 140);

      return {
        threadId,
        threadTitle: fallbackThreadTitle(
          threadId,
          cwd,
          String(meta.threadTitle || meta.title || ""),
        ),
        threadStatus: normalizeThreadStatus(String(meta.threadStatus || meta.status || "unknown")),
        cwd,
        projectName: cleanText(String(meta.projectName || ""), 80) || projectNameFromCwd(cwd),
        lastActivityAt: cleanText(String(meta.lastActivityAt || ""), 40) || nowIso(),
      };
    }
  } catch {
    // Bridge metadata is optional; fallbacks keep the app usable.
  }

  return {
    threadId: "",
    threadTitle: "",
    threadStatus: "unknown" as CodexThreadStatus,
    cwd: "",
    projectName: "",
    lastActivityAt: nowIso(),
  };
}

function integrationThreadMetadata(integration: Integration) {
  return {
    threadId: integration.codexThreadId || defaultCodexThreadId,
    threadTitle: fallbackThreadTitle(
      integration.codexThreadId || defaultCodexThreadId,
      integration.cwd || "",
      integration.threadTitle || "",
    ),
    threadStatus: normalizeThreadStatus(integration.threadStatus || "unknown"),
    cwd: integration.cwd || "",
    projectName:
      cleanText(integration.projectName || "", 80) || projectNameFromCwd(integration.cwd || ""),
    lastActivityAt: integration.lastActivityAt || nowIso(),
  };
}

function shouldShowThread(thread: Partial<CodexThread>): boolean {
  if (!thread.threadId) {
    return false;
  }

  return Boolean(
    thread.threadId !== defaultCodexThreadId ||
      thread.cwd ||
      (thread.projectName && thread.projectName !== "Project"),
  );
}

function findThread(ctx: any, connectionId: string, threadId: string): CodexThread | undefined {
  if (!connectionId || !threadId) {
    return undefined;
  }

  return ctx.db.codexThreads
    .where("connectionId", connectionId)
    .where("threadId", threadId)
    .limit(1)
    .all()[0] as CodexThread | undefined;
}

function upsertCodexThread(
  ctx: any,
  values: {
    connectionId: string;
    threadId: string;
    threadTitle?: string;
    threadStatus?: CodexThreadStatus;
    cwd?: string;
    projectName?: string;
    lastActivityAt?: string;
    pendingCards?: string;
    pendingIdeas?: string;
  },
  ownerId = ctx.auth.userId,
): CodexThread | undefined {
  const connectionId = cleanText(values.connectionId, 140);
  const threadId = cleanText(values.threadId, 140);

  if (!connectionId || !threadId || !shouldShowThread({ threadId, cwd: values.cwd, projectName: values.projectName })) {
    return undefined;
  }

  const existing = findThread(ctx, connectionId, threadId);
  const cwd = cleanText(values.cwd || existing?.cwd || "", 240);
  const projectName =
    cleanText(values.projectName || existing?.projectName || "", 80) || projectNameFromCwd(cwd);
  const patch = {
    ownerId: existing?.ownerId || ownerId,
    connectionId,
    threadId,
    threadTitle: fallbackThreadTitle(threadId, cwd, values.threadTitle || existing?.threadTitle || ""),
    threadStatus: normalizeThreadStatus(values.threadStatus || existing?.threadStatus || "unknown"),
    cwd,
    projectName,
    lastActivityAt: values.lastActivityAt || existing?.lastActivityAt || nowIso(),
    pendingCards: values.pendingCards ?? existing?.pendingCards ?? "0",
    pendingIdeas: values.pendingIdeas ?? existing?.pendingIdeas ?? "0",
  };

  if (existing) {
    ctx.db.codexThreads.update(existing.id, patch);
    return {
      ...existing,
      ...patch,
    };
  }

  ctx.db.codexThreads.insert(patch);
  return findThread(ctx, connectionId, threadId);
}

function threadMetadataFor(
  ctx: any,
  connectionId: string,
  threadId: string,
  fallback?: Partial<CodexThread>,
) {
  const thread = findThread(ctx, connectionId, threadId);
  const cwd = thread?.cwd || fallback?.cwd || "";

  return {
    threadTitle: fallbackThreadTitle(
      threadId,
      cwd,
      thread?.threadTitle || fallback?.threadTitle || "",
    ),
    threadStatus: normalizeThreadStatus(thread?.threadStatus || fallback?.threadStatus || "unknown"),
    cwd,
    projectName:
      cleanText(thread?.projectName || fallback?.projectName || "", 80) || projectNameFromCwd(cwd),
  };
}

function activeIntegrationsForConnection(
  ctx: any,
  connectionId: string,
  current = nowIso(),
): Integration[] {
  if (!connectionId) {
    return [];
  }

  return ctx.db.integrations
    .where("connectionId", connectionId)
    .orderBy("updatedAt", "desc")
    .all()
    .filter((row: Integration) => row.pairedUntil && row.pairedUntil > current);
}

function rowRecency(row: Integration): string {
  return row.lastSeenAt || row.updatedAt || row.createdAt || "";
}

function cleanupDuplicateDeviceRows(
  ctx: any,
  connectionId: string,
  preferredRowId = "",
): number {
  const current = nowIso();
  const rows = activeIntegrationsForConnection(ctx, connectionId, current).filter(
    (row) => Boolean(row.deviceId),
  );
  const rowsByDevice = new Map<string, Integration[]>();
  let removed = 0;

  for (const row of rows) {
    const group = rowsByDevice.get(row.deviceId) || [];
    group.push(row);
    rowsByDevice.set(row.deviceId, group);
  }

  for (const group of rowsByDevice.values()) {
    if (group.length < 2) {
      continue;
    }

    const keep =
      group.find((row) => row.id === preferredRowId) ||
      group.find((row) => row.ownerId === ctx.auth.userId) ||
      [...group].sort((left, right) => rowRecency(right).localeCompare(rowRecency(left)))[0];

    for (const row of group) {
      if (row.id === keep.id) {
        continue;
      }

      ctx.db.integrations.update(row.id, {
        pairedUntil: current,
      });
      removed += 1;
    }
  }

  return removed;
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const value = JSON.parse(payloadJson);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function stringifyCards(cards: SwipeCard[]): string {
  return JSON.stringify(cards.map((card, index) => normalizeCard(card, index)));
}

function getIntegration(ctx: any): Integration | undefined {
  return ctx.db.integrations.where("ownerId", ctx.auth.userId).limit(1).all()[0];
}

function ensureIntegration(ctx: any): Integration {
  const existing = getIntegration(ctx);

  if (existing) {
    return existing;
  }

  ctx.db.integrations.insert({
    ownerId: ctx.auth.userId,
    connectionId: defaultConnectionId,
    pairedUntil: "",
    codexThreadId: defaultCodexThreadId,
    threadTitle: fallbackThreadTitle(defaultCodexThreadId, ""),
    threadStatus: "unknown",
    cwd: "",
    projectName: "",
    lastActivityAt: "",
    customPrompt: defaultCustomPrompt,
    deviceId: "",
    deviceLabel: "",
    deviceBrowser: "",
    devicePlatform: "",
    lastSeenAt: "",
    pairedAt: "",
  });

  return getIntegration(ctx)!;
}

function connectionFor(ctx: any): string {
  const integration = getIntegration(ctx);
  return integration ? integration.connectionId : defaultConnectionId;
}

function canAccessHandoff(ctx: any, handoff: Handoff): boolean {
  if (handoff.ownerId === ctx.auth.userId) {
    return true;
  }

  return Boolean(handoff.connectionId && handoff.connectionId === connectionFor(ctx));
}

function canAccessBridgeEvent(ctx: any, event: any): boolean {
  if (event.ownerId === ctx.auth.userId) {
    return true;
  }

  return Boolean(event.connectionId && event.connectionId === connectionFor(ctx));
}

function normalizeCardsJson(cardsJson: string): SwipeCard[] {
  try {
    const parsed = JSON.parse(cardsJson);
    if (Array.isArray(parsed)) {
      return parsed.map((card, index) => normalizeCard(card, index));
    }
  } catch {
    return [];
  }

  return [];
}

function responseSummary(responses: HandoffResponse[]): string {
  return responses
    .map((response, index) => {
      const payload = JSON.stringify(response.payload);
      return `${index + 1}. ${response.title}\nAction: ${response.action}\nPayload: ${payload}`;
    })
    .join("\n\n");
}

function buildResponsePrompt(
  handoff: Handoff,
  responses: HandoffResponse[],
  customPrompt: string,
) {
  return [
    "JUSTSWIPE RESPONSE PACKET",
    "",
    "A user responded to a paused Codex handoff in JustSwipe.",
    "Treat this as steering, not permission. Use the signal, then decide whether to continue work or ask JustSwipe for another handoff.",
    "Use the repo JustSwipe skill to consume this response: skills/justswipe/SKILL.md, or /justswipe if this host supports slash skills.",
    "",
    `Handoff id: ${handoff.handoffId}`,
    `Connection id: ${handoff.connectionId}`,
    `Thread id: ${handoff.threadId}`,
    `Thread title: ${handoff.threadTitle || fallbackThreadTitle(handoff.threadId, handoff.cwd || "")}`,
    `Project: ${handoff.projectName || projectNameFromCwd(handoff.cwd || "")}`,
    `Project cwd: ${handoff.cwd || "unknown"}`,
    "",
    "Custom steering prompt:",
    customPrompt || defaultCustomPrompt,
    "",
    "User responses:",
    responseSummary(responses),
    "",
    "If you need another JustSwipe handoff, end your reply with:",
    "Set agentHtmlPreview to a short HTML fragment that communicates the actual UI state, diagram, screenshot summary, or evidence the user needs. Use headings, paragraphs, lists, and button-like labels only; JustSwipe renders it inline as native card content.",
    "JUSTSWIPE_HANDOFF_JSON",
    '{"reason":"short reason","cards":[{"cardId":"next","title":"Short question","summary":"No fluff.","recommendedAction":"yes","visualContext":"What the user needs to know.","questionType":"yes_no","quickRepliesByAction":{"yes":["Do this","Keep it simple","Ship this slice"],"no":["Not this","Too broad","Try smaller"]},"yesPayloadSchema":[],"noPayloadSchema":[],"morePayloadSchema":[],"laterPayloadSchema":[],"optionPayloadSchemas":{},"requiredFieldsByAction":{},"agentHtmlPreview":"<section><h2>UI state or diagram</h2><p>Show the concrete thing the user is deciding on.</p><ul><li>Evidence point</li><li>Tradeoff</li><li>Next effect</li></ul><button>Yes</button><button>No</button></section>"}]}',
    "END_JUSTSWIPE_HANDOFF_JSON",
    "",
    "Otherwise reply with what changed and what you will do next.",
  ].join("\n");
}

function buildPlanningPrompt(
  prompt: string,
  integration: Integration,
  targetThread?: Partial<CodexThread>,
  route = "new_thread",
) {
  const meta = targetThread || integrationThreadMetadata(integration);

  return [
    "JUSTSWIPE PLANNING START",
    "",
    route === "new_thread"
      ? "The user started a new project idea from an empty JustSwipe deck."
      : "The user sent a project idea to an existing Codex thread from JustSwipe.",
    "Treat this as a normal Codex planning prompt. If you need human direction, create a JustSwipe handoff bundle instead of asking a long chat question.",
    "",
    `Connection id: ${integration.connectionId}`,
    `Thread id: ${route === "new_thread" ? "new thread requested" : meta.threadId || integration.codexThreadId || defaultCodexThreadId}`,
    `Thread title: ${meta.threadTitle || integration.threadTitle || "New thread"}`,
    `Project: ${meta.projectName || integration.projectName || projectNameFromCwd(meta.cwd || integration.cwd || "")}`,
    `Project cwd: ${meta.cwd || integration.cwd || "unknown"}`,
    "",
    "Custom steering prompt:",
    integration.customPrompt || defaultCustomPrompt,
    "",
    "User prompt:",
    prompt,
    "",
    "If you need a JustSwipe handoff, end your reply with:",
    "Set agentHtmlPreview to a short HTML fragment that communicates the actual UI state, diagram, screenshot summary, or evidence the user needs. Use headings, paragraphs, lists, and button-like labels only; JustSwipe renders it inline as native card content.",
    "JUSTSWIPE_HANDOFF_JSON",
    '{"reason":"short reason","cards":[{"cardId":"next","title":"Short question","summary":"No fluff.","recommendedAction":"yes","visualContext":"What the user needs to know.","questionType":"yes_no","quickRepliesByAction":{"yes":["Do this","Keep it simple","Ship this slice"],"no":["Not this","Too broad","Try smaller"]},"yesPayloadSchema":[],"noPayloadSchema":[],"morePayloadSchema":[],"laterPayloadSchema":[],"optionPayloadSchemas":{},"requiredFieldsByAction":{},"agentHtmlPreview":"<section><h2>UI state or diagram</h2><p>Show the concrete thing the user is deciding on.</p><ul><li>Evidence point</li><li>Tradeoff</li><li>Next effect</li></ul><button>Yes</button><button>No</button></section>"}]}',
    "END_JUSTSWIPE_HANDOFF_JSON",
  ].join("\n");
}

function missingRequiredFields(
  card: SwipeCard,
  action: SwipeAction,
  payload: Record<string, unknown>,
): string[] {
  if (payload.quick_reply || payload.custom_response) {
    return [];
  }

  return requiredFieldsForAction(card, action).filter((fieldId) => {
    const value = payload[fieldId];

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return value === undefined || value === null || String(value).trim() === "";
  });
}

function createHandoffRow(
  ctx: any,
  connectionId: string,
  threadId: string,
  cards: SwipeCard[],
  reason: string,
  metadata: Partial<CodexThread> = {},
  ownerId = ctx.auth.userId,
) {
  const handoffId = createId("handoff");
  const threadMeta = threadMetadataFor(ctx, connectionId, threadId, metadata);

  upsertCodexThread(ctx, {
    connectionId,
    threadId,
    threadTitle: threadMeta.threadTitle,
    threadStatus: "awaiting_justswipe",
    cwd: threadMeta.cwd,
    projectName: threadMeta.projectName,
    lastActivityAt: nowIso(),
    pendingCards: String(cards.length),
  }, ownerId);

  ctx.db.handoffs.insert({
    ownerId,
    handoffId,
    connectionId,
    threadId,
    threadTitle: threadMeta.threadTitle,
    threadStatus: "awaiting_justswipe",
    cwd: threadMeta.cwd,
    projectName: threadMeta.projectName,
    status: "awaiting_justswipe",
    cardsJson: stringifyCards(cards),
    activeCardIndex: "0",
    responsesJson: "[]",
    reason: cleanText(reason || "Codex needs a JustSwipe response.", 240),
    expiresAt: minutesFromNow(30),
    respondedAt: "",
  });

  return handoffId;
}

export default capsule({
  name: brandName,
  schema: {
    handoffs: table({
      ownerId: string(),
      handoffId: string(),
      connectionId: string(),
      threadId: string(),
      threadTitle: string().default(""),
      threadStatus: string().default("unknown"),
      cwd: string().default(""),
      projectName: string().default(""),
      status: string().default("awaiting_justswipe"),
      cardsJson: string().default("[]"),
      activeCardIndex: string().default("0"),
      responsesJson: string().default("[]"),
      reason: string().default("Codex needs a decision."),
      expiresAt: string().default(""),
      respondedAt: string().default(""),
    }),
    bridgeEvents: table({
      ownerId: string(),
      handoffId: string().default(""),
      connectionId: string().default(""),
      threadId: string(),
      threadTitle: string().default(""),
      threadStatus: string().default("unknown"),
      cwd: string().default(""),
      projectName: string().default(""),
      handoffRowId: string().default(""),
      title: string(),
      action: string(),
      prompt: string(),
      feedback: string().default(""),
      status: string().default("queued"),
      response: string().default(""),
    }),
    integrations: table({
      ownerId: string(),
      connectionId: string().default(defaultConnectionId),
      pairedUntil: string().default(""),
      codexThreadId: string().default(defaultCodexThreadId),
      threadTitle: string().default(""),
      threadStatus: string().default("unknown"),
      cwd: string().default(""),
      projectName: string().default(""),
      lastActivityAt: string().default(""),
      customPrompt: string().default(defaultCustomPrompt),
      deviceId: string().default(""),
      deviceLabel: string().default(""),
      deviceBrowser: string().default(""),
      devicePlatform: string().default(""),
      lastSeenAt: string().default(""),
      pairedAt: string().default(""),
    }),
    pairingCodes: table({
      ownerId: string(),
      code: string(),
      connectionId: string(),
      threadId: string(),
      threadTitle: string().default(""),
      cwd: string().default(""),
      projectName: string().default(""),
      customPrompt: string().default(defaultCustomPrompt),
      status: string().default("active"),
      expiresAt: string(),
      pairedAt: string().default(""),
    }),
    codexThreads: table({
      ownerId: string(),
      connectionId: string(),
      threadId: string(),
      threadTitle: string().default(""),
      threadStatus: string().default("unknown"),
      cwd: string().default(""),
      projectName: string().default(""),
      lastActivityAt: string().default(""),
      pendingCards: string().default("0"),
      pendingIdeas: string().default("0"),
    }),
  },
  endpoints: {
    faviconSvg: endpoint({ method: "GET", path: "/favicon.svg" }, () =>
      text(brandSymbolSvg, {
        headers: {
          "Cache-Control": "public, max-age=86400",
          "Content-Type": "image/svg+xml; charset=utf-8",
        },
      }),
    ),
    faviconIco: endpoint({ method: "GET", path: "/favicon.ico" }, () =>
      text(brandSymbolSvg, {
        headers: {
          "Cache-Control": "public, max-age=86400",
          "Content-Type": "image/svg+xml; charset=utf-8",
        },
      }),
    ),
    installMarkdown: endpoint({ method: "GET", path: "/install.md" }, () =>
      text(justSwipeInstallMarkdown),
    ),
    setupMarkdown: endpoint({ method: "GET", path: "/setup.md" }, () =>
      text(justSwipeInstallMarkdown),
    ),
  },
  queries: {
    integration: query((ctx) => getIntegration(ctx)),

    activeHandoffs: query((ctx) => {
      const connectionId = connectionFor(ctx);
      const rows = ctx.db.handoffs
        .where("connectionId", connectionId)
        .orderBy("createdAt", "asc")
        .all();
      const current = nowIso();

      return rows.filter((row: Handoff) => {
        if (row.status === "expired") {
          return false;
        }

        if (row.expiresAt && row.expiresAt < current && row.status === "awaiting_justswipe") {
          return false;
        }

        return true;
      });
    }),

    bridgeEvents: query((ctx) => {
      const connectionId = connectionFor(ctx);

      return ctx.db.bridgeEvents
        .where("connectionId", connectionId)
        .orderBy("createdAt", "desc")
        .all();
    }),

    pairingCodes: query((ctx) =>
      ctx.db.pairingCodes
        .where("ownerId", ctx.auth.userId)
        .orderBy("createdAt", "desc")
        .limit(3)
        .all(),
    ),

    pairedDevices: query((ctx) => {
      const connectionId = connectionFor(ctx);

      if (!connectionId) {
        return [];
      }

      const rows = activeIntegrationsForConnection(ctx, connectionId);
      const countsByDevice = new Map<string, number>();

      for (const row of rows) {
        if (!row.deviceId) {
          continue;
        }

        countsByDevice.set(row.deviceId, (countsByDevice.get(row.deviceId) || 0) + 1);
      }

      return rows.map((row: Integration): PairedDevice => {
        const isCurrent = row.ownerId === ctx.auth.userId;
        const label = isCurrent
          ? "This browser"
          : row.deviceLabel || (row.deviceId ? "Paired browser" : "Unknown browser");

        return {
          id: row.id,
          sessionId: row.id,
          deviceId: row.deviceId || "",
          label,
          isCurrent,
          isDuplicate: Boolean(row.deviceId && (countsByDevice.get(row.deviceId) || 0) > 1),
          lastSeenAt: row.lastSeenAt || row.updatedAt,
          pairedAt: row.pairedAt || row.createdAt,
          pairedUntil: row.pairedUntil,
          threadId: row.codexThreadId || defaultCodexThreadId,
          updatedAt: row.updatedAt,
          browser: row.deviceBrowser || "",
          platform: row.devicePlatform || "",
        };
      });
    }),

    codexThreads: query((ctx) => {
      const connectionId = connectionFor(ctx);

      if (!connectionId) {
        return [];
      }

      const rank: Record<string, number> = {
        awaiting_justswipe: 0,
        running: 1,
        queued: 2,
        failed: 3,
        idle: 4,
        unknown: 5,
      };

      return ctx.db.codexThreads
        .where("connectionId", connectionId)
        .all()
        .filter((row: CodexThread) => shouldShowThread(row))
        .sort((left: CodexThread, right: CodexThread) => {
          const statusDelta =
            (rank[left.threadStatus] ?? rank.unknown) - (rank[right.threadStatus] ?? rank.unknown);

          if (statusDelta !== 0) {
            return statusDelta;
          }

          return (right.lastActivityAt || right.updatedAt || "").localeCompare(
            left.lastActivityAt || left.updatedAt || "",
          );
        });
    }),
  },
  mutations: {
    seedDemo: mutation((ctx) => {
      const integration = ensureIntegration(ctx);
      const existing = ctx.db.handoffs
        .where("connectionId", integration.connectionId)
        .limit(1)
        .all();

      if (existing.length > 0) {
        return;
      }

      createHandoffRow(
        ctx,
        integration.connectionId,
        integration.codexThreadId || defaultCodexThreadId,
        demoCards,
        "Codex paused and sent a three-card MVP decision bundle.",
        integrationThreadMetadata(integration),
      );
    }),

    createPairingCode: mutation((ctx, deviceJson = "") => {
      const integration = ensureIntegration(ctx);
      const connectionId = integration.connectionId || createId("conn");
      const current = nowIso();
      const device = parseDeviceSessionPayload(deviceJson);
      const threadMeta = integrationThreadMetadata(integration);
      const pairedUntil =
        integration.pairedUntil && integration.pairedUntil > current
          ? integration.pairedUntil
          : hoursFromNow(24);

      ctx.db.integrations.update(integration.id, {
        connectionId,
        pairedUntil,
        pairedAt: integration.pairedAt || current,
        threadTitle: threadMeta.threadTitle,
        threadStatus: threadMeta.threadStatus,
        cwd: threadMeta.cwd,
        projectName: threadMeta.projectName,
        lastActivityAt: threadMeta.lastActivityAt,
        ...devicePatch(device, current),
      });

      upsertCodexThread(ctx, {
        connectionId,
        threadId: threadMeta.threadId,
        threadTitle: threadMeta.threadTitle,
        threadStatus: threadMeta.threadStatus,
        cwd: threadMeta.cwd,
        projectName: threadMeta.projectName,
        lastActivityAt: threadMeta.lastActivityAt,
      });

      for (const row of ctx.db.pairingCodes
        .where("ownerId", ctx.auth.userId)
        .all()) {
        if (row.status === "active" || row.status === "paired") {
          ctx.db.pairingCodes.update(row.id, { status: "expired" });
        }
      }

      const code = createPairCode();
      ctx.db.pairingCodes.insert({
        ownerId: ctx.auth.userId,
        code,
        connectionId,
        threadId: threadMeta.threadId,
        threadTitle: threadMeta.threadTitle,
        cwd: threadMeta.cwd,
        projectName: threadMeta.projectName,
        customPrompt: integration.customPrompt || defaultCustomPrompt,
        status: "active",
        expiresAt: minutesFromNow(2),
        pairedAt: "",
      });

      return code;
    }),

    pairWithCode: mutation((ctx, rawCode: string, deviceJson = "") => {
      const code = cleanText(rawCode.toUpperCase(), 20);
      const row = ctx.db.pairingCodes.where("code", code).limit(1).all()[0];

      if (!row || !["active", "paired"].includes(row.status) || row.expiresAt < nowIso()) {
        return "Invalid or expired code.";
      }

      const existing = getIntegration(ctx);
      const current = nowIso();
      const device = parseDeviceSessionPayload(deviceJson);
      const cwd = cleanText(row.cwd || existing?.cwd || "", 240);
      const projectName = cleanText(row.projectName || existing?.projectName || "", 80) || projectNameFromCwd(cwd);
      const threadTitle = fallbackThreadTitle(row.threadId || defaultCodexThreadId, cwd, row.threadTitle || existing?.threadTitle || "");
      const patch = {
        connectionId: row.connectionId,
        pairedUntil: hoursFromNow(24),
        codexThreadId: row.threadId || defaultCodexThreadId,
        threadTitle,
        threadStatus: "unknown",
        cwd,
        projectName,
        lastActivityAt: current,
        customPrompt: row.customPrompt || existing?.customPrompt || defaultCustomPrompt,
        pairedAt: existing?.pairedAt || current,
        ...devicePatch(device, current),
      };

      if (existing) {
        ctx.db.integrations.update(existing.id, patch);
      } else {
        ctx.db.integrations.insert({
          ownerId: ctx.auth.userId,
          ...patch,
        });
      }

      const pairedIntegration = getIntegration(ctx);
      cleanupDuplicateDeviceRows(ctx, row.connectionId, pairedIntegration?.id || "");
      upsertCodexThread(ctx, {
        connectionId: row.connectionId,
        threadId: row.threadId || defaultCodexThreadId,
        threadTitle,
        threadStatus: "unknown",
        cwd,
        projectName,
        lastActivityAt: current,
      }, pairedIntegration?.ownerId || ctx.auth.userId);

      ctx.db.pairingCodes.update(row.id, {
        status: "active",
        pairedAt: row.pairedAt || current,
      });

      return "Connected for today.";
    }),

    touchDeviceSession: mutation((ctx, deviceJson = "") => {
      const existing = getIntegration(ctx);

      if (!existing?.connectionId || !isFutureIso(existing.pairedUntil)) {
        return;
      }

      const current = nowIso();
      const device = parseDeviceSessionPayload(deviceJson);

      ctx.db.integrations.update(existing.id, {
        ...devicePatch(device, current),
      });

      cleanupDuplicateDeviceRows(ctx, existing.connectionId, existing.id);
    }),

    revokePairedDevice: mutation((ctx, sessionId: string) => {
      const currentIntegration = getIntegration(ctx);
      const connectionId = currentIntegration?.connectionId || "";
      const row = ctx.db.integrations.get(cleanText(sessionId, 120)) as Integration | null;

      if (!connectionId || !row || row.connectionId !== connectionId) {
        return "Browser session not found.";
      }

      if (row.ownerId === ctx.auth.userId) {
        return "Use Disconnect for this browser.";
      }

      ctx.db.integrations.update(row.id, {
        pairedUntil: nowIso(),
      });

      return "Browser removed.";
    }),

    cleanDuplicateDevices: mutation((ctx) => {
      const currentIntegration = getIntegration(ctx);
      const removed = cleanupDuplicateDeviceRows(
        ctx,
        currentIntegration?.connectionId || "",
        currentIntegration?.id || "",
      );

      if (removed === 0) {
        return "No duplicate browsers found.";
      }

      return `Cleaned ${removed} duplicate ${removed === 1 ? "browser" : "browsers"}.`;
    }),

    saveIntegration: mutation((ctx, threadId: string, customPrompt: string, metadataJson = "") => {
      const existing = ensureIntegration(ctx);
      const meta = parseThreadMetadata(metadataJson);
      const savedThreadId = cleanText(threadId || meta.threadId || defaultCodexThreadId, 140);
      const cwd = cleanText(meta.cwd || existing.cwd || "", 240);
      const projectName =
        cleanText(meta.projectName || existing.projectName || "", 80) || projectNameFromCwd(cwd);
      const threadTitle = fallbackThreadTitle(
        savedThreadId,
        cwd,
        meta.threadTitle || existing.threadTitle || "",
      );
      const threadStatus = normalizeThreadStatus(meta.threadStatus || existing.threadStatus || "unknown");
      const lastActivityAt = meta.lastActivityAt || existing.lastActivityAt || nowIso();

      ctx.db.integrations.update(existing.id, {
        codexThreadId: savedThreadId,
        threadTitle,
        threadStatus,
        cwd,
        projectName,
        lastActivityAt,
        customPrompt: cleanBridgeResponse(customPrompt || defaultCustomPrompt),
      });

      if (existing.connectionId) {
        upsertCodexThread(ctx, {
          connectionId: existing.connectionId,
          threadId: savedThreadId,
          threadTitle,
          threadStatus,
          cwd,
          projectName,
          lastActivityAt,
        });
      }
    }),

    disconnectIntegration: mutation((ctx) => {
      const existing = ensureIntegration(ctx);

      ctx.db.integrations.update(existing.id, {
        connectionId: "",
        pairedUntil: "",
      });
    }),

    startPlanningDiscussion: mutation((ctx, rawPrompt: string, targetThreadId = "", route = "new_thread") => {
      const integration = ensureIntegration(ctx);
      const prompt = cleanText(rawPrompt, 1200);

      if (!integration.connectionId) {
        return JSON.stringify({ ok: false, error: "Connect JustSwipe first." });
      }

      if (!prompt) {
        return JSON.stringify({ ok: false, error: "Add a prompt first." });
      }

      const wantsExisting = route === "existing_thread" && targetThreadId;
      const targetThread = wantsExisting
        ? findThread(ctx, integration.connectionId, cleanText(targetThreadId, 140))
        : undefined;
      const threadId = wantsExisting
        ? targetThread?.threadId || cleanText(targetThreadId, 140)
        : "";
      const fallbackMeta = integrationThreadMetadata(integration);
      const meta = wantsExisting
        ? threadMetadataFor(ctx, integration.connectionId, threadId, fallbackMeta)
        : {
            threadTitle: "New thread",
            threadStatus: "queued" as CodexThreadStatus,
            cwd: fallbackMeta.cwd,
            projectName: fallbackMeta.projectName,
          };
      const action = wantsExisting ? "project_idea_existing_thread" : "project_idea_new_thread";

      if (wantsExisting && threadId) {
        upsertCodexThread(ctx, {
          connectionId: integration.connectionId,
          threadId,
          threadTitle: meta.threadTitle,
          threadStatus: "queued",
          cwd: meta.cwd,
          projectName: meta.projectName,
          lastActivityAt: nowIso(),
          pendingIdeas: String(Number.parseInt(targetThread?.pendingIdeas || "0", 10) + 1),
        });
      }

      ctx.db.bridgeEvents.insert({
        ownerId: ctx.auth.userId,
        handoffId: createId(wantsExisting ? "idea" : "newthread"),
        connectionId: integration.connectionId,
        threadId,
        threadTitle: meta.threadTitle,
        threadStatus: "queued",
        cwd: meta.cwd,
        projectName: meta.projectName,
        handoffRowId: "",
        title: wantsExisting ? `Idea for ${meta.threadTitle}` : "New project idea",
        action,
        prompt: buildPlanningPrompt(prompt, integration, { threadId, ...meta }, wantsExisting ? "existing_thread" : "new_thread"),
        feedback: prompt,
        status: "queued",
        response: "",
      });

      return JSON.stringify({ ok: true });
    }),

    createHandoffFromBridge: mutation(
      (
        ctx,
        connectionIdValue: string,
        threadIdValue: string,
        cardsJson: string,
        reason: string,
        metadataJson = "",
      ) => {
        const integration = ensureIntegration(ctx);
        const meta = parseThreadMetadata(metadataJson);
        const connectionId = cleanText(
          connectionIdValue || integration.connectionId || defaultConnectionId,
          120,
        );
        const threadId = cleanText(
          threadIdValue || meta.threadId || integration.codexThreadId || defaultCodexThreadId,
          120,
        );
        const cards = normalizeCardsJson(cardsJson);

        if (cards.length === 0) {
          return "";
        }

        return createHandoffRow(ctx, connectionId, threadId, cards, reason, {
          threadTitle: meta.threadTitle || undefined,
          threadStatus: "awaiting_justswipe",
          cwd: meta.cwd || integration.cwd || undefined,
          projectName: meta.projectName || integration.projectName || undefined,
          lastActivityAt: meta.lastActivityAt,
        });
      },
    ),

    clearConnectionState: mutation((ctx) => {
      const connectionId = connectionFor(ctx);

      if (!connectionId) {
        return;
      }

      for (const row of ctx.db.handoffs.where("connectionId", connectionId).all()) {
        ctx.db.handoffs.delete(row.id);
      }

      for (const row of ctx.db.bridgeEvents.where("connectionId", connectionId).all()) {
        ctx.db.bridgeEvents.delete(row.id);
      }

      for (const row of ctx.db.codexThreads.where("connectionId", connectionId).all()) {
        ctx.db.codexThreads.delete(row.id);
      }

      for (const row of ctx.db.pairingCodes.where("ownerId", ctx.auth.userId).all()) {
        ctx.db.pairingCodes.delete(row.id);
      }
    }),

    submitCardResponse: mutation(
      (
        ctx,
        handoffRowId: string,
        cardId: string,
        actionValue: string,
        payloadJson: string,
      ) => {
        const handoff = ctx.db.handoffs.get(handoffRowId) as Handoff | null;

        if (!handoff || !canAccessHandoff(ctx, handoff)) {
          return JSON.stringify({ ok: false, error: "Handoff not available." });
        }

        if (handoff.status === "responding_to_codex") {
          return JSON.stringify({ ok: false, error: "Response is already sending." });
        }

        const cards = parseCards(handoff.cardsJson);
        const activeIndex = Number.parseInt(handoff.activeCardIndex || "0", 10) || 0;
        const card = cards[activeIndex];

        if (!card || card.cardId !== cardId) {
          return JSON.stringify({ ok: false, error: "This card is no longer active." });
        }

        const action = normalizeSwipeAction(actionValue);
        const payload = parsePayload(payloadJson);
        const missing = missingRequiredFields(card, action, payload);

        if (missing.length > 0) {
          return JSON.stringify({
            ok: false,
            error: `Missing required fields: ${missing.join(", ")}`,
          });
        }

        const responses = parseResponses(handoff.responsesJson);
        responses.push({
          handoffId: handoff.handoffId,
          cardId: card.cardId,
          title: card.title,
          action,
          payload,
          submittedAt: nowIso(),
        });

        const nextIndex = activeIndex + 1;
        const completed = nextIndex >= cards.length;
        const integration = getIntegration(ctx);

        ctx.db.handoffs.update(handoff.id, {
          responsesJson: JSON.stringify(responses),
          activeCardIndex: String(Math.min(nextIndex, cards.length - 1)),
          status: completed ? "responding_to_codex" : "in_progress",
          respondedAt: completed ? nowIso() : handoff.respondedAt,
        });

        if (completed) {
          upsertCodexThread(ctx, {
            connectionId: handoff.connectionId,
            threadId: handoff.threadId || integration?.codexThreadId || defaultCodexThreadId,
            threadTitle: handoff.threadTitle,
            threadStatus: "queued",
            cwd: handoff.cwd,
            projectName: handoff.projectName,
            lastActivityAt: nowIso(),
            pendingCards: "0",
          }, handoff.ownerId);

          const prompt = buildResponsePrompt(
            {
              ...handoff,
              responsesJson: JSON.stringify(responses),
              status: "responding_to_codex",
            },
            responses,
            integration?.customPrompt || defaultCustomPrompt,
          );

          ctx.db.bridgeEvents.insert({
            ownerId: handoff.ownerId,
            handoffId: handoff.handoffId,
            connectionId: handoff.connectionId,
            threadId: handoff.threadId || integration?.codexThreadId || defaultCodexThreadId,
            threadTitle: handoff.threadTitle,
            threadStatus: "queued",
            cwd: handoff.cwd,
            projectName: handoff.projectName,
            handoffRowId: handoff.id,
            title: handoff.reason || card.title,
            action: "handoff_response",
            prompt,
            feedback: JSON.stringify(responses),
            status: "queued",
            response: "",
          });
        }

        return JSON.stringify({
          ok: true,
          completed,
          nextIndex,
        });
      },
    ),

    claimBridgeEvent: mutation((ctx, id: string) => {
      const event = ctx.db.bridgeEvents.get(id);

      if (!event || !canAccessBridgeEvent(ctx, event)) {
        return JSON.stringify({ ok: false, error: "Bridge event not available." });
      }

      if (event.status !== "queued") {
        return JSON.stringify({ ok: false, error: "Bridge event already claimed." });
      }

      ctx.db.bridgeEvents.update(id, {
        status: "running",
        threadStatus: "running",
      });

      if (event.threadId) {
        upsertCodexThread(ctx, {
          connectionId: event.connectionId,
          threadId: event.threadId,
          threadTitle: event.threadTitle,
          threadStatus: "running",
          cwd: event.cwd,
          projectName: event.projectName,
          lastActivityAt: nowIso(),
        }, event.ownerId);
      }

      return JSON.stringify({ ok: true });
    }),

    markBridgeSent: mutation((ctx, id: string, response: string, metadataJson = "") => {
      const event = ctx.db.bridgeEvents.get(id);

      if (!event || !canAccessBridgeEvent(ctx, event)) {
        return;
      }

      const meta = parseThreadMetadata(metadataJson);
      const threadId = cleanText(meta.threadId || event.threadId || "", 140);
      const cwd = cleanText(meta.cwd || event.cwd || "", 240);
      const projectName =
        cleanText(meta.projectName || event.projectName || "", 80) || projectNameFromCwd(cwd);
      const threadTitle = fallbackThreadTitle(threadId, cwd, meta.threadTitle || event.threadTitle || "");

      ctx.db.bridgeEvents.update(id, {
        status: "sent",
        threadId,
        threadTitle,
        threadStatus: "idle",
        cwd,
        projectName,
        response: cleanBridgeResponse(response),
      });

      if (threadId) {
        upsertCodexThread(ctx, {
          connectionId: event.connectionId,
          threadId,
          threadTitle,
          threadStatus: "idle",
          cwd,
          projectName,
          lastActivityAt: meta.lastActivityAt || nowIso(),
          pendingIdeas: "0",
        }, event.ownerId);
      }

      const handoff = ctx.db.handoffs.get(event.handoffRowId);

      if (handoff && canAccessHandoff(ctx, handoff)) {
        ctx.db.handoffs.update(handoff.id, {
          status: "codex_resumed",
          threadStatus: "idle",
        });
      }
    }),

    markBridgeFailed: mutation((ctx, id: string, error: string) => {
      const event = ctx.db.bridgeEvents.get(id);

      if (!event || !canAccessBridgeEvent(ctx, event)) {
        return;
      }

      ctx.db.bridgeEvents.update(id, {
        status: "failed",
        threadStatus: "failed",
        response: cleanBridgeResponse(error),
      });

      if (event.threadId) {
        upsertCodexThread(ctx, {
          connectionId: event.connectionId,
          threadId: event.threadId,
          threadTitle: event.threadTitle,
          threadStatus: "failed",
          cwd: event.cwd,
          projectName: event.projectName,
          lastActivityAt: nowIso(),
        }, event.ownerId);
      }

      const handoff = ctx.db.handoffs.get(event.handoffRowId);

      if (handoff && canAccessHandoff(ctx, handoff)) {
        ctx.db.handoffs.update(handoff.id, {
          status: "failed",
          threadStatus: "failed",
        });
      }
    }),

    resetDemo: mutation((ctx) => {
      const connectionId = connectionFor(ctx);

      if (!connectionId) {
        return;
      }

      for (const row of ctx.db.handoffs.where("connectionId", connectionId).all()) {
        ctx.db.handoffs.delete(row.id);
      }

      for (const row of ctx.db.bridgeEvents.where("connectionId", connectionId).all()) {
        ctx.db.bridgeEvents.delete(row.id);
      }

      for (const row of ctx.db.codexThreads.where("connectionId", connectionId).all()) {
        ctx.db.codexThreads.delete(row.id);
      }

      for (const row of ctx.db.pairingCodes.where("ownerId", ctx.auth.userId).all()) {
        ctx.db.pairingCodes.delete(row.id);
      }

      createHandoffRow(
        ctx,
        connectionId,
        getIntegration(ctx)?.codexThreadId || defaultCodexThreadId,
        demoCards,
        "Codex paused and sent a three-card MVP decision bundle.",
        getIntegration(ctx) ? integrationThreadMetadata(getIntegration(ctx)!) : {},
      );
    }),
  },
});
