import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const port = valueAfter("--port") ?? "3001";
const explicitGuest = valueAfter("--guest");
const smoke = args.has("--smoke");
const guest = explicitGuest ?? (smoke ? "smoke" : "local");
const appUrl = valueAfter("--app-url") ?? valueAfter("--url") ?? process.env.JUSTSWIPE_APP_URL ?? "";
const deployIdArg = valueAfter("--deploy-id") ?? process.env.JUSTSWIPE_DEPLOY_ID ?? "";
const inspectToken = valueAfter("--inspect-token") ?? process.env.JUSTSWIPE_INSPECT_TOKEN ?? "";
const jsonOutput = args.has("--json");
const dryRun = args.has("--dry-run");
const doctorReport = args.has("--doctor");
const statusReport = args.has("--status") || doctorReport;
const runAll = args.has("--all");
const watch = args.has("--watch");
const pair = args.has("--pair");
const openPairLink = args.has("--open") || args.has("--open-browser");
const demoHandoff = args.has("--demo-handoff");
const startThread = args.has("--start-thread");
const setupHandoff = args.has("--setup-handoff");
const setup = args.has("--setup");
const e2eLocal = args.has("--e2e-local");
const e2eHosted = args.has("--e2e-hosted");
const todoHandoff = args.has("--todo-handoff");
const clearState = args.has("--clear");
const relayMode = valueAfter("--relay") ?? process.env.JUSTSWIPE_CODEX_RELAY ?? "app-server";
const bridgeDir = join(root, ".lakebed", "bridge-runs");
const intervalMs = Number.parseInt(valueAfter("--interval-ms") ?? "1200", 10);
const codexTimeoutMs = Number.parseInt(valueAfter("--timeout-ms") ?? "900000", 10);
const threadCwd = valueAfter("--cwd") ?? root;
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
    "6. If you need user direction, emit one JUSTSWIPE_HANDOFF_JSON card and stop.",
    "",
    "Skill requirements:",
    "- Consume JUSTSWIPE RESPONSE PACKET messages as user steering.",
    "- Treat JustSwipe responses as steering, not permission.",
    "- Ask one clear decision per card.",
    "- Provide 3 to 4 quick replies plus custom text.",
    "- Include compact HTML/artifact context when it helps the user decide.",
    "- Handoff requests must be wrapped in JUSTSWIPE_HANDOFF_JSON and END_JUSTSWIPE_HANDOFF_JSON markers.",
    "- After the marker block, end with AWAITING_JUSTSWIPE_RESPONSE <cardId>.",
    "- After emitting a JustSwipe handoff, stop and wait for a response packet.",
    "",
    "Minimum handoff marker shape the skill must document:",
    "JUSTSWIPE_HANDOFF_JSON",
    "{\"reason\":\"Need one human decision before continuing.\",\"cards\":[{\"cardId\":\"next-decision\",\"title\":\"Pick the next step\",\"summary\":\"One clear choice.\",\"recommendedAction\":\"yes\",\"visualContext\":\"Current state, tradeoff, risk, and next effect.\",\"questionType\":\"yes_no\",\"quickRepliesByAction\":{\"yes\":[\"Do this\",\"Keep it simple\",\"Ship this slice\"],\"no\":[\"Not this\",\"Too broad\",\"Try smaller\"]},\"requiredFieldsByAction\":{\"yes\":[\"quick_reply\"],\"no\":[\"quick_reply\"]},\"yesPayloadSchema\":[],\"noPayloadSchema\":[],\"morePayloadSchema\":[],\"laterPayloadSchema\":[],\"optionPayloadSchemas\":{},\"agentHtmlPreview\":\"<section><h2>Decision context</h2><p>Show the concrete thing the user is deciding on.</p></section>\"}]}",
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

  if (appUrl) {
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

  return appUrl;
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

function finalTextFromThreadRead(result, turnId) {
  const turns = Array.isArray(result?.thread?.turns)
    ? result.thread.turns
    : Array.isArray(result?.turns)
      ? result.turns
      : [];
  const matchingTurn = turns.find((turn) => turn.id === turnId) || turns[0];

  return finalTextFromTurn(matchingTurn);
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

function queuedEvents(db) {
  const events = db.tables?.bridgeEvents ?? [];
  const connectionId = bridgeConnectionId(db);
  const ownerId = ownerIdForGuest();

  return events
    .filter((event) => event.status === "queued")
    .filter((event) => {
      if (connectionId) {
        return event.connectionId === connectionId;
      }

      return event.ownerId === ownerId;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

async function printStatusReport() {
  let db;

  try {
    db = await dumpDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");

    if (!doctorReport || isLocalAppUrl() || !/mutations quota exceeded/i.test(message)) {
      throw error;
    }

    const fallback = formatLakebedError(message);
    const report = {
      appUrl: appBaseUrl(),
      mode: "hosted",
      guest: ownerIdForGuest(),
      connected: false,
      connectionId: "",
      pairedUntil: "",
      pairedDevices: 0,
      activePairCodes: 0,
      activeHandoffs: 0,
      activeHandoffStatuses: {},
      queuedBridgeEvents: 0,
      threads: 0,
      threadStatuses: {},
      nextAction: "run local app and rerun with --app-url http://localhost:3001",
      hostedFallback: fallback,
      dbUnavailable: fallback,
      installDocs: await installDocDoctor(),
    };

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
    return;
  }

  const integration = integrationForGuest(db);
  const connectionId = bridgeConnectionId(db);
  const queued = queuedEvents(db);
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
  const nextAction = queued.length
    ? `run: npm run bridge${runAll ? ":all" : ""} -- --app-url ${appBaseUrl()}`
    : activeHandoffs.some((row) => ["awaiting_justswipe", "in_progress"].includes(row.status))
      ? `open: ${appBaseUrl()}`
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
    pairedDevices: pairedDevices.length,
    activePairCodes: activePairCodes.length,
    activeHandoffs: activeHandoffs.length,
    activeHandoffStatuses: statusCounts(activeHandoffs),
    queuedBridgeEvents: queued.length,
    threads: threads.length,
    threadStatuses: statusCounts(threads, "threadStatus"),
    nextAction,
    hostedFallback:
      isLocalAppUrl()
        ? ""
        : "if Lakebed reports mutations quota exceeded, use --app-url http://localhost:3001 until reset",
  };

  if (doctorReport) {
    report.installDocs = await installDocDoctor();
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
  console.log(`activePairCodes: ${report.activePairCodes}`);
  console.log(`activeHandoffs: ${report.activeHandoffs} (${formatCounts(report.activeHandoffStatuses)})`);
  console.log(`queuedBridgeEvents: ${report.queuedBridgeEvents}`);
  console.log(`threads: ${report.threads} (${formatCounts(report.threadStatuses)})`);
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
  }
}

function promptForEvent(event) {
  return `${event.prompt}

Keep normal prose under 180 words. If you need another JustSwipe card bundle, append the exact JUSTSWIPE_HANDOFF_JSON block described above.`;
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

    const completed = await client.onceNotification(
      "turn/completed",
      (params) => params?.threadId === threadId && params?.turn?.id === turnId,
      codexTimeoutMs,
    );
    let response = finalTextFromTurn(completed?.turn);

    if (!response) {
      const refreshed = await client.request("thread/read", {
        threadId,
        includeTurns: true,
      });
      response = finalTextFromThreadRead(refreshed, turnId);
      threadMeta = threadMetadataFromThread(refreshed?.thread, {
        ...threadMeta,
        threadId,
        threadStatus: "idle",
      });
    } else {
      try {
        const refreshed = await client.request("thread/read", {
          threadId,
          includeTurns: false,
        });
        threadMeta = threadMetadataFromThread(refreshed?.thread, {
          ...threadMeta,
          threadId,
          threadStatus: "idle",
        });
      } catch {
        threadMeta = {
          ...threadMeta,
          threadId,
          threadStatus: "idle",
          lastActivityAt: new Date().toISOString(),
        };
      }
    }

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

async function createDemoHandoff() {
  await runMutation("resetDemo", []);
  console.log("Demo handoff bundle reset.");
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
  await clearConnectionState();

  console.log("JustSwipe bridge smoke passed.");
  console.log(`Pair code format: ${code}`);
  console.log(`Queued packet: ${event.action} / ${event.handoffId}`);
  console.log("Duplicate claim blocked.");
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

async function createSetupHandoff() {
  await runMutation("clearConnectionState", []);
  let db = await dumpDb();
  let integration = integrationForGuest(db);
  const threadId = valueAfter("--thread-id") ?? integration?.codexThreadId ?? "";

  if (!threadId) {
    throw new Error("No Codex thread id is saved. Run npm run bridge:start-thread first or pass --thread-id.");
  }

  const code = await createPairingCode();
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

async function clearConnectionState() {
  await runMutation("clearConnectionState", []);
  console.log("JustSwipe connection state cleared.");
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

      const completed = await client.onceNotification(
        "turn/completed",
        (params) => params?.threadId === threadId && params?.turn?.id === turnId,
        codexTimeoutMs,
      );
      final = finalTextFromTurn(completed?.turn);
      threadMeta = {
        ...threadMeta,
        threadStatus: "idle",
        lastActivityAt: new Date().toISOString(),
      };
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

  console.log(`Native Codex thread created and saved: ${threadId}`);
  console.log(`cwd: ${cwd}`);
  if (final) {
    console.log(final);
  }

  return {
    threadId,
    cwd,
    final,
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

async function prepareE2eTarget() {
  const explicitCwd = process.argv.includes("--cwd");
  const target = resolve(explicitCwd ? threadCwd : join(root, ".lakebed", "e2e-target"));
  const defaultRoot = resolve(root, ".lakebed");

  if (!explicitCwd) {
    if (!target.startsWith(defaultRoot)) {
      throw new Error(`Refusing to reset E2E target outside .lakebed: ${target}`);
    }

    await rm(target, { recursive: true, force: true });
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

  const e2ePrompt = [
    "Install JustSwipe steering in this disposable repo and preserve existing instructions.",
    "Do not build a JustSwipe UI, dashboard, bridge UI, auth shell, or replacement app in this repo.",
    "After the setup card is answered, emit a JustSwipe card asking whether to build a non-UI doctor fixture.",
    "If the user chooses the doctor fixture, add scripts/justswipe-doctor.ps1, update README.md with the command, run it normally and with -Json, then stop.",
  ].join(" ");
  const started = await startNativeThread({
    cwd: target,
    prompt: e2ePrompt,
    setup: true,
  });

  await createSetupHandoff();

  let db = await dumpDb();
  let handoff = activeHandoffRows(db)[0];

  if (!handoff) {
    throw new Error("E2E failed: setup handoff was not queued.");
  }

  const setupAnswer = await submitFirstYesReply(handoff, "Use desktop browser");

  if (queuedEvents(await dumpDb()).length !== 1) {
    throw new Error("E2E failed: setup response did not queue exactly one bridge event.");
  }

  const firstRelayCount = await processQueued({ all: false, quiet: false });

  if (firstRelayCount !== 1) {
    throw new Error("E2E failed: setup response was not relayed.");
  }

  db = await dumpDb();
  handoff = activeHandoffRows(db).find((row) => row.status === "awaiting_justswipe");

  if (!handoff) {
    throw new Error("E2E failed: Codex did not queue a follow-up JustSwipe handoff.");
  }

  const workAnswer = await submitFirstYesReply(handoff, "Build doctor fixture");
  const secondRelayCount = await processQueued({ all: false, quiet: false });

  if (secondRelayCount !== 1) {
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
    setupAnswer,
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
  console.log(`setupAnswer: ${report.setupAnswer.reply}`);
  console.log(`workAnswer: ${report.workAnswer.reply}`);
  console.log(`doctor: ${report.doctorPath}`);
}

async function runLocalE2e() {
  await runBridgeE2e("local");
}

async function runHostedE2e() {
  await runBridgeE2e("hosted");
}

async function main() {
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

  if (e2eLocal) {
    await runLocalE2e();
    return;
  }

  if (e2eHosted) {
    await runHostedE2e();
    return;
  }

  if (setup) {
    await startNativeThread();
    await createSetupHandoff();
    console.log("Start the watcher with: npm run bridge:watch -- --app-url " + appBaseUrl());
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

  if (pair) {
    await createPairingCode();
    return;
  }

  if (demoHandoff) {
    await createDemoHandoff();
    return;
  }

  if (watch) {
    console.log(`Watching JustSwipe responses on port ${port} with ${relayMode} relay.`);
    while (true) {
      const handled = await processQueued({ all: false, quiet: true });
      if (!handled) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  }

  const handled = await processQueued({ all: runAll, quiet: false });
  if (!handled) {
    console.log("No JustSwipe responses waiting for Codex.");
  }
}

async function processQueued({ all, quiet }) {
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
    try {
      const relayResult = await runCodex(event);
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
  console.error(formatTopLevelError(error));
  process.exitCode = 1;
});
