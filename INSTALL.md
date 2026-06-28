# JustSwipe Cloud Install For Codex

You are Codex working inside a target repo.

Primary install doc:
https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md

Hosted JustSwipe app:
https://clear-harbor-b4fc257b5a.lakebed.app

Bridge repo:
https://github.com/45ck/justswipe

The GitHub/raw install doc is the canonical source. Hosted `/install.md` and `/setup.md` are convenience mirrors only; if Lakebed quota blocks them, keep using this GitHub doc and continue with the same setup flow.

## Non-Negotiable Boundary

Use the hosted JustSwipe app. Do not build JustSwipe. Do not recreate a JustSwipe UI, swipe UI, bridge UI, or browser control page inside the target repo.

The target repo only receives steering instructions:

1. Preserve or create AGENTS.md.
2. Create or update skills/justswipe/SKILL.md.
3. Configure Codex to emit and consume JustSwipe handoff packets.

The local bridge is separate tooling. It talks to the hosted app and relays responses back into Codex. If the hosted Lakebed deploy reaches its mutation quota, the same bridge can temporarily point at the local JustSwipe dev server instead.

## Install The Repo Contract First

This setup phase is mandatory. Do not decide JustSwipe is unnecessary because the current project request seems clear. Complete or clearly block setup before continuing normal project work.

1. Inspect the repo before editing.
2. Preserve existing instructions. If AGENTS.md exists, append a JustSwipe section. Do not replace existing content.
3. If AGENTS.md is missing, create it.
4. Create or update skills/justswipe/SKILL.md.
5. Do not continue the user's project work until the hosted pairing step is complete, the local-dev quota fallback is paired, or setup is clearly blocked.

Add these JustSwipe rules to AGENTS.md and the skill:

- Use JustSwipe when you need user taste, clarification, a checkpoint, a visual decision, or you are stuck.
- Ask one clear decision per card.
- Use as many cards as needed, as few as possible. There is no fixed bundle limit.
- Give 3 to 4 useful quick replies, then allow custom text.
- Include only the context needed to decide: current state, tradeoff, risk, and next effect.
- Use card context well: include an HTML artifact, diagram, screenshot summary, UI state, code diff, evidence checklist, or compact schema form when it helps the user decide faster.
- Customize card context for this repo. Prefer the smallest useful artifact over a long explanation.
- Treat JustSwipe responses as steering, not permission.
- Do not claim you can see JustSwipe, the browser, or the user's machine unless tools prove it.
- After a JustSwipe handoff, stop and wait. Do not keep working until a response packet arrives.

## Pair Hosted JustSwipe

After installing the repo contract, set up the cloud app connection before continuing project work.

Default setup behavior:

- Use the hosted cloud app for every user.
- Open the hosted pair link automatically when the environment allows it.
- Print the same pair code/link so the user can pair a phone browser or second desktop browser.
- Ask one short question only if needed: "Pair desktop, phone, or both?"
- If hosted Lakebed reports `mutations quota exceeded`, stop retrying hosted mutations or hosted normal reads and switch `$app` to local development until hosted quota resets.
- Do not build a local JustSwipe UI if pairing is blocked. Report the blocker and the next command.

First locate bridge tooling:

- If JUSTSWIPE_BRIDGE_DIR is set, use that directory.
- Else if E:\justswipe exists on Windows, use E:\justswipe.
- Else clone https://github.com/45ck/justswipe into the user's home directory under .justswipe/bridge.

Then use one of these paths.

Automatic path, preferred for a new JustSwipe-controlled Codex thread:

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "<absolute path to target repo>"
$bridge = "<absolute path to JustSwipe bridge repo>"

Set-Location $bridge
npm install
npm run bridge:up:hosted -- --cwd $repo --open --prompt "Use hosted JustSwipe for steering. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
```

Existing-thread path, only if the current Codex thread id is known:

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$bridge = "<absolute path to JustSwipe bridge repo>"
$thread = "<current Codex thread id>"

Set-Location $bridge
npm install
npm run bridge:pair -- --app-url $app --open
npm run handoff:setup -- --app-url $app --thread-id $thread
npm run bridge:watch -- --app-url $app --daemon
```

If you can open a browser, use --open so the hosted app pairs automatically through the link parameter. Always print the pair code and pair link too, so the user can pair a phone browser or another desktop browser. Ask whether they want desktop, phone, or both only if it changes what you do next.

The expected result is simple: the hosted app opens, the user can pair this browser, the same link can be opened on a phone, and both devices see the same JustSwipe cards for this repo connection.

Keep the watcher running while the user expects Codex to receive JustSwipe responses. The hosted app stores cards and responses; the local bridge watcher relays those responses into Codex. Prefer the background watcher path so Codex can keep working after setup. If the user swipes and Codex does not respond, run:

```powershell
npm run bridge:status:hosted
npm run bridge:dry-run:hosted
npm run bridge:watch:hosted:daemon
```

If `bridge:status:hosted` reports `queuedBridgeEvents > 0`, the hosted app has a response waiting and the watcher is not currently relaying it.

If it reports `failedBridgeEvents > 0`, fix the bridge/Codex error, then retry from the JustSwipe thread log or run:

```powershell
npm run bridge:retry-failed -- --app-url $app
```

To queue an idea from the bridge instead of the web composer:

```powershell
# Start a new Codex thread in the paired project
npm run bridge:idea -- --app-url $app --idea "Plan the smallest useful next slice."

# Send to the current paired Codex thread
npm run bridge:idea -- --app-url $app --current-thread --idea "Review this repo and ask JustSwipe for one product decision."

# Send to a known existing Codex thread
npm run bridge:idea -- --app-url $app --thread-id <thread-id> --idea "Review this repo and ask JustSwipe for one product decision."
```

Use `--current-thread` by default after pairing. Use `--thread-id` only when steering a specific older thread.

The site connection panel shows the paired project, repo path, queued responses, relay state, and watcher heartbeat. If it shows the wrong repo or an E2E/test path, use Forget project in the connection panel or run `npm run bridge:forget:hosted`, then re-pair from the target repo.

## Hosted Mutation Quota Fallback

Lakebed exposes deploy limits with `npx lakebed inspect <deploy-url-or-id> --json`. For this hosted deploy, the important operational limits are `mutationsPerDay: 1000` and `requestsPerDay: 10000`.

If the hosted app reports `mutations quota exceeded`, do not keep retrying hosted setup, pairing, browser-session cleanup, handoff mutations, or hosted normal reads such as `/install.md`. Keep using the GitHub/raw install doc and switch active work to the local JustSwipe dev server:

```powershell
# Terminal 1: keep the local JustSwipe app running
$bridge = "<absolute path to JustSwipe bridge repo>"

Set-Location $bridge
npm install
npm run dev
```

```powershell
# Terminal 2: point the bridge at local dev
$bridge = "<absolute path to JustSwipe bridge repo>"
$repo = "<absolute path to target repo>"

Set-Location $bridge
$app = "http://localhost:3001"
npm run bridge:up -- --app-url $app --cwd $repo --open --prompt "Use JustSwipe for steering. Hosted quota is exhausted; use local dev until hosted quota resets. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
```

Report this blocker exactly: `hosted mutation quota exhausted; switch bridge app URL to local dev`. If Lakebed's 429 body includes `resetAt` or `retryAfterSeconds`, include that timing in the report, then continue active work locally. Hosted JustSwipe can resume after the Lakebed quota resets. This is not permission to build or install a replacement JustSwipe UI inside the target repo.

After setup is proven, continue the user's original project request. When the first real product, design, scope, or implementation choice appears, send that choice to JustSwipe instead of deciding silently.

For greenfield app work started from JustSwipe, the first useful response must be a planning bundle before building unless the user explicitly says not to ask questions. Good planning bundles cover the decisions Codex genuinely needs, such as direction, UI taste, first build slice, constraints, or review expectations. After building a visible slice, send a review card with screenshot/HTML/diff/evidence context before polishing further.

If you say you will ask JustSwipe, send a card, emit a handoff, or wait for a swipe, the same response must include the `JUSTSWIPE_HANDOFF_JSON` block. Do not describe a future handoff in prose without emitting the machine-readable packet.

## Handoff Format

When you need a decision, emit this exact shape:

A handoff can contain one card or a bundle. Use one card for one isolated question. Use a bundle when several related decisions are needed before productive work can continue. JustSwipe shows cards one at a time.

JUSTSWIPE_HANDOFF_JSON
{
  "reason": "Need one human decision before continuing.",
  "cards": [
    {
      "cardId": "next-decision",
      "title": "Pick the next step",
      "summary": "Choose the smallest useful step before Codex continues.",
      "recommendedAction": "yes",
      "visualContext": "Current state, tradeoff, risk, screenshot or artifact summary, and expected next effect.",
      "questionType": "yes_no",
      "quickRepliesByAction": {
        "yes": ["Build the smallest useful slice", "Keep it simple", "Prioritize reliability"],
        "no": ["Not this direction", "Too much scope", "Ask for alternatives"],
        "more": ["Show 3 smaller options", "Compare risks", "Give a visual example"],
        "later": ["Park this", "Ask again after the next checkpoint"]
      },
      "requiredFieldsByAction": {
        "yes": ["quick_reply"],
        "no": ["quick_reply"]
      },
      "yesPayloadSchema": [],
      "noPayloadSchema": [],
      "morePayloadSchema": [],
      "laterPayloadSchema": [],
      "optionPayloadSchemas": {},
      "agentHtmlPreview": "<section><h2>Decision context</h2><p>Show the useful artifact: UI state, screenshot summary, diagram, diff, or evidence.</p><ul><li>What changes next</li><li>Why it matters</li><li>Risk or fallback</li></ul></section>"
    }
  ]
}
END_JUSTSWIPE_HANDOFF_JSON

After emitting the packet, stop and end with:

AWAITING_JUSTSWIPE_RESPONSE next-decision

## Completion Standard

A successful install means:

- AGENTS.md is preserved or created.
- skills/justswipe/SKILL.md exists.
- Hosted JustSwipe pair code/link was created, or local-dev pair code/link was created because hosted mutation quota was exhausted.
- The pair link was opened automatically when possible.
- The user was given the pair code/link for phone or second-browser pairing.
- `npm --silent run bridge:status -- --app-url <app-url> --json` reports the connection and queue state.
- `queuedBridgeEvents` is `0`, or `npm run bridge:watch -- --app-url <app-url> --daemon` is running to relay them.
- The connection panel shows the expected project/repo path and a fresh bridge heartbeat when the watcher is running.
- `npm run bridge:doctor -- --app-url <app-url>` reports the canonical GitHub install doc, app mirror state, pairing state, queue state, and next action.
- `npm run bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 300000` proves the local setup, Codex-emitted first handoff, response relay, and target-repo doctor loop when hosted quota blocks cloud testing.
- After hosted quota resets, `npm run deploy:hosted` refreshes the hosted app, then `npm run bridge:e2e-hosted -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --timeout-ms 300000` proves the same loop against the hosted app.
- A JustSwipe handoff was queued, or the exact blocker and next command were reported.

If any part is blocked, do not build a local replacement. Report the blocker and the exact next command.
