export type SwipeAction = "yes" | "no" | "more" | "later";

export type QuestionType =
  | "yes_no"
  | "options"
  | "free_text"
  | "adaptive_form";

export type PayloadFieldType =
  | "text"
  | "textarea"
  | "select"
  | "toggle"
  | "checklist"
  | "rating"
  | "evidence";

export type PayloadField = {
  id: string;
  label: string;
  type: PayloadFieldType;
  required?: boolean;
  helper?: string;
  placeholder?: string;
  options?: string[];
};

export type RequiredFieldsByAction = Partial<Record<SwipeAction, string[]>>;
export type PayloadSchemasByOption = Record<string, PayloadField[]>;
export type QuickRepliesByAction = Partial<Record<SwipeAction, string[]>>;

export type SwipeCard = {
  cardId: string;
  title: string;
  summary: string;
  recommendedAction: SwipeAction;
  visualContext: string;
  questionType: QuestionType;
  yesPayloadSchema: PayloadField[];
  noPayloadSchema: PayloadField[];
  morePayloadSchema: PayloadField[];
  laterPayloadSchema: PayloadField[];
  optionPayloadSchemas: PayloadSchemasByOption;
  quickRepliesByAction: QuickRepliesByAction;
  requiredFieldsByAction: RequiredFieldsByAction;
  agentHtmlPreview: string;
};

export type HandoffStatus =
  | "awaiting_justswipe"
  | "in_progress"
  | "responding_to_codex"
  | "codex_resumed"
  | "failed"
  | "expired";

export type CodexThreadStatus =
  | "idle"
  | "running"
  | "awaiting_justswipe"
  | "queued"
  | "failed"
  | "unknown";

export type CodexThread = {
  id: string;
  ownerId: string;
  connectionId: string;
  threadId: string;
  threadTitle: string;
  threadStatus: CodexThreadStatus;
  cwd: string;
  projectName: string;
  lastActivityAt: string;
  pendingCards: string;
  pendingIdeas: string;
  createdAt: string;
  updatedAt: string;
};

export type Handoff = {
  id: string;
  ownerId: string;
  handoffId: string;
  connectionId: string;
  threadId: string;
  threadTitle: string;
  threadStatus: CodexThreadStatus;
  cwd: string;
  projectName: string;
  status: HandoffStatus;
  cardsJson: string;
  activeCardIndex: string;
  responsesJson: string;
  reason: string;
  expiresAt: string;
  respondedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type HandoffResponse = {
  handoffId: string;
  cardId: string;
  title: string;
  action: SwipeAction;
  payload: Record<string, unknown>;
  submittedAt: string;
};

export type BridgeEvent = {
  id: string;
  ownerId: string;
  handoffId: string;
  connectionId: string;
  threadId: string;
  threadTitle: string;
  threadStatus: CodexThreadStatus;
  cwd: string;
  projectName: string;
  handoffRowId: string;
  title: string;
  action: string;
  prompt: string;
  feedback: string;
  status: string;
  response: string;
  claimHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Integration = {
  id: string;
  ownerId: string;
  connectionId: string;
  pairedUntil: string;
  codexThreadId: string;
  threadTitle: string;
  threadStatus: CodexThreadStatus;
  cwd: string;
  projectName: string;
  lastActivityAt: string;
  customPrompt: string;
  deviceId: string;
  deviceLabel: string;
  deviceBrowser: string;
  devicePlatform: string;
  lastSeenAt: string;
  pairedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PairingCode = {
  id: string;
  ownerId: string;
  code: string;
  connectionId: string;
  threadId: string;
  threadTitle: string;
  cwd: string;
  projectName: string;
  customPrompt: string;
  status: string;
  expiresAt: string;
  pairedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PairedDevice = {
  id: string;
  sessionId: string;
  deviceId: string;
  label: string;
  isCurrent: boolean;
  isDuplicate: boolean;
  lastSeenAt: string;
  pairedAt: string;
  pairedUntil: string;
  threadId: string;
  updatedAt: string;
  browser: string;
  platform: string;
};

export type BridgeHeartbeat = {
  id: string;
  ownerId: string;
  connectionId: string;
  label: string;
  appUrl: string;
  status: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceSessionPayload = {
  deviceId: string;
  label: string;
  browser: string;
  platform: string;
};

export const defaultCodexThreadId = "";
export const defaultConnectionId = "";

export const defaultCustomPrompt =
  "You are the Codex worker behind JustSwipe. Treat each JustSwipe packet as user steering, not approval. Use the structured response, either continue the work or ask for another JustSwipe handoff, then be explicit about what you did next.";

export function cleanText(value: string, maxLength = 500): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseCards(cardsJson: string): SwipeCard[] {
  return safeParseJson<SwipeCard[]>(cardsJson, []);
}

export function parseResponses(responsesJson: string): HandoffResponse[] {
  return safeParseJson<HandoffResponse[]>(responsesJson, []);
}

export function normalizeSwipeAction(value: string): SwipeAction {
  if (value === "yes" || value === "no" || value === "more" || value === "later") {
    return value;
  }

  return "yes";
}

export function actionLabel(action: SwipeAction): string {
  if (action === "yes") return "Yes";
  if (action === "no") return "No";
  if (action === "more") return "More";
  return "Later";
}

export function actionVerb(action: SwipeAction): string {
  if (action === "yes") return "Continue";
  if (action === "no") return "Reject";
  if (action === "more") return "Alternatives";
  return "Defer";
}

export function schemaForAction(card: SwipeCard, action: SwipeAction): PayloadField[] {
  if (action === "yes") return card.yesPayloadSchema || [];
  if (action === "no") return card.noPayloadSchema || [];
  if (action === "more") return card.morePayloadSchema || [];
  return card.laterPayloadSchema || [];
}

export function requiredFieldsForAction(card: SwipeCard, action: SwipeAction): string[] {
  const explicit = card.requiredFieldsByAction?.[action] || [];
  const fromSchema = schemaForAction(card, action)
    .filter((field) => field.required)
    .map((field) => field.id);

  return Array.from(new Set([...explicit, ...fromSchema]));
}

export function hasSchemaForAction(card: SwipeCard, action: SwipeAction): boolean {
  return schemaForAction(card, action).length > 0;
}

export function normalizeCard(input: Partial<SwipeCard>, index = 0): SwipeCard {
  return {
    cardId: cleanText(input.cardId || `card-${index + 1}`, 80),
    title: cleanText(input.title || "Codex needs a decision", 120),
    summary: cleanText(input.summary || "Pick the direction so the thread can continue.", 500),
    recommendedAction: normalizeSwipeAction(input.recommendedAction || "yes"),
    visualContext: cleanText(input.visualContext || "No visual context attached.", 800),
    questionType: input.questionType || "yes_no",
    yesPayloadSchema: Array.isArray(input.yesPayloadSchema)
      ? input.yesPayloadSchema
      : [],
    noPayloadSchema: Array.isArray(input.noPayloadSchema)
      ? input.noPayloadSchema
      : [],
    morePayloadSchema: Array.isArray(input.morePayloadSchema)
      ? input.morePayloadSchema
      : [],
    laterPayloadSchema: Array.isArray(input.laterPayloadSchema)
      ? input.laterPayloadSchema
      : [],
    optionPayloadSchemas: input.optionPayloadSchemas || {},
    quickRepliesByAction: input.quickRepliesByAction || {},
    requiredFieldsByAction: input.requiredFieldsByAction || {},
    agentHtmlPreview: (input.agentHtmlPreview || "").trim().slice(0, 6000),
  };
}

export const demoCards: SwipeCard[] = [
  normalizeCard({
    cardId: "build-slice",
    title: "Build mobile swipe shell first?",
    summary:
      "Ship the phone-first card loop before deeper bridge controls.",
    recommendedAction: "yes",
    visualContext:
      "Decision: mobile shell first | Risk: too much setup UI before the loop feels real | Next: one-card inbox, drag gestures, response sheet",
    questionType: "yes_no",
    yesPayloadSchema: [
      {
        id: "chosen_option",
        label: "Chosen option",
        type: "select",
        required: true,
        options: ["Mobile swipe shell first", "Pairing flow first", "Adaptive forms later"],
      },
      {
        id: "implementation_notes",
        label: "Implementation notes",
        type: "textarea",
        required: false,
        placeholder: "Keep it simple, animated, and phone friendly.",
      },
    ],
    noPayloadSchema: [
      {
        id: "reason",
        label: "Reason for no",
        type: "text",
        required: true,
        placeholder: "What feels wrong?",
      },
      {
        id: "preferred_direction",
        label: "Preferred direction",
        type: "textarea",
        required: true,
        placeholder: "Tell Codex what to try instead.",
      },
      {
        id: "ask_for_alternatives",
        label: "Ask for alternatives",
        type: "toggle",
        helper: "Request another card bundle from Codex.",
      },
    ],
    morePayloadSchema: [
      {
        id: "variant_focus",
        label: "Variant focus",
        type: "checklist",
        required: true,
        options: ["More playful", "More professional", "More visual proof", "Fewer words"],
      },
    ],
    laterPayloadSchema: [
      {
        id: "return_when",
        label: "Bring this back when",
        type: "select",
        options: ["After one more card", "Before build starts", "End of session"],
      },
    ],
    requiredFieldsByAction: {
      yes: ["chosen_option"],
      no: ["reason", "preferred_direction"],
      more: ["variant_focus"],
    },
    quickRepliesByAction: {
      yes: [
        "Build mobile swipe shell first",
        "Prioritize pairing and bridge reliability",
        "Keep the first version tactile and minimal",
        "Focus on the Codex handoff loop",
      ],
      no: [
        "Too much UI before bridge proof",
        "Start with pairing only",
        "Make forms simpler first",
        "Ask for a smaller slice",
      ],
      more: [
        "Show 3 layout variants",
        "Compare mobile vs desktop",
        "Give me a lower-risk slice",
        "Generate a visual card bundle",
      ],
      later: [
        "Bring this back after one card",
        "Return before implementation",
        "Save for end of session",
      ],
    },
    agentHtmlPreview:
      `<section><h2>Mobile swipe shell</h2><p>Build the tactile phone loop first.</p><ul><li>Decision: one-card inbox</li><li>Risk: setup UI can wait</li><li>Next: drag, tap, send response</li></ul><button>Build it</button><button>Go smaller</button></section>`,
  }),
  normalizeCard({
    cardId: "copy-density",
    title: "Should this card be shorter?",
    summary:
      "Keep only the decision, risk, and next effect visible.",
    recommendedAction: "yes",
    visualContext:
      "Decision: shorter cards | Risk: slow reading breaks the remote-control feel | Next: hide extra context behind the response sheet",
    questionType: "yes_no",
    yesPayloadSchema: [
      {
        id: "must_keep",
        label: "Must keep visible",
        type: "checklist",
        required: true,
        options: ["Decision", "Why it matters", "Risk", "Evidence", "Recommended action"],
      },
    ],
    noPayloadSchema: [
      {
        id: "what_to_expand",
        label: "What should Codex expand?",
        type: "textarea",
        required: true,
      },
    ],
    morePayloadSchema: [],
    laterPayloadSchema: [],
    requiredFieldsByAction: {
      yes: ["must_keep"],
      no: ["what_to_expand"],
    },
    quickRepliesByAction: {
      yes: [
        "Keep decision and risk only",
        "Show one reason and one action",
        "Use fewer than 30 words",
        "Keep visual proof visible",
      ],
      no: [
        "Need more evidence",
        "Show tradeoffs before I decide",
        "Keep the full context",
      ],
      more: [
        "Generate shorter copy variants",
        "Show a visual-only version",
        "Try a calmer operator tone",
      ],
    },
    agentHtmlPreview:
      `<section><h2>Short card rule</h2><p>Keep decision and risk only.</p><ul><li>Decision in one line</li><li>Risk as a visible cue</li><li>Details only when asked</li></ul><button>Keep it short</button><button>Show more</button></section>`,
  }),
  normalizeCard({
    cardId: "alerts",
    title: "Enable soft alerts for new handoffs?",
    summary:
      "Use quiet haptics and a small badge when Codex waits.",
    recommendedAction: "yes",
    visualContext:
      "Decision: tactile but quiet | Risk: loud alerts make JustSwipe feel like a dashboard | Next: badge, short vibration, compact notification",
    questionType: "adaptive_form",
    yesPayloadSchema: [
      {
        id: "alert_style",
        label: "Alert style",
        type: "select",
        required: true,
        options: ["Tactile but quiet", "In-app only", "High visibility"],
      },
    ],
    noPayloadSchema: [
      {
        id: "alert_limit",
        label: "Alert limit",
        type: "text",
        required: true,
        placeholder: "Only in-app badge, no notifications.",
      },
    ],
    morePayloadSchema: [],
    laterPayloadSchema: [],
    requiredFieldsByAction: {
      yes: ["alert_style"],
      no: ["alert_limit"],
    },
    quickRepliesByAction: {
      yes: [
        "Tactile but quiet",
        "Use badge plus vibration",
        "Notify only on new handoff",
        "Keep sound off",
      ],
      no: [
        "In-app only",
        "No browser notifications",
        "Manual refresh is fine",
      ],
    },
    agentHtmlPreview:
      `<section><h2>Quiet attention</h2><p>Alert only when Codex is blocked.</p><ul><li>Badge changes</li><li>Short vibration</li><li>No sound</li></ul><button>Tactile but quiet</button><button>In-app only</button></section>`,
  }),
];
