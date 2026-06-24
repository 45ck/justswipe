import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const port = valueAfter("--port") ?? "3001";
const guest = valueAfter("--guest") ?? "local";
const dryRun = args.has("--dry-run");
const runAll = args.has("--all");
const watch = args.has("--watch");
const pair = args.has("--pair");
const demoHandoff = args.has("--demo-handoff");
const bridgeDir = join(root, ".lakebed", "bridge-runs");
const intervalMs = Number.parseInt(valueAfter("--interval-ms") ?? "1200", 10);
const codexTimeoutMs = Number.parseInt(valueAfter("--timeout-ms") ?? "90000", 10);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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

function parseDump(stdout) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("Lakebed DB dump did not include JSON.");
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function queuedEvents(db) {
  const events = db.tables?.bridgeEvents ?? [];
  return events
    .filter((event) => event.status === "queued")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function nextQueuedEvent(db) {
  return queuedEvents(db)[0];
}

async function dumpDb() {
  if (!/^\d+$/.test(port)) {
    throw new Error("--port must be numeric.");
  }

  const result = await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `npx --yes lakebed db dump --port ${port}`,
    ],
  );
  if (result.code !== 0) {
    throw new Error(`Lakebed DB dump failed.\n${result.stderr || result.stdout}`);
  }
  return parseDump(result.stdout);
}

async function runCodex(event) {
  await mkdir(bridgeDir, { recursive: true });
  const safeId = event.id.replace(/[^a-zA-Z0-9-]/g, "");
  const promptPath = join(bridgeDir, `${safeId}.prompt.txt`);
  const responsePath = join(bridgeDir, `${safeId}.response.txt`);
  const prompt = `${event.prompt}

Keep normal prose under 180 words. If you need another JustSwipe card bundle, append the exact JUSTSWIPE_HANDOFF_JSON block described above.`;

  await writeFile(promptPath, prompt, "utf8");
  const command = [
    "Get-Content -Raw -LiteralPath",
    psQuote(promptPath),
    "|",
    "codex exec --skip-git-repo-check -C",
    psQuote(root),
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
  return response;
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
        reject(new Error(message.error ?? "Lakebed mutation failed."));
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

  const url = `ws://localhost:${port}/__lakebed/ws?lakebed_guest=${encodeURIComponent(guest)}`;
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

async function markSent(event, response) {
  await runMutation("markBridgeSent", [event.id, response]);
}

async function markFailed(event, error) {
  await runMutation("markBridgeFailed", [event.id, String(error).slice(0, 1600)]);
}

async function maybeCreateNextHandoff(event, response) {
  const next = extractNextHandoff(response);

  if (!next) {
    return null;
  }

  return runMutation("createHandoffFromBridge", [
    event.connectionId || "",
    event.threadId || "",
    next.cardsJson,
    next.reason,
  ]);
}

async function createPairingCode() {
  const code = await runMutation("createPairingCode", []);
  console.log(`JustSwipe pairing code: ${code}`);
  console.log("Expires in 2 minutes. The paired browser stays connected for today.");
}

async function createDemoHandoff() {
  await runMutation("resetDemo", []);
  console.log("Demo handoff bundle reset.");
}

async function main() {
  if (pair) {
    await createPairingCode();
    return;
  }

  if (demoHandoff) {
    await createDemoHandoff();
    return;
  }

  if (watch) {
    console.log(`Watching JustSwipe responses on port ${port}.`);
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
    console.log(`Relaying JustSwipe response ${event.handoffId || event.id}: ${event.title}`);
    try {
      const response = await runCodex(event);
      const nextHandoffId = await maybeCreateNextHandoff(event, response);
      await markSent(
        event,
        nextHandoffId
          ? `${response}\n\nCreated next JustSwipe handoff: ${nextHandoffId}`
          : response,
      );
      handled += 1;
      console.log(`Codex handled JustSwipe response: ${event.handoffId || event.id}`);
      if (nextHandoffId) {
        console.log(`Next JustSwipe handoff queued: ${nextHandoffId}`);
      }
      console.log(response);
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
