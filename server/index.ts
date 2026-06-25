import { capsule, endpoint, mutation, query, string, table, text } from "lakebed/server";
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
  type Handoff,
  type HandoffResponse,
  type Integration,
  type SwipeAction,
  type SwipeCard,
} from "../shared/decision";
import { justSwipeInstallMarkdown } from "../shared/install";

function nowIso(): string {
  return new Date().toISOString();
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
    customPrompt: defaultCustomPrompt,
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
) {
  return [
    "JUSTSWIPE PLANNING START",
    "",
    "The user started a planning discussion from an empty JustSwipe deck.",
    "Treat this as a normal Codex planning prompt. If you need human direction, create a JustSwipe handoff bundle instead of asking a long chat question.",
    "",
    `Connection id: ${integration.connectionId}`,
    `Thread id: ${integration.codexThreadId || defaultCodexThreadId}`,
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
  ownerId = ctx.auth.userId,
) {
  const handoffId = createId("handoff");

  ctx.db.handoffs.insert({
    ownerId,
    handoffId,
    connectionId,
    threadId,
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
  schema: {
    handoffs: table({
      ownerId: string(),
      handoffId: string(),
      connectionId: string(),
      threadId: string(),
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
      customPrompt: string().default(defaultCustomPrompt),
    }),
    pairingCodes: table({
      ownerId: string(),
      code: string(),
      connectionId: string(),
      threadId: string(),
      customPrompt: string().default(defaultCustomPrompt),
      status: string().default("active"),
      expiresAt: string(),
      pairedAt: string().default(""),
    }),
  },
  endpoints: {
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
      );
    }),

    createPairingCode: mutation((ctx) => {
      const integration = ensureIntegration(ctx);
      const connectionId = integration.connectionId || createId("conn");

      if (!integration.connectionId) {
        ctx.db.integrations.update(integration.id, {
          connectionId,
          pairedUntil: hoursFromNow(24),
        });
      }

      for (const row of ctx.db.pairingCodes
        .where("ownerId", ctx.auth.userId)
        .where("status", "active")
        .all()) {
        ctx.db.pairingCodes.update(row.id, { status: "expired" });
      }

      const code = createPairCode();
      ctx.db.pairingCodes.insert({
        ownerId: ctx.auth.userId,
        code,
        connectionId,
        threadId: integration.codexThreadId || defaultCodexThreadId,
        customPrompt: integration.customPrompt || defaultCustomPrompt,
        status: "active",
        expiresAt: minutesFromNow(2),
        pairedAt: "",
      });

      return code;
    }),

    pairWithCode: mutation((ctx, rawCode: string) => {
      const code = cleanText(rawCode.toUpperCase(), 20);
      const row = ctx.db.pairingCodes.where("code", code).limit(1).all()[0];

      if (!row || row.status !== "active" || row.expiresAt < nowIso()) {
        return "Invalid or expired code.";
      }

      const existing = getIntegration(ctx);
      const patch = {
        connectionId: row.connectionId,
        pairedUntil: hoursFromNow(24),
        codexThreadId: row.threadId || defaultCodexThreadId,
        customPrompt: row.customPrompt || existing?.customPrompt || defaultCustomPrompt,
      };

      if (existing) {
        ctx.db.integrations.update(existing.id, patch);
      } else {
        ctx.db.integrations.insert({
          ownerId: ctx.auth.userId,
          ...patch,
        });
      }

      ctx.db.pairingCodes.update(row.id, {
        status: "paired",
        pairedAt: nowIso(),
      });

      return "Connected for today.";
    }),

    saveIntegration: mutation((ctx, threadId: string, customPrompt: string) => {
      const existing = ensureIntegration(ctx);

      ctx.db.integrations.update(existing.id, {
        codexThreadId: cleanText(threadId || defaultCodexThreadId, 120),
        customPrompt: cleanBridgeResponse(customPrompt || defaultCustomPrompt),
      });
    }),

    disconnectIntegration: mutation((ctx) => {
      const existing = ensureIntegration(ctx);

      ctx.db.integrations.update(existing.id, {
        connectionId: "",
        pairedUntil: "",
      });
    }),

    startPlanningDiscussion: mutation((ctx, rawPrompt: string) => {
      const integration = ensureIntegration(ctx);
      const prompt = cleanText(rawPrompt, 1200);

      if (!integration.connectionId) {
        return JSON.stringify({ ok: false, error: "Connect JustSwipe first." });
      }

      if (!prompt) {
        return JSON.stringify({ ok: false, error: "Add a prompt first." });
      }

      ctx.db.bridgeEvents.insert({
        ownerId: ctx.auth.userId,
        handoffId: createId("plan"),
        connectionId: integration.connectionId,
        threadId: integration.codexThreadId || defaultCodexThreadId,
        handoffRowId: "",
        title: "Planning discussion",
        action: "planning_prompt",
        prompt: buildPlanningPrompt(prompt, integration),
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
      ) => {
        const integration = ensureIntegration(ctx);
        const connectionId = cleanText(
          connectionIdValue || integration.connectionId || defaultConnectionId,
          120,
        );
        const threadId = cleanText(
          threadIdValue || integration.codexThreadId || defaultCodexThreadId,
          120,
        );
        const cards = normalizeCardsJson(cardsJson);

        if (cards.length === 0) {
          return "";
        }

        return createHandoffRow(ctx, connectionId, threadId, cards, reason);
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

    markBridgeSent: mutation((ctx, id: string, response: string) => {
      const event = ctx.db.bridgeEvents.get(id);

      if (!event || !canAccessBridgeEvent(ctx, event)) {
        return;
      }

      ctx.db.bridgeEvents.update(id, {
        status: "sent",
        response: cleanBridgeResponse(response),
      });

      const handoff = ctx.db.handoffs.get(event.handoffRowId);

      if (handoff && canAccessHandoff(ctx, handoff)) {
        ctx.db.handoffs.update(handoff.id, {
          status: "codex_resumed",
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
        response: cleanBridgeResponse(error),
      });

      const handoff = ctx.db.handoffs.get(event.handoffRowId);

      if (handoff && canAccessHandoff(ctx, handoff)) {
        ctx.db.handoffs.update(handoff.id, {
          status: "failed",
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

      for (const row of ctx.db.pairingCodes.where("ownerId", ctx.auth.userId).all()) {
        ctx.db.pairingCodes.delete(row.id);
      }

      createHandoffRow(
        ctx,
        connectionId,
        getIntegration(ctx)?.codexThreadId || defaultCodexThreadId,
        demoCards,
        "Codex paused and sent a three-card MVP decision bundle.",
      );
    }),
  },
});
