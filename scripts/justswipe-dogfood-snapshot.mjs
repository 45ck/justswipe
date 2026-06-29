import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const outPath = resolve(valueAfter("--out") || join(root, "docs", "dogfood-snapshots.md"));
const cachePath = resolve(valueAfter("--cache") || join(root, ".lakebed", "dogfood-thread-cache.json"));
const expectedCwd = valueAfter("--expect-cwd") || "";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function runNode(args) {
  return new Promise((resolvePromise, reject) => {
    execFile(process.execPath, args, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.message = [error.message, stderr, stdout].filter(Boolean).join("\n");
        reject(error);
        return;
      }
      resolvePromise(stdout);
    });
  });
}

function asCount(value) {
  return Number.parseInt(String(value ?? "0"), 10) || 0;
}

function threadLine(thread) {
  return `  - ${thread.threadStatus || "unknown"} | ${thread.projectName || "unknown"} | ${thread.threadTitle || thread.threadId || "unknown"} | cards=${thread.pendingCards || "0"} ideas=${thread.pendingIdeas || "0"}`;
}

async function updateThreadCache(report, threads) {
  if (!threads.length) {
    return 0;
  }

  let cache = { threads: [] };
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    cache = { threads: [] };
  }

  const byId = new Map((Array.isArray(cache.threads) ? cache.threads : [])
    .filter((thread) => thread.threadId)
    .map((thread) => [thread.threadId, thread]));

  const observedAt = new Date().toISOString();
  for (const thread of threads) {
    if (!thread.threadId) {
      continue;
    }
    byId.set(thread.threadId, {
      ...byId.get(thread.threadId),
      threadId: thread.threadId,
      threadTitle: thread.threadTitle || thread.threadId,
      threadStatus: thread.threadStatus || "unknown",
      projectName: thread.projectName || "",
      cwd: thread.cwd || "",
      pendingCards: thread.pendingCards || "0",
      pendingIdeas: thread.pendingIdeas || "0",
      lastActivityAt: thread.lastActivityAt || observedAt,
      lastObservedAt: observedAt,
      sourceAppUrl: report.appUrl || appUrl,
    });
  }

  const merged = [...byId.values()].sort((left, right) =>
    String(right.lastObservedAt || right.lastActivityAt || "").localeCompare(
      String(left.lastObservedAt || left.lastActivityAt || ""),
    ),
  );
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify({ updatedAt: observedAt, threads: merged }, null, 2)}\n`);
  return merged.length;
}

async function main() {
  const args = ["scripts/justswipe-codex-bridge.mjs", "--status", "--json", "--app-url", appUrl];
  if (expectedCwd) {
    args.push("--expect-cwd", expectedCwd);
  }

  const stdout = await runNode(args);
  const report = JSON.parse(stdout);
  const now = new Date().toISOString();
  const eventCounts = {
    queued: asCount(report.queuedBridgeEvents),
    running: asCount(report.runningBridgeEvents),
    failed: asCount(report.failedBridgeEvents),
  };
  const ready =
    report.connected === true &&
    report.bridgeHeartbeat?.fresh === true &&
    eventCounts.queued === 0 &&
    eventCounts.running === 0 &&
    eventCounts.failed === 0 &&
    asCount(report.activeHandoffs) === 0;
  const threads = Array.isArray(report.recentThreads) ? report.recentThreads : [];
  const projects = [...new Set(threads.map((thread) => thread.projectName).filter(Boolean))];
  const lines = [
    `## ${now}`,
    "",
    `- appUrl: ${report.appUrl}`,
    `- connectionId: ${report.connectionId || "none"}`,
    `- currentProject: ${report.currentProject || "unknown"}`,
    `- currentCwd: ${report.currentCwd || "unknown"}`,
    `- currentThread: ${report.currentThread || "unknown"}`,
    `- heartbeat: ${report.bridgeHeartbeat?.status || "unknown"} / fresh=${report.bridgeHeartbeat?.fresh === true} / ageSeconds=${report.bridgeHeartbeat?.ageSeconds ?? "unknown"}`,
    `- activeHandoffs: ${report.activeHandoffs || 0}`,
    `- bridgeEvents: queued=${eventCounts.queued} running=${eventCounts.running} failed=${eventCounts.failed}`,
    `- threads: ${report.threads || threads.length} (${projects.join(", ") || "no projects"})`,
    `- readyForDogfood: ${ready ? "yes" : "no"}`,
    "",
    "Threads:",
    ...threads.map(threadLine),
    "",
  ];

  await mkdir(dirname(outPath), { recursive: true });
  const cachedThreads = await updateThreadCache(report, threads);
  let existing = "";
  try {
    existing = await readFile(outPath, "utf8");
  } catch {
    existing = "# JustSwipe Dogfood Snapshots\n\nRepeatable status snapshots for long-running dogfood.\n\n";
  }

  await writeFile(outPath, `${existing.replace(/\s*$/, "\n\n")}${lines.join("\n")}`);
  console.log(`Dogfood snapshot appended: ${outPath}`);
  console.log(`readyForDogfood: ${ready ? "yes" : "no"}`);
  console.log(`threads: ${report.threads || threads.length}`);
  console.log(`cachedThreads: ${cachedThreads}`);
  console.log(`bridgeEvents: queued=${eventCounts.queued} running=${eventCounts.running} failed=${eventCounts.failed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
