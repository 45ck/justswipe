import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const guest = valueAfter("--guest") || "ui-smoke";
const keepState = args.has("--keep-state");

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function appBaseUrl() {
  return appUrl.replace(/\/$/, "");
}

function lakebedWsUrl() {
  const base = new URL(appBaseUrl());
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/__lakebed/ws";
  base.search = `?lakebed_guest=${encodeURIComponent(guest)}`;
  base.hash = "";
  return base.href;
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

async function dumpDb() {
  const result = await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `npx --yes --cache ${psQuote(join(root, ".lakebed", "npm-cache"))} lakebed db dump ${psQuote(appBaseUrl())}`,
    ],
    { timeoutMs: 30_000 },
  );

  if (result.code !== 0) {
    throw new Error(`Lakebed DB dump failed.\n${result.stderr || result.stdout}`);
  }

  return parseDump(result.stdout);
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
      if (message.id !== id) return;
      clearTimeout(timeout);
      if (message.ok) {
        resolvePromise(message.result);
      } else {
        reject(new Error(String(message.error || "Lakebed mutation failed.")));
      }
      ws.close();
    });

    ws.send(JSON.stringify({ id, op, ...payload }));
  });
}

async function runMutation(name, mutationArgs = []) {
  const ws = new WebSocket(lakebedWsUrl());

  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out opening Lakebed socket.")), 10_000);
    ws.addEventListener("open", () => {
      clearTimeout(timeout);
      resolvePromise();
    }, { once: true });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`Could not connect to ${lakebedWsUrl()}`));
    }, { once: true });
  });

  return lakebedRequest(ws, "mutation.run", {
    name,
    args: mutationArgs,
  });
}

function richUiSmokeCard() {
  return {
    cardId: "ui-rich-schema-card",
    title: "Review schema UI smoke card",
    summary: "Confirm the response sheet renders model-made fields and submits them.",
    recommendedAction: "yes",
    visualContext: "Mobile-width UI smoke | Schema fields | HTML preview | Queued response payload",
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
        helper: "Keep the phone swipe surface primary.",
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
      },
      {
        id: "artifact_context",
        label: "Artifact context",
        type: "evidence",
        helper: "Inline HTML preview should appear as native card context.",
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
    agentHtmlPreview:
      "<section><h2>Schema UI evidence</h2><p>This preview should render inline on the card.</p><ul><li>Select</li><li>Text</li><li>Toggle</li><li>Checklist</li><li>Rating</li></ul><button>Keep direction</button></section>",
  };
}

async function setupConnection() {
  await runMutation("clearConnectionState", []);
  const deviceJson = JSON.stringify({
    deviceId: "justswipe-ui-smoke-browser",
    label: "JustSwipe UI smoke browser",
    browser: "Playwright",
    platform: process.platform,
  });
  const code = String(await runMutation("createPairingCode", [deviceJson]));
  const pairMessage = String(await runMutation("pairWithCode", [code, deviceJson]));

  if (!pairMessage.includes("Connected")) {
    throw new Error(`Could not pair ui-smoke guest: ${pairMessage}`);
  }

  const db = await dumpDb();
  const ownerId = `guest:${guest}`;
  const integration = (db.tables?.integrations || [])
    .filter((row) => row.ownerId === ownerId)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];

  if (!integration?.connectionId) {
    throw new Error("Could not find ui-smoke connection after pairing.");
  }

  return { code, connectionId: integration.connectionId };
}

async function setupHandoff() {
  const connection = await setupConnection();
  const threadId = "ui-smoke-thread";
  const handoffId = await runMutation("createHandoffFromBridge", [
    connection.connectionId,
    threadId,
    JSON.stringify([richUiSmokeCard()]),
    "UI smoke rich schema handoff.",
    JSON.stringify({
      threadId,
      threadTitle: "UI smoke thread",
      threadStatus: "awaiting_justswipe",
      cwd: root,
      projectName: "justswipe",
      lastActivityAt: new Date().toISOString(),
    }),
  ]);

  return { ...connection, handoffId };
}

async function setupQuickHandoff(reason = "UI smoke relay state handoff.") {
  const db = await dumpDb();
  const ownerId = `guest:${guest}`;
  const integration = (db.tables?.integrations || [])
    .filter((row) => row.ownerId === ownerId)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];

  if (!integration?.connectionId) {
    throw new Error("Could not find ui-smoke connection for relay state setup.");
  }

  const threadId = "ui-smoke-failure-thread";
  const handoffId = await runMutation("createHandoffFromBridge", [
    integration.connectionId,
    threadId,
    JSON.stringify([
      {
        cardId: "ui-failure-state-card",
        title: "Trigger relay failure state",
        summary: "Submit this card so the smoke can mark its bridge event failed.",
        recommendedAction: "yes",
        visualContext: "Failure UX smoke | Thread log | Retry relay",
        questionType: "yes_no",
        yesPayloadSchema: [],
        noPayloadSchema: [],
        morePayloadSchema: [],
        laterPayloadSchema: [],
        optionPayloadSchemas: {},
        requiredFieldsByAction: {},
        quickRepliesByAction: {
          yes: ["Trigger failure"],
        },
        agentHtmlPreview:
          "<section><h2>Failure state proof</h2><p>This card is submitted, then marked failed so the user-facing retry flow can be tested.</p><button>Trigger failure</button></section>",
      },
    ]),
    reason,
    JSON.stringify({
      threadId,
      threadTitle: "UI failure smoke thread",
      threadStatus: "awaiting_justswipe",
      cwd: root,
      projectName: "justswipe",
      lastActivityAt: new Date().toISOString(),
    }),
  ]);

  return { handoffId, connectionId: integration.connectionId };
}

function guestUrl(code) {
  const url = new URL(appBaseUrl());
  url.searchParams.set("lakebed_guest", guest);
  url.searchParams.set("justswipe_pair", code);
  return url.href;
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  if (overflow) {
    throw new Error("UI smoke failed: mobile viewport has horizontal overflow.");
  }
}

async function waitForBridgeEvent(handoffId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const db = await dumpDb();
    const event = (db.tables?.bridgeEvents || []).find((row) => row.handoffId === handoffId);

    if (event) {
      return event;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  return null;
}

async function runUiSmoke() {
  const setup = await setupHandoff();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(guestUrl(setup.code), { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByText("Review schema UI smoke card").waitFor({ timeout: 15_000 });
    await page.getByText("Schema UI evidence").waitFor({ timeout: 10_000 });
    await assertNoOverflow(page);

    await page.locator('button[title^="Yes / Continue"]').click();
    await page.getByText("Details Codex needs").waitFor({ timeout: 10_000 });
    await page.locator("select").selectOption("Keep direction");
    await page.getByPlaceholder("What should Codex preserve?").fill("Preserve the compact swipe surface.");
    await page.locator("label").filter({ hasText: "Mobile first" }).locator("button").click();
    const evidenceField = page.locator("label").filter({ hasText: "Evidence checked" });
    await evidenceField.locator("button").filter({ hasText: "HTML preview" }).click();
    await evidenceField.locator("button").filter({ hasText: "Thread context" }).click();
    await page.locator("label").filter({ hasText: "Confidence" }).locator("button").filter({ hasText: "5" }).click();
    await assertNoOverflow(page);
    await page.getByRole("button", { name: "Submit Yes" }).click();
    await page.getByText(/Response sent|Codex resuming|Sent to Codex/i).first().waitFor({ timeout: 15_000 });
    await page.getByText("Swipe saved").waitFor({ timeout: 10_000 });
    await page.getByText("Bridge relay").waitFor({ timeout: 10_000 });
    await page.getByText("Codex continues").waitFor({ timeout: 10_000 });

    if (consoleErrors.length > 0) {
      throw new Error(`UI smoke failed: browser console errors:\n${consoleErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
  }

  const event = await waitForBridgeEvent(setup.handoffId);

  if (!event) {
    throw new Error("UI smoke failed: submitted card did not queue a bridge event.");
  }

  const responses = JSON.parse(event.feedback || "[]");
  const payload = responses[0]?.payload || {};

  if (
    payload.direction !== "Keep direction" ||
    payload.implementation_note !== "Preserve the compact swipe surface." ||
    payload.mobile_first !== true ||
    !Array.isArray(payload.evidence_checked) ||
    payload.evidence_checked.length !== 2 ||
    payload.confidence !== "5"
  ) {
    throw new Error(`UI smoke failed: unexpected queued payload ${JSON.stringify(payload)}`);
  }

  if (!keepState) {
    await runMutation("clearConnectionState", []);
  }

  console.log("JustSwipe UI smoke passed.");
  console.log(`appUrl: ${appBaseUrl()}`);
  console.log(`guest: guest:${guest}`);
  console.log(`handoffId: ${setup.handoffId}`);
  console.log("verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload");
}

async function runFailureUiSmoke() {
  const setup = await setupConnection();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(guestUrl(setup.code), { waitUntil: "networkidle", timeout: 30_000 });
    const failureSetup = await setupQuickHandoff();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Trigger relay failure state").waitFor({ timeout: 15_000 });
    await page.locator('button[title^="Yes / Continue"]').click();
    await page.getByRole("button", { name: "Trigger failure" }).click();
    await page.getByText(/Response sent|Codex resuming|Sent to Codex/i).first().waitFor({ timeout: 15_000 });

    const event = await waitForBridgeEvent(failureSetup.handoffId);

    if (!event) {
      throw new Error("Failure UI smoke failed: submitted card did not create bridge event.");
    }

    const claim = JSON.parse(String(await runMutation("claimBridgeEvent", [event.id])));

    if (!claim.ok) {
      throw new Error(`Failure UI smoke failed: could not claim bridge event: ${claim.error || "unknown error"}`);
    }

    await runMutation("markBridgeFailed", [event.id, "Simulated relay failure for UI smoke."]);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Bridge needs attention").first().waitFor({ timeout: 15_000 });
    await page.getByText("Simulated relay failure for UI smoke.").waitFor({ timeout: 10_000 });
    await page.locator('button[title="Thread log"]').click();
    await page.getByRole("button", { name: "Retry relay" }).click();
    await page.getByText("Retry queued. Keep the bridge watcher running.").waitFor({ timeout: 10_000 });

    const db = await dumpDb();
    const retried = (db.tables?.bridgeEvents || []).find((row) => row.id === event.id);

    if (retried?.status !== "queued") {
      throw new Error(`Failure UI smoke failed: retry did not requeue event, got ${retried?.status || "missing"}.`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Failure UI smoke failed: browser console errors:\n${consoleErrors.join("\n")}`);
    }

    if (!keepState) {
      await runMutation("clearConnectionState", []);
    }

    console.log("JustSwipe failure UI smoke passed.");
    console.log(`appUrl: ${appBaseUrl()}`);
    console.log(`guest: guest:${guest}`);
    console.log(`handoffId: ${failureSetup.handoffId}`);
    console.log("verified: failed relay banner, failure detail, thread log retry, queued retry payload");
  } finally {
    await browser.close();
  }
}

const runMode = valueAfter("--mode") || "schema";
const runner = runMode === "failure" ? runFailureUiSmoke : runUiSmoke;

runner().catch(async (error) => {
  try {
    if (!keepState) {
      await runMutation("clearConnectionState", []);
    }
  } catch {
    // Keep the original failure.
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
