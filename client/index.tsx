import {
  SignInWithGoogle,
  signOut,
  useAuth,
  useMutation,
  useQuery,
} from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  actionLabel,
  actionVerb,
  defaultCodexThreadId,
  defaultCustomPrompt,
  parseCards,
  parseResponses,
  type BridgeEvent,
  type Handoff,
  type Integration,
  type PairingCode,
  type SwipeAction,
  type SwipeCard,
} from "../shared/decision";

type FormValues = Record<string, string | boolean | string[]>;

function Icon(props: { name: string; class?: string }) {
  const common = {
    class: props.class || "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "2",
    viewBox: "0 0 24 24",
  };

  if (props.name === "yes") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (props.name === "no") {
    return (
      <svg {...common}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (props.name === "more") {
    return (
      <svg {...common}>
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    );
  }

  if (props.name === "later") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    );
  }

  if (props.name === "bell") {
    return (
      <svg {...common}>
        <path d="M10 21h4" />
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      </svg>
    );
  }

  if (props.name === "link") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.14" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14" />
      </svg>
    );
  }

  if (props.name === "inbox") {
    return (
      <svg {...common}>
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="m5.45 5.11-3.36 7.38A2 2 0 0 0 2 13.32V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.68a2 2 0 0 0-.09-.83l-3.36-7.38A2 2 0 0 0 16.73 4H7.27a2 2 0 0 0-1.82 1.11Z" />
      </svg>
    );
  }

  if (props.name === "log") {
    return (
      <svg {...common}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    );
  }

  if (props.name === "power") {
    return (
      <svg {...common}>
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
      </svg>
    );
  }

  if (props.name === "send") {
    return (
      <svg {...common}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function actionTone(action: SwipeAction): string {
  if (action === "yes") return "border-lime-300/40 bg-lime-300/12 text-lime-100";
  if (action === "no") return "border-orange-400/40 bg-orange-400/12 text-orange-100";
  if (action === "more") return "border-cyan-300/40 bg-cyan-300/12 text-cyan-100";
  return "border-teal-300/40 bg-teal-300/12 text-teal-100";
}

function actionSolid(action: SwipeAction): string {
  if (action === "yes") return "bg-lime-300 text-zinc-950 hover:bg-lime-200";
  if (action === "no") return "bg-orange-500 text-white hover:bg-orange-400";
  if (action === "more") return "bg-cyan-300 text-zinc-950 hover:bg-cyan-200";
  return "bg-teal-300 text-zinc-950 hover:bg-teal-200";
}

function bridgeStatusLabel(status: string): string {
  if (status === "queued") return "Sending to Codex";
  if (status === "sent") return "Codex resumed";
  if (status === "failed") return "Bridge failed";
  return status || "Waiting";
}

function handoffStatusLabel(status: string): string {
  if (status === "awaiting_justswipe") return "Awaiting you";
  if (status === "in_progress") return "Clearing bundle";
  if (status === "responding_to_codex") return "Sending to Codex";
  if (status === "codex_resumed") return "Thread resumed";
  if (status === "failed") return "Bridge failed";
  return status;
}

function currentHandoff(handoffs: Handoff[]): Handoff | undefined {
  return handoffs.find((handoff) =>
    ["awaiting_justswipe", "in_progress"].includes(handoff.status),
  );
}

function sendingHandoff(handoffs: Handoff[]): Handoff | undefined {
  return handoffs.find((handoff) =>
    ["responding_to_codex", "failed"].includes(handoff.status),
  );
}

function requiredMissing(
  card: SwipeCard,
  action: SwipeAction,
  values: FormValues,
): string[] {
  if (values.quick_reply || values.custom_response) {
    return [];
  }

  return ["answer"];
}

function quickRepliesForAction(card: SwipeCard, action: SwipeAction): string[] {
  const provided = card.quickRepliesByAction?.[action] || [];

  if (provided.length > 0) {
    return provided.slice(0, 4);
  }

  if (action === "yes") {
    return [
      "Continue with this",
      "Good direction",
      "Keep it simple",
      "Use this as the default",
    ];
  }

  if (action === "no") {
    return [
      "Not this direction",
      "Too much complexity",
      "Try a smaller slice",
      "Show alternatives",
    ];
  }

  if (action === "more") {
    return [
      "Show 3 variants",
      "Give tradeoffs",
      "Make it more visual",
      "Reduce scope",
    ];
  }

  return [
    "Bring back later",
    "After one more card",
    "Before build starts",
  ];
}

function safeResult(value: string): { ok: boolean; error?: string; completed?: boolean } {
  try {
    return JSON.parse(value);
  } catch {
    return { ok: false, error: "Unexpected response from JustSwipe." };
  }
}

function Header(props: {
  integration?: Integration;
  onReset: () => void;
  onEnableAlerts: () => void;
  onOpenConnection: () => void;
  onOpenThreadLog: () => void;
  alertsEnabled: boolean;
  connected: boolean;
}) {
  const auth = useAuth();

  return (
    <header class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 border-b border-white/10 pb-4">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded border border-cyan-300/40 bg-cyan-300/12 text-sm font-black text-cyan-100">
          JS
        </div>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
            JustSwipe
          </p>
          <h1 class="truncate text-lg font-semibold text-white">
            Swipe to resume Codex
          </h1>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class={`grid h-10 w-10 place-items-center rounded border text-sm transition ${
            props.alertsEnabled
              ? "border-lime-300/40 bg-lime-300/12 text-lime-100"
              : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
          }`}
          type="button"
          title="Enable browser alerts"
          onClick={props.onEnableAlerts}
        >
          <Icon name="bell" class="h-4 w-4" />
        </button>
        <button
          class={`grid h-10 w-10 place-items-center rounded border text-sm transition ${
            props.connected
              ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
              : "border-orange-400/40 bg-orange-400/12 text-orange-100"
          }`}
          type="button"
          title={props.connected ? "Connection" : "Connect JustSwipe"}
          onClick={props.onOpenConnection}
        >
          <Icon name="link" class="h-4 w-4" />
        </button>
        <button
          class="grid h-10 w-10 place-items-center rounded border border-white/10 bg-white/5 text-sm text-zinc-300 transition hover:bg-white/10"
          type="button"
          title="Thread log"
          onClick={props.onOpenThreadLog}
        >
          <Icon name="log" class="h-4 w-4" />
        </button>
        <button
          class="grid h-10 w-10 place-items-center rounded border border-white/10 bg-white/5 text-sm text-zinc-300 transition hover:bg-white/10"
          type="button"
          title="Reset demo"
          onClick={props.onReset}
        >
          <Icon name="inbox" class="h-4 w-4" />
        </button>
        {!auth.isLoading && auth.isGuest ? (
          <SignInWithGoogle />
        ) : !auth.isLoading ? (
          <button
            class="hidden rounded border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10 sm:block"
            type="button"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}

function StatusRail(props: {
  handoff?: Handoff;
  cards: SwipeCard[];
  responses: number;
  latestEvent?: BridgeEvent;
}) {
  const total = Math.max(props.cards.length, 1);
  const active = props.handoff
    ? Math.min(Number.parseInt(props.handoff.activeCardIndex || "0", 10) + 1, total)
    : 0;

  return (
    <section class="mx-auto grid w-full max-w-2xl grid-cols-3 gap-2">
      <div class="rounded border border-white/10 bg-white/[0.03] p-3">
        <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Inbox</p>
        <p class="mt-1 text-sm font-medium text-white">
          {props.handoff ? `${active}/${total}` : "Clear"}
        </p>
      </div>
      <div class="rounded border border-white/10 bg-white/[0.03] p-3">
        <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Thread</p>
        <p class="mt-1 truncate text-sm font-medium text-white">
          {props.handoff
            ? handoffStatusLabel(props.handoff.status)
            : bridgeStatusLabel(props.latestEvent?.status || "")}
        </p>
      </div>
      <div class="rounded border border-white/10 bg-white/[0.03] p-3">
        <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Signal</p>
        <p class="mt-1 text-sm font-medium text-white">
          {props.responses ? `${props.responses} sent` : "Waiting"}
        </p>
      </div>
    </section>
  );
}

function extractPreviewText(html: string) {
  if (!html.trim()) {
    return { title: "", description: "", tags: [] as string[] };
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed").forEach((node) =>
      node.remove(),
    );
    const title =
      doc.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 80) || "";
    const description =
      doc.querySelector("p")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 180) ||
      "";
    const tags = Array.from(doc.querySelectorAll("button,.yes,.no,.tag,.pill,li"))
      .map((node) => node.textContent?.trim().replace(/\s+/g, " "))
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);

    return { title, description, tags };
  } catch {
    return { title: "", description: "", tags: [] as string[] };
  }
}

function AgentInlineShowcase(props: { card: SwipeCard }) {
  const preview = extractPreviewText(props.card.agentHtmlPreview);
  const title = preview.title || props.card.title;
  const description = preview.description || props.card.visualContext;
  const pathItems = ["Codex pauses", "You decide", "Structured reply", "Thread resumes"];

  return (
    <section class="mt-6 grid gap-4">
      <div class="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
        <div class="rounded bg-cyan-300/[0.07] p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            What Codex is showing
          </p>
          <h3 class="mt-3 text-xl font-semibold leading-tight text-white">{title}</h3>
          <p class="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
          <div class="mt-4 grid grid-cols-4 gap-1.5">
            {pathItems.map((item, index) => (
              <div class="relative rounded bg-black/24 p-2 text-center">
                <div class="mx-auto mb-2 h-2 w-2 rounded bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
                <p class="text-[10px] leading-4 text-zinc-300">{item}</p>
                {index < pathItems.length - 1 ? (
                  <span class="absolute right-[-6px] top-3 h-px w-3 bg-cyan-300/60" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div class="rounded bg-white/[0.04] p-3">
          <div class="rounded bg-[#061016] p-3 shadow-inner shadow-black/40">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <span>App slice</span>
              <span>evidence</span>
            </div>
            <div class="mt-3 rounded bg-white/[0.06] p-3">
              <div class="h-20 rounded bg-gradient-to-br from-cyan-300/25 via-white/8 to-lime-300/20 p-3">
                <div class="h-2 w-20 rounded bg-cyan-200/80" />
                <div class="mt-3 h-2 w-28 rounded bg-white/35" />
                <div class="mt-2 h-2 w-16 rounded bg-white/20" />
              </div>
              <div class="mt-3 grid gap-2">
                <div class="h-2 w-full rounded bg-cyan-300/35" />
                <div class="h-2 w-3/4 rounded bg-white/20" />
              </div>
            </div>
            {preview.tags.length ? (
              <div class="mt-3 flex flex-wrap gap-2">
                {preview.tags.map((tag) => (
                  <span class="rounded bg-white/[0.07] px-2 py-1 text-[11px] text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SwipeCardView(props: {
  card: SwipeCard;
  index: number;
  total: number;
  dragX: number;
  dragY: number;
  motion: SwipeAction | null;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const rotate = props.dragX / 18;
  const activeCue =
    props.motion ||
    (props.dragX > 42
      ? "yes"
      : props.dragX < -42
        ? "no"
        : props.dragY < -42
          ? "more"
          : props.dragY > 42
            ? "later"
            : null);
  const transform = props.motion
    ? props.motion === "yes"
      ? "translateX(760px) rotate(18deg)"
      : props.motion === "no"
        ? "translateX(-760px) rotate(-18deg)"
        : props.motion === "more"
          ? "translateY(-650px) scale(0.94)"
          : "translateY(650px) scale(0.94)"
    : `translate(${props.dragX}px, ${props.dragY}px) rotate(${rotate}deg)`;
  const glow =
    activeCue === "yes"
      ? "border-lime-300/70 shadow-lime-500/20"
      : activeCue === "no"
        ? "border-orange-400/70 shadow-orange-500/20"
        : activeCue === "more"
          ? "border-cyan-300/70 shadow-cyan-500/20"
          : activeCue === "later"
            ? "border-teal-300/70 shadow-teal-500/20"
            : "border-white/15 shadow-black/50";
  const contextItems = props.card.visualContext
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <section class="relative mx-auto w-full max-w-2xl">
      <article
        class={`relative min-h-[520px] touch-none overflow-hidden rounded border bg-[#080d12] p-5 shadow-2xl transition-all duration-300 ${glow}`}
        style={{ transform }}
        onPointerDown={props.onPointerDown}
        onPointerMove={props.onPointerMove}
        onPointerUp={props.onPointerUp}
        onPointerCancel={props.onPointerUp}
      >
        <div class="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between">
          <span class="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
            Card {props.index + 1} of {props.total}
          </span>
          <span class={`rounded border px-2 py-1 text-xs ${actionTone(props.card.recommendedAction)}`}>
            Best: {actionLabel(props.card.recommendedAction)}
          </span>
        </div>

        <div
          class={`pointer-events-none absolute inset-0 grid place-items-center bg-zinc-950/78 text-center transition-opacity duration-150 ${
            activeCue ? "opacity-100" : "opacity-0"
          }`}
        >
          <div class={`grid h-32 w-32 place-items-center rounded border ${activeCue ? actionTone(activeCue) : ""}`}>
            {activeCue ? (
              <Icon name={activeCue} class="h-14 w-14" />
            ) : null}
          </div>
          <p class="absolute bottom-10 text-sm font-semibold text-white">
            {activeCue ? `${actionLabel(activeCue)} / ${actionVerb(activeCue)}` : ""}
          </p>
        </div>

        <div class="pt-16">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Codex handoff
          </p>
          <h2 class="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {props.card.title}
          </h2>
          <p class="mt-4 text-base leading-7 text-zinc-300">
            {props.card.summary}
          </p>
        </div>

        <div class="mt-8 rounded bg-white/[0.035] p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Evidence
          </p>
          <div class="mt-3 grid gap-2">
            {contextItems.length > 1 ? (
              contextItems.map((item) => (
                <div class="flex items-start gap-2 text-sm leading-5 text-zinc-200">
                  <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded bg-cyan-300" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p class="text-sm leading-6 text-zinc-200">{props.card.visualContext}</p>
            )}
          </div>
        </div>

        <AgentInlineShowcase card={props.card} />

        <div class="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-zinc-500">
          <span>Swipe left/right, or use buttons</span>
          <span>{props.card.questionType.replace("_", " ")}</span>
        </div>
      </article>
    </section>
  );
}

function ActionDock(props: {
  disabled: boolean;
  onAction: (action: SwipeAction) => void;
}) {
  const actions: SwipeAction[] = ["no", "yes", "more", "later"];

  return (
    <div class="mx-auto mt-4 grid w-full max-w-2xl grid-cols-4 gap-2">
      {actions.map((action) => (
        <button
          class={`grid h-14 place-items-center rounded border text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40 ${
            action === "yes" ? actionSolid(action) : actionTone(action)
          }`}
          disabled={props.disabled}
          type="button"
          onClick={() => props.onAction(action)}
          title={`${actionLabel(action)} / ${actionVerb(action)}`}
        >
          <Icon name={action} class="h-5 w-5" />
          <span>{actionLabel(action)}</span>
        </button>
      ))}
    </div>
  );
}

function PayloadSheet(props: {
  card: SwipeCard;
  action: SwipeAction;
  values: FormValues;
  error: string;
  submitting: boolean;
  onChange: (fieldId: string, value: FormValues[string]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const quickReplies = quickRepliesForAction(props.card, props.action);
  const selectedQuickReply = String(props.values.quick_reply || "");
  const customResponse = String(props.values.custom_response || "");
  const optionalNote = String(props.values.optional_note || "");
  const writingCustom = props.values.answer_mode === "custom" || customResponse.length > 0;
  const hasAnswer = selectedQuickReply.length > 0 || customResponse.trim().length > 0;

  return (
    <section class="fixed inset-0 z-40 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div class="max-h-[92vh] w-full max-w-xl overflow-auto rounded-t border border-white/10 bg-[#080d12] p-4 shadow-2xl shadow-black/70 sm:max-h-[86vh] sm:rounded">
        <div class="mx-auto mb-3 h-1 w-12 rounded bg-white/20 sm:hidden" />
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class={`inline-flex items-center gap-2 rounded border px-2 py-1 text-xs ${actionTone(props.action)}`}>
              <Icon name={props.action} class="h-4 w-4" />
              {actionLabel(props.action)} / {actionVerb(props.action)}
            </p>
            <h3 class="mt-3 text-xl font-semibold text-white">Pick what Codex should hear</h3>
            <p class="mt-1 text-sm leading-6 text-zinc-500">
              One tap is enough. Add a note only if Codex needs extra context.
            </p>
          </div>
          <button
            class="grid h-9 w-9 shrink-0 place-items-center rounded border border-white/10 text-zinc-300 transition hover:bg-white/10"
            aria-label="Close response"
            title="Close response"
            type="button"
            onClick={props.onClose}
          >
            <Icon name="no" class="h-4 w-4" />
          </button>
        </div>

        <div class="mt-4 grid gap-2">
          {quickReplies.map((reply) => {
            const selected = selectedQuickReply === reply;

            return (
              <button
                class={`flex min-h-12 items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? `${actionTone(props.action)} bg-white/[0.08]`
                    : "border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
                }`}
                aria-pressed={selected}
                type="button"
                onClick={() => {
                  props.onChange("quick_reply", reply);
                  props.onChange("custom_response", "");
                  props.onChange("answer_mode", "");
                }}
              >
                <span>{reply}</span>
                {selected ? <Icon name="yes" class="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>

        {writingCustom ? (
          <label class="mt-4 grid gap-2 rounded border border-white/10 bg-white/[0.03] p-3">
            <span class="text-sm font-medium text-zinc-100">Custom answer</span>
            <textarea
              class="min-h-24 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
              placeholder="Write a different answer for Codex."
              value={customResponse}
              onInput={(event) => {
                props.onChange("custom_response", event.currentTarget.value);
                props.onChange("quick_reply", "");
              }}
            />
          </label>
        ) : (
          <button
            class="mt-3 flex min-h-11 w-full items-center justify-between rounded border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            type="button"
            onClick={() => {
              props.onChange("answer_mode", "custom");
              props.onChange("quick_reply", "");
            }}
          >
            <span>Write a custom answer</span>
            <Icon name="more" class="h-4 w-4" />
          </button>
        )}

        {selectedQuickReply ? (
          <div class="mt-4 rounded border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Codex will receive
            </p>
            <p class="mt-2 text-sm font-medium text-white">{selectedQuickReply}</p>
            <label class="mt-3 grid gap-2">
              <span class="text-xs text-zinc-500">Optional note</span>
              <textarea
                class="min-h-16 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
                placeholder="Add extra context only if needed."
                value={optionalNote}
                onInput={(event) => props.onChange("optional_note", event.currentTarget.value)}
              />
            </label>
          </div>
        ) : null}

        {props.error ? (
          <p class="mt-3 rounded border border-orange-400/30 bg-orange-400/10 p-3 text-sm text-orange-100">
            {props.error}
          </p>
        ) : null}

        <button
          class={`mt-4 h-12 w-full rounded text-sm font-semibold transition disabled:opacity-40 ${actionSolid(props.action)}`}
          disabled={props.submitting || !hasAnswer}
          type="button"
          onClick={props.onSubmit}
        >
          {props.submitting ? "Sending..." : `Submit ${actionLabel(props.action)}`}
        </button>
      </div>
    </section>
  );
}

function EmptyInbox(props: {
  connected: boolean;
  planningPrompt: string;
  planningBusy: boolean;
  latestEvent?: BridgeEvent;
  setPlanningPrompt: (value: string) => void;
  onStartPlanning: () => void;
  onOpenConnection: () => void;
}) {
  if (!props.connected) {
    return (
      <section class="mx-auto grid min-h-[480px] w-full max-w-2xl place-items-center rounded border border-orange-400/25 bg-orange-400/8 p-6 text-center">
        <div>
          <div class="mx-auto grid h-16 w-16 place-items-center rounded border border-orange-400/40 bg-orange-400/12 text-orange-100">
            <Icon name="link" class="h-8 w-8" />
          </div>
          <h2 class="mt-5 text-2xl font-semibold text-white">Connect JustSwipe</h2>
          <p class="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
            Paste a temporary code from the laptop bridge before cards can appear here.
          </p>
          <button
            class="mt-5 inline-flex h-11 items-center gap-2 rounded bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
            type="button"
            onClick={props.onOpenConnection}
          >
            <Icon name="link" class="h-4 w-4" />
            Open connection
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="mx-auto grid min-h-[420px] w-full max-w-2xl place-items-center rounded border border-white/10 bg-white/[0.03] p-6 text-center">
      <div class="w-full max-w-lg">
        <div class="mx-auto grid h-16 w-16 place-items-center rounded border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
          <Icon name="inbox" class="h-8 w-8" />
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-white">You're out of cards</h2>
        <p class="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          Codex has nothing waiting right now. Start a planning discussion or wait for the next handoff.
        </p>
        <div class="mt-5 rounded border border-white/10 bg-[#080d12] p-3 text-left">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Start a planning discussion
          </label>
          <textarea
            class="mt-3 min-h-24 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
            placeholder="Ask Codex to plan the next slice. It can answer or create new swipe cards."
            value={props.planningPrompt}
            onInput={(event) => props.setPlanningPrompt(event.currentTarget.value)}
          />
          <button
            class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-cyan-300 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:opacity-40"
            disabled={props.planningBusy || !props.planningPrompt.trim()}
            type="button"
            onClick={props.onStartPlanning}
          >
            <Icon name="send" class="h-4 w-4" />
            {props.planningBusy ? "Sending..." : "Send to Codex"}
          </button>
        </div>
        {props.latestEvent ? (
          <p class="mt-3 text-xs text-zinc-500">
            Last thread state: {bridgeStatusLabel(props.latestEvent.status)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SentState(props: {
  handoff: Handoff;
  latestEvent?: BridgeEvent;
}) {
  const status = props.latestEvent?.status || props.handoff.status;

  return (
    <section class="mx-auto grid min-h-[420px] w-full max-w-2xl place-items-center rounded border border-lime-300/25 bg-lime-300/8 p-6 text-center jsw-sent-pulse">
      <div>
        <div class="mx-auto grid h-20 w-20 place-items-center rounded border border-lime-300/50 bg-lime-300/15 text-lime-100">
          <Icon name={status === "failed" ? "no" : "yes"} class="h-10 w-10" />
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-white">
          {status === "failed" ? "Bridge needs attention" : "Response sent"}
        </h2>
        <p class="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          {status === "failed"
            ? "The local bridge could not resume Codex. The response is saved and can be retried from the bridge."
            : "Codex has the structured response. It can continue working or ask the next JustSwipe card."}
        </p>
        <div class="mt-5 rounded border border-white/10 bg-black/20 p-3 text-left">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Thread state
          </p>
          <p class="mt-2 text-sm text-zinc-200">
            {bridgeStatusLabel(status)}
          </p>
          {props.latestEvent?.response ? (
            <p class="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400">
              {props.latestEvent.response}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Modal(props: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  return (
    <section class="fixed inset-0 z-50 grid place-items-end bg-black/65 p-0 sm:place-items-center sm:p-4">
      <div class="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-t border border-white/10 bg-[#080d12] p-4 shadow-2xl shadow-black/70 sm:rounded">
        <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            {props.title}
          </h2>
          <button
            class="grid h-9 w-9 place-items-center rounded border border-white/10 text-zinc-300 transition hover:bg-white/10"
            aria-label="Close modal"
            title="Close modal"
            type="button"
            onClick={props.onClose}
          >
            <Icon name="no" class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-4">{props.children}</div>
      </div>
    </section>
  );
}

function PairingPanel(props: {
  integration?: Integration;
  pairCodes: PairingCode[];
  codeDraft: string;
  setCodeDraft: (value: string) => void;
  pairMessage: string;
  threadDraft: string;
  setThreadDraft: (value: string) => void;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  onCreatePairCode: () => void;
  onPair: () => void;
  onSave: () => void;
  onDisconnect: () => void;
}) {
  const latestCode = props.pairCodes[0];

  return (
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded border border-white/10 bg-[#080d12] p-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Phone pairing
          </p>
          <p class="mt-2 text-xs leading-5 text-zinc-500">
            Code lasts 2 minutes. Paired devices use this connection for today.
          </p>
          <button
            class="mt-3 h-10 w-full rounded bg-cyan-300 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
            type="button"
            onClick={props.onCreatePairCode}
          >
            Create code
          </button>
          {latestCode ? (
            <div class="mt-3 rounded border border-lime-300/25 bg-lime-300/8 p-3">
              <p class="text-[11px] uppercase tracking-[0.18em] text-lime-100">
                Latest code
              </p>
              <p class="mt-1 text-2xl font-semibold tracking-[0.12em] text-white">
                {latestCode.code}
              </p>
              <p class="mt-1 text-xs text-zinc-500">
                {latestCode.status} until {latestCode.expiresAt.slice(11, 16)}
              </p>
            </div>
          ) : null}
          <div class="mt-3 flex gap-2">
            <input
              class="h-10 min-w-0 flex-1 rounded border border-white/10 bg-[#05080c] px-3 text-sm uppercase text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
              placeholder="ABC-123"
              value={props.codeDraft}
              onInput={(event) => props.setCodeDraft(event.currentTarget.value)}
            />
            <button
              class="rounded border border-white/10 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              type="button"
              onClick={props.onPair}
            >
              Pair
            </button>
          </div>
          {props.pairMessage ? (
            <p class="mt-2 text-xs text-zinc-400">{props.pairMessage}</p>
          ) : null}
        </div>

        <div class="rounded border border-white/10 bg-[#080d12] p-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Local bridge
          </p>
          <p class="mt-2 truncate text-xs text-zinc-500">
            {props.integration?.connectionId || "Not paired"}
          </p>
          <input
            class="mt-3 h-10 w-full rounded border border-white/10 bg-[#05080c] px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
            placeholder="Codex thread id"
            value={props.threadDraft}
            onInput={(event) => props.setThreadDraft(event.currentTarget.value)}
          />
          <textarea
            class="mt-2 min-h-24 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-xs leading-5 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
            placeholder={defaultCustomPrompt}
            value={props.promptDraft}
            onInput={(event) => props.setPromptDraft(event.currentTarget.value)}
          />
          <button
            class="mt-2 h-10 w-full rounded border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
            type="button"
            onClick={props.onSave}
          >
            Save bridge prompt
          </button>
          {props.integration?.connectionId ? (
            <button
              class="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-orange-400/30 bg-orange-400/10 text-sm font-semibold text-orange-100 transition hover:bg-orange-400/20"
              type="button"
              onClick={props.onDisconnect}
            >
              <Icon name="power" class="h-4 w-4" />
              Disconnect
            </button>
          ) : null}
        </div>
      </div>
  );
}

function ThreadLog(props: { events: BridgeEvent[] }) {
  const latest = props.events[0];

  return (
    <>
      {latest ? (
        <div class="mt-3 rounded border border-white/10 bg-[#080d12] p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-white">{latest.title}</p>
              <p class="mt-1 text-xs text-zinc-500">{latest.handoffId}</p>
            </div>
            <span class="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300">
              {bridgeStatusLabel(latest.status)}
            </span>
          </div>
          {latest.response ? (
            <p class="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-400">
              {latest.response}
            </p>
          ) : null}
        </div>
      ) : (
        <p class="mt-3 text-sm text-zinc-500">
          No response has been sent back to Codex yet.
        </p>
      )}
    </>
  );
}

export function App() {
  const auth = useAuth();
  const handoffs = (useQuery("activeHandoffs") || []) as Handoff[];
  const bridgeEvents = (useQuery("bridgeEvents") || []) as BridgeEvent[];
  const integration = useQuery("integration") as Integration | undefined;
  const pairCodes = (useQuery("pairingCodes") || []) as PairingCode[];
  const seedDemo = useMutation<[], void>("seedDemo");
  const resetDemo = useMutation<[], void>("resetDemo");
  const createPairingCode = useMutation<[], string>("createPairingCode");
  const pairWithCode = useMutation<[code: string], string>("pairWithCode");
  const saveIntegration = useMutation<
    [threadId: string, customPrompt: string],
    void
  >("saveIntegration");
  const disconnectIntegration = useMutation<[], void>("disconnectIntegration");
  const startPlanningDiscussion = useMutation<[prompt: string], string>(
    "startPlanningDiscussion",
  );
  const submitCardResponse = useMutation<
    [handoffRowId: string, cardId: string, action: string, payloadJson: string],
    string
  >("submitCardResponse");
  const [hasSeeded, setHasSeeded] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [motion, setMotion] = useState<SwipeAction | null>(null);
  const [pendingAction, setPendingAction] = useState<SwipeAction | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [pairMessage, setPairMessage] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState(defaultCodexThreadId);
  const [promptDraft, setPromptDraft] = useState(defaultCustomPrompt);
  const [planningPrompt, setPlanningPrompt] = useState("");
  const [planningBusy, setPlanningBusy] = useState(false);
  const [modal, setModal] = useState<"connection" | "thread" | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const [lastNotified, setLastNotified] = useState("");
  const activeHandoff = currentHandoff(handoffs);
  const backgroundHandoff = sendingHandoff(handoffs);
  const activeCards = activeHandoff ? parseCards(activeHandoff.cardsJson) : [];
  const activeIndex = activeHandoff
    ? Number.parseInt(activeHandoff.activeCardIndex || "0", 10) || 0
    : 0;
  const activeCard = activeCards[activeIndex];
  const responses = activeHandoff
    ? parseResponses(activeHandoff.responsesJson)
    : backgroundHandoff
      ? parseResponses(backgroundHandoff.responsesJson)
      : [];
  const latestEvent = bridgeEvents[0];
  const connected = Boolean(integration?.connectionId) && !isDisconnected;
  const busy = Boolean(motion || pendingAction || submitting || activeHandoff?.status === "responding_to_codex");

  useEffect(() => {
    if (!auth.isLoading && !hasSeeded && !isDisconnected && handoffs.length === 0) {
      setHasSeeded(true);
      void seedDemo();
    }
  }, [auth.isLoading, handoffs.length, hasSeeded, isDisconnected]);

  useEffect(() => {
    if (integration?.codexThreadId) {
      setThreadDraft(integration.codexThreadId);
    }

    if (integration?.customPrompt) {
      setPromptDraft(integration.customPrompt);
    }
  }, [integration?.codexThreadId, integration?.customPrompt]);

  useEffect(() => {
    if (!activeHandoff || activeHandoff.handoffId === lastNotified) {
      return;
    }

    setLastNotified(activeHandoff.handoffId);

    try {
      navigator.vibrate?.([18, 30, 18]);
    } catch {
      // Vibration is optional.
    }

    if (alertsEnabled && typeof Notification !== "undefined") {
      const card = parseCards(activeHandoff.cardsJson)[0];
      new Notification("JustSwipe needs a response", {
        body: card?.title || activeHandoff.reason,
      });
    }
  }, [activeHandoff?.handoffId, alertsEnabled, lastNotified]);

  function resetDrag() {
    setDragStart(null);
    setDragX(0);
    setDragY(0);
  }

  function onPointerDown(event: PointerEvent) {
    if (busy) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, summary")) return;
    setDragStart({ x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragStart || busy) return;
    setDragX(Math.max(-170, Math.min(170, event.clientX - dragStart.x)));
    setDragY(Math.max(-150, Math.min(150, event.clientY - dragStart.y)));
  }

  async function playFeedback(action: SwipeAction) {
    try {
      navigator.vibrate?.(action === "yes" ? 18 : action === "no" ? [10, 25, 10] : 14);
    } catch {
      // Haptics are best effort.
    }
  }

  async function chooseAction(action: SwipeAction) {
    if (!activeCard || !activeHandoff || busy) return;

    setMotion(action);
    await playFeedback(action);
    await new Promise((resolve) => setTimeout(resolve, 260));

    setPendingAction(action);
    setFormValues({});
    setFormError("");
    setMotion(null);
    resetDrag();
  }

  async function submitResponse(action: SwipeAction, payload: FormValues) {
    if (!activeCard || !activeHandoff || submitting) return;

    setSubmitting(true);
    setFormError("");

    const result = safeResult(
      await submitCardResponse(
        activeHandoff.id,
        activeCard.cardId,
        action,
        JSON.stringify(payload),
      ),
    );

    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error || "Could not submit response.");
      setMotion(null);
      return;
    }

    setToast(result.completed ? "Response sent to Codex" : "Next card ready");
    setPendingAction(null);
    setFormValues({});
    setMotion(null);
    resetDrag();

    setTimeout(() => setToast(""), 1600);
  }

  async function onPointerUp() {
    if (busy) return;

    if (dragX > 96) {
      await chooseAction("yes");
    } else if (dragX < -96) {
      await chooseAction("no");
    } else if (dragY < -90) {
      await chooseAction("more");
    } else if (dragY > 90) {
      await chooseAction("later");
    } else {
      resetDrag();
    }
  }

  async function submitPendingForm() {
    if (!activeCard || !pendingAction) return;

    const missing = requiredMissing(activeCard, pendingAction, formValues);

    if (missing.length > 0) {
      setFormError(`Missing required fields: ${missing.join(", ")}`);
      return;
    }

    await submitResponse(pendingAction, formValues);
  }

  async function createCode() {
    const code = await createPairingCode();
    setPairMessage(`Code created: ${code}`);
  }

  async function pairDevice() {
    const message = await pairWithCode(codeDraft);
    setPairMessage(message);
    if (message.includes("Connected")) {
      setIsDisconnected(false);
      setModal(null);
    }
  }

  async function saveBridge() {
    await saveIntegration(threadDraft || defaultCodexThreadId, promptDraft || defaultCustomPrompt);
    setIsDisconnected(false);
    setToast("Bridge prompt saved");
    setTimeout(() => setToast(""), 1400);
  }

  async function disconnect() {
    await disconnectIntegration();
    setIsDisconnected(true);
    setModal(null);
    setToast("JustSwipe disconnected");
    setTimeout(() => setToast(""), 1400);
  }

  async function startPlanning() {
    const prompt = planningPrompt.trim();

    if (!prompt || planningBusy) {
      return;
    }

    setPlanningBusy(true);
    const result = safeResult(await startPlanningDiscussion(prompt));
    setPlanningBusy(false);

    if (!result.ok) {
      setToast(result.error || "Could not start planning");
      setTimeout(() => setToast(""), 1800);
      return;
    }

    setPlanningPrompt("");
    setToast("Planning prompt sent to Codex");
    setTimeout(() => setToast(""), 1600);
  }

  async function enableAlerts() {
    if (typeof Notification === "undefined") {
      setToast("Browser alerts are not available here");
      return;
    }

    const permission = await Notification.requestPermission();
    setAlertsEnabled(permission === "granted");
  }

  async function reset() {
    await resetDemo();
    setHasSeeded(true);
    setPendingAction(null);
    setMotion(null);
    resetDrag();
  }

  return (
    <main class="min-h-screen overflow-x-hidden bg-[#05080c] text-zinc-100">
      <style>{`
        @keyframes jsw-sent-pulse {
          0% { box-shadow: 0 0 0 rgba(163, 230, 53, 0); }
          35% { box-shadow: 0 0 40px rgba(163, 230, 53, 0.22); }
          100% { box-shadow: 0 0 0 rgba(163, 230, 53, 0); }
        }
        .jsw-sent-pulse { animation: jsw-sent-pulse 900ms ease-out; }
      `}</style>
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6">
        <Header
          alertsEnabled={alertsEnabled}
          connected={connected}
          integration={integration}
          onEnableAlerts={enableAlerts}
          onOpenConnection={() => setModal("connection")}
          onOpenThreadLog={() => setModal("thread")}
          onReset={reset}
        />

        {connected ? (
          <StatusRail
            cards={activeCards}
            handoff={activeHandoff || backgroundHandoff}
            latestEvent={latestEvent}
            responses={responses.length}
          />
        ) : null}

        {connected && activeCard && activeHandoff ? (
          <>
            <SwipeCardView
              card={activeCard}
              dragX={dragX}
              dragY={dragY}
              index={activeIndex}
              motion={motion}
              total={activeCards.length}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            <ActionDock disabled={busy} onAction={(action) => void chooseAction(action)} />
          </>
        ) : connected && backgroundHandoff ? (
          <SentState handoff={backgroundHandoff} latestEvent={latestEvent} />
        ) : (
          <EmptyInbox
            connected={connected}
            latestEvent={latestEvent}
            planningBusy={planningBusy}
            planningPrompt={planningPrompt}
            setPlanningPrompt={setPlanningPrompt}
            onOpenConnection={() => setModal("connection")}
            onStartPlanning={() => void startPlanning()}
          />
        )}
      </div>

      {modal === "connection" ? (
        <Modal title={connected ? "Connection" : "Connect JustSwipe"} onClose={() => setModal(null)}>
          <PairingPanel
            codeDraft={codeDraft}
            integration={integration}
            pairCodes={pairCodes}
            pairMessage={pairMessage}
            promptDraft={promptDraft}
            setCodeDraft={setCodeDraft}
            setPromptDraft={setPromptDraft}
            setThreadDraft={setThreadDraft}
            threadDraft={threadDraft}
            onCreatePairCode={() => void createCode()}
            onDisconnect={() => void disconnect()}
            onPair={() => void pairDevice()}
            onSave={() => void saveBridge()}
          />
        </Modal>
      ) : null}

      {modal === "thread" ? (
        <Modal title="Thread log" onClose={() => setModal(null)}>
          <ThreadLog events={bridgeEvents} />
        </Modal>
      ) : null}

      {pendingAction && activeCard ? (
        <PayloadSheet
          action={pendingAction}
          card={activeCard}
          error={formError}
          submitting={submitting}
          values={formValues}
          onChange={(fieldId, value) =>
            setFormValues((current) => ({
              ...current,
              [fieldId]: value,
            }))
          }
          onClose={() => {
            setPendingAction(null);
            setFormError("");
          }}
          onSubmit={() => void submitPendingForm()}
        />
      ) : null}

      {toast ? (
        <div class="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded border border-cyan-300/30 bg-zinc-950/95 p-4 shadow-2xl shadow-cyan-500/20">
          <p class="text-sm font-semibold text-white">{toast}</p>
        </div>
      ) : null}
    </main>
  );
}
