import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), "..");
const args = new Set(process.argv.slice(2));
const port = valueAfter("--port") ?? "3001";
const explicitGuest = valueAfter("--guest");
const smoke = args.has("--smoke");
const e2eLocal = args.has("--e2e-local");
const e2eHosted = args.has("--e2e-hosted");
const guest = explicitGuest ?? (smoke ? "smoke" : e2eLocal ? "e2e-local" : e2eHosted ? "e2e-hosted" : "local");
const appUrl = valueAfter("--app-url") ?? valueAfter("--url") ?? process.env.JUSTSWIPE_APP_URL ?? "";
const deployIdArg = valueAfter("--deploy-id") ?? process.env.JUSTSWIPE_DEPLOY_ID ?? "";
const inspectToken = valueAfter("--inspect-token") ?? process.env.JUSTSWIPE_INSPECT_TOKEN ?? "";
const jsonOutput = args.has("--json");
const dryRun = args.has("--dry-run");
const doctorReport = args.has("--doctor");
const failOnAttention = args.has("--fail-on-attention") || args.has("--fail-if-not-ready");
const statusReport = args.has("--status") || doctorReport;
const runAll = args.has("--all");
const watch = args.has("--watch");
const daemon = args.has("--daemon") || args.has("--background") || args.has("--watch-daemon");
const pair = args.has("--pair");
const openPairLink = args.has("--open") || args.has("--open-browser");
const demoHandoff = args.has("--demo-handoff");
const smokeHandoff = args.has("--smoke-handoff");
const startThread = args.has("--start-thread");
const setupHandoff = args.has("--setup-handoff");
const setup = args.has("--setup");
const preserveConnection = args.has("--preserve-connection") || args.has("--no-clear");
const todoHandoff = args.has("--todo-handoff");
const clearState = args.has("--clear");
const forgetConnection = args.has("--forget");
const syncThreads = args.has("--sync-threads");
const rehydrateThreads = args.has("--rehydrate-threads");
const retryFailed = args.has("--retry-failed");
const forceSetupCard = args.has("--setup-card");
const answerFirstCard = args.has("--answer-first-card");
const replyArg = valueAfter("--reply") ?? "";
const ideaPrompt = valueAfter("--idea") ?? "";
const relayMode = valueAfter("--relay") ?? process.env.JUSTSWIPE_CODEX_RELAY ?? "app-server";
const bridgeDir = join(root, ".lakebed", "bridge-runs");
const intervalMs = Number.parseInt(valueAfter("--interval-ms") ?? "1200", 10);
const heartbeatMs = Number.parseInt(valueAfter("--heartbeat-ms") ?? "90000", 10);
const threadSyncMs = Number.parseInt(valueAfter("--thread-sync-ms") ?? "300000", 10);
const runningLeaseMs = Number.parseInt(valueAfter("--running-lease-ms") ?? "300000", 10);
const codexTimeoutMs = Number.parseInt(valueAfter("--timeout-ms") ?? "900000", 10);
const codexRetryDelayMs = Number.parseInt(valueAfter("--codex-retry-delay-ms") ?? "7000", 10);
const threadCwd = valueAfter("--cwd") ?? root;
const expectedCwd = valueAfter("--expect-cwd") ?? "";
const threadCachePath = resolve(valueAfter("--thread-cache") ?? join(root, ".lakebed", "dogfood-thread-cache.json"));
const threadPromptArg = valueAfter("--prompt");
const threadPromptFile = valueAfter("--prompt-file");
const defaultThreadPrompt =
  "You are the Codex worker behind JustSwipe. Wait for a JustSwipe decision before editing files. Reply in under 120 words with the decision you need, then end with AWAITING_JUSTSWIPE_RESPONSE.";
const canonicalInstallDocUrl = "https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function readThreadPrompt() {
  if (threadPromptFile) {
    return (await readFile(resolve(threadPromptFile), "utf8")).trim();
  }

  return (threadPromptArg ?? defaultThreadPrompt).trim();
}

function setupThreadPrompt(prompt) {
  return [
    "JUSTSWIPE TARGET REPO SETUP",
    "",
    "You are setting up this target repo to be controlled by the external JustSwipe app.",
    "Do not build JustSwipe, a swipe UI, a local dashboard, a bridge UI, or an auth shell in this repo.",
    "",
    "Mandatory repo contract before normal project work:",
    "1. Inspect the repo.",
    "2. Preserve existing instructions.",
    "3. Create AGENTS.md if missing, or append a JustSwipe section if it exists.",
    "4. Create or update skills/justswipe/SKILL.md.",
    "5. State that hosted/local JustSwipe is the only UI and this repo only consumes steering packets.",
    "6. If you need user direction, emit a JUSTSWIPE_HANDOFF_JSON card or bundle and stop.",
    "7. Do not report bridge pairing, watcher heartbeat, queue, or current-thread state as authoritative in your prose. The bridge CLI prints that status after this setup turn.",
    "",
    "Skill requirements:",
    "- Consume JUSTSWIPE RESPONSE PACKET messages as user steering.",
    "- Treat JustSwipe responses as steering, not permission.",
    "- Ask one clear decision per card.",
    "- Use as many cards as needed and as few as possible; there is no fixed bundle limit.",
    "- Provide 3 to 4 quick replies plus custom text.",
    "- Include compact HTML/artifact context when it helps the user decide.",
    "- Handoff requests must be wrapped in JUSTSWIPE_HANDOFF_JSON and END_JUSTSWIPE_HANDOFF_JSON markers.",
    "- After the marker block, end with AWAITING_JUSTSWIPE_RESPONSE <cardId>.",
    "- After emitting a JustSwipe handoff, stop and wait for a response packet.",
    "- If the user prompt says to emit, ask, or send a JustSwipe card, do it in the current response with the marker block. Do not merely say you will do it.",
    "- If you mention that you will ask JustSwipe, send a card, or emit a handoff, the response is incomplete unless it includes the marker block.",
    "",
    "Minimum handoff marker shape the skill must document:",
    "JUSTSWIPE_HANDOFF_JSON",
    JSON.stringify(
      {
        reason: "Need one human decision before continuing.",
        cards: [
          {
            cardId: "next-decision",
            title: "Pick the next step",
            summary: "One clear choice.",
            recommendedAction: "yes",
            visualContext: "Current state, tradeoff, risk, and next effect.",
            questionType: "yes_no",
            quickRepliesByAction: {
              yes: ["Do this", "Keep it simple", "Ship this slice"],
              no: ["Not this", "Too broad", "Try smaller"],
            },
            requiredFieldsByAction: {
              yes: ["quick_reply"],
              no: ["quick_reply"],
            },
            yesPayloadSchema: [],
            noPayloadSchema: [],
            morePayloadSchema: [],
            laterPayloadSchema: [],
            optionPayloadSchemas: {},
            agentHtmlPreview:
              "<section><h2>Decision context</h2><p>Show the concrete thing the user is deciding on.</p></section>",
          },
        ],
      },
      null,
      2,
    ),
    "END_JUSTSWIPE_HANDOFF_JSON",
    "AWAITING_JUSTSWIPE_RESPONSE next-decision",
    "",
    "User setup prompt:",
    prompt || defaultThreadPrompt,
  ].join("\n");
}

function appBaseUrl() {
  if (appUrl) {
    const parsed = new URL(appUrl);
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  }

  return `http://localhost:${port}`;
}

function isLocalAppUrl() {
  const host = new URL(appBaseUrl()).hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function extractQuotaDetails(message) {
  const text = String(message || "");
  const details = {};

  const resetAt =
    text.match(/"resetAt"\s*:\s*"([^"]+)"/)?.[1] ||
    text.match(/\bresetAt[:=]\s*([0-9TZ:.\-]+)/i)?.[1] ||
    "";
  const retryAfterSeconds =
    text.match(/"retryAfterSeconds"\s*:\s*(\d+)/)?.[1] ||
    text.match(/\bretryAfterSeconds[:=]\s*(\d+)/i)?.[1] ||
    "";

  if (resetAt) {
    details.resetAt = resetAt;
  }

  if (retryAfterSeconds) {
    details.retryAfterSeconds = retryAfterSeconds;
  }

  return details;
}

function formatLakebedError(message) {
  const text = String(message || "Lakebed mutation failed.");

  if (/mutations quota exceeded/i.test(text)) {
    const details = extractQuotaDetails(text);
    const timing = [
      details.resetAt ? `resetAt: ${details.resetAt}` : "",
      details.retryAfterSeconds ? `retryAfterSeconds: ${details.retryAfterSeconds}` : "",
    ].filter(Boolean);
    const fallback = [
      "hosted mutation quota exhausted; switch bridge app URL to local dev",
      "Run: npm run dev",
      "Then use: --app-url http://localhost:3001",
      ...timing,
    ];

    return fallback.join("\n");
  }

  return text;
}

function formatTopLevelError(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (!isLocalAppUrl() && /mutations quota exceeded/i.test(message)) {
    return formatLakebedError(message);
  }

  return message || "JustSwipe bridge failed.";
}

function lakebedWsUrl() {
  const base = new URL(appBaseUrl());
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/__lakebed/ws";
  base.search = `?lakebed_guest=${encodeURIComponent(guest)}`;
  base.hash = "";
  return base.href;
}

function pairingLink(code) {
  const base = new URL(appBaseUrl());
  base.searchParams.set("justswipe_pair", code);
  return base.href;
}

function openUrl(url) {
  let command = "xdg-open";
  let commandArgs = [url];

  if (process.platform === "win32") {
    command = "cmd.exe";
    commandArgs = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
  }

  const child = spawn(command, commandArgs, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function safeLogSlug(value) {
  return String(value || "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "default";
}

function isProcessAlive(pid) {
  const parsed = Number.parseInt(String(pid || ""), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return false;
  }

  try {
    process.kill(parsed, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readLogTail(path, maxChars = 2000) {
  try {
    const text = await readFile(path, "utf8");
    return text.slice(-maxChars).trim();
  } catch {
    return "";
  }
}

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function readLogSince(path, offset, maxChars = 2000) {
  try {
    const text = await readFile(path, "utf8");
    return text.slice(offset).slice(-maxChars).trim();
  } catch {
    return "";
  }
}

async function startWatcherDaemon() {
  await mkdir(join(root, ".lakebed"), { recursive: true });

  const host = new URL(appBaseUrl()).hostname;
  const mode = isLocalAppUrl() ? "local" : "hosted";
  const slug = `${mode}-${safeLogSlug(host)}-${safeLogSlug(guest)}`;
  const outLog = join(root, ".lakebed", `bridge-watch-${slug}.out.log`);
  const errLog = join(root, ".lakebed", `bridge-watch-${slug}.err.log`);
  const pidFile = join(root, ".lakebed", `bridge-watch-${slug}.pid`);
  let existingPid = "";

  try {
    existingPid = (await readFile(pidFile, "utf8")).trim();
  } catch {
    existingPid = "";
  }

  if (isProcessAlive(existingPid)) {
    console.log("JustSwipe bridge watcher is already running.");
    console.log(`pid: ${existingPid}`);
    console.log(`stdout: ${outLog}`);
    console.log(`stderr: ${errLog}`);
    console.log("scope: one watcher per app URL and guest; current project routing comes from JustSwipe state, not the daemon command cwd.");
    return Number.parseInt(existingPid, 10);
  }

  if (existingPid) {
    await rm(pidFile, { force: true });
  }

  const outFd = openSync(outLog, "a");
  const errFd = openSync(errLog, "a");
  const outStart = await fileSize(outLog);
  const errStart = await fileSize(errLog);
  const watcherArgs = [
    scriptPath,
    "--watch",
    "--app-url",
    appBaseUrl(),
    "--guest",
    guest,
    "--port",
    port,
    "--relay",
    relayMode,
    "--interval-ms",
    String(intervalMs),
    "--heartbeat-ms",
    String(heartbeatMs),
    "--timeout-ms",
    String(codexTimeoutMs),
    "--cwd",
    resolve(threadCwd),
  ];

  const child = spawn(process.execPath, watcherArgs, {
    cwd: root,
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
  });

  child.unref();
  await writeFile(pidFile, String(child.pid || ""));

  await sleep(2500);

  if (!isProcessAlive(child.pid)) {
    await rm(pidFile, { force: true });
    const stderr = (await readLogSince(errLog, errStart)) || (await readLogTail(errLog));
    const stdout = (await readLogSince(outLog, outStart)) || (await readLogTail(outLog));
    console.error("JustSwipe bridge watcher exited before the first heartbeat.");
    console.error(`stdout: ${outLog}`);
    console.error(`stderr: ${errLog}`);
    if (stderr) {
      console.error(stderr);
    } else if (stdout) {
      console.error(stdout);
    }
    process.exitCode = 1;
    return null;
  }

  console.log("Started JustSwipe bridge watcher in the background.");
  console.log(`pid: ${child.pid}`);
  console.log(`pidFile: ${pidFile}`);
  console.log(`stdout: ${outLog}`);
  console.log(`stderr: ${errLog}`);
  console.log("scope: one watcher per app URL and guest; current project routing comes from JustSwipe state, not the daemon command cwd.");
  console.log("The hosted app will show Bridge online when the first heartbeat lands.");

  return child.pid;
}

function ownerIdForGuest() {
  return guest.startsWith("guest:") ? guest : `guest:${guest}`;
}

function integrationForGuest(db) {
  const ownerId = ownerIdForGuest();
  const integrations = db.tables?.integrations ?? [];

  return integrations.find((row) => row.ownerId === ownerId) ?? null;
}

function bridgeConnectionId(db) {
  return valueAfter("--connection-id") ?? integrationForGuest(db)?.connectionId ?? "";
}

function isFuture(value) {
  return Boolean(value) && String(value) > new Date().toISOString();
}

function statusCounts(rows, field = "status") {
  return rows.reduce((counts, row) => {
    const key = row[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts) {
  const entries = Object.entries(counts);

  if (!entries.length) {
    return "none";
  }

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}

function recentRows(rows, limit = 5) {
  return [...rows]
    .sort((left, right) =>
      String(right.lastActivityAt || right.updatedAt || right.createdAt || "").localeCompare(
        String(left.lastActivityAt || left.updatedAt || left.createdAt || ""),
      ),
    )
    .slice(0, limit);
}

function statusThreadSummary(thread) {
  const pendingCards = thread.pendingCards || "0";
  const pendingIdeas = thread.pendingIdeas || "0";
  const hasPendingWork = Number.parseInt(pendingCards, 10) > 0 || Number.parseInt(pendingIdeas, 10) > 0;
  const threadStatus =
    ["awaiting_justswipe", "unknown"].includes(thread.threadStatus) && !hasPendingWork
      ? "idle"
      : thread.threadStatus;

  return {
    threadId: thread.threadId || "",
    threadTitle: thread.threadTitle || shortThreadId(thread.threadId || ""),
    threadStatus: threadStatus || "unknown",
    projectName: thread.projectName || "",
    cwd: thread.cwd || "",
    pendingCards,
    pendingIdeas,
    lastActivityAt: thread.lastActivityAt || "",
  };
}

function statusEventSummary(event) {
  return {
    handoffId: event.handoffId || "",
    threadId: event.threadId || "",
    threadTitle: event.threadTitle || shortThreadId(event.threadId || ""),
    status: event.status || "unknown",
    action: event.action || "",
    title: event.title || "",
    projectName: event.projectName || "",
    cwd: event.cwd || "",
    updatedAt: event.updatedAt || event.claimHeartbeatAt || "",
  };
}

function statusHandoffSummary(handoff) {
  const cards = parseCardsJson(handoff.cardsJson);
  const activeIndex = Number.parseInt(handoff.activeCardIndex || "0", 10) || 0;
  const card = cards[activeIndex] || {};

  return {
    handoffId: handoff.handoffId || handoff.id,
    status: handoff.status || "unknown",
    threadId: handoff.threadId || "",
    threadTitle: handoff.threadTitle || shortThreadId(handoff.threadId || ""),
    projectName: handoff.projectName || "",
    cwd: handoff.cwd || "",
    activeCardIndex: activeIndex,
    cardCount: cards.length,
    cardId: card.cardId || "",
    cardTitle: card.title || "",
    recommendedAction: card.recommendedAction || "",
    questionType: card.questionType || "",
    updatedAt: handoff.updatedAt || handoff.createdAt || "",
  };
}

function statusBridgeHeartbeat(db, connectionId) {
  const heartbeat = (db.tables?.bridgeHeartbeats ?? [])
    .filter((row) => connectionId && row.connectionId === connectionId)
    .sort((left, right) => String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || "")))[0];

  if (!heartbeat?.lastSeenAt) {
    return {
      status: "missing",
      fresh: false,
      lastSeenAt: "",
      ageSeconds: null,
      label: "",
      appUrl: "",
    };
  }

  const seenAt = new Date(heartbeat.lastSeenAt).getTime();
  const ageSeconds = Number.isFinite(seenAt) ? Math.max(0, Math.round((Date.now() - seenAt) / 1000)) : null;
  const fresh = ageSeconds !== null && ageSeconds < 180;

  return {
    status: fresh ? "online" : "stale",
    fresh,
    lastSeenAt: heartbeat.lastSeenAt,
    ageSeconds,
    label: heartbeat.label || "",
    appUrl: heartbeat.appUrl || "",
  };
}

async function fetchTextCheck(url, expected = []) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const expectedValues = Array.isArray(expected) ? expected : [expected];

    return {
      ok: response.ok,
      status: response.status,
      checks: Object.fromEntries(
        expectedValues.map((value) => [value, text.includes(value)]),
      ),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error || "Fetch failed."),
      checks: {},
    };
  }
}

async function installDocDoctor() {
  const raw = await fetchTextCheck(canonicalInstallDocUrl, [
    "https://clear-harbor-b4fc257b5a.lakebed.app",
    "Do not build JustSwipe",
    "hosted mutation quota exhausted; switch bridge app URL to local dev",
  ]);
  const appMirrorUrl = `${appBaseUrl()}/install.md`;
  const mirror = isLocalAppUrl()
    ? await fetchTextCheck(appMirrorUrl, [
        canonicalInstallDocUrl,
        "convenience mirrors only",
        "~~~powershell",
      ])
    : {
        ok: null,
        status: null,
        skipped: true,
        reason: "hosted app install mirror read skipped to avoid consuming Lakebed hosted quota",
        checks: {},
      };

  return {
    canonicalInstallDocUrl,
    raw,
    appInstallMirrorUrl: appMirrorUrl,
    appMirror: mirror,
  };
}

function projectNameFromCwd(cwd) {
  const normalized = String(cwd || "").replaceAll("\\", "/");
  const name = normalized.split("/").filter(Boolean).pop();
  return name || "Project";
}

function projectNameForMetadata(projectName, cwd) {
  const label = String(projectName || "").trim();
  if (label && label !== "Project") {
    return label;
  }

  return projectNameFromCwd(cwd);
}

function shortThreadId(threadId) {
  return threadId ? String(threadId).slice(0, 8) : "new";
}

function threadTitleFallback(threadId, cwd, title = "") {
  const cleanTitle = String(title || "").trim();
  if (cleanTitle && cleanTitle !== "New thread" && !/\bthread new$/i.test(cleanTitle)) {
    return cleanTitle.slice(0, 140);
  }

  return `${projectNameFromCwd(cwd)} thread ${shortThreadId(threadId)}`;
}

function threadMetadataFromThread(thread, fallback = {}) {
  const cwd = thread?.cwd || fallback.cwd || resolve(threadCwd);
  const threadId = thread?.id || thread?.threadId || thread?.thread_id || fallback.threadId || "";
  const fallbackTitle = String(fallback.threadTitle || "");
  const usableFallbackTitle =
    fallbackTitle && fallbackTitle !== "New thread" && !/\bthread new$/i.test(fallbackTitle)
      ? fallbackTitle
      : "";
  const rawStatus = typeof thread?.status === "string" ? thread.status : thread?.status?.type;
  const status =
    rawStatus === "idle" ||
    rawStatus === "running" ||
    rawStatus === "awaiting_justswipe" ||
    rawStatus === "queued" ||
    rawStatus === "failed"
      ? rawStatus
      : fallback.threadStatus || "unknown";

  return {
    threadId,
    threadTitle: threadTitleFallback(threadId, cwd, thread?.title || usableFallbackTitle),
    threadStatus: status,
    cwd,
    projectName: projectNameForMetadata(fallback.projectName, cwd),
    lastActivityAt: new Date().toISOString(),
  };
}

function ensureThreadMetadata(metadata, fallback = {}) {
  const cwd = metadata?.cwd || fallback.cwd || resolve(threadCwd);
  const threadId = metadata?.threadId || fallback.threadId || "";

  return {
    threadId,
    threadTitle: threadTitleFallback(threadId, cwd, metadata?.threadTitle || fallback.threadTitle || ""),
    threadStatus: metadata?.threadStatus || fallback.threadStatus || "unknown",
    cwd,
    projectName: projectNameForMetadata(metadata?.projectName || fallback.projectName, cwd),
    lastActivityAt: metadata?.lastActivityAt || fallback.lastActivityAt || new Date().toISOString(),
  };
}

function threadMetadataFromEvent(event, overrides = {}) {
  const cwd = overrides.cwd || event.cwd || resolve(threadCwd);

  return {
    threadId: overrides.threadId || event.threadId || "",
    threadTitle: threadTitleFallback(
      overrides.threadId || event.threadId || "",
      cwd,
      overrides.threadTitle || event.threadTitle || "",
    ),
    threadStatus: overrides.threadStatus || event.threadStatus || "unknown",
    cwd,
    projectName: projectNameForMetadata(overrides.projectName || event.projectName, cwd),
    lastActivityAt: overrides.lastActivityAt || new Date().toISOString(),
  };
}

function metadataJson(metadata) {
  return JSON.stringify(metadata);
}

async function deployInspectTarget() {
  if (deployIdArg) {
    return deployIdArg;
  }

  if (appUrl && isLocalAppUrl()) {
    return appBaseUrl();
  }

  try {
    const metadata = JSON.parse(await readFile(join(root, "lakebed.json"), "utf8"));

    if (metadata?.deployId) {
      return metadata.deployId;
    }
  } catch {
    // Fall back to the app URL for unbound deployments.
  }

  return appUrl ? appBaseUrl() : "";
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          if (process.platform === "win32") {
            spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
              windowsHide: true,
            });
          } else {
            child.kill("SIGKILL");
          }
          resolvePromise({
            code: 124,
            stdout,
            stderr: `${stderr}\nTimed out after ${options.timeoutMs}ms.`,
          });
        }, options.timeoutMs)
      : null;

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findCodexEntrypoint() {
  if (process.env.CODEX_APP_SERVER_JS) {
    if (!(await pathExists(process.env.CODEX_APP_SERVER_JS))) {
      throw new Error(`CODEX_APP_SERVER_JS does not exist: ${process.env.CODEX_APP_SERVER_JS}`);
    }

    return {
      command: process.execPath,
      args: [process.env.CODEX_APP_SERVER_JS],
    };
  }

  if (process.platform !== "win32") {
    return {
      command: "codex",
      args: [],
    };
  }

  const where = await run("where.exe", ["codex"]);
  const candidates = where.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => join(dirname(line), "node_modules", "@openai", "codex", "bin", "codex.js"));

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return {
        command: process.execPath,
        args: [candidate],
      };
    }
  }

  throw new Error(
    "Could not locate the Codex app-server entrypoint. Set CODEX_APP_SERVER_JS to @openai/codex/bin/codex.js.",
  );
}

function parseDump(stdout) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("Lakebed DB dump did not include JSON.");
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function finalTextFromTurn(turn) {
  const items = Array.isArray(turn?.items) ? turn.items : [];
  const finalAnswer = [...items]
    .reverse()
    .find((item) => item.type === "agentMessage" && item.phase === "final_answer");
  const lastAgentMessage = [...items]
    .reverse()
    .find((item) => item.type === "agentMessage");

  return (finalAnswer?.text || lastAgentMessage?.text || "").trim();
}

function turnFromThreadRead(result, turnId) {
  const turns = Array.isArray(result?.thread?.turns)
    ? result.thread.turns
    : Array.isArray(result?.turns)
      ? result.turns
      : [];

  return turnId
    ? turns.find((turn) => turn.id === turnId)
    : turns[0];
}

function finalTextFromThreadRead(result, turnId) {
  const matchingTurn = turnFromThreadRead(result, turnId);

  if (!matchingTurn) {
    return "";
  }

  return finalTextFromTurn(matchingTurn);
}

function turnStatusType(turn) {
  return String(typeof turn?.status === "object" ? turn.status?.type : turn?.status || "").toLowerCase();
}

function isTerminalTurn(turn) {
  return ["completed", "failed", "cancelled", "canceled"].includes(turnStatusType(turn));
}

function codexTurnError(message) {
  const error = new Error(message);
  error.code = "CODEX_TURN_TERMINAL_EMPTY";
  return error;
}

async function emptyTurnReasonFromSession(result) {
  const defaultReason = "Codex turn completed without a response body.";
  const sessionPath = result?.thread?.path;

  if (!sessionPath) {
    return defaultReason;
  }

  try {
    const lines = (await readFile(sessionPath, "utf8")).trim().split(/\r?\n/);
    let sawNullAgentMessage = false;
    let credits = null;

    for (const line of lines) {
      let entry;

      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (entry?.type !== "event_msg") {
        continue;
      }

      if (entry.payload?.type === "task_complete" && entry.payload?.last_agent_message === null) {
        sawNullAgentMessage = true;
      }

      if (entry.payload?.type === "token_count" && entry.payload?.rate_limits?.credits) {
        credits = entry.payload.rate_limits.credits;
      }
    }

    if (credits?.has_credits === false || credits?.balance === "0" || credits?.balance === 0) {
      return `${defaultReason} Codex reported no available credits for that turn.`;
    }

    if (sawNullAgentMessage) {
      return `${defaultReason} Codex marked the task complete with no agent message.`;
    }
  } catch {
    return defaultReason;
  }

  return defaultReason;
}

async function readTurnResult(client, threadId, turnId, threadMeta) {
  const refreshed = await client.request("thread/read", {
    threadId,
    includeTurns: true,
  });
  const turn = turnFromThreadRead(refreshed, turnId);
  const terminal = isTerminalTurn(turn);
  const response = finalTextFromTurn(turn);

  if (!terminal) {
    return {
      response: "",
      threadMeta: threadMetadataFromThread(refreshed?.thread, {
        ...threadMeta,
        threadId,
        threadStatus: "running",
      }),
    };
  }

  if (!response) {
    throw codexTurnError(await emptyTurnReasonFromSession(refreshed));
  }

  return {
    response,
    threadMeta: threadMetadataFromThread(refreshed?.thread, {
      ...threadMeta,
      threadId,
      threadStatus: response ? "idle" : threadMeta.threadStatus || "running",
    }),
  };
}

async function waitForTurnResult(client, threadId, turnId, threadMeta) {
  const deadline = Date.now() + codexTimeoutMs;
  let lastReadError = null;
  const completedPromise = client
    .onceNotification(
      "turn/completed",
      (params) => params?.threadId === threadId && params?.turn?.id === turnId,
      codexTimeoutMs,
    )
    .then((params) => ({ kind: "completed", params }))
    .catch((error) => ({ kind: "error", error }));

  while (Date.now() < deadline) {
    const waitMs = Math.min(2_000, Math.max(1, deadline - Date.now()));
    const result = await Promise.race([
      completedPromise,
      new Promise((resolve) => setTimeout(() => resolve({ kind: "poll" }), waitMs)),
    ]);

    if (result.kind === "error") {
      throw result.error;
    }

    if (result.kind === "completed") {
      const response = finalTextFromTurn(result.params?.turn);

      if (response) {
        return {
          response,
          threadMeta: threadMetadataFromThread(result.params?.thread, {
            ...threadMeta,
            threadId,
            threadStatus: "idle",
          }),
        };
      }
    }

    let polled;

    try {
      polled = await readTurnResult(client, threadId, turnId, threadMeta);
      lastReadError = null;
    } catch (error) {
      if (error?.code === "CODEX_TURN_TERMINAL_EMPTY") {
        throw error;
      }
      lastReadError = error;
      continue;
    }

    if (polled.response) {
      return polled;
    }
  }

  if (lastReadError) {
    throw lastReadError;
  }

  throw new Error("Timed out waiting for Codex turn result.");
}

async function createAppServerClient() {
  const entrypoint = await findCodexEntrypoint();
  const child = spawn(
    entrypoint.command,
    [...entrypoint.args, "app-server", "--listen", "stdio://"],
    {
      cwd: root,
      windowsHide: true,
    },
  );
  const pending = new Map();
  const notifications = new Map();
  let buffer = "";
  let stderr = "";
  let nextId = 1;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;

    try {
      child.stdin.end();
    } catch {
      // The process may already be closing.
    }

    setTimeout(() => {
      if (child.exitCode !== null) return;
      if (process.platform === "win32") {
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        });
      } else {
        child.kill("SIGKILL");
      }
    }, 500);
  }

  function emitNotification(message) {
    const listeners = notifications.get(message.method) || [];

    for (const listener of listeners) {
      listener(message.params);
    }
  }

  function handleLine(line) {
    let message;

    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.id !== undefined && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);

      if (message.error) {
        request.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        request.resolve(message.result);
      }

      return;
    }

    if (message.method) {
      emitNotification(message);
    }
  }

  child.stdout?.on("data", (chunk) => {
    buffer += String(chunk);

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        handleLine(line);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  });

  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  child.on("close", () => {
    for (const request of pending.values()) {
      request.reject(new Error(`Codex app-server closed before responding.\n${stderr.trim()}`));
    }
    pending.clear();
  });

  function request(method, params) {
    const id = nextId;
    nextId += 1;

    return new Promise((resolvePromise, reject) => {
      pending.set(id, { resolve: resolvePromise, reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  function onceNotification(method, predicate, timeoutMs) {
    return new Promise((resolvePromise, reject) => {
      let remove = () => {};
      const timer = setTimeout(() => {
        remove();
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      timer.unref?.();
      const listener = (params) => {
        if (predicate && !predicate(params)) {
          return;
        }

        clearTimeout(timer);
        remove();
        resolvePromise(params);
      };

      remove = () => {
        const listeners = notifications.get(method) || [];
        notifications.set(
          method,
          listeners.filter((item) => item !== listener),
        );
      };

      notifications.set(method, [...(notifications.get(method) || []), listener]);
    });
  }

  await request("initialize", {
    clientInfo: {
      name: "justswipe-bridge",
      title: "JustSwipe bridge",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      optOutNotificationMethods: [
        "item/agentMessage/delta",
        "rawResponseItem/completed",
        "item/reasoning/textDelta",
      ],
    },
  });

  return {
    request,
    onceNotification,
    close,
  };
}

function bridgeEventsByStatus(db, statuses) {
  const events = db.tables?.bridgeEvents ?? [];
  const connectionId = bridgeConnectionId(db);
  const ownerId = ownerIdForGuest();
  const allowed = new Set(statuses);

  return events
    .filter((event) => allowed.has(event.status))
    .filter((event) => {
      if (connectionId) {
        return event.connectionId === connectionId;
      }

      return event.ownerId === ownerId;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function queuedEvents(db) {
  return bridgeEventsByStatus(db, ["queued"]);
}

function nextQueuedEvent(db) {
  return queuedEvents(db)[0];
}

async function dumpDb() {
  if (!appUrl && !/^\d+$/.test(port)) {
    throw new Error("--port must be numeric.");
  }

  const hostedTarget = await deployInspectTarget();
  const target = appUrl
    ? `${psQuote(hostedTarget)}${inspectToken ? ` --inspect-token ${psQuote(inspectToken)}` : ""}`
    : `--port ${port}`;

  const result = await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `npx --yes --cache ${psQuote(join(root, ".lakebed", "npm-cache"))} lakebed db dump ${target}`,
    ],
  );
  if (result.code !== 0) {
    throw new Error(`Lakebed DB dump failed.\n${result.stderr || result.stdout}`);
  }
  return parseDump(result.stdout);
}

function isTransientDumpError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Lakebed DB dump failed/i.test(message) && !/mutations quota exceeded/i.test(message);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function dumpDbForStatus() {
  const attempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return {
        db: await dumpDb(),
        dumpRetryCount: attempt - 1,
      };
    } catch (error) {
      lastError = error;

      if (!isTransientDumpError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(350 * attempt);
    }
  }

  throw lastError;
}

function doctorVerdictFor(report) {
  const expectedCwdResolved = report.expectedCwd ? resolve(report.expectedCwd) : "";
  const currentCwdResolved = report.currentCwd ? resolve(report.currentCwd) : "";
  const checks = {
    connected: Boolean(report.connected),
    currentProjectKnown: Boolean(report.currentProject && report.currentCwd),
    currentThreadKnown: Boolean(report.currentThread),
    expectedCwdMatches: !expectedCwdResolved || currentCwdResolved.toLowerCase() === expectedCwdResolved.toLowerCase(),
    bridgeHeartbeatOnline: report.bridgeHeartbeat?.status === "online" && report.bridgeHeartbeat?.fresh === true,
    noActiveHandoffs: Number(report.activeHandoffs || 0) === 0,
    noQueuedBridgeEvents: Number(report.queuedBridgeEvents || 0) === 0,
    noRunningBridgeEvents: Number(report.runningBridgeEvents || 0) === 0,
    noFailedBridgeEvents: Number(report.failedBridgeEvents || 0) === 0,
    installDocReachable: report.installDocs ? report.installDocs.raw?.ok === true : true,
    appInstallMirrorOkOrSkipped: report.installDocs
      ? report.installDocs.appMirror?.ok === true || report.installDocs.appMirror?.skipped === true
      : true,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    ready: failedChecks.length === 0,
    status: failedChecks.length === 0 ? "ready" : "attention",
    failedChecks,
    checks,
  };
}

function applyDoctorExitCode(report) {
  if (failOnAttention && report.doctor && !report.doctor.ready) {
    process.exitCode = 2;
  }
}

async function printStatusReport() {
  let db;
  let dumpRetryCount = 0;

  try {
    const statusDump = await dumpDbForStatus();
    db = statusDump.db;
    dumpRetryCount = statusDump.dumpRetryCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");

    const canReturnUnavailableStatus =
      statusReport && (isLocalAppUrl() || (doctorReport && /mutations quota exceeded/i.test(message)));

    if (!canReturnUnavailableStatus) {
      throw error;
    }

    const fallback = isLocalAppUrl()
      ? `local JustSwipe app is not reachable at ${appBaseUrl()}. Start it with: npm run dev`
      : formatLakebedError(message);
    const report = {
      appUrl: appBaseUrl(),
      mode: isLocalAppUrl() ? "local" : "hosted",
      guest: ownerIdForGuest(),
      connected: false,
      connectionId: "",
      pairedUntil: "",
      pairedDevices: 0,
      activePairCodes: 0,
      activeHandoffs: 0,
      activeHandoffStatuses: {},
      activeHandoffCards: [],
      bridgeHeartbeat: {
        status: "missing",
        fresh: false,
        lastSeenAt: "",
        ageSeconds: null,
        label: "",
        appUrl: "",
      },
      queuedBridgeEvents: 0,
      runningBridgeEvents: 0,
      failedBridgeEvents: 0,
      threads: 0,
      threadStatuses: {},
      recentThreads: [],
      recentBridgeEvents: [],
      dumpRetryCount: 2,
      expectedCwd: expectedCwd ? resolve(expectedCwd) : "",
      nextAction: isLocalAppUrl()
        ? `run: npm run dev -- --port ${port}`
        : "run local app and rerun with --app-url http://localhost:3001",
      hostedFallback: isLocalAppUrl() ? "" : fallback,
      dbUnavailable: fallback,
      installDocs: doctorReport ? await installDocDoctor() : undefined,
    };
    if (doctorReport) {
      report.doctor = doctorVerdictFor(report);
      applyDoctorExitCode(report);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log("JustSwipe bridge doctor");
    console.log(`appUrl: ${report.appUrl}`);
    console.log(`mode: ${report.mode}`);
    console.log(`dbUnavailable: ${report.dbUnavailable}`);
    console.log(`next: ${report.nextAction}`);
    console.log(`installDoc: ${report.installDocs.canonicalInstallDocUrl}`);
    console.log(
      `installDocReachable: ${report.installDocs.raw.ok ? "yes" : "no"} (${report.installDocs.raw.status})`,
    );
    console.log(`appInstallMirror: skipped (${report.installDocs.appMirror.reason})`);
    console.log(`doctor: ${report.doctor.status}`);
    if (!report.doctor.ready) {
      console.log(`doctorFailedChecks: ${report.doctor.failedChecks.join(", ")}`);
    }
    return;
  }

  const integration = integrationForGuest(db);
  const connectionId = bridgeConnectionId(db);
  const queued = queuedEvents(db);
  const running = bridgeEventsByStatus(db, ["running"]);
  const failed = bridgeEventsByStatus(db, ["failed"]);
  const handoffs = (db.tables?.handoffs ?? []).filter((row) =>
    connectionId ? row.connectionId === connectionId : row.ownerId === ownerIdForGuest(),
  );
  const activeHandoffs = handoffs.filter((row) =>
    ["awaiting_justswipe", "in_progress", "responding_to_codex", "failed"].includes(row.status),
  );
  const threads = (db.tables?.codexThreads ?? []).filter((row) =>
    connectionId ? row.connectionId === connectionId : row.ownerId === ownerIdForGuest(),
  );
  const pairedDevices = (db.tables?.integrations ?? []).filter((row) =>
    connectionId ? row.connectionId === connectionId && isFuture(row.pairedUntil) : false,
  );
  const activePairCodes = (db.tables?.pairingCodes ?? []).filter((row) =>
    row.ownerId === ownerIdForGuest() && row.status === "active" && isFuture(row.expiresAt),
  );
  const connected = Boolean(connectionId && integration?.pairedUntil && isFuture(integration.pairedUntil));
  const recentThreads = recentRows(threads).map(statusThreadSummary);
  const threadSummaries = threads.map(statusThreadSummary);
  const recentBridgeEvents = recentRows([...queued, ...running, ...failed]).map(statusEventSummary);
  const activeHandoffCards = activeHandoffs.map(statusHandoffSummary);
  const bridgeHeartbeat = statusBridgeHeartbeat(db, connectionId);
  const currentThread = recentThreads[0];
  const watcherCommand = `npm run bridge:watch -- --app-url ${appBaseUrl()} --daemon`;
  const nextAction = failed.length
    ? `fix the bridge error, then retry: npm run bridge:retry-failed -- --app-url ${appBaseUrl()}`
    : running.length
      ? "bridge is relaying; wait or inspect watcher logs"
      : queued.length
        ? `run: npm run bridge${runAll ? ":all" : ""} -- --app-url ${appBaseUrl()}`
        : activeHandoffs.some((row) => ["awaiting_justswipe", "in_progress"].includes(row.status))
      ? `open: ${appBaseUrl()}`
      : connected && !bridgeHeartbeat.fresh
        ? `start watcher: ${watcherCommand}`
      : connected
        ? "no cards waiting; send an idea from JustSwipe or keep watcher running"
        : `pair: npm run bridge:pair -- --app-url ${appBaseUrl()} --open`;
  const report = {
    appUrl: appBaseUrl(),
    mode: isLocalAppUrl() ? "local" : "hosted",
    guest: ownerIdForGuest(),
    connected,
    connectionId: connectionId || "",
    pairedUntil: integration?.pairedUntil || "",
    currentProject: currentThread?.projectName || integration?.projectName || "",
    currentCwd: currentThread?.cwd || integration?.cwd || "",
    currentThread: currentThread?.threadTitle || integration?.threadTitle || "",
    pairedDevices: pairedDevices.length,
    activePairCodes: activePairCodes.length,
    activeHandoffs: activeHandoffs.length,
    activeHandoffStatuses: statusCounts(activeHandoffs),
    activeHandoffCards,
    bridgeHeartbeat,
    queuedBridgeEvents: queued.length,
    runningBridgeEvents: running.length,
    failedBridgeEvents: failed.length,
    threads: threads.length,
    threadStatuses: statusCounts(threadSummaries, "threadStatus"),
    recentThreads,
    recentBridgeEvents,
    dumpRetryCount,
    expectedCwd: expectedCwd ? resolve(expectedCwd) : "",
    nextAction,
    hostedFallback:
      isLocalAppUrl()
        ? ""
        : "if Lakebed reports mutations quota exceeded, use --app-url http://localhost:3001 until reset",
  };

  if (doctorReport) {
    report.installDocs = await installDocDoctor();
    report.doctor = doctorVerdictFor(report);
    applyDoctorExitCode(report);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("JustSwipe bridge status");
  console.log(`appUrl: ${report.appUrl}`);
  console.log(`mode: ${report.mode}`);
  console.log(`guest: ${report.guest}`);
  console.log(`connection: ${connected ? "connected" : "not connected"}`);
  console.log(`connectionId: ${report.connectionId || "none"}`);
  console.log(`pairedUntil: ${report.pairedUntil || "none"}`);
  console.log(`pairedDevices: ${report.pairedDevices}`);
  console.log(`currentProject: ${report.currentProject || "unknown"}`);
  console.log(`currentCwd: ${report.currentCwd || "unknown"}`);
  console.log(`currentThread: ${report.currentThread || "unknown"}`);
  if (report.expectedCwd) {
    console.log(`expectedCwd: ${report.expectedCwd}`);
  }
  console.log(`activePairCodes: ${report.activePairCodes}`);
  console.log(
    `bridgeHeartbeat: ${report.bridgeHeartbeat.status}${
      report.bridgeHeartbeat.ageSeconds === null ? "" : ` (${report.bridgeHeartbeat.ageSeconds}s ago)`
    }`,
  );
  console.log(`activeHandoffs: ${report.activeHandoffs} (${formatCounts(report.activeHandoffStatuses)})`);
  for (const handoff of report.activeHandoffCards) {
    const position = `${handoff.activeCardIndex + 1}/${Math.max(handoff.cardCount, 1)}`;
    console.log(
      `- ${handoff.status}: ${handoff.threadTitle || handoff.threadId || "unknown thread"} -> ${handoff.cardTitle || handoff.cardId || "unknown card"} (${position}, ${handoff.recommendedAction || "no recommendation"})`,
    );
  }
  console.log(`queuedBridgeEvents: ${report.queuedBridgeEvents}`);
  console.log(`runningBridgeEvents: ${report.runningBridgeEvents}`);
  console.log(`failedBridgeEvents: ${report.failedBridgeEvents}`);
  console.log(`threads: ${report.threads} (${formatCounts(report.threadStatuses)})`);
  if (report.dumpRetryCount) {
    console.log(`dbDumpRetries: ${report.dumpRetryCount}`);
  }
  console.log(`next: ${report.nextAction}`);

  if (report.hostedFallback) {
    console.log(`hostedFallback: ${report.hostedFallback}`);
  }

  if (doctorReport && report.installDocs) {
    console.log(`installDoc: ${report.installDocs.canonicalInstallDocUrl}`);
    console.log(
      `installDocReachable: ${report.installDocs.raw.ok ? "yes" : "no"} (${report.installDocs.raw.status})`,
    );

    if (report.installDocs.appMirror.skipped) {
      console.log(`appInstallMirror: skipped (${report.installDocs.appMirror.reason})`);
    } else {
      console.log(
        `appInstallMirror: ${report.installDocs.appMirror.ok ? "ok" : "failed"} (${report.installDocs.appMirror.status})`,
      );
    }

    console.log(`doctor: ${report.doctor.status}`);
    if (!report.doctor.ready) {
      console.log(`doctorFailedChecks: ${report.doctor.failedChecks.join(", ")}`);
    }
  }
}

function promptForEvent(event) {
  return `${event.prompt}

Keep normal prose under 180 words.

JustSwipe machine contract:
- If this is a JustSwipe-started greenfield idea, your first useful response must be a JustSwipe planning handoff unless the user explicitly said not to ask questions.
- If this packet, the repo instructions, or your own response says you should ask/send/emit a JustSwipe card or handoff, append a valid JUSTSWIPE_HANDOFF_JSON block before ending.
- Do not say "I will send/emit/ask JustSwipe" unless the same response includes the marker block.
- Use as many cards as needed and as few as possible; each card must be one concise decision.
- End a handoff response with AWAITING_JUSTSWIPE_RESPONSE <handoff-or-card-id>.`;
}

async function runCodexExec(event) {
  await mkdir(bridgeDir, { recursive: true });
  const safeId = event.id.replace(/[^a-zA-Z0-9-]/g, "");
  const promptPath = join(bridgeDir, `${safeId}.prompt.txt`);
  const responsePath = join(bridgeDir, `${safeId}.response.txt`);
  const prompt = promptForEvent(event);
  const targetCwd = resolve(event.cwd || threadCwd);

  await mkdir(targetCwd, { recursive: true });
  await writeFile(promptPath, prompt, "utf8");
  const command = [
    "Get-Content -Raw -LiteralPath",
    psQuote(promptPath),
    "|",
    "codex exec --skip-git-repo-check -C",
    psQuote(targetCwd),
    "--output-last-message",
    psQuote(responsePath),
    "-",
  ].join(" ");

  const result = await run(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { timeoutMs: codexTimeoutMs },
  );

  if (result.code !== 0) {
    throw new Error(`codex exec failed.\n${result.stderr || result.stdout}`);
  }

  const response = (await readFile(responsePath, "utf8")).trim();
  if (!response) {
    throw new Error("codex exec completed without a response body.");
  }
  return {
    response,
    threadMeta: threadMetadataFromEvent(event, {
      threadStatus: "idle",
    }),
  };
}

async function runCodexAppServer(event) {
  const createsThread = event.action === "project_idea_new_thread" || !event.threadId;

  if (!event.threadId && !createsThread) {
    throw new Error("Codex app-server relay needs a threadId on the bridge event.");
  }

  const client = await createAppServerClient();
  let threadId = event.threadId || "";
  let turnId = "";
  let threadMeta = threadMetadataFromEvent(event, {
    threadStatus: "running",
  });

  try {
    if (createsThread) {
      const cwd = resolve(event.cwd || threadCwd);
      await mkdir(cwd, { recursive: true });
      const started = await client.request("thread/start", {
        cwd,
        ephemeral: false,
        threadSource: "user",
      });

      threadId = started?.thread?.id || "";

      if (!threadId) {
        throw new Error("Codex app-server did not return a thread id for the JustSwipe idea.");
      }

      threadMeta = threadMetadataFromThread(started?.thread, {
        ...threadMetadataFromEvent(event),
        threadId,
        cwd,
        threadStatus: "running",
      });
    } else {
      try {
        await client.request("thread/resume", { threadId });
      } catch (error) {
        throw new Error(
          [
            `Could not resume Codex thread ${threadId} through app-server.`,
            "Use a thread created by the native app-server bridge, or rerun with --relay exec for the isolated CLI fallback.",
            error instanceof Error ? error.message : String(error),
          ].join("\n"),
        );
      }
    }

    const turn = await client.request("turn/start", {
      threadId,
      input: [
        {
          type: "text",
          text: promptForEvent(event),
          text_elements: [],
        },
      ],
    });
    turnId = turn?.turn?.id || "";

    if (!turnId) {
      throw new Error("Codex app-server did not return a turn id.");
    }

    const turnResult = await waitForTurnResult(client, threadId, turnId, threadMeta);
    const response = turnResult.response;
    threadMeta = turnResult.threadMeta;

    if (!response) {
      throw new Error("Codex app-server completed without a final response body.");
    }

    return {
      response,
      threadMeta: ensureThreadMetadata(threadMeta, {
        threadId,
        cwd: event.cwd || threadCwd,
        threadStatus: "idle",
      }),
    };
  } finally {
    client.close();
  }
}

async function runCodex(event) {
  if (relayMode === "exec") {
    return runCodexExec(event);
  }

  if (relayMode === "app-server") {
    return runCodexAppServer(event);
  }

  throw new Error(`Unknown relay mode "${relayMode}". Use app-server or exec.`);
}

function isTransientCodexRelayError(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  return [
    /database is locked/i,
    /failed to initialize sqlite state runtime/i,
    /failed to initialize state runtime/i,
    /app-server closed before responding/i,
    /ECONNRESET/i,
    /EPIPE/i,
  ].some((pattern) => pattern.test(message));
}

async function runCodexWithTransientRetry(event, { quiet = false } = {}) {
  try {
    return await runCodex(event);
  } catch (error) {
    if (!isTransientCodexRelayError(error)) {
      throw error;
    }

    if (!quiet) {
      const message = error instanceof Error ? error.message : String(error || "");
      console.warn(
        `Transient Codex relay error for ${event.handoffId || event.id}; retrying once in ${codexRetryDelayMs}ms.`,
      );
      console.warn(message.split("\n")[0]);
    }

    await sleep(codexRetryDelayMs);
    return runCodex(event);
  }
}

function extractNextHandoff(response) {
  const marker = /JUSTSWIPE_HANDOFF_JSON\s*([\s\S]*?)\s*END_JUSTSWIPE_HANDOFF_JSON/m;
  const match = response.match(marker);

  if (!match) {
    return null;
  }

  let raw = match[1].trim();
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      return {
        reason: String(parsed.reason || "Codex asked another JustSwipe question."),
        cardsJson: JSON.stringify(parsed.cards),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function lakebedRequest(ws, op, payload = {}) {
  return new Promise((resolvePromise, reject) => {
    const id = Math.floor(Math.random() * 1_000_000);
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for Lakebed mutation response."));
      ws.close();
    }, 15_000);

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== id) {
        return;
      }
      clearTimeout(timeout);
      if (message.ok) {
        resolvePromise(message.result);
      } else {
        reject(new Error(formatLakebedError(message.error ?? "Lakebed mutation failed.")));
      }
      ws.close();
    });

    ws.send(JSON.stringify({ id, op, ...payload }));
  });
}

async function runMutation(name, mutationArgs = []) {
  if (typeof WebSocket === "undefined") {
    throw new Error("This Node runtime does not expose WebSocket.");
  }

  const url = lakebedWsUrl();
  const ws = new WebSocket(url);

  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out opening Lakebed socket."));
    }, 10_000);

    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolvePromise();
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error(`Could not connect to ${url}`));
      },
      { once: true },
    );
  });

  return lakebedRequest(ws, "mutation.run", {
    name,
    args: mutationArgs,
  });
}

async function claimEvent(event) {
  const result = await runMutation("claimBridgeEvent", [event.id]);

  try {
    return JSON.parse(String(result));
  } catch {
    return { ok: false, error: "Could not claim bridge event." };
  }
}

async function recoverStaleBridgeEvents({ quiet = false } = {}) {
  const result = await runMutation("recoverStaleBridgeEvents", [String(runningLeaseMs)]);
  let parsed;

  try {
    parsed = JSON.parse(String(result));
  } catch {
    parsed = { ok: false, error: "Could not recover stale bridge events." };
  }

  if (parsed.recovered > 0 && !quiet) {
    console.log(`Recovered ${parsed.recovered} stale running bridge event${parsed.recovered === 1 ? "" : "s"}.`);
  }

  return parsed;
}

async function touchRunningEvent(event) {
  return runMutation("touchRunningBridgeEvent", [event.id]);
}

async function markSent(event, response, threadMeta) {
  await runMutation("markBridgeSent", [event.id, response, metadataJson(threadMeta)]);
}

async function markFailed(event, error) {
  await runMutation("markBridgeFailed", [event.id, String(error).slice(0, 1600)]);
}

async function maybeCreateNextHandoff(event, relayResult) {
  const next = extractNextHandoff(relayResult.response);

  if (!next) {
    return null;
  }

  return runMutation("createHandoffFromBridge", [
    event.connectionId || "",
    event.threadId || relayResult.threadMeta?.threadId || "",
    next.cardsJson,
    next.reason,
    metadataJson(relayResult.threadMeta || threadMetadataFromEvent(event)),
  ]);
}

async function maybeCreateInitialHandoff(threadId, final, threadMeta) {
  const next = extractNextHandoff(final);

  if (!next) {
    return null;
  }

  const db = await dumpDb();
  const connectionId = bridgeConnectionId(db);

  if (!connectionId) {
    throw new Error("Codex emitted a JustSwipe handoff, but no active JustSwipe connection exists.");
  }

  return runMutation("createHandoffFromBridge", [
    connectionId,
    threadId,
    next.cardsJson,
    next.reason,
    metadataJson(threadMeta),
  ]);
}

async function createPairingCode() {
  const code = await runMutation("createPairingCode", []);
  const link = pairingLink(code);
  console.log(`JustSwipe pairing code: ${code}`);
  console.log(`Pair link: ${link}`);
  console.log("Expires in 2 minutes. The paired browser stays connected for today.");
  if (openPairLink) {
    openUrl(link);
    console.log("Opened pair link in the default browser.");
  }
  return code;
}

async function pairBridgeDevice(label = "JustSwipe bridge") {
  const deviceJson = JSON.stringify({
    deviceId: `justswipe-${guest}-bridge`,
    label,
    browser: "Bridge",
    platform: process.platform,
  });
  const code = await runMutation("createPairingCode", [deviceJson]);
  const message = await runMutation("pairWithCode", [code, deviceJson]);

  if (!String(message || "").includes("Connected")) {
    throw new Error(`Could not pair bridge device with code ${code}: ${message || "unknown error"}`);
  }

  return { code, message };
}

async function createDemoHandoff() {
  await runMutation("resetDemo", []);
  console.log("Demo handoff bundle reset.");
}

async function retryFailedBridgeEvents() {
  const result = JSON.parse(await runMutation("retryFailedBridgeEvents", []));

  if (!result.ok) {
    throw new Error(result.error || "Could not retry failed JustSwipe events.");
  }

  console.log(`Retried ${result.retried} failed JustSwipe event${result.retried === 1 ? "" : "s"}.`);
  if (result.retried > 0) {
    console.log(`Run the watcher to relay queued work: npm run bridge:watch -- --app-url ${appBaseUrl()}`);
  }
}

async function queuePlanningIdea() {
  if (!ideaPrompt.trim()) {
    throw new Error("Pass an idea with --idea \"...\".");
  }

  let targetThreadId = valueAfter("--thread-id") ?? "";

  if (!targetThreadId && args.has("--current-thread")) {
    const db = await dumpDb();
    const connectionId = bridgeConnectionId(db);
    const thread = newestThreadForConnection(db, connectionId);
    targetThreadId = thread?.threadId || "";

    if (!targetThreadId) {
      throw new Error("No current Codex thread found for this JustSwipe connection.");
    }
  }

  const route = targetThreadId ? "existing_thread" : "new_thread";
  const result = await runMutation("startPlanningDiscussion", [
    ideaPrompt.trim(),
    targetThreadId,
    route,
  ]);
  let parsed;

  try {
    parsed = JSON.parse(String(result));
  } catch {
    parsed = { ok: false, error: String(result || "Could not queue JustSwipe idea.") };
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || "Could not queue JustSwipe idea.");
  }

  console.log("Queued JustSwipe idea.");
  console.log(`route: ${route}`);
  if (targetThreadId) {
    console.log(`thread: ${targetThreadId}`);
  }
  console.log(`Run the watcher to relay queued work: npm run bridge:watch -- --app-url ${appBaseUrl()}`);
}

async function runSmoke() {
  const quotaMessage = formatLakebedError(
    'mutations quota exceeded {"resetAt":"2026-06-26T00:00:00.000Z","retryAfterSeconds":7200}',
  );

  if (
    !quotaMessage.includes("hosted mutation quota exhausted; switch bridge app URL to local dev") ||
    !quotaMessage.includes("resetAt: 2026-06-26T00:00:00.000Z") ||
    !quotaMessage.includes("retryAfterSeconds: 7200")
  ) {
    throw new Error("Smoke failed: quota fallback message did not include required guidance.");
  }

  const partialTurn = await readTurnResult(
    {
      request: async () => ({
        thread: {
          id: "smoke-thread",
          cwd: root,
          status: { type: "running" },
          turns: [
            {
              id: "smoke-turn",
              status: { type: "running" },
              items: [
                {
                  type: "agentMessage",
                  text: "I am checking files before emitting the required JustSwipe handoff.",
                },
              ],
            },
          ],
        },
      }),
    },
    "smoke-thread",
    "smoke-turn",
    { cwd: root, threadStatus: "running" },
  );

  if (partialTurn.response) {
    throw new Error("Smoke failed: non-terminal Codex message was treated as a final response.");
  }

  await clearConnectionState();

  const code = await runMutation("createPairingCode", [
    JSON.stringify({
      deviceId: "justswipe-smoke-bridge",
      label: "JustSwipe smoke bridge",
      browser: "Bridge",
      platform: process.platform,
    }),
  ]);

  if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(String(code))) {
    throw new Error(`Smoke failed: invalid pair code "${code}".`);
  }

  const visibleCodes = JSON.parse(await runMutation("smokeVisiblePairingCodes", []));

  if (!Array.isArray(visibleCodes) || !visibleCodes.some((row) => row.code === code)) {
    throw new Error("Smoke failed: active pair code was not visible to the UI query.");
  }

  const supersedingCode = await runMutation("createPairingCode", [
    JSON.stringify({
      deviceId: "justswipe-smoke-bridge-next",
      label: "JustSwipe smoke bridge next",
      browser: "Bridge",
      platform: process.platform,
    }),
  ]);
  const visibleAfterSupersede = JSON.parse(await runMutation("smokeVisiblePairingCodes", []));

  if (
    !Array.isArray(visibleAfterSupersede) ||
    visibleAfterSupersede.some((row) => row.code === code) ||
    !visibleAfterSupersede.some((row) => row.code === supersedingCode)
  ) {
    throw new Error("Smoke failed: pairingCodes query did not hide superseded pair codes.");
  }

  const started = JSON.parse(
    await runMutation("startPlanningDiscussion", [
      "Smoke test idea. Do not call Codex from this smoke command.",
      "",
      "new_thread",
    ]),
  );

  if (!started.ok) {
    throw new Error(`Smoke failed: could not queue idea: ${started.error || "unknown error"}`);
  }

  const queued = queuedEvents(await dumpDb());
  const event = queued[0];

  if (!event) {
    throw new Error("Smoke failed: no bridge event queued.");
  }

  if (event.action !== "project_idea_new_thread") {
    throw new Error(`Smoke failed: expected project_idea_new_thread, got ${event.action}.`);
  }

  if (!event.connectionId || !event.handoffId || !event.prompt.includes("JUSTSWIPE PLANNING START")) {
    throw new Error("Smoke failed: queued idea is missing required bridge packet fields.");
  }

  const claimed = await claimEvent(event);

  if (!claimed.ok) {
    throw new Error(`Smoke failed: could not claim queued event: ${claimed.error || "unknown error"}`);
  }

  const duplicateClaim = await claimEvent(event);

  if (duplicateClaim.ok) {
    throw new Error("Smoke failed: duplicate event claim was allowed.");
  }

  await markFailed(event, "Smoke test intentionally stopped before Codex relay.");

  let db = await dumpDb();
  const retryResult = JSON.parse(await runMutation("retryBridgeEvent", [event.id]));

  if (!retryResult.ok || retryResult.retried !== 1) {
    throw new Error(`Smoke failed: failed bridge event was not retried: ${retryResult.error || "unknown error"}`);
  }

  db = await dumpDb();
  const retriedEvent = queuedEvents(db).find((row) => row.id === event.id);

  if (!retriedEvent) {
    throw new Error("Smoke failed: retried bridge event was not queued.");
  }

  await markSent(
    retriedEvent,
    "Smoke retry accepted.",
    threadMetadataFromEvent(retriedEvent, { threadStatus: "idle" }),
  );

  db = await dumpDb();

  if (queuedEvents(db).some((row) => row.id === event.id)) {
    throw new Error("Smoke failed: retried bridge event stayed queued after mark sent.");
  }

  const connectionId = bridgeConnectionId(db);
  const smokeThreadMeta = threadMetadataFromEvent({
    threadId: "smoke-multicard-thread",
    threadTitle: "Smoke multi-card thread",
    cwd: root,
    projectName: "justswipe",
    threadStatus: "awaiting_justswipe",
  });
  const multiHandoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    smokeThreadMeta.threadId,
    JSON.stringify([
      {
        cardId: "smoke-card-one",
        title: "Smoke card one",
        summary: "First card in a two-card smoke bundle.",
        recommendedAction: "yes",
        visualContext: "Card one should advance the bundle, not queue a bridge event.",
        questionType: "yes_no",
        yesPayloadSchema: [],
        noPayloadSchema: [],
        morePayloadSchema: [],
        laterPayloadSchema: [],
        optionPayloadSchemas: {},
        requiredFieldsByAction: {},
        quickRepliesByAction: {
          yes: ["First card done"],
        },
      },
      {
        cardId: "smoke-card-two",
        title: "Smoke card two",
        summary: "Second card completes the smoke bundle.",
        recommendedAction: "yes",
        visualContext: "Card two should queue exactly one bridge event with both responses.",
        questionType: "yes_no",
        yesPayloadSchema: [],
        noPayloadSchema: [],
        morePayloadSchema: [],
        laterPayloadSchema: [],
        optionPayloadSchemas: {},
        requiredFieldsByAction: {},
        quickRepliesByAction: {
          yes: ["Second card done"],
        },
      },
    ]),
    "Smoke multi-card handoff.",
    metadataJson(smokeThreadMeta),
  ]);

  db = await dumpDb();
  let multiHandoff = activeHandoffRows(db).find((row) => row.handoffId === multiHandoffId);

  if (!multiHandoff) {
    throw new Error("Smoke failed: multi-card handoff was not active.");
  }

  const firstCard = await submitFirstYesReply(multiHandoff, "First card done");
  db = await dumpDb();
  multiHandoff = activeHandoffRows(db).find((row) => row.handoffId === multiHandoffId);

  if (!multiHandoff || multiHandoff.status !== "in_progress" || multiHandoff.activeCardIndex !== "1") {
    throw new Error("Smoke failed: first multi-card response did not advance to card two.");
  }

  if (queuedEvents(db).some((row) => row.handoffId === multiHandoffId)) {
    throw new Error("Smoke failed: multi-card handoff queued before all cards were answered.");
  }

  const secondCard = await submitFirstYesReply(multiHandoff, "Second card done");
  db = await dumpDb();
  const multiEvent = queuedEvents(db).find((row) => row.handoffId === multiHandoffId);

  if (!multiEvent) {
    throw new Error("Smoke failed: completed multi-card handoff did not queue a bridge event.");
  }

  const multiResponses = JSON.parse(multiEvent.feedback || "[]");

  if (
    !Array.isArray(multiResponses) ||
    multiResponses.length !== 2 ||
    multiResponses[0]?.cardId !== firstCard.cardId ||
    multiResponses[1]?.cardId !== secondCard.cardId
  ) {
    throw new Error("Smoke failed: completed multi-card event did not include both responses in order.");
  }

  const requiredThreadMeta = threadMetadataFromEvent({
    threadId: "smoke-required-thread",
    threadTitle: "Smoke required-field thread",
    cwd: root,
    projectName: "justswipe",
    threadStatus: "awaiting_justswipe",
  });
  const requiredHandoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    requiredThreadMeta.threadId,
    JSON.stringify([
      {
        cardId: "smoke-required-card",
        title: "Smoke required field card",
        summary: "A required schema field must block empty submissions.",
        recommendedAction: "yes",
        visualContext: "Submitting without the required field should fail before relay.",
        questionType: "adaptive_form",
        yesPayloadSchema: [
          {
            id: "decision_note",
            label: "Decision note",
            type: "textarea",
            required: true,
          },
        ],
        noPayloadSchema: [],
        morePayloadSchema: [],
        laterPayloadSchema: [],
        optionPayloadSchemas: {},
        requiredFieldsByAction: {
          yes: ["decision_note"],
        },
        quickRepliesByAction: {},
      },
    ]),
    "Smoke required-field handoff.",
    metadataJson(requiredThreadMeta),
  ]);

  db = await dumpDb();
  const requiredHandoff = activeHandoffRows(db).find((row) => row.handoffId === requiredHandoffId);

  if (!requiredHandoff) {
    throw new Error("Smoke failed: required-field handoff was not active.");
  }

  const emptyRequiredResult = JSON.parse(
    await runMutation("submitCardResponse", [
      requiredHandoff.id,
      "smoke-required-card",
      "yes",
      JSON.stringify({ decision_note: "" }),
    ]),
  );

  if (emptyRequiredResult.ok || !String(emptyRequiredResult.error || "").includes("decision_note")) {
    throw new Error("Smoke failed: missing required field was not rejected.");
  }

  db = await dumpDb();

  if (queuedEvents(db).some((row) => row.handoffId === requiredHandoffId)) {
    throw new Error("Smoke failed: invalid required-field response queued a bridge event.");
  }

  const quickReplyBypassResult = JSON.parse(
    await runMutation("submitCardResponse", [
      requiredHandoff.id,
      "smoke-required-card",
      "yes",
      JSON.stringify({ quick_reply: "Looks good" }),
    ]),
  );

  if (quickReplyBypassResult.ok || !String(quickReplyBypassResult.error || "").includes("decision_note")) {
    throw new Error("Smoke failed: quick reply bypassed a required schema field.");
  }

  const filledRequiredResult = JSON.parse(
    await runMutation("submitCardResponse", [
      requiredHandoff.id,
      "smoke-required-card",
      "yes",
      JSON.stringify({ decision_note: "Required value present" }),
    ]),
  );

  if (!filledRequiredResult.ok || !filledRequiredResult.completed) {
    throw new Error("Smoke failed: valid required-field response did not complete.");
  }

  db = await dumpDb();
  const requiredEvent = queuedEvents(db).find((row) => row.handoffId === requiredHandoffId);

  if (!requiredEvent) {
    throw new Error("Smoke failed: valid required-field response did not queue a bridge event.");
  }

  const requiredResponses = JSON.parse(requiredEvent.feedback || "[]");

  if (requiredResponses[0]?.payload?.decision_note !== "Required value present") {
    throw new Error("Smoke failed: required-field payload was not preserved.");
  }

  const richThreadMeta = threadMetadataFromEvent({
    threadId: "smoke-rich-schema-thread",
    threadTitle: "Smoke rich schema thread",
    cwd: root,
    projectName: "justswipe",
    threadStatus: "awaiting_justswipe",
  });
  const richHtmlPreview =
    "<section><h2>Three-screen app review</h2><p>Choose the sharper direction after seeing the actual UI evidence.</p><ul><li>Home is readable</li><li>Empty state is clear</li><li>Save path needs confirmation</li></ul><button>Keep direction</button></section>";
  const richHandoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    richThreadMeta.threadId,
    JSON.stringify([
      {
        cardId: "smoke-rich-schema-card",
        title: "Smoke rich schema card",
        summary: "A model-made form can ask for structured feedback.",
        recommendedAction: "yes",
        visualContext: "HTML artifact, UI evidence, and structured follow-up fields.",
        questionType: "adaptive_form",
        yesPayloadSchema: [
          {
            id: "direction",
            label: "Direction",
            type: "select",
            required: true,
            options: ["Keep direction", "Simplify", "Try bolder"],
          },
          {
            id: "implementation_note",
            label: "Implementation note",
            type: "text",
            required: true,
            placeholder: "What should Codex preserve?",
          },
          {
            id: "mobile_first",
            label: "Mobile first",
            type: "toggle",
            helper: "Keep the phone swipe surface as the primary experience.",
          },
          {
            id: "evidence_checked",
            label: "Evidence checked",
            type: "checklist",
            required: true,
            options: ["HTML preview", "Thread context", "Failure path"],
          },
          {
            id: "confidence",
            label: "Confidence",
            type: "rating",
            required: true,
            helper: "5 means Codex can continue without another card.",
          },
          {
            id: "artifact_context",
            label: "Artifact context",
            type: "evidence",
            helper: "Inline preview is rendered as native card context, not executed as arbitrary app code.",
          },
        ],
        noPayloadSchema: [],
        morePayloadSchema: [],
        laterPayloadSchema: [],
        optionPayloadSchemas: {},
        requiredFieldsByAction: {
          yes: ["direction", "implementation_note", "evidence_checked", "confidence"],
        },
        quickRepliesByAction: {
          yes: ["Keep direction"],
          no: ["Needs another pass"],
        },
        agentHtmlPreview: richHtmlPreview,
      },
    ]),
    "Smoke rich schema handoff.",
    metadataJson(richThreadMeta),
  ]);

  db = await dumpDb();
  const richHandoff = activeHandoffRows(db).find((row) => row.handoffId === richHandoffId);

  if (!richHandoff) {
    throw new Error("Smoke failed: rich schema handoff was not active.");
  }

  const richCards = JSON.parse(richHandoff.cardsJson || "[]");
  const richCard = richCards[0];

  if (
    richCard?.agentHtmlPreview !== richHtmlPreview ||
    richCard?.yesPayloadSchema?.length !== 6 ||
    richCard?.yesPayloadSchema?.some((field) => !field.id || !field.label || !field.type)
  ) {
    throw new Error("Smoke failed: rich schema card was not preserved.");
  }

  const richResult = JSON.parse(
    await runMutation("submitCardResponse", [
      richHandoff.id,
      "smoke-rich-schema-card",
      "yes",
      JSON.stringify({
        direction: "Keep direction",
        implementation_note: "Preserve the compact swipe surface.",
        mobile_first: true,
        evidence_checked: ["HTML preview", "Thread context"],
        confidence: "5",
      }),
    ]),
  );

  if (!richResult.ok || !richResult.completed) {
    throw new Error(`Smoke failed: rich schema response did not complete: ${richResult.error || "unknown error"}`);
  }

  db = await dumpDb();
  const richEvent = queuedEvents(db).find((row) => row.handoffId === richHandoffId);

  if (!richEvent) {
    throw new Error("Smoke failed: rich schema response did not queue a bridge event.");
  }

  const richResponses = JSON.parse(richEvent.feedback || "[]");
  const richPayload = richResponses[0]?.payload || {};

  if (
    richPayload.direction !== "Keep direction" ||
    richPayload.implementation_note !== "Preserve the compact swipe surface." ||
    richPayload.mobile_first !== true ||
    !Array.isArray(richPayload.evidence_checked) ||
    richPayload.evidence_checked.length !== 2 ||
    richPayload.confidence !== "5"
  ) {
    throw new Error("Smoke failed: rich schema payload was not preserved.");
  }

  await clearConnectionState();

  console.log("JustSwipe bridge smoke passed.");
  console.log(`Pair code format: ${code}`);
  console.log(`Pair code query hides superseded code: ${supersedingCode}`);
  console.log(`Queued packet: ${event.action} / ${event.handoffId}`);
  console.log("Duplicate claim blocked.");
  console.log(`Multi-card bundle advanced and queued: ${multiHandoffId}`);
  console.log(`Required-field validation blocked empty payload and quick-reply bypass: ${requiredHandoffId}`);
  console.log(`Rich schema and HTML preview preserved: ${richHandoffId}`);
  console.log("Quota fallback guidance verified.");
}

function todoHandoffCard() {
  return {
    cardId: "todo-first-slice",
    title: "Pick the first todo slice",
    summary:
      "The todo Codex thread is waiting for one product direction before it edits files.",
    recommendedAction: "yes",
    visualContext:
      "Thread: native Codex todo worker | App goal: tiny local todo app | Decision needed: first useful slice",
    questionType: "adaptive_form",
    yesPayloadSchema: [],
    noPayloadSchema: [],
    morePayloadSchema: [],
    laterPayloadSchema: [],
    optionPayloadSchemas: {},
    quickRepliesByAction: {
      yes: [
        "Build add, complete, and delete todos",
        "Keep it one-screen and minimal",
        "Start with localStorage persistence",
        "Add delete controls and completion state",
      ],
      no: [
        "Do not build yet",
        "Ask for a smaller prototype",
        "Clarify the target user first",
      ],
      more: [
        "Show 3 todo slice options",
        "Compare storage vs UI first",
        "Give the lowest-risk path",
      ],
      later: [
        "Ask me after setup",
        "Save this decision",
      ],
    },
    requiredFieldsByAction: {},
    agentHtmlPreview:
      "<section><h2>Todo first slice</h2><p>Choose the smallest useful todo behavior for Codex to build now.</p><ul><li>Add todo input</li><li>Visible task list</li><li>Complete/delete affordance</li><li>Local persistence optional</li></ul><button>Build add-and-list todos first</button><button>Show alternatives</button></section>",
  };
}

function setupHandoffCard(code, link) {
  return {
    cardId: "justswipe-setup",
    title: "Connect this repo to JustSwipe?",
    summary:
      "Pair your browser or phone with hosted JustSwipe before Codex keeps working in this repo.",
    recommendedAction: "yes",
    visualContext: `Pair code: ${code}. Pair link: ${link}. Use desktop, phone, or both.`,
    questionType: "yes_no",
    yesPayloadSchema: [],
    noPayloadSchema: [],
    morePayloadSchema: [],
    laterPayloadSchema: [],
    optionPayloadSchemas: {},
    quickRepliesByAction: {
      yes: [
        "Use desktop browser",
        "Use phone",
        "Use both desktop and phone",
        "Pair now, then continue",
      ],
      no: [
        "Do not pair yet",
        "Show manual setup steps",
        "Use normal Codex chat for now",
      ],
      more: [
        "Explain the bridge",
        "Show phone setup",
        "Show desktop setup",
      ],
      later: [
        "Ask again after repo setup",
        "Park pairing for later",
      ],
    },
    requiredFieldsByAction: {},
    agentHtmlPreview:
      `<section><h2>Hosted JustSwipe setup</h2><p>Open the pair link on desktop, phone, or both. Do not build a replacement JustSwipe UI in this repo.</p><ul><li>Code: <strong>${code}</strong></li><li>Pair link: ${link}</li><li>After pairing, Codex can send one-card decisions to hosted JustSwipe.</li></ul><button>Use desktop</button><button>Use phone</button><button>Use both</button></section>`,
  };
}

function handoffSmokeCard() {
  return {
    cardId: `handoff-smoke-${Date.now().toString(36)}`,
    title: "Confirm hosted handoff loop",
    summary:
      "This is a live no-edit card proving Codex can hand a decision to hosted JustSwipe and receive the swipe response.",
    recommendedAction: "yes",
    visualContext:
      "Scope: hosted handoff smoke | Expected: swipe yes, bridge relays response, Codex acknowledges without editing files",
    questionType: "yes_no",
    yesPayloadSchema: [],
    noPayloadSchema: [],
    morePayloadSchema: [],
    laterPayloadSchema: [],
    optionPayloadSchemas: {},
    quickRepliesByAction: {
      yes: [
        "Hosted card reached JustSwipe",
        "Relay this no-edit proof back to Codex",
        "Confirm the handoff loop works",
      ],
      no: [
        "Card did not have enough context",
        "Do not relay this proof",
      ],
      more: [
        "Show more handoff context",
        "Explain what will be relayed",
      ],
      later: [
        "Save this proof for later",
      ],
    },
    requiredFieldsByAction: {},
    agentHtmlPreview:
      "<section><h2>Hosted handoff smoke</h2><p>Swipe yes to prove a Codex handoff card can return to the selected thread.</p><ul><li>No file edits</li><li>Hosted JustSwipe card</li><li>Bridge relay back to Codex</li></ul><button>Confirm handoff loop</button></section>",
  };
}

function newestThreadForConnection(db, connectionId) {
  return (db.tables?.codexThreads ?? [])
    .filter((thread) => thread.connectionId === connectionId && thread.threadId)
    .sort((left, right) =>
      String(right.lastActivityAt || right.updatedAt || right.createdAt || "").localeCompare(
        String(left.lastActivityAt || left.updatedAt || left.createdAt || ""),
      ),
    )[0];
}

function hasActivePairedDevice(db, connectionId) {
  return (db.tables?.integrations ?? []).some((row) =>
    row.connectionId === connectionId && row.pairedUntil && isFuture(row.pairedUntil),
  );
}

async function shouldCreateSetupHandoff() {
  if (forceSetupCard) {
    return true;
  }

  const db = await dumpDb();
  const connectionId = bridgeConnectionId(db);
  return !connectionId || !hasActivePairedDevice(db, connectionId);
}

async function createSetupHandoff(options = {}) {
  if (options.clear !== false) {
    await runMutation("clearConnectionState", []);
  }

  let db = await dumpDb();
  let integration = integrationForGuest(db);
  const threadId = valueAfter("--thread-id") ?? integration?.codexThreadId ?? "";

  if (!threadId) {
    throw new Error("No Codex thread id is saved. Run npm run bridge:start-thread first or pass --thread-id.");
  }

  const code = options.code || await createPairingCode();
  const link = pairingLink(code);
  db = await dumpDb();
  integration = integrationForGuest(db);
  const connectionId = valueAfter("--connection-id") ?? integration?.connectionId ?? "";

  if (!connectionId) {
    throw new Error(`Could not create a JustSwipe connection for pairing code ${code}.`);
  }

  const threadMeta = threadMetadataFromEvent({
    threadId,
    threadTitle: integration?.threadTitle,
    cwd: integration?.cwd || resolve(threadCwd),
    projectName: integration?.projectName,
    threadStatus: "awaiting_justswipe",
  });

  const handoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    threadId,
    JSON.stringify([setupHandoffCard(code, link)]),
    "Connect this repo to hosted JustSwipe.",
    metadataJson(threadMeta),
  ]);

  console.log(`Setup handoff queued: ${handoffId}`);
  console.log(`Thread: ${threadId}`);
}

async function recordSetupFailure(error, options = {}) {
  const message = error instanceof Error ? error.message : String(error || "Codex setup failed.");
  const cwd = resolve(options.cwd ?? threadCwd);
  const metadata = threadMetadataFromEvent({
    threadId: options.threadId || "",
    threadTitle: options.threadTitle || "Setup thread",
    cwd,
    projectName: projectNameFromCwd(cwd),
    threadStatus: "failed",
  });

  await runMutation("recordSetupFailure", [
    message,
    metadataJson(metadata),
  ]);

  console.error(`Codex setup failed: ${message}`);
  console.error("JustSwipe recorded the failure so the app can show the exact blocker.");
}

async function createTodoHandoff() {
  await runMutation("clearConnectionState", []);
  let db = await dumpDb();
  let integration = integrationForGuest(db);
  let connectionId = valueAfter("--connection-id") ?? integration?.connectionId ?? "";
  const threadId = valueAfter("--thread-id") ?? integration?.codexThreadId ?? "";

  if (!threadId) {
    throw new Error("No Codex thread id is saved. Run npm run bridge:start-thread first or pass --thread-id.");
  }

  if (!connectionId) {
    const code = await createPairingCode();
    db = await dumpDb();
    integration = integrationForGuest(db);
    connectionId = integration?.connectionId ?? "";

    if (!connectionId) {
      throw new Error(`Could not create a JustSwipe connection for pairing code ${code}.`);
    }
  }

  const threadMeta = threadMetadataFromEvent({
    threadId,
    threadTitle: integration?.threadTitle,
    cwd: integration?.cwd || resolve(threadCwd),
    projectName: integration?.projectName,
    threadStatus: "awaiting_justswipe",
  });

  const handoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    threadId,
    JSON.stringify([todoHandoffCard()]),
    "Todo Codex thread needs the next concrete todo slice.",
    metadataJson(threadMeta),
  ]);

  console.log(`Todo handoff queued: ${handoffId}`);
  console.log(`Thread: ${threadId}`);
}

async function createSmokeHandoff() {
  const db = await dumpDb();
  const integration = integrationForGuest(db);
  const connectionId = valueAfter("--connection-id") ?? bridgeConnectionId(db) ?? "";
  const thread = newestThreadForConnection(db, connectionId);
  const threadId =
    valueAfter("--thread-id") ??
    thread?.threadId ??
    integration?.codexThreadId ??
    "";

  if (!connectionId) {
    throw new Error("No active JustSwipe connection found. Pair hosted JustSwipe first.");
  }

  if (!threadId) {
    throw new Error("No Codex thread id found. Start or pair a JustSwipe project thread first.");
  }

  const threadMeta = threadMetadataFromEvent({
    threadId,
    threadTitle: thread?.threadTitle || integration?.threadTitle,
    cwd: thread?.cwd || integration?.cwd || resolve(threadCwd),
    projectName: thread?.projectName || integration?.projectName,
    threadStatus: "awaiting_justswipe",
  });
  const handoffId = await runMutation("createHandoffFromBridge", [
    connectionId,
    threadId,
    JSON.stringify([handoffSmokeCard()]),
    "Hosted handoff smoke: confirm a card can return to Codex without editing files.",
    metadataJson(threadMeta),
  ]);

  console.log(`Smoke handoff queued: ${handoffId}`);
  console.log(`Thread: ${threadId}`);
}

async function clearConnectionState() {
  await runMutation("clearConnectionState", []);
  console.log("JustSwipe connection state cleared.");
}

async function forgetProjectConnection() {
  const message = await runMutation("forgetProjectConnection", []);
  console.log(message || "JustSwipe project connection forgotten.");
}

let lastHeartbeatAt = 0;
let lastThreadSyncAt = 0;

async function touchBridgeHeartbeat({ force = false } = {}) {
  const current = Date.now();

  if (!force && current - lastHeartbeatAt < heartbeatMs) {
    return;
  }

  const touched = await runMutation("touchBridgeHeartbeat", [
    "Local bridge watcher",
    appBaseUrl(),
  ]);

  if (touched) {
    lastHeartbeatAt = current;
  }
}

async function syncKnownThreads({ force = false, quiet = false } = {}) {
  if (dryRun || relayMode !== "app-server") {
    return 0;
  }

  const current = Date.now();
  if (!force && current - lastThreadSyncAt < threadSyncMs) {
    return 0;
  }

  lastThreadSyncAt = current;

  const db = await dumpDb();
  const connectionId = bridgeConnectionId(db);
  const threads = (db.tables?.codexThreads ?? [])
    .filter((thread) => thread.connectionId === connectionId && thread.threadId)
    .slice(0, 50);

  if (!connectionId || threads.length === 0) {
    return 0;
  }

  const client = await createAppServerClient();
  let synced = 0;

  try {
    for (const thread of threads) {
      try {
        const read = await client.request("thread/read", {
          threadId: thread.threadId,
          includeTurns: false,
        });
        const metadata = threadMetadataFromThread(read?.thread, {
          threadId: thread.threadId,
          threadTitle: thread.threadTitle,
          threadStatus: thread.threadStatus,
          cwd: thread.cwd,
          projectName: thread.projectName,
          lastActivityAt: thread.lastActivityAt,
        });
        await runMutation("saveThreadMetadata", [
          connectionId,
          thread.threadId,
          metadataJson(metadata),
        ]);
        synced += 1;
      } catch (error) {
        if (!quiet) {
          console.warn(
            `Could not sync Codex thread ${shortThreadId(thread.threadId)}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  } finally {
    client.close();
  }

  if (!quiet) {
    console.log(`Synced ${synced} ${synced === 1 ? "thread" : "threads"} from Codex.`);
  }

  return synced;
}

async function rehydrateThreadsFromCache() {
  const db = await dumpDb();
  const connectionId = bridgeConnectionId(db);

  if (!connectionId) {
    throw new Error("No active JustSwipe connection exists. Run setup or pair before rehydrating threads.");
  }

  let cache;
  try {
    cache = JSON.parse(await readFile(threadCachePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read thread cache at ${threadCachePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const threads = Array.isArray(cache.threads) ? cache.threads.filter((thread) => thread.threadId) : [];
  let saved = 0;

  for (const thread of threads) {
    const metadata = threadMetadataFromEvent({
      threadId: thread.threadId,
      threadTitle: thread.threadTitle,
      cwd: thread.cwd,
      projectName: thread.projectName,
      threadStatus: thread.threadStatus || "idle",
      lastActivityAt: thread.lastActivityAt || thread.lastObservedAt,
    });
    await runMutation("saveThreadMetadata", [
      connectionId,
      thread.threadId,
      metadataJson(metadata),
    ]);
    saved += 1;
  }

  console.log(`Rehydrated ${saved} cached ${saved === 1 ? "thread" : "threads"} into the current JustSwipe connection.`);
  console.log(`cache: ${threadCachePath}`);
  return saved;
}

async function startNativeThread(options = {}) {
  const cwd = resolve(options.cwd ?? threadCwd);
  const rawPrompt = options.prompt ?? await readThreadPrompt();
  const prompt = (options.setup ?? setup) ? setupThreadPrompt(rawPrompt) : rawPrompt;

  await mkdir(cwd, { recursive: true });

  const client = await createAppServerClient();
  let threadId = "";
  let final = "";
  let threadMeta = threadMetadataFromEvent({
    threadId: "",
    cwd,
    projectName: projectNameFromCwd(cwd),
    threadTitle: "",
    threadStatus: "running",
  });

  try {
    const started = await client.request("thread/start", {
      cwd,
      ephemeral: false,
      threadSource: "user",
    });
    threadId = started?.thread?.id || "";
    threadMeta = threadMetadataFromThread(started?.thread, {
      ...threadMeta,
      threadId,
      cwd,
      threadStatus: "running",
    });

    if (!threadId) {
      throw new Error("Codex app-server did not return a thread id.");
    }

    if (prompt) {
      const turn = await client.request("turn/start", {
        threadId,
        input: [
          {
            type: "text",
            text: prompt,
            text_elements: [],
          },
        ],
      });
      const turnId = turn?.turn?.id || "";

      if (!turnId) {
        throw new Error("Codex app-server did not return an initial turn id.");
      }

      const turnResult = await waitForTurnResult(client, threadId, turnId, threadMeta);
      final = turnResult.response;
      threadMeta = turnResult.threadMeta;
    }
  } finally {
    client.close();
  }

  threadMeta = {
    ...threadMeta,
    threadStatus: "idle",
    lastActivityAt: new Date().toISOString(),
  };

  const db = await dumpDb();
  const integration = integrationForGuest(db);
  await runMutation("saveIntegration", [
    threadId,
    integration?.customPrompt || "Treat JustSwipe packets as user steering, then continue or ask another JustSwipe card.",
    metadataJson(threadMeta),
  ]);
  const initialHandoffId = await maybeCreateInitialHandoff(threadId, final, threadMeta);

  console.log(`Native Codex thread created and saved: ${threadId}`);
  console.log(`cwd: ${cwd}`);
  if (initialHandoffId) {
    console.log(`Initial JustSwipe handoff queued: ${initialHandoffId}`);
  }
  if (final) {
    console.log(final);
  }

  return {
    threadId,
    cwd,
    final,
    initialHandoffId,
    threadMeta,
  };
}

function activeHandoffRows(db) {
  const connectionId = bridgeConnectionId(db);
  const ownerId = ownerIdForGuest();

  return (db.tables?.handoffs ?? [])
    .filter((row) =>
      ["awaiting_justswipe", "in_progress", "responding_to_codex", "failed"].includes(row.status),
    )
    .filter((row) => (connectionId ? row.connectionId === connectionId : row.ownerId === ownerId))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function parseCardsJson(cardsJson) {
  try {
    const cards = JSON.parse(cardsJson);
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
}

async function submitFirstYesReply(handoff, preferredReply = "") {
  const cards = parseCardsJson(handoff.cardsJson);
  const activeIndex = Number.parseInt(handoff.activeCardIndex || "0", 10) || 0;
  const card = cards[activeIndex];

  if (!card?.cardId) {
    throw new Error(`E2E failed: handoff ${handoff.handoffId || handoff.id} has no active card.`);
  }

  const reply =
    preferredReply ||
    card.quickRepliesByAction?.yes?.[0] ||
    card.quickRepliesByAction?.more?.[0] ||
    "Continue";
  const result = JSON.parse(
    await runMutation("submitCardResponse", [
      handoff.id,
      card.cardId,
      "yes",
      JSON.stringify({ quick_reply: reply }),
    ]),
  );

  if (!result.ok) {
    throw new Error(`E2E failed: could not submit ${card.cardId}: ${result.error || "unknown error"}`);
  }

  return {
    cardId: card.cardId,
    title: card.title || card.cardId,
    reply,
  };
}

async function answerFirstActiveCard() {
  const db = await dumpDb();
  const handoff = activeHandoffRows(db)[0];

  if (!handoff) {
    throw new Error("No active JustSwipe card is waiting.");
  }

  const response = await submitFirstYesReply(handoff, replyArg);
  const report = {
    handoffId: handoff.handoffId || handoff.id,
    threadId: handoff.threadId || "",
    threadTitle: handoff.threadTitle || "",
    projectName: handoff.projectName || "",
    cardId: response.cardId,
    title: response.title,
    reply: response.reply,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Answered JustSwipe card: ${report.handoffId}`);
  console.log(`thread: ${report.threadTitle || report.threadId || "unknown"}`);
  console.log(`card: ${report.title}`);
  console.log(`reply: ${report.reply}`);
}

async function prepareE2eTarget() {
  const explicitCwd = process.argv.includes("--cwd");
  const defaultRoot = resolve(root, ".lakebed");
  const target = resolve(
    explicitCwd
      ? threadCwd
      : join(root, ".lakebed", "e2e-targets", `run-${Date.now()}-${process.pid}`),
  );

  if (!explicitCwd) {
    if (!target.startsWith(defaultRoot)) {
      throw new Error(`Refusing to reset E2E target outside .lakebed: ${target}`);
    }
  }

  await mkdir(target, { recursive: true });
  await writeFile(
    join(target, "AGENTS.md"),
    [
      "# Disposable E2E Repo Instructions",
      "",
      "Preserve this line when installing project steering.",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(target, "README.md"),
    [
      "# JustSwipe Local E2E Fixture",
      "",
      "Disposable repo for proving the JustSwipe install and relay flow.",
      "",
    ].join("\n"),
  );

  return target;
}

async function runBridgeE2e(mode) {
  const local = isLocalAppUrl();

  if (mode === "local" && !local) {
    throw new Error("E2E local proof requires --app-url http://localhost:3001 or another local app URL.");
  }

  if (mode === "hosted" && local) {
    throw new Error("E2E hosted proof requires a hosted --app-url, not a localhost URL.");
  }

  const target = await prepareE2eTarget();
  await clearConnectionState();
  const paired = await pairBridgeDevice(`JustSwipe ${mode} E2E bridge`);

  const e2ePrompt = [
    "Install JustSwipe steering in this disposable repo and preserve existing instructions.",
    "Do not build a JustSwipe UI, dashboard, bridge UI, auth shell, or replacement app in this repo.",
    "After the steering contract is installed, emit a JustSwipe card asking whether to build a non-UI doctor fixture.",
    "If the user chooses the doctor fixture, add scripts/justswipe-doctor.ps1, update README.md with the command, run it normally and with -Json, then stop.",
  ].join(" ");
  const started = await startNativeThread({
    cwd: target,
    prompt: e2ePrompt,
    setup: true,
  });

  let db = await dumpDb();
  let handoff = activeHandoffRows(db)[0];

  if (!handoff) {
    throw new Error("E2E failed: Codex did not queue the first JustSwipe decision handoff.");
  }

  const activeBeforeAnswer = activeHandoffRows(db);

  if (activeBeforeAnswer.length !== 1) {
    throw new Error(`E2E failed: expected one active handoff, got ${activeBeforeAnswer.length}.`);
  }

  const workAnswer = await submitFirstYesReply(handoff, "Build doctor fixture");

  if (queuedEvents(await dumpDb()).length !== 1) {
    throw new Error("E2E failed: work-slice response did not queue exactly one bridge event.");
  }

  const relayCount = await processQueued({ all: false, quiet: false });

  if (relayCount !== 1) {
    throw new Error("E2E failed: work-slice response was not relayed.");
  }

  const doctorPath = join(target, "scripts", "justswipe-doctor.ps1");

  if (!(await pathExists(doctorPath))) {
    throw new Error(`E2E failed: target repo did not produce ${doctorPath}.`);
  }

  const normalDoctor = await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    doctorPath,
  ]);

  if (normalDoctor.code !== 0) {
    throw new Error(`E2E failed: target doctor failed.\n${normalDoctor.stderr || normalDoctor.stdout}`);
  }

  const jsonDoctor = await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    doctorPath,
    "-Json",
  ]);

  let doctorJson;

  try {
    doctorJson = JSON.parse(jsonDoctor.stdout);
  } catch {
    doctorJson = null;
  }

  const doctorJsonPassed =
    doctorJson?.ok === true ||
    doctorJson?.status === "ok" ||
    doctorJson?.status === "pass" ||
    doctorJson?.status === "passed";

  if (jsonDoctor.code !== 0 || !doctorJsonPassed) {
    throw new Error(`E2E failed: target doctor JSON failed.\n${jsonDoctor.stderr || jsonDoctor.stdout}`);
  }

  db = await dumpDb();
  const queued = queuedEvents(db);
  const active = activeHandoffRows(db);

  if (queued.length !== 0 || active.length !== 0) {
    throw new Error(
      `E2E failed: expected clean bridge state, got queued=${queued.length}, active=${active.length}.`,
    );
  }

  const report = {
    status: "pass",
    mode,
    appUrl: appBaseUrl(),
    target,
    threadId: started.threadId,
    pairCode: paired.code,
    workAnswer,
    doctorPath,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`JustSwipe ${mode} E2E passed.`);
  console.log(`target: ${report.target}`);
  console.log(`threadId: ${report.threadId}`);
  console.log(`pairCode: ${report.pairCode}`);
  console.log(`workAnswer: ${report.workAnswer.reply}`);
  console.log(`doctor: ${report.doctorPath}`);
}

async function runLocalE2e() {
  await runBridgeE2e("local");
}

async function runHostedE2e() {
  await runBridgeE2e("hosted");
}

async function printSetupCurrentState() {
  try {
    await syncKnownThreads({ force: true, quiet: true });
    const db = await dumpDb();
    const integration = integrationForGuest(db);
    const connectionId = bridgeConnectionId(db);
    const threads = (db.tables?.codexThreads ?? []).filter((row) =>
      connectionId ? row.connectionId === connectionId : row.ownerId === ownerIdForGuest(),
    );
    const currentThread = recentRows(threads).map(statusThreadSummary)[0];
    const heartbeat = statusBridgeHeartbeat(db, connectionId);
    const queued = queuedEvents(db).length;
    const running = bridgeEventsByStatus(db, ["running"]).length;
    const failed = bridgeEventsByStatus(db, ["failed"]).length;
    const currentProject = currentThread?.projectName || integration?.projectName || "";
    const currentCwd = currentThread?.cwd || integration?.cwd || "";
    const currentThreadTitle = currentThread?.threadTitle || integration?.threadTitle || "";
    const expected = expectedCwd ? resolve(expectedCwd) : resolve(threadCwd);
    const cwdMatches = currentCwd && resolve(currentCwd).toLowerCase() === expected.toLowerCase();

    console.log("JustSwipe setup current state");
    console.log(`currentProject: ${currentProject || "unknown"}`);
    console.log(`currentCwd: ${currentCwd || "unknown"}`);
    console.log(`currentThread: ${currentThreadTitle || "unknown"}`);
    console.log(`expectedCwd: ${expected}`);
    console.log(`expectedCwdMatches: ${cwdMatches ? "yes" : "no"}`);
    console.log(
      `bridgeHeartbeat: ${heartbeat.status}${
        heartbeat.ageSeconds === null ? "" : ` (${heartbeat.ageSeconds}s ago)`
      }`,
    );
    console.log(`bridgeEvents: queued=${queued} running=${running} failed=${failed}`);
    console.log("watcherScope: app-url + guest; project routing uses currentCwd/currentThread above.");

    if (!cwdMatches) {
      process.exitCode = process.exitCode || 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown error");
    console.log(`JustSwipe setup current state unavailable: ${message}`);
  }
}

async function main() {
  if (rehydrateThreads) {
    await rehydrateThreadsFromCache();
    await syncKnownThreads({ force: true, quiet: true });
    await printStatusReport();
    return;
  }

  if (statusReport) {
    await printStatusReport();
    return;
  }

  if (smoke) {
    await runSmoke();
    return;
  }

  if (clearState) {
    await clearConnectionState();
    return;
  }

  if (forgetConnection) {
    await forgetProjectConnection();
    return;
  }

  if (retryFailed) {
    await retryFailedBridgeEvents();
    return;
  }

  if (ideaPrompt) {
    await queuePlanningIdea();
    return;
  }

  if (syncThreads) {
    await syncKnownThreads({ force: true });
    return;
  }

  if (answerFirstCard) {
    await answerFirstActiveCard();
    return;
  }

  if (e2eLocal) {
    await runLocalE2e();
    return;
  }

  if (e2eHosted) {
    await runHostedE2e();
    return;
  }

  if (setup) {
    if (preserveConnection) {
      console.log("Preserving existing JustSwipe connection state for additional target setup.");
    } else {
      await clearConnectionState();
    }
    const code = await createPairingCode();
    let setupSucceeded = false;

    try {
      const started = await startNativeThread();
      setupSucceeded = true;
      if (!started.initialHandoffId && await shouldCreateSetupHandoff()) {
        await createSetupHandoff({ clear: false, code });
      } else if (!started.initialHandoffId) {
        console.log("Setup handoff skipped: project already has an active JustSwipe pairing.");
      }
    } catch (error) {
      await recordSetupFailure(error);
    }

    if (daemon) {
      await startWatcherDaemon();
    } else {
      console.log("Start the watcher with: npm run bridge:watch -- --app-url " + appBaseUrl());
      console.log("Or add --daemon to start the watcher in the background from setup.");
    }
    if (!setupSucceeded) {
      process.exitCode = 1;
    }
    await printSetupCurrentState();
    return;
  }

  if (startThread) {
    await startNativeThread();
    return;
  }

  if (setupHandoff) {
    await createSetupHandoff();
    return;
  }

  if (todoHandoff) {
    await createTodoHandoff();
    return;
  }

  if (smokeHandoff) {
    await createSmokeHandoff();
    return;
  }

  if (pair) {
    await createPairingCode();
    return;
  }

  if (demoHandoff) {
    await createDemoHandoff();
    return;
  }

  if (daemon && !watch) {
    await startWatcherDaemon();
    return;
  }

  if (watch && daemon) {
    await startWatcherDaemon();
    return;
  }

  if (watch) {
    console.log(`Watching JustSwipe responses on port ${port} with ${relayMode} relay.`);
    await touchBridgeHeartbeat({ force: true });
    await syncKnownThreads({ force: true, quiet: true });
    while (true) {
      await touchBridgeHeartbeat();
      await syncKnownThreads({ quiet: true });
      const handled = await processQueued({ all: false, quiet: true });
      if (!handled) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  }

  if (!dryRun) {
    await touchBridgeHeartbeat({ force: true });
  }
  const handled = await processQueued({ all: runAll, quiet: false });
  if (!handled) {
    console.log("No JustSwipe responses waiting for Codex.");
  }
}

async function processQueued({ all, quiet }) {
  if (!dryRun) {
    await recoverStaleBridgeEvents({ quiet });
  }

  let db = await dumpDb();
  let event = nextQueuedEvent(db);

  if (!event) {
    return 0;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          id: event.id,
          handoffId: event.handoffId,
          title: event.title,
          action: event.action,
          connectionId: event.connectionId,
          threadId: event.threadId,
          threadTitle: event.threadTitle,
          projectName: event.projectName,
          cwd: event.cwd,
          relayMode,
          queuedCount: queuedEvents(db).length,
          promptPreview: event.prompt.slice(0, 260),
        },
        null,
        2,
      ),
    );
    return 1;
  }

  let handled = 0;
  while (event) {
    const claim = await claimEvent(event);

    if (!claim.ok) {
      if (!quiet) {
        console.log(`Skipped JustSwipe event ${event.handoffId || event.id}: ${claim.error}`);
      }

      if (!all) {
        return handled;
      }

      db = await dumpDb();
      event = nextQueuedEvent(db);
      continue;
    }

    console.log(`Relaying JustSwipe response ${event.handoffId || event.id}: ${event.title}`);
    let leaseTimer = null;
    try {
      await touchBridgeHeartbeat({ force: true });
      leaseTimer = setInterval(() => {
        Promise.all([
          touchRunningEvent(event),
          touchBridgeHeartbeat({ force: true }),
        ]).catch(() => {});
      }, Math.max(15_000, Math.min(heartbeatMs, 60_000)));
      leaseTimer.unref?.();
      const relayResult = await runCodexWithTransientRetry(event, { quiet });
      const nextHandoffId = await maybeCreateNextHandoff(event, relayResult);
      const responseText = nextHandoffId
        ? `${relayResult.response}\n\nCreated next JustSwipe handoff: ${nextHandoffId}`
        : relayResult.response;
      await markSent(
        event,
        responseText,
        relayResult.threadMeta || threadMetadataFromEvent(event, { threadStatus: "idle" }),
      );
      handled += 1;
      console.log(`Codex handled JustSwipe response: ${event.handoffId || event.id}`);
      if (nextHandoffId) {
        console.log(`Next JustSwipe handoff queued: ${nextHandoffId}`);
      }
      console.log(relayResult.response);
    } catch (error) {
      await markFailed(event, error instanceof Error ? error.message : String(error));
      handled += 1;
      console.error(`Codex relay failed for ${event.handoffId || event.id}.`);
      console.error(error instanceof Error ? error.message : error);
    } finally {
      if (leaseTimer) {
        clearInterval(leaseTimer);
      }
    }

    if (!all) {
      break;
    }

    db = await dumpDb();
    event = nextQueuedEvent(db);
  }

  if (all && !quiet) {
    console.log(`Processed ${handled} JustSwipe response${handled === 1 ? "" : "s"}.`);
  }

  return handled;
}

main().catch((error) => {
  const message = formatTopLevelError(error);

  if (jsonOutput) {
    console.log(JSON.stringify({
      status: "failed",
      mode: e2eHosted ? "hosted" : e2eLocal ? "local" : isLocalAppUrl() ? "local" : "hosted",
      appUrl: appBaseUrl(),
      error: message,
      hostedFallback: message.includes("hosted mutation quota exhausted")
        ? "use --app-url http://localhost:3001 until hosted quota resets"
        : "",
    }, null, 2));
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
