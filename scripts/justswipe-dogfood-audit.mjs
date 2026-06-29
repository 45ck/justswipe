import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const outPath = resolve(valueAfter("--out") || join(root, "docs", "dogfood-audit.md"));
const monitorLogPath = resolve(valueAfter("--monitor-log") || join(root, "docs", "dogfood-monitor-runs.md"));
const snapshotPath = resolve(valueAfter("--snapshot-log") || join(root, "docs", "dogfood-snapshots.md"));
const verifyPath = resolve(valueAfter("--verify-log") || join(root, "docs", "dogfood-verify-runs.md"));
const experimentsPath = resolve(valueAfter("--experiments") || join(root, "docs", "experiments.md"));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
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

function timestamps(markdown) {
  return [...markdown.matchAll(/^## ([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\r\n]+)/gm)]
    .map((match) => new Date(match[1]))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
}

function hoursBetween(first, last) {
  if (!first || !last) {
    return 0;
  }
  return (last.getTime() - first.getTime()) / 36e5;
}

function count(pattern, text) {
  return (text.match(pattern) || []).length;
}

function hasAll(text, phrases) {
  return phrases.every((phrase) => text.includes(phrase));
}

async function bridgeStatus() {
  const result = await runNode(["scripts/justswipe-codex-bridge.mjs", "--status", "--json", "--app-url", appUrl]);
  if (!result.ok) {
    return { ok: false, error: [result.error, result.stderr, result.stdout].filter(Boolean).join("\n") };
  }
  try {
    return { ok: true, report: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function statusLine(state, label, evidence) {
  return `| ${state} | ${label} | ${evidence} |`;
}

async function main() {
  const [monitorLog, snapshotLog, verifyLog, experiments] = await Promise.all([
    readText(monitorLogPath),
    readText(snapshotPath),
    readText(verifyPath),
    readText(experimentsPath),
  ]);
  const bridge = await bridgeStatus();
  const monitorTimes = timestamps(monitorLog);
  const snapshotTimes = timestamps(snapshotLog);
  const monitorHours = hoursBetween(monitorTimes[0], monitorTimes.at(-1));
  const passedMonitorRuns = count(/- status:\s*passed/g, monitorLog);
  const readySnapshots = count(/- readyForDogfood:\s*yes/g, snapshotLog);
  const latestVerifyPassed = hasAll(verifyLog, [
    "JustSwipe UI smoke passed.",
    "JustSwipe card shapes UI smoke passed.",
    "JustSwipe multi-thread UI smoke passed.",
    "JustSwipe relay state UI smoke passed.",
    "JustSwipe failure UI smoke passed.",
    "No JustSwipe responses waiting for Codex.",
  ]);
  const failureUxProven = experiments.includes("browser-tested failure recovery for failed relay");
  const richCardsProven = experiments.includes("rich schema forms and inline HTML previews");
  const naturalGreenfieldProofs = [
    ...experiments.matchAll(/^### EXP-\d+:\s+(.+)$/gm),
  ].filter((match) => /natural .*greenfield|greenfield .*dogfood|greenfield planning/i.test(match[1])).length;
  const hostedGap = experiments.includes("hosted cloud proof after Lakebed quota reset");
  const phoneGap = experiments.includes("mobile/phone ergonomics");
  const hostedQuotaBlocked = experiments.includes("hosted mutation quota exhausted; switch bridge app URL to local dev");

  const bridgeEvidence = bridge.ok
    ? `bridge=${bridge.report.bridgeHeartbeat?.status || "unknown"}, fresh=${bridge.report.bridgeHeartbeat?.fresh === true}, threads=${bridge.report.threads || 0}, events=${bridge.report.queuedBridgeEvents || 0}/${bridge.report.runningBridgeEvents || 0}/${bridge.report.failedBridgeEvents || 0}`
    : `bridge status unavailable: ${bridge.error.split(/\r?\n/)[0] || "unknown error"}`;

  const rows = [
    statusLine(
      bridge.ok && bridge.report.bridgeHeartbeat?.fresh === true ? "proven-local" : "gap",
      "Current local bridge can relay",
      bridgeEvidence,
    ),
    statusLine(
      monitorHours >= 24 ? "proven" : passedMonitorRuns >= 2 ? "partial" : "gap",
      "Long-running multi-thread use over hours/days",
      `${passedMonitorRuns} passed monitor runs across ${monitorHours.toFixed(2)}h; ${readySnapshots} ready snapshots`,
    ),
    statusLine(
      latestVerifyPassed && failureUxProven ? "proven-local" : "gap",
      "Failure recovery UX from user perspective",
      latestVerifyPassed ? "failure UI smoke and documented retry flow passed" : "latest verifier evidence missing",
    ),
    statusLine(
      latestVerifyPassed && richCardsProven ? "proven-local" : "partial",
      "Rich schema forms and HTML artifact previews",
      latestVerifyPassed ? "card shapes smoke covers schema fields, unsupported fallback, HTML preview, multi-card order" : "coverage not recently verified",
    ),
    statusLine(
      naturalGreenfieldProofs >= 2 ? "proven-local" : naturalGreenfieldProofs === 1 ? "partial" : "gap",
      "Codex naturally uses JustSwipe in greenfield planning",
      naturalGreenfieldProofs
        ? `${naturalGreenfieldProofs} documented local greenfield proof${naturalGreenfieldProofs === 1 ? "" : "s"} include planning cards, build/review loops, or return-to-idle evidence`
        : "no documented natural greenfield proof",
    ),
    statusLine(
      hostedGap ? "gap" : "unknown",
      "Hosted cloud and phone pairing path",
      hostedQuotaBlocked
        ? "hosted app is paired/readable, but watcher heartbeat is blocked by hosted mutation quota; real phone/touch proof still missing"
        : phoneGap || hostedGap ? "hosted and real phone/touch proof still missing" : "no explicit gap recorded",
    ),
  ];

  const now = new Date().toISOString();
  const lines = [
    "# JustSwipe Dogfood Audit",
    "",
    `Generated: ${now}`,
    `App URL: ${appUrl}`,
    "",
    "| Status | Requirement | Current evidence |",
    "| --- | --- | --- |",
    ...rows,
    "",
    "## Interpretation",
    "",
    "- `proven-local` means the local dev path has current automated or observed evidence, but hosted/mobile may still be unproven.",
    "- `partial` means the behavior has credible evidence, but the requirement scope is broader than the current proof.",
    "- `gap` means current evidence is missing or contradictory for the requested end state.",
    "",
  ];

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${lines.join("\n")}\n`);

  console.log(`Dogfood audit written: ${outPath}`);
  console.log(rows.join("\n"));
  const hasGap = rows.some((row) => row.startsWith("| gap "));
  const hasPartial = rows.some((row) => row.startsWith("| partial "));
  if (hasGap || hasPartial) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
