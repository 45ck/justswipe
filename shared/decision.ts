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

export type Handoff = {
  id: string;
  ownerId: string;
  handoffId: string;
  connectionId: string;
  threadId: string;
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
  handoffRowId: string;
  title: string;
  action: string;
  prompt: string;
  feedback: string;
  status: string;
  response: string;
  createdAt: string;
  updatedAt: string;
};

export type Integration = {
  id: string;
  ownerId: string;
  connectionId: string;
  pairedUntil: string;
  codexThreadId: string;
  customPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export type PairingCode = {
  id: string;
  ownerId: string;
  code: string;
  connectionId: string;
  threadId: string;
  status: string;
  expiresAt: string;
  pairedAt: string;
  createdAt: string;
  updatedAt: string;
};

export const defaultCodexThreadId = "019ef89d-058c-7df3-aad4-d9a4fa9e750e";
export const defaultConnectionId = "local-demo";

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
    title: "Pick the next build slice for Codex",
    summary:
      "Codex wants to build the mobile-first swipe shell: pairing code, one-card inbox, drag gestures, and response handoff.",
    recommendedAction: "yes",
    visualContext:
      "Thread pauses in Codex | JustSwipe shows one clear card | User swipes or adds context | Codex receives structured response and resumes",
    questionType: "adaptive_form",
    yesPayloadSchema: [
      {
        id: "chosen_option",
        label: "Chosen option",
        type: "select",
        required: true,
        options: ["Mobile swipe shell first", "Pairing flow first", "Adaptive forms first"],
      },
      {
        id: "implementation_notes",
        label: "Implementation notes",
        type: "textarea",
        required: true,
        placeholder: "Keep it simple, animated, and phone friendly.",
      },
      {
        id: "priority",
        label: "Priority",
        type: "rating",
        required: true,
        helper: "5 means Codex should do this before anything else.",
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
      yes: ["chosen_option", "implementation_notes", "priority"],
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
      `<section><h2>Mobile swipe shell</h2><p>Codex is proposing the smallest useful loop: paired thread, one decision card, tactile swipe, structured response, then resume.</p><ul><li>Phone-first card stack</li><li>Thread paused state</li><li>Inline evidence preview</li><li>Adaptive response form</li></ul><button>Yes</button><button>No</button></section>`,
  }),
  normalizeCard({
    cardId: "copy-density",
    title: "Should this card be shorter?",
    summary:
      "The current direction is powerful, but the user wants low-attention UX. Codex needs a copy-density rule before generating more cards.",
    recommendedAction: "yes",
    visualContext:
      "Title under 9 words | Summary under 30 words | One visual proof block | One obvious action",
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
      `<section><h2>Low-attention card rule</h2><p>The card should be scannable before the user thinks about the form. Evidence first, options second.</p><ul><li>Decision in one line</li><li>Risk shown as a chip</li><li>Context shown visually</li><li>Details hidden until needed</li></ul><button>Keep it short</button><button>Show more evidence</button></section>`,
  }),
  normalizeCard({
    cardId: "alerts",
    title: "Enable soft alerts for new handoffs?",
    summary:
      "When Codex pauses, JustSwipe should get your attention without feeling like another work dashboard.",
    recommendedAction: "yes",
    visualContext:
      "Badge changes | Browser notification if enabled | Short mobile vibration | Quiet sent pulse after submit",
    questionType: "adaptive_form",
    yesPayloadSchema: [
      {
        id: "alert_style",
        label: "Alert style",
        type: "select",
        required: true,
        options: ["Quiet", "Tactile", "High visibility"],
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
      `<section><h2>Attention hook</h2><p>Codex should get attention only when blocked, then get out of the way once the response is sent.</p><ul><li>New card badge</li><li>Soft vibration</li><li>Sent pulse</li><li>Thread resumes</li></ul><button>Tactile but quiet</button><button>In-app only</button></section>`,
  }),
];
