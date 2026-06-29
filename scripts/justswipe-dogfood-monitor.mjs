import { spawn } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const intervalMs = Number.parseInt(valueAfter("--interval-ms") || "900000", 10);
const maxRuns = Number.parseInt(valueAfter("--max-runs") || "0", 10);
const logPath = resolve(valueAfter("--log") || join(root, "docs", "dogfood-monitor-runs.md"));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function runSnapshot() {
  return new Promise((resolveSnapshot) => {
    const startedAt = new Date();
    const child = spawn(
      process.execPath,
      ["scripts/justswipe-dogfood-snapshot.mjs", "--app-url", appUrl],
      {
        cwd: root,
        shell: process.platform === "win32",
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      const finishedAt = new Date();
      resolveSnapshot({
        code,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        stdout,
        stderr,
      });
    });
  });
}

function compactOutput(result) {
  const lines = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines
    .filter((line) => /readyForDogfood|threads:|cachedThreads|bridgeEvents|Dogfood snapshot appended|failed|error/i.test(line))
    .slice(-10);
}

async function appendMonitorRun(index, result) {
  const status = result.code === 0 ? "passed" : "failed";
  const lines = [
    `## ${result.finishedAt}`,
    "",
    `- appUrl: ${appUrl}`,
    `- run: ${index}`,
    `- status: ${status}`,
    `- exitCode: ${result.code}`,
    `- durationMs: ${result.durationMs}`,
    "",
    "```text",
    ...compactOutput(result),
    "```",
    "",
  ];

  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${lines.join("\n")}\n`);
}

async function main() {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
    throw new Error("--interval-ms must be at least 1000.");
  }

  console.log(`JustSwipe dogfood monitor: ${appUrl}`);
  console.log(`intervalMs: ${intervalMs}`);
  console.log(`maxRuns: ${maxRuns || "unbounded"}`);
  console.log(`log: ${logPath}`);

  let run = 0;
  while (maxRuns === 0 || run < maxRuns) {
    run += 1;
    console.log(`\n== dogfood monitor run ${run} ==`);
    const result = await runSnapshot();
    await appendMonitorRun(run, result);

    if (result.code !== 0) {
      process.exitCode = 1;
      break;
    }

    if (maxRuns !== 0 && run >= maxRuns) {
      break;
    }

    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
