import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const monitorName = safeName(valueAfter("--name") || appUrl);
const monitorDir = join(root, ".lakebed", "dogfood-monitor");
const pidPath = join(monitorDir, `${monitorName}.pid`);
const outPath = join(monitorDir, `${monitorName}.out.log`);
const errPath = join(monitorDir, `${monitorName}.err.log`);
const monitorLogPath = resolve(valueAfter("--log") || join(root, "docs", "dogfood-monitor-runs.md"));
const snapshotPath = resolve(valueAfter("--snapshot-log") || join(root, "docs", "dogfood-snapshots.md"));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function safeName(value) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "local";
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function readPid() {
  const text = (await readText(pidPath)).trim();
  const pid = Number.parseInt(text, 10);
  return Number.isFinite(pid) ? pid : 0;
}

function runNode(args) {
  return new Promise((resolvePromise) => {
    execFile(process.execPath, args, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolvePromise({
        ok: !error,
        stdout,
        stderr,
        error: error?.message || "",
      });
    });
  });
}

async function processAlive(pid) {
  if (!pid) {
    return false;
  }

  const result = await runNode([
    "-e",
    `try { process.kill(${pid}, 0); process.exit(0); } catch { process.exit(1); }`,
  ]);
  return result.ok;
}

function parseLatestSection(markdown) {
  const matches = [...markdown.matchAll(/^## ([^\r\n]+)/gm)];
  const latest = matches.at(-1);
  if (!latest) {
    return null;
  }
  const next = markdown.indexOf("\n## ", latest.index + 1);
  const end = next === -1 ? markdown.length : next;
  const timestamp = latest[1];
  const body = markdown.slice(latest.index + latest[0].length, end);
  return { timestamp, body };
}

function findValue(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || "";
}

function findInline(body, pattern) {
  const match = body.match(pattern);
  return match?.[1]?.trim() || "";
}

async function getBridgeStatus() {
  const result = await runNode(["scripts/justswipe-codex-bridge.mjs", "--status", "--json", "--app-url", appUrl]);
  if (!result.ok) {
    return {
      ok: false,
      error: [result.error, result.stderr, result.stdout].filter(Boolean).join("\n").trim(),
    };
  }

  try {
    return { ok: true, report: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function bridgeLine(status) {
  if (!status.ok) {
    return `bridge: unavailable (${status.error.split(/\r?\n/)[0] || "unknown error"})`;
  }
  const report = status.report;
  return [
    `bridge: ${report.bridgeHeartbeat?.status || "unknown"}`,
    `fresh=${report.bridgeHeartbeat?.fresh === true}`,
    `age=${report.bridgeHeartbeat?.ageSeconds ?? "unknown"}s`,
    `events=${report.queuedBridgeEvents || 0}/${report.runningBridgeEvents || 0}/${report.failedBridgeEvents || 0}`,
  ].join(" | ");
}

async function main() {
  const pid = await readPid();
  const alive = await processAlive(pid);
  const monitorLog = await readText(monitorLogPath);
  const snapshotLog = await readText(snapshotPath);
  const latestMonitor = parseLatestSection(monitorLog);
  const latestSnapshot = parseLatestSection(snapshotLog);
  const bridgeStatus = await getBridgeStatus();
  const stderrTail = (await readText(errPath)).trim().split(/\r?\n/).filter(Boolean).slice(-3);

  console.log("JustSwipe dogfood monitor status");
  console.log(`appUrl: ${appUrl}`);
  console.log(`name: ${monitorName}`);
  console.log(`pid: ${pid || "none"}`);
  console.log(`process: ${alive ? "alive" : "not observed"}`);
  console.log(`pidFile: ${existsSync(pidPath) ? pidPath : "missing"}`);
  console.log(`stdout: ${existsSync(outPath) ? outPath : "missing"}`);
  console.log(`stderr: ${existsSync(errPath) ? errPath : "missing"}`);
  console.log(bridgeLine(bridgeStatus));

  if (latestMonitor) {
    console.log(`latestMonitor: ${latestMonitor.timestamp}`);
    console.log(`monitorStatus: ${findValue(latestMonitor.body, "status") || "unknown"}`);
    console.log(`monitorRun: ${findValue(latestMonitor.body, "run") || "unknown"}`);
    console.log(`monitorReady: ${findInline(latestMonitor.body, /readyForDogfood:\s*(yes|no)/i) || "unknown"}`);
    console.log(`monitorThreads: ${findInline(latestMonitor.body, /threads:\s*([0-9]+)/i) || "unknown"}`);
    console.log(`monitorEvents: ${findInline(latestMonitor.body, /bridgeEvents:\s*([^\r\n]+)/i) || "unknown"}`);
  } else {
    console.log("latestMonitor: none");
  }

  if (latestSnapshot) {
    console.log(`latestSnapshot: ${latestSnapshot.timestamp}`);
    console.log(`snapshotReady: ${findValue(latestSnapshot.body, "readyForDogfood") || "unknown"}`);
    console.log(`snapshotHeartbeat: ${findValue(latestSnapshot.body, "heartbeat") || "unknown"}`);
    console.log(`snapshotEvents: ${findValue(latestSnapshot.body, "bridgeEvents") || "unknown"}`);
  } else {
    console.log("latestSnapshot: none");
  }

  if (stderrTail.length) {
    console.log("stderrTail:");
    for (const line of stderrTail) {
      console.log(`  ${line}`);
    }
  }

  const failed =
    !alive ||
    !bridgeStatus.ok ||
    bridgeStatus.report?.bridgeHeartbeat?.fresh !== true ||
    (latestMonitor && /status:\s*failed/i.test(latestMonitor.body));
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
