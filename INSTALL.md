# JustSwipe Cloud Install For Codex

You are Codex working inside a target repo.

Hosted JustSwipe app:
https://clear-harbor-b4fc257b5a.lakebed.app

Bridge repo:
https://github.com/45ck/justswipe

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
- If hosted Lakebed reports `mutations quota exceeded`, stop retrying hosted mutations and switch `$app` to local development until hosted quota resets.
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
npm run bridge:setup -- --app-url $app --cwd $repo --open --prompt "Use hosted JustSwipe for steering. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
npm run bridge:watch -- --app-url $app
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
npm run bridge:watch -- --app-url $app
```

If you can open a browser, use --open so the hosted app pairs automatically through the link parameter. Always print the pair code and pair link too, so the user can pair a phone browser or another desktop browser. Ask whether they want desktop, phone, or both only if it changes what you do next.

The expected result is simple: the hosted app opens, the user can pair this browser, the same link can be opened on a phone, and both devices see the same JustSwipe cards for this repo connection.

## Hosted Mutation Quota Fallback

Lakebed exposes deploy limits with `npx lakebed inspect <deploy-url-or-id> --json`. For this hosted deploy, the important operational limits are `mutationsPerDay: 1000` and `requestsPerDay: 10000`.

If the hosted app reports `mutations quota exceeded`, do not keep retrying hosted setup, pairing, browser-session cleanup, or handoff mutations. Switch active work to the local JustSwipe dev server:

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
npm run bridge:setup -- --app-url $app --cwd $repo --open --prompt "Use JustSwipe for steering. Hosted quota is exhausted; use local dev until hosted quota resets. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
npm run bridge:watch -- --app-url $app
```

Report this blocker exactly: `hosted mutation quota exhausted; switch bridge app URL to local dev`. If Lakebed's 429 body includes `resetAt` or `retryAfterSeconds`, include that timing in the report, then continue active work locally. Hosted JustSwipe can resume after the Lakebed quota resets. This is not permission to build or install a replacement JustSwipe UI inside the target repo.

After setup is proven, continue the user's original project request. When the first real product, design, scope, or implementation choice appears, send that choice to JustSwipe instead of deciding silently.

## Handoff Format

When you need a decision, emit this exact shape:

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
- A setup handoff was queued, or the exact blocker and next command were reported.

If any part is blocked, do not build a local replacement. Report the blocker and the exact next command.
