import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = valueAfter("--app-url") || "http://localhost:3001";
const outPath = resolve(valueAfter("--out") || join(root, "docs", "dogfood-verify-runs.md"));

const steps = [
  ["build", "npm", ["run", "build"]],
  ["bridge status", "npm", ["run", "bridge:status", "--", "--app-url", appUrl, "--json"]],
  ["ui smoke", "npm", ["run", "ui:smoke"]],
  ["ui card shapes", "npm", ["run", "ui:smoke:card-shapes"]],
  ["ui multi-thread", "npm", ["run", "ui:smoke:multi-thread"]],
  ["ui relay state", "npm", ["run", "ui:smoke:relay-state"]],
  ["ui failure recovery", "npm", ["run", "ui:smoke:failure"]],
  ["bridge dry-run", "npm", ["run", "bridge:dry-run"]],
  ["dogfood snapshot", "npm", ["run", "dogfood:snapshot"]],
  ["final bridge status", "npm", ["run", "bridge:status", "--", "--app-url", appUrl, "--json"]],
];

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function runStep(label, command, args) {
  const startedAt = new Date();

  return new Promise((resolveStep) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: process.platform === "win32",
      env: {
        ...process.env,
      },
    });

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
      resolveStep({
        label,
        command: [command, ...args].join(" "),
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

function summarizeOutput(step) {
  const text = `${step.stdout}\n${step.stderr}`.trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const interesting = lines.filter((line) =>
    /passed|verified|readyForDogfood|threads:|"threads"|bridgeEvents:|"activeHandoffs"|"queuedBridgeEvents"|"runningBridgeEvents"|"failedBridgeEvents"|"bridgeHeartbeat"|No JustSwipe responses|artifactHash|failed|error|status:/.test(line),
  );
  return (interesting.length ? interesting : lines.slice(-8)).slice(-12);
}

async function writeReport(results) {
  const now = new Date().toISOString();
  const failed = results.filter((step) => step.code !== 0);
  const lines = [
    `## ${now}`,
    "",
    `- appUrl: ${appUrl}`,
    `- status: ${failed.length ? "failed" : "passed"}`,
    `- steps: ${results.length}`,
    `- failedSteps: ${failed.length ? failed.map((step) => step.label).join(", ") : "none"}`,
    "",
  ];

  for (const step of results) {
    lines.push(`### ${step.label}`);
    lines.push("");
    lines.push(`- command: \`${step.command}\``);
    lines.push(`- exitCode: ${step.code}`);
    lines.push(`- durationMs: ${step.durationMs}`);
    lines.push("");
    lines.push("```text");
    lines.push(...summarizeOutput(step));
    lines.push("```");
    lines.push("");
  }

  await mkdir(dirname(outPath), { recursive: true });
  try {
    await appendFile(outPath, `${lines.join("\n")}\n`);
  } catch {
    await writeFile(outPath, `${lines.join("\n")}\n`);
  }
}

async function main() {
  console.log(`JustSwipe dogfood verify: ${appUrl}`);
  console.log("Running stateful smoke tests serially.");

  const results = [];
  for (const [label, command, args] of steps) {
    console.log(`\n== ${label} ==`);
    const result = await runStep(label, command, args);
    results.push(result);

    if (result.code !== 0) {
      console.error(`Dogfood verify failed at: ${label}`);
      break;
    }
  }

  await writeReport(results);
  console.log(`Dogfood verify report appended: ${outPath}`);

  if (results.some((step) => step.code !== 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
