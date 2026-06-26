import {
  SignInWithGoogle,
  signOut,
  useAuth,
  useMutation,
  useQuery,
} from "lakebed/client";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  brandName,
  brandSymbolDataUri,
  brandThemeColor,
} from "../shared/branding";
import {
  actionLabel,
  actionVerb,
  defaultCodexThreadId,
  defaultCustomPrompt,
  parseCards,
  parseResponses,
  type BridgeHeartbeat,
  type BridgeEvent,
  type CodexThread,
  type CodexThreadStatus,
  type DeviceSessionPayload,
  type Handoff,
  type Integration,
  type PairedDevice,
  type PairingCode,
  type SwipeAction,
  type SwipeCard,
} from "../shared/decision";

type FormValues = Record<string, string | boolean | string[]>;

function upsertHeadLink(rel: string, attributes: Record<string, string>) {
  let element = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function upsertNamedMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function useDocumentBranding() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = brandName;
    upsertHeadLink("icon", { href: brandSymbolDataUri, type: "image/svg+xml" });
    upsertHeadLink("shortcut icon", { href: brandSymbolDataUri, type: "image/svg+xml" });
    upsertHeadLink("apple-touch-icon", { href: brandSymbolDataUri });
    upsertHeadLink("mask-icon", { href: brandSymbolDataUri, color: brandThemeColor });
    upsertNamedMeta("application-name", brandName);
    upsertNamedMeta("apple-mobile-web-app-title", brandName);
    upsertNamedMeta("theme-color", brandThemeColor);
  }, []);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();

  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function hasResponseDraft(values: FormValues): boolean {
  return String(values.quick_reply || "").length > 0 || String(values.custom_response || "").trim().length > 0;
}

function tryVibrate(pattern: VibratePattern) {
  try {
    const nav = navigator as Navigator & {
      userActivation?: { hasBeenActive: boolean };
    };

    if (nav.userActivation && !nav.userActivation.hasBeenActive) {
      return;
    }

    nav.vibrate?.(pattern);
  } catch {
    // Haptics are best effort and should never create console noise.
  }
}

function currentAppUrl(): string {
  if (typeof window === "undefined") {
    return "<app-url>";
  }

  return window.location.origin;
}

function bridgeWatcherCommand(): string {
  return `npm run bridge:watch -- --app-url ${currentAppUrl()} --daemon`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  try {
    const element = document.createElement("textarea");
    element.value = value;
    element.setAttribute("readonly", "true");
    element.style.position = "fixed";
    element.style.left = "-9999px";
    document.body.appendChild(element);
    element.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(element);
    return copied;
  } catch {
    return false;
  }
}

const deviceIdStorageKey = "justswipe.deviceId";

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `dev-${crypto.randomUUID()}`;
  }

  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStableDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = window.localStorage.getItem(deviceIdStorageKey);

    if (existing) {
      return existing;
    }

    const next = createDeviceId();
    window.localStorage.setItem(deviceIdStorageKey, next);
    return next;
  } catch {
    return createDeviceId();
  }
}

function detectBrowser(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";

  return "Browser";
}

function readDeviceSessionPayload(): DeviceSessionPayload {
  if (typeof navigator === "undefined") {
    return {
      deviceId: "",
      label: "Unknown browser",
      browser: "",
      platform: "",
    };
  }

  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const browser = detectBrowser(nav.userAgent || "");
  const platform = nav.userAgentData?.platform || nav.platform || "Unknown device";

  return {
    deviceId: getStableDeviceId(),
    label: `${browser} on ${platform}`,
    browser,
    platform,
  };
}

function compactDeviceMeta(device: PairedDevice): string {
  const parts = [device.browser, device.platform].filter(Boolean);

  if (parts.length === 0) {
    return device.deviceId ? "Browser session" : "Legacy session";
  }

  return parts.join(" on ");
}

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

  if (props.name === "folder") {
    return (
      <svg {...common}>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
      </svg>
    );
  }

  if (props.name === "play") {
    return (
      <svg {...common}>
        <path d="M8 5v14l11-7Z" />
      </svg>
    );
  }

  if (props.name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
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

  if (props.name === "trash") {
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6 18 20H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
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

function BrandSymbol(props: { class?: string }) {
  return (
    <svg
      aria-hidden="true"
      class={props.class || "h-6 w-6"}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="jsw-brand-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8FF3D" />
          <stop offset="48%" stopColor="#45E7A3" />
          <stop offset="100%" stopColor="#00D9FF" />
        </linearGradient>
      </defs>
      <path
        clipRule="evenodd"
        d="M180 70A48 48 0 0 1 228 118v96.575a50 50 0 0 0 0 82.85V394a48 48 0 0 1-96 0V118a48 48 0 0 1 48-48Z"
        fill="#F7F9FB"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M332 70a48 48 0 0 1 48 48v276a48 48 0 0 1-96 0v-96.575a50 50 0 0 0 0-82.85V118a48 48 0 0 1 48-48Z"
        fill="url(#jsw-brand-gradient)"
        fillRule="evenodd"
      />
    </svg>
  );
}

function BrandLogo(props: { class?: string }) {
  return (
    <svg
      aria-label={brandName}
      class={props.class || "h-10 w-40"}
      role="img"
      viewBox="0 0 560 130"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{brandName}</title>
      <defs>
        <linearGradient id="jsw-logo-symbol-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8FF3D" />
          <stop offset="48%" stopColor="#45E7A3" />
          <stop offset="100%" stopColor="#00D9FF" />
        </linearGradient>
        <linearGradient id="jsw-logo-word-gradient" x1="265" y1="0" x2="545" y2="0">
          <stop offset="0%" stopColor="#C8FF3D" />
          <stop offset="46%" stopColor="#45E7A3" />
          <stop offset="100%" stopColor="#00D9FF" />
        </linearGradient>
      </defs>
      <g transform="translate(4 8) scale(0.22)">
        <path
          clipRule="evenodd"
          d="M180 70A48 48 0 0 1 228 118v96.575a50 50 0 0 0 0 82.85V394a48 48 0 0 1-96 0V118a48 48 0 0 1 48-48Z"
          fill="#F7F9FB"
          fillRule="evenodd"
        />
        <path
          clipRule="evenodd"
          d="M332 70a48 48 0 0 1 48 48v276a48 48 0 0 1-96 0v-96.575a50 50 0 0 0 0-82.85V118a48 48 0 0 1 48-48Z"
          fill="url(#jsw-logo-symbol-gradient)"
          fillRule="evenodd"
        />
      </g>
      <text
        fill="#F7F9FB"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="68"
        fontWeight="800"
        letterSpacing="0"
        x="132"
        y="85"
      >
        Just
      </text>
      <text
        fill="url(#jsw-logo-word-gradient)"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="68"
        fontWeight="800"
        letterSpacing="0"
        x="268"
        y="85"
      >
        Swipe
      </text>
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
  if (status === "queued") return "Waiting for Codex";
  if (status === "running") return "Codex working";
  if (status === "sent") return "Codex resumed";
  if (status === "failed") return "Bridge failed";
  return status || "Waiting";
}

function handoffStatusLabel(status: string): string {
  if (status === "awaiting_justswipe") return "Awaiting JustSwipe";
  if (status === "in_progress") return "Clearing bundle";
  if (status === "responding_to_codex") return "Waiting for Codex";
  if (status === "codex_resumed") return "Thread resumed";
  if (status === "failed") return "Bridge failed";
  return status;
}

function threadStatusLabel(status: string): string {
  if (status === "idle") return "Idle";
  if (status === "running") return "Running";
  if (status === "awaiting_justswipe") return "Awaiting JustSwipe";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  return "Unknown";
}

function threadStatusTone(status: string): string {
  if (status === "idle") return "border-teal-300/30 bg-teal-300/10 text-teal-100";
  if (status === "running") return "border-cyan-300/35 bg-cyan-300/10 text-cyan-100";
  if (status === "awaiting_justswipe") return "border-lime-300/35 bg-lime-300/10 text-lime-100";
  if (status === "queued") return "border-yellow-300/35 bg-yellow-300/10 text-yellow-100";
  if (status === "failed") return "border-orange-400/35 bg-orange-400/10 text-orange-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function threadDotTone(status: string): string {
  if (status === "idle") return "bg-teal-300";
  if (status === "running") return "bg-cyan-300 animate-pulse";
  if (status === "awaiting_justswipe") return "bg-lime-300 animate-pulse";
  if (status === "queued") return "bg-yellow-300 animate-pulse";
  if (status === "failed") return "bg-orange-400";
  return "bg-zinc-500";
}

function threadStatusIcon(status: string): string {
  if (status === "running") return "play";
  if (status === "queued") return "clock";
  if (status === "awaiting_justswipe") return "inbox";
  if (status === "failed") return "no";
  return "yes";
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

function defaultQuickReplies(action: SwipeAction): string[] {
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

function quickRepliesForAction(card: SwipeCard, action: SwipeAction): string[] {
  const replies = [...(card.quickRepliesByAction?.[action] || []), ...defaultQuickReplies(action)];
  const unique = new Set<string>();

  for (const reply of replies) {
    const trimmed = reply.trim();

    if (trimmed) {
      unique.add(trimmed);
    }
  }

  return Array.from(unique).slice(0, 4);
}

function safeResult(value: string): { ok: boolean; error?: string; completed?: boolean } {
  try {
    return JSON.parse(value);
  } catch {
    return { ok: false, error: "Unexpected response from JustSwipe." };
  }
}

function mutationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("mutations quota exceeded")) {
    return "Hosted mutation quota is exhausted. Try again after the Lakebed quota resets.";
  }

  return message || "Could not update JustSwipe.";
}

function isFutureIso(value: string): boolean {
  return Boolean(value) && value > new Date().toISOString();
}

function isConnectedIntegration(integration?: Integration): boolean {
  return Boolean(integration?.connectionId && isFutureIso(integration.pairedUntil));
}

function shortId(value: string): string {
  if (!value) return "Not paired";
  if (value.length <= 14) return value;

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatTime(value: string): string {
  if (!value) return "No expiry";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16) || value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAgo(value: string): string {
  if (!value) return "now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16) || "now";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return count === 1 ? singular : pluralValue;
}

function pairLinkForCode(code: string): string {
  if (!code || typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("lakebed_guest");
  url.searchParams.set("justswipe_pair", code);
  return url.toString();
}

function bridgeTone(status: string): string {
  if (status === "failed") return "border-orange-400/35 bg-orange-400/10 text-orange-100";
  if (status === "warning") return "border-orange-300/35 bg-orange-300/10 text-orange-100";
  if (status === "queued" || status === "running" || status === "responding_to_codex") {
    return "border-cyan-300/35 bg-cyan-300/10 text-cyan-100";
  }
  if (status === "awaiting_justswipe" || status === "in_progress") {
    return "border-lime-300/35 bg-lime-300/10 text-lime-100";
  }
  if (status === "connected") return "border-teal-300/35 bg-teal-300/10 text-teal-100";

  return "border-white/10 bg-white/[0.04] text-zinc-200";
}

function iconTone(status: string, connected: boolean): string {
  if (!connected || status === "failed" || status === "warning") {
    return "border-orange-400/40 bg-orange-400/12 text-orange-100 hover:bg-orange-400/20";
  }

  if (status === "queued" || status === "running") {
    return "border-cyan-300/40 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/20";
  }

  if (status === "awaiting_justswipe") {
    return "border-lime-300/40 bg-lime-300/12 text-lime-100 hover:bg-lime-300/20";
  }

  return "border-teal-300/40 bg-teal-300/12 text-teal-100 hover:bg-teal-300/20";
}

function statusDotTone(status: string, connected: boolean): string {
  if (!connected || status === "failed" || status === "warning") return "bg-orange-400";
  if (status === "queued" || status === "running") return "bg-cyan-300 animate-pulse";
  if (status === "awaiting_justswipe") return "bg-lime-300 animate-pulse";
  return "bg-teal-300";
}

function runtimeState(props: {
  connected: boolean;
  handoff?: Handoff;
  latestEvent?: BridgeEvent;
  queuedEvents?: number;
  fixtureProject?: boolean;
}) {
  if (!props.connected) {
    return {
      label: "Not paired",
      detail: "Pair this browser with the local bridge",
      status: "",
    };
  }

  if (props.fixtureProject) {
    return {
      label: "Test project paired",
      detail: "Forget this connection and pair a real repo",
      status: "warning",
    };
  }

  if (props.queuedEvents && props.queuedEvents > 0) {
    return {
      label: "Bridge watcher needed",
      detail: `${props.queuedEvents} ${plural(props.queuedEvents, "packet")} waiting for Codex`,
      status: "warning",
    };
  }

  if (props.handoff?.status === "failed" || props.latestEvent?.status === "failed") {
    return {
      label: "Bridge failed",
      detail: "Response is saved for retry",
      status: "failed",
    };
  }

  if (
    props.handoff?.status === "responding_to_codex" ||
    props.latestEvent?.status === "queued" ||
    props.latestEvent?.status === "running"
  ) {
    return {
      label: props.latestEvent?.status === "running" ? "Codex working" : "Waiting for Codex",
      detail: "Local bridge is relaying work",
      status: "queued",
    };
  }

  if (
    props.handoff?.status === "awaiting_justswipe" ||
    props.handoff?.status === "in_progress"
  ) {
    return {
      label: "Awaiting JustSwipe",
      detail: "One card is ready for this connection",
      status: "awaiting_justswipe",
    };
  }

  return {
    label: "Connected",
    detail: "Cards will appear for this bridge",
    status: "connected",
  };
}

function latestProjectContext(props: {
  integration?: Integration;
  bridgeEvents: BridgeEvent[];
  threads: CodexThread[];
}) {
  const latestEvent = props.bridgeEvents[0];
  const latestThread = props.threads[0];
  const cwd = props.integration?.cwd || latestEvent?.cwd || latestThread?.cwd || "";
  const projectName =
    props.integration?.projectName ||
    latestEvent?.projectName ||
    latestThread?.projectName ||
    (cwd ? cwd.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "Project" : "Project");
  const threadTitle =
    props.integration?.threadTitle ||
    latestEvent?.threadTitle ||
    latestThread?.threadTitle ||
    "";

  return {
    cwd,
    projectName,
    threadTitle,
  };
}

function isFixtureProjectPath(cwd: string): boolean {
  return /[\\\/]\.lakebed[\\\/]e2e-targets?[\\\/]/i.test(cwd);
}

function isFreshBridgeHeartbeat(heartbeat?: BridgeHeartbeat): boolean {
  if (!heartbeat?.lastSeenAt) {
    return false;
  }

  const seenAt = new Date(heartbeat.lastSeenAt).getTime();

  return Number.isFinite(seenAt) && Date.now() - seenAt < 3 * 60_000;
}

function bridgeHealthState(props: {
  connected: boolean;
  integration?: Integration;
  handoff?: Handoff;
  heartbeat?: BridgeHeartbeat;
  bridgeEvents: BridgeEvent[];
  threads: CodexThread[];
}) {
  const queuedEvents = props.bridgeEvents.filter((event) => event.status === "queued").length;
  const runningEvents = props.bridgeEvents.filter((event) => event.status === "running").length;
  const failedEvents = props.bridgeEvents.filter((event) => event.status === "failed").length;
  const context = latestProjectContext({
    integration: props.integration,
    bridgeEvents: props.bridgeEvents,
    threads: props.threads,
  });
  const fixtureProject = isFixtureProjectPath(context.cwd);
  const heartbeatFresh = isFreshBridgeHeartbeat(props.heartbeat);
  const heartbeatAge = props.heartbeat?.lastSeenAt ? formatAgo(props.heartbeat.lastSeenAt) : "";

  if (!props.connected) {
    return {
      status: "",
      label: "Not connected",
      detail: "Pair this browser with the laptop bridge.",
      action: "Open connection and paste a 2-minute pair code.",
      icon: "link",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (fixtureProject) {
    return {
      status: "warning",
      label: "Paired to a test project",
      detail: "This browser is connected to an E2E fixture, not a normal repo.",
      action: "Forget this project, then re-pair from the real repo.",
      icon: "folder",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (queuedEvents > 0) {
    return {
      status: "warning",
      label: "Bridge watcher offline",
      detail: `${queuedEvents} ${plural(queuedEvents, "response")} waiting in hosted JustSwipe.`,
      action: "Start the background watcher for this app URL.",
      icon: "clock",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (failedEvents > 0 || props.handoff?.status === "failed") {
    return {
      status: "failed",
      label: "Bridge needs attention",
      detail: "A relay failed. The response is saved for retry.",
      action: "Open the thread log or run npm run bridge:dry-run:hosted.",
      icon: "log",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (runningEvents > 0 || props.handoff?.status === "responding_to_codex") {
    return {
      status: "running",
      label: "Bridge relaying",
      detail: "The local bridge is sending a response to Codex.",
      action: "The watcher is active. Keep it running while Codex works.",
      icon: "play",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (props.handoff?.status === "awaiting_justswipe" || props.handoff?.status === "in_progress") {
    return {
      status: "awaiting_justswipe",
      label: "Codex is waiting",
      detail: "A card is ready for this connection.",
      action: "Swipe the card or add context.",
      icon: "inbox",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  if (!heartbeatFresh) {
    return {
      status: "warning",
      label: "Bridge not observed",
      detail: props.heartbeat?.lastSeenAt
        ? `Last bridge heartbeat was ${heartbeatAge} ago.`
        : "No bridge watcher heartbeat has reached this connection.",
      action: "Start the background watcher for this app URL.",
      icon: "clock",
      queuedEvents,
      runningEvents,
      failedEvents,
      fixtureProject,
      heartbeatFresh,
      heartbeatAge,
      ...context,
    };
  }

  return {
    status: "connected",
    label: "Bridge online",
    detail: `Watcher heartbeat seen ${heartbeatAge || "now"} ago.`,
    action: "Ideas will queue here and relay when the watcher is active.",
    icon: "link",
    queuedEvents,
    runningEvents,
    failedEvents,
    fixtureProject,
    heartbeatFresh,
    heartbeatAge,
    ...context,
  };
}

function BridgeHealthPanel(props: {
  health: ReturnType<typeof bridgeHealthState>;
  compact?: boolean;
  onForget?: () => void;
  onOpenConnection?: () => void;
}) {
  const showForget = Boolean(props.onForget && props.health.fixtureProject);
  const showWatcherCommand =
    props.health.label === "Bridge watcher offline" ||
    props.health.label === "Bridge not observed";
  const watcherCommand = bridgeWatcherCommand();
  const [copyState, setCopyState] = useState<"" | "copied" | "failed">("");

  return (
    <div class={`rounded border p-3 text-left ${bridgeTone(props.health.status)}`}>
      <div class="flex items-start gap-3">
        <div class="grid h-9 w-9 shrink-0 place-items-center rounded border border-white/10 bg-black/15">
          <Icon name={props.health.icon} class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white">{props.health.label}</p>
              <p class="mt-1 text-xs leading-5 opacity-80">{props.health.detail}</p>
            </div>
            <span class={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotTone(props.health.status, props.health.status !== "")}`} />
          </div>
          <div class="mt-3 grid gap-2 text-xs">
            <div class="min-w-0 rounded border border-white/10 bg-black/15 px-2 py-2">
              <p class="text-zinc-500">Project</p>
              <p class="mt-1 truncate font-medium text-zinc-100">{props.health.projectName || "Unknown project"}</p>
              {props.health.cwd ? (
                <p class="mt-1 truncate text-zinc-500">{props.health.cwd}</p>
              ) : null}
            </div>
            {!props.compact ? (
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded border border-white/10 bg-black/15 px-2 py-2">
                  <p class="text-zinc-500">Waiting</p>
                  <p class="mt-1 font-semibold text-white">{props.health.queuedEvents}</p>
                </div>
                <div class="rounded border border-white/10 bg-black/15 px-2 py-2">
                  <p class="text-zinc-500">Relaying</p>
                  <p class="mt-1 font-semibold text-white">{props.health.runningEvents}</p>
                </div>
                <div class="rounded border border-white/10 bg-black/15 px-2 py-2">
                  <p class="text-zinc-500">Failed</p>
                  <p class="mt-1 font-semibold text-white">{props.health.failedEvents}</p>
                </div>
              </div>
            ) : null}
            {props.health.heartbeatAge ? (
              <div class="rounded border border-white/10 bg-black/15 px-2 py-2">
                <p class="text-zinc-500">Bridge heartbeat</p>
                <p class="mt-1 font-medium text-zinc-100">
                  {props.health.heartbeatFresh ? "Online" : "Stale"} · {props.health.heartbeatAge}
                </p>
              </div>
            ) : null}
            <p class="text-xs leading-5 opacity-80">{props.health.action}</p>
            {showWatcherCommand ? (
              <div class="rounded border border-orange-300/20 bg-black/20 p-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-100/80">
                    Start watcher
                  </p>
                  <button
                    class="h-7 rounded border border-orange-300/30 bg-orange-300/10 px-2 text-[11px] font-semibold text-orange-50 transition hover:bg-orange-300/20"
                    type="button"
                    onClick={async () => {
                      const copied = await copyText(watcherCommand);
                      setCopyState(copied ? "copied" : "failed");
                      window.setTimeout(() => setCopyState(""), 1600);
                    }}
                  >
                    {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy command"}
                  </button>
                </div>
                <code class="mt-2 block break-all rounded border border-white/10 bg-black/30 px-2 py-2 font-mono text-[11px] leading-5 text-zinc-200">
                  {watcherCommand}
                </code>
              </div>
            ) : null}
          </div>
          {showForget || props.onOpenConnection ? (
            <div class="mt-3 flex flex-wrap gap-2">
              {showForget ? (
                <button
                  class="h-8 rounded border border-orange-300/35 bg-orange-300/10 px-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-300/20"
                  type="button"
                  onClick={props.onForget}
                >
                  Forget project
                </button>
              ) : null}
              {props.onOpenConnection ? (
                <button
                  class="h-8 rounded border border-white/10 bg-black/15 px-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/10"
                  type="button"
                  onClick={props.onOpenConnection}
                >
                  Connection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BrowserSessionList(props: {
  devices: PairedDevice[];
  compact?: boolean;
  onRevoke: (sessionId: string) => void;
  onCleanDuplicates: () => void;
  onConfirmingChange?: (confirming: boolean) => void;
}) {
  const hasDuplicates = props.devices.some((device) => device.isDuplicate);
  const [confirmingSessionId, setConfirmingSessionId] = useState("");

  useEffect(() => {
    if (
      confirmingSessionId &&
      !props.devices.some((device) => device.sessionId === confirmingSessionId)
    ) {
      setConfirmingSessionId("");
      props.onConfirmingChange?.(false);
    }
  }, [confirmingSessionId, props.devices, props.onConfirmingChange]);

  if (props.devices.length === 0) {
    return (
      <p class="rounded border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-400">
        No active paired browsers.
      </p>
    );
  }

  return (
    <div class="grid gap-2">
      {props.devices.map((device) => {
        const confirming = confirmingSessionId === device.sessionId;

        return (
          <div
            key={device.sessionId}
            class={`group flex items-center justify-between gap-2 rounded border border-white/10 bg-black/15 ${
              props.compact ? "px-2 py-2" : "px-3 py-2.5"
            }`}
          >
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <p class="truncate text-sm font-medium text-white">{device.label}</p>
                {device.isCurrent ? (
                  <span class="shrink-0 rounded border border-teal-300/30 bg-teal-300/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-100">
                    Current
                  </span>
                ) : null}
                {device.isDuplicate ? (
                  <span class="shrink-0 rounded border border-orange-300/30 bg-orange-300/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-100">
                    Duplicate
                  </span>
                ) : null}
              </div>
              <p class="mt-0.5 truncate text-xs text-zinc-500">
                {compactDeviceMeta(device)} · last seen {formatTime(device.lastSeenAt)}
              </p>
              {!props.compact ? (
                <p class="mt-0.5 truncate text-xs text-zinc-600">
                  Thread {shortId(device.threadId)} · paired {formatTime(device.pairedAt)}
                </p>
              ) : null}
            </div>
            {device.isCurrent ? (
              <span class="shrink-0 text-xs text-zinc-500">
                {formatTime(device.pairedUntil)}
              </span>
            ) : confirming ? (
              <div class="flex shrink-0 items-center gap-1">
                <button
                  class="h-8 rounded border border-white/10 px-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingSessionId("");
                    props.onConfirmingChange?.(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  class="h-8 rounded border border-orange-400/30 bg-orange-400/15 px-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-400/25"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingSessionId("");
                    props.onConfirmingChange?.(false);
                    props.onRevoke(device.sessionId);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                class="grid h-8 w-8 shrink-0 place-items-center rounded border border-orange-400/25 bg-orange-400/10 text-orange-100 opacity-100 transition hover:bg-orange-400/20 focus:opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                aria-label={`Remove ${device.label}`}
                title={`Remove ${device.label}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onConfirmingChange?.(true);
                  setConfirmingSessionId(device.sessionId);
                }}
              >
                <Icon name="trash" class="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
      {hasDuplicates ? (
        <button
          class="h-8 rounded border border-orange-300/30 bg-orange-300/10 px-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-300/20"
          type="button"
          onClick={props.onCleanDuplicates}
        >
          Clean duplicates
        </button>
      ) : null}
    </div>
  );
}

function Header(props: {
  integration?: Integration;
  pairedDevices: PairedDevice[];
  pairCodes: PairingCode[];
  codeDraft: string;
  setCodeDraft: (value: string) => void;
  pairMessage: string;
  connectionMenuOpen: boolean;
  state: ReturnType<typeof runtimeState>;
  health: ReturnType<typeof bridgeHealthState>;
  onReset: () => void;
  onEnableAlerts: () => void;
  onToggleConnection: () => void;
  onOpenConnection: () => void;
  onCloseConnection: () => void;
  onCreatePairCode: () => void;
  onPair: () => void;
  onOpenAdvanced: () => void;
  onDisconnect: () => void;
  onOpenThreadLog: () => void;
  onForgetProject: () => void;
  onRevokePairedDevice: (sessionId: string) => void;
  onCleanDuplicateDevices: () => void;
  alertsEnabled: boolean;
  connected: boolean;
}) {
  const auth = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const removeConfirming = useRef(false);
  const latestCode = props.pairCodes[0];
  const latestPairLink = latestCode ? pairLinkForCode(latestCode.code) : "";
  const deviceCount = props.pairedDevices.length;

  useEffect(() => {
    if (!props.connectionMenuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        props.onCloseConnection();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [props.connectionMenuOpen, props.onCloseConnection]);

  useEffect(() => {
    if (!props.connectionMenuOpen) {
      removeConfirming.current = false;
    }
  }, [props.connectionMenuOpen]);

  function clearHoverTimer() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  function openAfterHover() {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(props.onOpenConnection, 260);
  }

  function closeAfterHover() {
    clearHoverTimer();
    if (removeConfirming.current) {
      return;
    }

    hoverTimer.current = window.setTimeout(props.onCloseConnection, 280);
  }

  return (
    <header class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 border-b border-white/10 pb-4">
      <div class="flex min-w-0 items-center">
        <BrandLogo class="h-10 w-[min(34vw,180px)] min-w-[104px] max-w-[180px] sm:h-11 sm:w-[210px] sm:max-w-[210px]" />
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          class={`grid h-10 w-10 shrink-0 place-items-center rounded border text-sm transition ${
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
        <div
          ref={menuRef}
          class="relative"
          onMouseEnter={openAfterHover}
          onMouseLeave={closeAfterHover}
        >
          <button
            class={`relative grid h-10 w-10 shrink-0 place-items-center rounded border text-sm transition ${iconTone(props.state.status, props.connected)}`}
            aria-expanded={props.connectionMenuOpen}
            aria-haspopup="menu"
            aria-label={props.connected ? props.state.label : "Connect JustSwipe"}
            type="button"
            title={props.connected ? props.state.label : "Connect JustSwipe"}
            onClick={() => {
              clearHoverTimer();
              props.onToggleConnection();
            }}
          >
            <Icon name="link" class="h-4 w-4" />
            <span
              class={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#05080c] ${statusDotTone(props.state.status, props.connected)}`}
            />
          </button>
          {props.connectionMenuOpen ? (
            <>
              <div
                class="fixed inset-0 z-30 sm:hidden"
                onClick={(event) => {
                  event.preventDefault();
                  clearHoverTimer();
                  props.onCloseConnection();
                }}
              />
              <section
                class="fixed left-3 right-3 top-20 z-40 max-h-[78vh] overflow-auto rounded border border-white/10 bg-[#080d12]/98 p-3 text-left shadow-2xl shadow-black/70 backdrop-blur sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(88vw,380px)]"
                role="menu"
              >
              <div class={`rounded border p-3 ${bridgeTone(props.state.status)}`}>
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                      Connection
                    </p>
                    <div class="mt-1 flex items-center gap-2">
                      <span class={`h-2.5 w-2.5 rounded-full ${statusDotTone(props.state.status, props.connected)}`} />
                      <p class="truncate text-sm font-semibold text-white">{props.state.label}</p>
                    </div>
                    <p class="mt-1 truncate text-xs opacity-75">{props.state.detail}</p>
                  </div>
                  <span class="rounded border border-white/10 bg-black/15 px-2 py-1 text-xs text-zinc-100">
                    {deviceCount} {plural(deviceCount, "browser", "browsers")}
                  </span>
                </div>
              </div>

              <div class="mt-3">
                <BridgeHealthPanel
                  compact
                  health={props.health}
                  onForget={props.onForgetProject}
                  onOpenConnection={props.onOpenAdvanced}
                />
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="min-w-0 rounded border border-white/10 bg-black/15 px-2 py-2">
                  <p class="text-zinc-500">ID</p>
                  <p class="mt-1 truncate font-medium text-zinc-100">
                    {shortId(props.integration?.connectionId || "")}
                  </p>
                </div>
                <div class="min-w-0 rounded border border-white/10 bg-black/15 px-2 py-2">
                  <p class="text-zinc-500">Thread</p>
                  <p class="mt-1 truncate font-medium text-zinc-100">
                    {shortId(props.integration?.codexThreadId || "")}
                  </p>
                </div>
              </div>

              <div class="mt-3 rounded border border-white/10 bg-black/10 p-2">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    Browsers
                  </p>
                  <span class="text-xs text-zinc-500">
                    {deviceCount} active
                  </span>
                </div>
                <BrowserSessionList
                  compact
                  devices={props.pairedDevices}
                  onCleanDuplicates={() => {
                    clearHoverTimer();
                    props.onCleanDuplicateDevices();
                  }}
                  onConfirmingChange={(confirming) => {
                    removeConfirming.current = confirming;
                    if (confirming) {
                      clearHoverTimer();
                    }
                  }}
                  onRevoke={(sessionId) => {
                    clearHoverTimer();
                    props.onRevokePairedDevice(sessionId);
                  }}
                />
              </div>

              {latestCode ? (
                <div class="mt-3 rounded border border-lime-300/25 bg-lime-300/8 p-2">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-100">
                      Pair code
                    </p>
                    <p class="text-xs text-zinc-500">{formatTime(latestCode.expiresAt)}</p>
                  </div>
                  <p class="mt-1 text-lg font-semibold tracking-[0.12em] text-white">{latestCode.code}</p>
                  {latestPairLink ? (
                    <input
                      class="mt-2 h-8 w-full rounded border border-white/10 bg-black/20 px-2 text-xs text-zinc-300 outline-none"
                      readOnly
                      value={latestPairLink}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  ) : null}
                </div>
              ) : null}

              <div class="mt-3 grid grid-cols-2 gap-2">
                <button
                  class="h-9 rounded bg-cyan-300 px-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-200"
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    props.onCreatePairCode();
                  }}
                >
                  Add browser
                </button>
                <button
                  class="h-9 rounded border border-white/10 px-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    props.onOpenThreadLog();
                  }}
                >
                  Thread log
                </button>
              </div>
              <div class="mt-2 flex gap-2">
                <input
                  class="h-9 min-w-0 flex-1 rounded border border-white/10 bg-[#05080c] px-2 text-xs uppercase text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
                  placeholder="ABC-123"
                  value={props.codeDraft}
                  onInput={(event) => props.setCodeDraft(event.currentTarget.value)}
                />
                <button
                  class="rounded border border-white/10 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    props.onPair();
                  }}
                >
                  Pair
                </button>
              </div>
              {props.pairMessage ? (
                <p class="mt-2 truncate text-xs text-zinc-400">{props.pairMessage}</p>
              ) : null}
              <div class="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <button
                  class="h-9 rounded border border-cyan-300/30 bg-cyan-300/10 px-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    props.onOpenAdvanced();
                  }}
                >
                  Advanced
                </button>
                <button
                  class="h-9 rounded border border-orange-400/30 bg-orange-400/10 px-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-400/20 disabled:opacity-40"
                  disabled={!props.integration?.connectionId}
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    props.onDisconnect();
                  }}
                >
                  Disconnect
                </button>
              </div>
              </section>
            </>
          ) : null}
        </div>
        <button
          class="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-white/5 text-sm text-zinc-300 transition hover:bg-white/10"
          type="button"
          title="Thread log"
          onClick={props.onOpenThreadLog}
        >
          <Icon name="log" class="h-4 w-4" />
        </button>
        <button
          class="hidden h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-white/5 text-sm text-zinc-300 transition hover:bg-white/10 sm:grid"
          type="button"
          title="Reset demo"
          onClick={props.onReset}
        >
          <Icon name="inbox" class="h-4 w-4" />
        </button>
        {!auth.isLoading && auth.isGuest ? (
          <div class="hidden sm:block">
            <SignInWithGoogle />
          </div>
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

function DeckBar(props: {
  handoff?: Handoff;
  cards: SwipeCard[];
  responses: number;
  latestEvent?: BridgeEvent;
}) {
  const total = Math.max(props.cards.length, 1);
  const active = props.handoff
    ? Math.min(Number.parseInt(props.handoff.activeCardIndex || "0", 10) + 1, total)
    : 0;

  const label = props.handoff
    ? handoffStatusLabel(props.handoff.status)
    : bridgeStatusLabel(props.latestEvent?.status || "");

  return (
    <section class="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-white">
          {props.handoff ? `Card ${active} of ${total}` : "No cards waiting"}
        </p>
        <p class="mt-0.5 truncate text-xs text-zinc-500">
          {props.handoff?.threadTitle ? `${props.handoff.projectName || "Project"} · ${props.handoff.threadTitle} · ` : ""}
          {label}
          {props.responses ? ` · ${props.responses} sent` : ""}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1" aria-label={`Card ${active} of ${total}`}>
        {Array.from({ length: total }).map((_, index) => (
          <span
            class={`h-2 rounded-full transition-all ${
              index + 1 === active
                ? "w-6 bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
                : index + 1 < active
                  ? "w-2 bg-lime-300"
                  : "w-2 bg-white/15"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function extractAgentContent(html: string) {
  if (!html.trim()) {
    return {
      title: "",
      description: "",
      bullets: [] as string[],
      actions: [] as string[],
    };
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
    const bullets = Array.from(doc.querySelectorAll("li"))
      .map((node) => node.textContent?.trim().replace(/\s+/g, " "))
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);
    const actions = Array.from(doc.querySelectorAll("button,.yes,.no,.tag,.pill"))
      .map((node) => node.textContent?.trim().replace(/\s+/g, " "))
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    return { title, description, bullets, actions };
  } catch {
    return {
      title: "",
      description: "",
      bullets: [] as string[],
      actions: [] as string[],
    };
  }
}

function DecisionContext(props: { card: SwipeCard }) {
  const preview = extractAgentContent(props.card.agentHtmlPreview);
  const contextItems = props.card.visualContext
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const title = preview.title || "Context";
  const description = preview.description || props.card.visualContext;
  const bullets = preview.bullets.length ? preview.bullets : contextItems.slice(0, 4);

  return (
    <section class="mt-6 rounded border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded bg-cyan-300/15 text-cyan-100">
          <Icon name="inbox" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            What Codex is showing
          </p>
          <h3 class="mt-2 text-lg font-semibold leading-snug text-white">{title}</h3>
          <p class="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
        </div>
      </div>

      {bullets.length ? (
        <div class="mt-4 grid gap-2">
          {bullets.map((item) => (
            <div class="flex items-start gap-2 text-sm leading-5 text-zinc-200">
              <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded bg-cyan-300" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}

      {preview.actions.length ? (
        <div class="mt-4 flex flex-wrap gap-2">
          {preview.actions.map((action) => (
            <span class="rounded border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-zinc-200">
              {action}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function visualCueItems(card: SwipeCard): { label: string; value: string }[] {
  return card.visualContext
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf(":");

      if (separator === -1) {
        return { label: "Context", value: item };
      }

      return {
        label: item.slice(0, separator).trim(),
        value: item.slice(separator + 1).trim(),
      };
    })
    .filter((item) => item.value)
    .slice(0, 3);
}

function SwipeCardView(props: {
  card: SwipeCard;
  handoff: Handoff;
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
  const cues = visualCueItems(props.card);

  return (
    <section class="relative mx-auto w-full max-w-2xl">
      <article
        class={`relative min-h-[min(72vh,560px)] touch-none overflow-hidden rounded border bg-[#080d12] p-4 shadow-2xl transition-all duration-300 sm:p-5 ${glow} jsw-card-enter`}
        style={{ transform }}
        onPointerDown={props.onPointerDown}
        onPointerMove={props.onPointerMove}
        onPointerUp={props.onPointerUp}
        onPointerCancel={props.onPointerUp}
      >
        <div class="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between">
          <span class="min-w-0 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
            <span class="hidden sm:inline">{props.handoff.projectName || "Project"} · </span>
            {props.handoff.threadTitle || "Codex thread"}
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

        <div class="pt-14 sm:pt-16">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            {props.handoff.projectName || "Project"} handoff
          </p>
          <h2 class="mt-3 text-2xl font-semibold leading-tight text-white sm:mt-4 sm:text-4xl">
            {props.card.title}
          </h2>
          <p class="mt-3 text-base leading-7 text-zinc-300 sm:mt-4">
            {props.card.summary}
          </p>
        </div>

        <div class="mt-5 grid gap-2">
          <div class="rounded border border-lime-300/25 bg-lime-300/[0.08] p-3">
            <div class="flex items-center gap-2">
              <Icon name={props.card.recommendedAction} class="h-4 w-4 text-lime-200" />
              <p class="text-sm font-medium text-white">
                {actionLabel(props.card.recommendedAction)} / {actionVerb(props.card.recommendedAction)}
              </p>
            </div>
            <p class="mt-1 text-xs leading-5 text-lime-100/70">
              Swipe, then pick one short reply.
            </p>
          </div>
          {cues.length ? (
            <div class="grid gap-2 sm:grid-cols-3">
              {cues.map((cue) => (
                <div class="min-w-0 rounded border border-white/10 bg-white/[0.03] p-2.5">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {cue.label}
                  </p>
                  <p class="mt-1 text-sm leading-5 text-zinc-200">{cue.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DecisionContext card={props.card} />

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
  const lastActivationAt = useRef(0);
  const actions: SwipeAction[] = ["no", "yes", "more", "later"];
  const shortcuts: Record<SwipeAction, string> = {
    yes: "Y / ArrowRight",
    no: "N / ArrowLeft",
    more: "M / ArrowUp",
    later: "L / ArrowDown",
  };

  function activate(action: SwipeAction, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (props.disabled) return;

    const now = Date.now();
    if (now - lastActivationAt.current < 350) return;

    lastActivationAt.current = now;
    props.onAction(action);
  }

  return (
    <div class="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-2xl grid-cols-4 gap-2 border-t border-white/10 bg-[#05080c]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur sm:bottom-4 sm:rounded sm:border">
      {actions.map((action) => (
        <button
          class={`grid h-14 place-items-center rounded border text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40 ${
            action === "yes" ? actionSolid(action) : actionTone(action)
          }`}
          disabled={props.disabled}
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => activate(action, event)}
          onClick={(event) => activate(action, event)}
          title={`${actionLabel(action)} / ${actionVerb(action)} (${shortcuts[action]})`}
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
  onQuickSubmit: (reply: string) => void;
  onSubmit: () => void;
}) {
  const quickReplies = quickRepliesForAction(props.card, props.action);
  const selectedQuickReply = String(props.values.quick_reply || "");
  const customResponse = String(props.values.custom_response || "");
  const optionalNote = String(props.values.optional_note || "");
  const writingCustom = props.values.answer_mode === "custom" || customResponse.length > 0;
  const showingNote = props.values.show_note === true || optionalNote.trim().length > 0;
  const hasAnswer = hasResponseDraft(props.values);

  return (
    <section
      class="fixed inset-0 z-40 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !props.submitting) {
          props.onClose();
        }
      }}
    >
      <div
        class="jsw-sheet-rise max-h-[92vh] w-full max-w-xl overflow-auto rounded-t border border-white/10 bg-[#080d12] p-4 shadow-2xl shadow-black/70 sm:max-h-[86vh] sm:rounded"
        onClick={(event) => event.stopPropagation()}
      >
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
                disabled={props.submitting}
                type="button"
                onClick={() => {
                  props.onQuickSubmit(reply);
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
            {showingNote ? (
              <label class="mt-3 grid gap-2">
                <span class="text-xs text-zinc-500">Extra detail</span>
                <textarea
                  class="min-h-16 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
                  placeholder="Only add what changes Codex's next step."
                  value={optionalNote}
                  onInput={(event) => props.onChange("optional_note", event.currentTarget.value)}
                />
              </label>
            ) : (
              <button
                class="mt-3 inline-flex h-10 items-center gap-2 rounded border border-white/10 bg-black/15 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                type="button"
                onClick={() => props.onChange("show_note", true)}
              >
                <Icon name="more" class="h-4 w-4" />
                Add detail
              </button>
            )}
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

type ThreadTableRow = {
  key: string;
  threadId: string;
  title: string;
  status: CodexThreadStatus;
  projectName: string;
  cwd: string;
  lastActivityAt: string;
  pendingCards: number;
  pendingIdeas: number;
  synthetic: boolean;
};

function numberValue(value: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function threadRows(threads: CodexThread[], events: BridgeEvent[]): ThreadTableRow[] {
  const activeEvents = events.filter((event) =>
    ["queued", "running"].includes(event.status),
  );
  const latestEventByThread = new Map<string, BridgeEvent>();

  for (const event of activeEvents) {
    if (event.threadId && !latestEventByThread.has(event.threadId)) {
      latestEventByThread.set(event.threadId, event);
    }
  }

  const rows: ThreadTableRow[] = threads.map((thread) => {
    const event = latestEventByThread.get(thread.threadId);
    const status = (event?.threadStatus || event?.status || thread.threadStatus || "unknown") as CodexThreadStatus;
    const pendingIdeas = activeEvents.filter(
      (item) => item.threadId === thread.threadId && item.action.includes("idea"),
    ).length;

    return {
      key: thread.id || thread.threadId,
      threadId: thread.threadId,
      title: thread.threadTitle || shortId(thread.threadId),
      status,
      projectName: thread.projectName || event?.projectName || "Project",
      cwd: thread.cwd || event?.cwd || "",
      lastActivityAt: event?.updatedAt || event?.createdAt || thread.lastActivityAt || thread.updatedAt,
      pendingCards: numberValue(thread.pendingCards),
      pendingIdeas: Math.max(numberValue(thread.pendingIdeas), pendingIdeas),
      synthetic: false,
    };
  });

  for (const event of activeEvents) {
    if (event.threadId || !event.action.includes("new_thread")) {
      continue;
    }

    rows.unshift({
      key: event.id,
      threadId: "",
      title: event.title || "New thread idea",
      status: (event.threadStatus || event.status || "queued") as CodexThreadStatus,
      projectName: event.projectName || "Project",
      cwd: event.cwd || "",
      lastActivityAt: event.updatedAt || event.createdAt,
      pendingCards: 0,
      pendingIdeas: 1,
      synthetic: true,
    });
  }

  return rows.slice(0, 8);
}

function ThreadTable(props: {
  threads: CodexThread[];
  events: BridgeEvent[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
}) {
  const rows = threadRows(props.threads, props.events);

  if (rows.length === 0) {
    return (
      <div class="mt-4 rounded border border-white/10 bg-black/15 p-3 text-left">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Threads
        </p>
        <p class="mt-2 text-sm text-zinc-400">
          No project threads yet. Send an idea to start the first one.
        </p>
      </div>
    );
  }

  return (
    <div class="mt-4 rounded border border-white/10 bg-black/15 p-3 text-left">
      <div class="mb-2 flex items-center justify-between gap-3">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Threads
        </p>
        <span class="text-xs text-zinc-500">{rows.length} visible</span>
      </div>
      <div class="grid gap-2">
        {rows.map((row) => {
          const selected = props.selectedThreadId === row.threadId && Boolean(row.threadId);
          const detail = [
            row.projectName,
            row.pendingCards ? `${row.pendingCards} cards` : "",
            row.pendingIdeas ? `${row.pendingIdeas} ideas` : "",
            row.lastActivityAt ? formatAgo(row.lastActivityAt) : "",
          ].filter(Boolean).join(" · ");

          return (
            <div
              key={row.key}
              class={`grid gap-2 rounded border p-3 sm:grid-cols-[1fr_auto] sm:items-center ${
                selected
                  ? "border-cyan-300/40 bg-cyan-300/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span class={`h-2.5 w-2.5 shrink-0 rounded-full ${threadDotTone(row.status)}`} />
                  <p class="truncate text-sm font-medium text-white">{row.title}</p>
                </div>
                <p class="mt-1 truncate text-xs text-zinc-500">{detail}</p>
              </div>
              <div class="flex items-center justify-between gap-2 sm:justify-end">
                <span class={`inline-flex h-8 items-center gap-1.5 rounded border px-2 text-xs ${threadStatusTone(row.status)}`}>
                  <Icon name={threadStatusIcon(row.status)} class="h-3.5 w-3.5" />
                  {threadStatusLabel(row.status)}
                </span>
                {row.threadId ? (
                  <button
                    class="h-8 rounded border border-white/10 px-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                    type="button"
                    onClick={() => props.onSelectThread(row.threadId)}
                  >
                    {selected ? "Selected" : "Use"}
                  </button>
                ) : (
                  <span class="h-8 rounded border border-white/10 px-2 py-2 text-xs text-zinc-500">
                    pending
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyInbox(props: {
  connected: boolean;
  planningPrompt: string;
  planningBusy: boolean;
  health: ReturnType<typeof bridgeHealthState>;
  latestEvent?: BridgeEvent;
  bridgeEvents: BridgeEvent[];
  threads: CodexThread[];
  selectedThreadId: string;
  setPlanningPrompt: (value: string) => void;
  setSelectedThreadId: (value: string) => void;
  onStartPlanning: () => void;
  onOpenConnection: () => void;
  onForgetProject: () => void;
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
          Drop an idea into this project. JustSwipe starts a new Codex thread by default, or you can route it to an existing one.
        </p>
        {props.health.status === "warning" || props.health.status === "failed" ? (
          <div class="mt-5">
            <BridgeHealthPanel
              health={props.health}
              onForget={props.onForgetProject}
              onOpenConnection={props.onOpenConnection}
            />
          </div>
        ) : (
          <div class="mt-5">
            <BridgeHealthPanel compact health={props.health} onOpenConnection={props.onOpenConnection} />
          </div>
        )}
        <div class="mt-5 rounded border border-white/10 bg-[#080d12] p-3 text-left">
          <label class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Send an idea to Codex
          </label>
          <textarea
            class="mt-3 min-h-24 w-full resize-none rounded border border-white/10 bg-[#05080c] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/70"
            placeholder="Spit out an idea. Codex can run with it or come back with swipe cards."
            value={props.planningPrompt}
            onInput={(event) => props.setPlanningPrompt(event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                props.onStartPlanning();
              }
            }}
          />
          <label class="mt-3 grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Target
            </span>
            <select
              class="h-10 w-full rounded border border-white/10 bg-[#05080c] px-3 text-sm text-white outline-none focus:border-cyan-300/70"
              value={props.selectedThreadId}
              onInput={(event) => props.setSelectedThreadId(event.currentTarget.value)}
              onChange={(event) => props.setSelectedThreadId(event.currentTarget.value)}
            >
              <option value="">New Codex thread</option>
              {props.threads.map((thread) => (
                <option value={thread.threadId}>
                  {thread.threadTitle || shortId(thread.threadId)}
                </option>
              ))}
            </select>
          </label>
          <button
            class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-cyan-300 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:opacity-40"
            disabled={props.planningBusy || !props.planningPrompt.trim()}
            type="button"
            onClick={props.onStartPlanning}
          >
            <Icon name="send" class="h-4 w-4" />
            {props.planningBusy
              ? "Sending..."
              : props.selectedThreadId
                ? "Send to selected thread"
                : "Start new thread"}
          </button>
        </div>
        <ThreadTable
          events={props.bridgeEvents}
          selectedThreadId={props.selectedThreadId}
          threads={props.threads}
          onSelectThread={props.setSelectedThreadId}
        />
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
          <p class="mt-2 truncate text-sm font-medium text-white">
            {props.latestEvent?.projectName || props.handoff.projectName || "Project"} · {props.latestEvent?.threadTitle || props.handoff.threadTitle || "Codex thread"}
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
    <section
      class="fixed inset-0 z-50 grid place-items-end bg-black/65 p-0 sm:place-items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div
        class="jsw-sheet-rise max-h-[88vh] w-full max-w-2xl overflow-auto rounded-t border border-white/10 bg-[#080d12] p-4 shadow-2xl shadow-black/70 sm:rounded"
        onClick={(event) => event.stopPropagation()}
      >
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
  connected: boolean;
  pairCodes: PairingCode[];
  pairedDevices: PairedDevice[];
  health: ReturnType<typeof bridgeHealthState>;
  latestEvent?: BridgeEvent;
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
  onForgetProject: () => void;
  onRevokePairedDevice: (sessionId: string) => void;
  onCleanDuplicateDevices: () => void;
}) {
  const latestCode = props.pairCodes[0];
  const latestPairLink = latestCode ? pairLinkForCode(latestCode.code) : "";
  const state = runtimeState({
    connected: props.connected,
    latestEvent: props.latestEvent,
  });

  return (
    <div class="grid gap-3">
      <BridgeHealthPanel health={props.health} onForget={props.onForgetProject} />
      <div class={`rounded border p-3 ${bridgeTone(state.status)}`}>
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
              Current browser
            </p>
            <p class="mt-1 text-sm font-semibold text-white">{state.label}</p>
            <p class="mt-1 truncate text-xs opacity-75">
              {shortId(props.integration?.connectionId || "")}
            </p>
          </div>
          <span class="rounded border border-white/10 bg-black/15 px-2 py-1 text-xs text-zinc-100">
            {props.connected ? `until ${formatTime(props.integration?.pairedUntil || "")}` : "not paired"}
          </span>
        </div>
        {props.connected ? (
          <div class="mt-3 grid gap-2">
            <BrowserSessionList
              devices={props.pairedDevices}
              onCleanDuplicates={props.onCleanDuplicateDevices}
              onRevoke={props.onRevokePairedDevice}
            />
          </div>
        ) : null}
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded border border-white/10 bg-[#080d12] p-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Add browser
          </p>
          <p class="mt-2 text-xs leading-5 text-zinc-500">
            Code lasts 2 minutes. Every browser joins this connection for today.
          </p>
          <button
            class="mt-3 h-10 w-full rounded bg-cyan-300 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
            type="button"
            onClick={props.onCreatePairCode}
          >
            Create add-device code
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
                Usable until {formatTime(latestCode.expiresAt)}
              </p>
              {latestPairLink ? (
                <input
                  class="mt-3 h-9 w-full rounded border border-white/10 bg-black/20 px-2 text-xs text-zinc-200 outline-none"
                  readOnly
                  value={latestPairLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
              ) : null}
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
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                props.onSave();
              }
            }}
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
          {props.integration?.connectionId ? (
            <button
              class="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-orange-300/30 bg-orange-300/10 text-sm font-semibold text-orange-100 transition hover:bg-orange-300/20"
              type="button"
              onClick={props.onForgetProject}
            >
              <Icon name="trash" class="h-4 w-4" />
              Forget project and re-pair
            </button>
          ) : null}
        </div>
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
              <p class="mt-1 truncate text-xs text-zinc-500">
                {latest.projectName || "Project"} · {latest.threadTitle || shortId(latest.threadId)} · {latest.handoffId}
              </p>
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
  useDocumentBranding();

  const handoffs = (useQuery("activeHandoffs") || []) as Handoff[];
  const bridgeEvents = (useQuery("bridgeEvents") || []) as BridgeEvent[];
  const integration = useQuery("integration") as Integration | undefined;
  const bridgeHeartbeat = useQuery("bridgeHeartbeat") as BridgeHeartbeat | undefined;
  const pairCodes = (useQuery("pairingCodes") || []) as PairingCode[];
  const pairedDevices = (useQuery("pairedDevices") || []) as PairedDevice[];
  const codexThreads = (useQuery("codexThreads") || []) as CodexThread[];
  const resetDemo = useMutation<[], void>("resetDemo");
  const createPairingCode = useMutation<[deviceJson?: string], string>("createPairingCode");
  const pairWithCode = useMutation<[code: string, deviceJson?: string], string>("pairWithCode");
  const revokePairedDevice = useMutation<[sessionId: string], string>("revokePairedDevice");
  const cleanDuplicateDevices = useMutation<[], string>("cleanDuplicateDevices");
  const saveIntegration = useMutation<
    [threadId: string, customPrompt: string],
    void
  >("saveIntegration");
  const disconnectIntegration = useMutation<[], void>("disconnectIntegration");
  const forgetProjectConnection = useMutation<[], string>("forgetProjectConnection");
  const startPlanningDiscussion = useMutation<[prompt: string, targetThreadId: string, route: string], string>(
    "startPlanningDiscussion",
  );
  const submitCardResponse = useMutation<
    [handoffRowId: string, cardId: string, action: string, payloadJson: string],
    string
  >("submitCardResponse");
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
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [planningBusy, setPlanningBusy] = useState(false);
  const [modal, setModal] = useState<"connection" | "thread" | null>(null);
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [deviceSession] = useState<DeviceSessionPayload>(() => readDeviceSessionPayload());
  const [autoPairCode, setAutoPairCode] = useState("");
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
  const connected = isConnectedIntegration(integration) && !isDisconnected;
  const bridgeHealth = bridgeHealthState({
    connected,
    integration,
    handoff: activeHandoff || backgroundHandoff,
    heartbeat: bridgeHeartbeat,
    bridgeEvents,
    threads: codexThreads,
  });
  const connectionState = runtimeState({
    connected,
    handoff: activeHandoff || backgroundHandoff,
    latestEvent,
    queuedEvents: bridgeHealth.queuedEvents,
    fixtureProject: bridgeHealth.fixtureProject,
  });
  const busy = Boolean(motion || pendingAction || submitting || activeHandoff?.status === "responding_to_codex");
  const deviceSessionJson = JSON.stringify(deviceSession);

  useEffect(() => {
    if (typeof window === "undefined" || autoPairCode) {
      return;
    }

    const url = new URL(window.location.href);
    const code = url.searchParams.get("justswipe_pair") || url.searchParams.get("pair");

    if (!code) {
      return;
    }

    const cleanCode = code.toUpperCase();
    setAutoPairCode(cleanCode);
    setCodeDraft(cleanCode);

    void (async () => {
      try {
        const message = await pairWithCode(cleanCode, deviceSessionJson);
        setPairMessage(message);
        setToast(message.includes("Connected") ? "JustSwipe connected" : message);

        if (message.includes("Connected")) {
          setIsDisconnected(false);
          url.searchParams.delete("justswipe_pair");
          url.searchParams.delete("pair");
          window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }
      } catch (error) {
        const message = mutationErrorMessage(error);
        setPairMessage(message);
        setToast(message);
      }

      setTimeout(() => setToast(""), 1800);
    })();
  }, [autoPairCode, deviceSessionJson, pairWithCode]);

  useEffect(() => {
    if (integration?.codexThreadId) {
      setThreadDraft(integration.codexThreadId);
    }

    if (integration?.customPrompt) {
      setPromptDraft(integration.customPrompt);
    }
  }, [integration?.codexThreadId, integration?.customPrompt]);

  useEffect(() => {
    if (selectedThreadId && !codexThreads.some((thread) => thread.threadId === selectedThreadId)) {
      setSelectedThreadId("");
    }
  }, [codexThreads, selectedThreadId]);

  useEffect(() => {
    if (!activeHandoff || activeHandoff.handoffId === lastNotified) {
      return;
    }

    setLastNotified(activeHandoff.handoffId);

    tryVibrate(12);

    if (alertsEnabled && typeof Notification !== "undefined") {
      const card = parseCards(activeHandoff.cardsJson)[0];
      new Notification("JustSwipe", {
        body: card?.title || activeHandoff.reason || "Codex is waiting.",
        renotify: false,
        silent: true,
        tag: `justswipe-${activeHandoff.handoffId}`,
      });
    }
  }, [activeHandoff?.handoffId, alertsEnabled, lastNotified]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = activeHandoff ? `• ${brandName}` : brandName;
  }, [activeHandoff?.handoffId]);

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
    tryVibrate(action === "yes" ? 14 : action === "no" ? [8, 18, 8] : 10);
  }

  async function chooseAction(action: SwipeAction) {
    if (!activeCard || !activeHandoff || busy) return;

    setPendingAction(action);
    setFormValues({});
    setFormError("");
    setMotion(action);
    await playFeedback(action);
    await new Promise((resolve) => setTimeout(resolve, 220));
    setMotion(null);
    resetDrag();
  }

  async function submitResponse(action: SwipeAction, payload: FormValues) {
    if (!activeCard || !activeHandoff || submitting) return;

    setSubmitting(true);
    setFormError("");

    let result: { ok: boolean; error?: string; completed?: boolean };

    try {
      result = safeResult(
        await submitCardResponse(
          activeHandoff.id,
          activeCard.cardId,
          action,
          JSON.stringify(payload),
        ),
      );
    } catch (error) {
      result = {
        ok: false,
        error: mutationErrorMessage(error),
      };
    }

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

    const payload = { ...formValues };

    delete payload.show_note;

    if (typeof payload.optional_note === "string" && !payload.optional_note.trim()) {
      delete payload.optional_note;
    }

    await submitResponse(pendingAction, payload);
  }

  async function createCode() {
    try {
      const code = await createPairingCode(deviceSessionJson);
      setPairMessage(`Code created: ${code}`);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function pairDevice() {
    try {
      const message = await pairWithCode(codeDraft, deviceSessionJson);
      setPairMessage(message);
      if (message.includes("Connected")) {
        setIsDisconnected(false);
        setConnectionMenuOpen(false);
      }
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function revokeDevice(sessionId: string) {
    try {
      const message = await revokePairedDevice(sessionId);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1400);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function cleanDuplicates() {
    try {
      const message = await cleanDuplicateDevices();
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1400);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function saveBridge() {
    const savedThreadId = threadDraft.trim() || defaultCodexThreadId;
    const savedPrompt = promptDraft.trim() || defaultCustomPrompt;

    try {
      await saveIntegration(savedThreadId, savedPrompt);
      setThreadDraft(savedThreadId);
      setPromptDraft(savedPrompt);
      setIsDisconnected(false);
      setModal(null);
      setConnectionMenuOpen(false);
      setToast("Bridge prompt saved");
      setTimeout(() => setToast(""), 1400);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function disconnect() {
    try {
      await disconnectIntegration();
      setIsDisconnected(true);
      setModal(null);
      setConnectionMenuOpen(false);
      setToast("JustSwipe disconnected");
      setTimeout(() => setToast(""), 1400);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function forgetProject() {
    try {
      const message = await forgetProjectConnection();
      setIsDisconnected(true);
      setConnectionMenuOpen(false);
      setModal(null);
      setSelectedThreadId("");
      setPlanningPrompt("");
      setToast(message || "Project connection forgotten");
      setTimeout(() => setToast(""), 1800);
    } catch (error) {
      const message = mutationErrorMessage(error);
      setPairMessage(message);
      setToast(message);
      setTimeout(() => setToast(""), 1800);
    }
  }

  async function startPlanning() {
    const prompt = planningPrompt.trim();

    if (!prompt || planningBusy) {
      return;
    }

    setPlanningBusy(true);
    let result: { ok: boolean; error?: string };

    try {
      result = safeResult(
        await startPlanningDiscussion(
          prompt,
          selectedThreadId,
          selectedThreadId ? "existing_thread" : "new_thread",
        ),
      );
    } catch (error) {
      result = {
        ok: false,
        error: mutationErrorMessage(error),
      };
    }

    setPlanningBusy(false);

    if (!result.ok) {
      setToast(result.error || "Could not start planning");
      setTimeout(() => setToast(""), 1800);
      return;
    }

    setPlanningPrompt("");
    setToast(selectedThreadId ? "Idea queued for thread" : "New thread idea sent");
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
    try {
      await resetDemo();
    } catch (error) {
      setToast(mutationErrorMessage(error));
      setTimeout(() => setToast(""), 1800);
      return;
    }

    setPendingAction(null);
    setMotion(null);
    resetDrag();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isTyping = isTypingTarget(event.target);

      if (key === "escape") {
        if (connectionMenuOpen) {
          event.preventDefault();
          setConnectionMenuOpen(false);
          return;
        }

        if (modal) {
          event.preventDefault();
          setModal(null);
          return;
        }

        if (pendingAction && !submitting) {
          event.preventDefault();
          setPendingAction(null);
          setFormError("");
          return;
        }
      }

      if (pendingAction) {
        if ((event.ctrlKey || event.metaKey) && key === "enter" && !submitting && hasResponseDraft(formValues)) {
          event.preventDefault();
          void submitPendingForm();
          return;
        }

        if (!isTyping && key === "enter" && !submitting && hasResponseDraft(formValues)) {
          event.preventDefault();
          void submitPendingForm();
        }

        return;
      }

      if (modal || isTyping || busy || !activeCard || !activeHandoff || event.repeat) {
        return;
      }

      const shortcutAction =
        key === "arrowright" || key === "y"
          ? "yes"
          : key === "arrowleft" || key === "n"
            ? "no"
            : key === "arrowup" || key === "m"
              ? "more"
              : key === "arrowdown" || key === "l" || key === "d"
                ? "later"
                : null;

      if (shortcutAction) {
        event.preventDefault();
        void chooseAction(shortcutAction);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard, activeHandoff, busy, connectionMenuOpen, formValues, modal, pendingAction, submitting]);

  return (
    <main class="min-h-screen overflow-x-hidden bg-[#05080c] text-zinc-100">
      <style>{`
        @keyframes jsw-card-enter {
          from { opacity: 0; filter: blur(6px); }
          to { opacity: 1; filter: blur(0); }
        }
        @keyframes jsw-sheet-rise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes jsw-sent-pulse {
          0% { box-shadow: 0 0 0 rgba(163, 230, 53, 0); }
          35% { box-shadow: 0 0 40px rgba(163, 230, 53, 0.22); }
          100% { box-shadow: 0 0 0 rgba(163, 230, 53, 0); }
        }
        .jsw-card-enter { animation: jsw-card-enter 360ms cubic-bezier(.2,.8,.2,1); }
        .jsw-sheet-rise { animation: jsw-sheet-rise 180ms ease-out; }
        .jsw-sent-pulse { animation: jsw-sent-pulse 900ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .jsw-card-enter, .jsw-sheet-rise, .jsw-sent-pulse { animation: none; }
        }
      `}</style>
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-28 pt-4 sm:px-6">
        <Header
          alertsEnabled={alertsEnabled}
          codeDraft={codeDraft}
          connected={connected}
          connectionMenuOpen={connectionMenuOpen}
          health={bridgeHealth}
          integration={integration}
          pairCodes={pairCodes}
          pairedDevices={pairedDevices}
          pairMessage={pairMessage}
          setCodeDraft={setCodeDraft}
          state={connectionState}
          onEnableAlerts={enableAlerts}
          onCleanDuplicateDevices={() => void cleanDuplicates()}
          onCloseConnection={() => setConnectionMenuOpen(false)}
          onCreatePairCode={() => void createCode()}
          onDisconnect={() => void disconnect()}
          onOpenAdvanced={() => {
            setConnectionMenuOpen(false);
            setModal("connection");
          }}
          onOpenConnection={() => setConnectionMenuOpen(true)}
          onOpenThreadLog={() => {
            setConnectionMenuOpen(false);
            setModal("thread");
          }}
          onForgetProject={() => void forgetProject()}
          onPair={() => void pairDevice()}
          onRevokePairedDevice={(sessionId) => void revokeDevice(sessionId)}
          onReset={reset}
          onToggleConnection={() => setConnectionMenuOpen((open) => !open)}
        />

        {connected ? (
          <DeckBar
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
              handoff={activeHandoff}
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
            bridgeEvents={bridgeEvents}
            connected={connected}
            health={bridgeHealth}
            selectedThreadId={selectedThreadId}
            threads={codexThreads}
            latestEvent={latestEvent}
            planningBusy={planningBusy}
            planningPrompt={planningPrompt}
            setPlanningPrompt={setPlanningPrompt}
            setSelectedThreadId={setSelectedThreadId}
            onOpenConnection={() => setConnectionMenuOpen(true)}
            onForgetProject={() => void forgetProject()}
            onStartPlanning={() => void startPlanning()}
          />
        )}
      </div>

      {modal === "connection" ? (
        <Modal title={connected ? "Connection" : "Connect JustSwipe"} onClose={() => setModal(null)}>
          <PairingPanel
            codeDraft={codeDraft}
            connected={connected}
            integration={integration}
            health={bridgeHealth}
            latestEvent={latestEvent}
            pairCodes={pairCodes}
            pairedDevices={pairedDevices}
            pairMessage={pairMessage}
            promptDraft={promptDraft}
            setCodeDraft={setCodeDraft}
            setPromptDraft={setPromptDraft}
            setThreadDraft={setThreadDraft}
            threadDraft={threadDraft}
            onCleanDuplicateDevices={() => void cleanDuplicates()}
            onCreatePairCode={() => void createCode()}
            onDisconnect={() => void disconnect()}
            onForgetProject={() => void forgetProject()}
            onPair={() => void pairDevice()}
            onRevokePairedDevice={(sessionId) => void revokeDevice(sessionId)}
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
          onQuickSubmit={(reply) =>
            void submitResponse(pendingAction, {
              quick_reply: reply,
            })
          }
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
