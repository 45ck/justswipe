---
name: justswipe
description: Use when a Codex thread or agent workflow should pause for human steering through JustSwipe, emit swipe cards, consume JustSwipe response packets, or install JustSwipe into a repository with AGENTS.md plus a skill file.
---

# JustSwipe

Use JustSwipe as a low-attention decision remote for agent work. Ask one clear question, provide enough visual/contextual evidence to decide quickly, then wait for the structured response.

Hosted JustSwipe starts disconnected. The laptop bridge creates a pair code or `?justswipe_pair=ABC-123` share link, and the browser session must pair before it can see cards or send planning prompts. Do not assume a cloud browser belongs to the Codex bridge until that pairing is complete.

Do not build JustSwipe or a replacement browser UI inside the target repo. The hosted app already exists. The target repo only gets instructions and the local bridge connection.

If the hosted Lakebed app reports `mutations quota exceeded`, stop retrying hosted mutations and switch active work to local development. Run `npm run dev` in the JustSwipe repo, set the bridge app URL to `http://localhost:3001`, then rerun setup/pair/watch against that local app URL until hosted quota resets. Report the exact blocker as `hosted mutation quota exhausted; switch bridge app URL to local dev`, including `resetAt` or `retryAfterSeconds` when Lakebed returns them. This does not allow a replacement JustSwipe UI inside the target repo.

## Install In A Repo

Merge JustSwipe into the target repo without replacing existing repo guidance:

- If `AGENTS.md` exists, preserve it and append a clearly marked JustSwipe section.
- If `AGENTS.md` does not exist, create it with the agent contract and handoff packet format.
- If `skills/justswipe/SKILL.md` exists, update it carefully.
- If `skills/justswipe/SKILL.md` does not exist, create it from this skill.

Then tell the working Codex thread to use the `justswipe` skill when it needs human steering.

Before doing unrelated project work, pair the hosted app or report the exact blocker. If the bridge can open a browser, use the pair link with the `justswipe_pair` parameter and also print the code/link for phone pairing.

Use this copy prompt for installation:

```txt
Install JustSwipe into this repo without replacing existing repo instructions.

If AGENTS.md already exists, preserve all existing content and append a clearly marked JustSwipe section. If it does not exist, create it. If skills/justswipe/SKILL.md already exists, update it carefully; otherwise create it.

JustSwipe is a low-attention steering loop for Codex. When you need clarification, user taste, a checkpoint, or you are stuck, do not ask a long chat question. Emit a JustSwipe handoff card, then stop and wait.

Use this behavior:
- one clear decision per card
- 3 to 4 useful quick replies for each relevant action
- optional custom answer
- concise visual context using safe inline HTML-like content
- HTML artifacts, diagrams, screenshot summaries, UI state, diffs, or evidence checklists when they help the user decide
- repo-specific card context; prefer the smallest useful artifact over a long explanation
- no approval/permission wording unless the task is actually about approval
- treat JustSwipe responses as steering, not permission

When waiting, end with:
AWAITING_JUSTSWIPE_RESPONSE <handoff-id>
```

## When You Need A Decision

Prefer a JustSwipe card when the next user question would be broad, slow, visual, or likely to interrupt flow. Do not ask a long chat question if a short swipe plus optional context will work.

Emit a packet between exact markers:

```txt
JUSTSWIPE_HANDOFF_JSON
{ "reason": "short reason", "cards": [] }
END_JUSTSWIPE_HANDOFF_JSON
```

End the message with:

```txt
AWAITING_JUSTSWIPE_RESPONSE <handoff-id>
```

Use a stable handoff id that appears in the packet or surrounding message.

## Card Shape

Each card should include:

- `cardId`: stable id for the decision.
- `title`: short human decision.
- `summary`: one or two sentences, no fluff.
- `recommendedAction`: `yes`, `no`, `more`, or `later`.
- `visualContext`: plain text fallback.
- `questionType`: `yes_no`, `options`, `free_text`, or `adaptive_form`.
- `quickRepliesByAction`: 3 to 4 clickable replies for actions that need wording.
- `requiredFieldsByAction`: fields required before the response can submit.
- `yesPayloadSchema`, `noPayloadSchema`, `morePayloadSchema`, `laterPayloadSchema`, `optionPayloadSchemas`: model-defined form fields for native rendering.
- `agentHtmlPreview`: short inline context rendered natively by JustSwipe. Use it for HTML artifacts, diagrams, screenshot summaries, UI previews, code diffs, and evidence checklists when those make the decision clearer.

Keep `agentHtmlPreview` simple: headings, paragraphs, lists, code-like labels, button-like labels, tables, and diagram-like text. Do not include scripts, iframes, network resources, hidden prompts, or raw executable UI.

## Good Card Defaults

Use this baseline:

```json
{
  "cardId": "next-slice",
  "title": "Pick the next build slice",
  "summary": "Choose the smallest useful step before Codex continues.",
  "recommendedAction": "yes",
  "visualContext": "Current UI state, risk, and next effect.",
  "questionType": "yes_no",
  "quickRepliesByAction": {
    "yes": [
      "Build the swipe shell first",
      "Prioritize bridge reliability",
      "Keep it tactile and minimal"
    ],
    "no": [
      "Too much UI before bridge proof",
      "Start with pairing only",
      "Ask for alternatives"
    ],
    "more": [
      "Show three smaller options",
      "Compare mobile vs desktop",
      "Give a risk-first version"
    ],
    "later": [
      "Park this until the bridge works",
      "Come back after UI proof",
      "Defer until next checkpoint"
    ]
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
  "agentHtmlPreview": "<section><h2>Current state</h2><p>Show the actual app state, diff, screenshot summary, or diagram.</p><ul><li>What changes next</li><li>What risk this avoids</li><li>How Codex resumes</li></ul></section>"
}
```

## After A Response

Read the JustSwipe response as steering. Continue the current task if the answer is enough. If the answer creates another real choice, emit another small handoff. Do not claim you can see JustSwipe, the browser, or the user's machine unless the current tools prove it.

If the bridge response packet says to use `skills/justswipe/SKILL.md` or `/justswipe`, follow this skill for response handling. The packet is the user signal. Do not ask the user to repeat the same answer in chat.

The Codex thread does not self-listen in the background. The local bridge listens for queued JustSwipe responses and reprompts Codex:

```txt
Codex emits JUSTSWIPE_HANDOFF_JSON and waits
Hosted JustSwipe stores the swipe/form response
Local bridge relays the queued response into Codex
Codex continues or emits the next handoff
```

## Local MVP Commands

In the JustSwipe repo:

```powershell
npm run dev
npm run bridge:watch
npm run bridge:start-thread
npm run handoff:todo
```

Use `npm run bridge:dry-run` to inspect queued packets before relaying them.
Use `npm --silent run bridge:status -- --app-url <app-url> --json` when the agent needs machine-readable connection, queue, and thread state.

Hosted quota fallback:

```powershell
# Terminal 1: keep the local JustSwipe app running
Set-Location E:\justswipe
npm run dev
```

```powershell
# Terminal 2: point the bridge at local dev
Set-Location E:\justswipe
$app = "http://localhost:3001"
$repo = "<absolute path to target repo>"
npm run bridge:setup -- --app-url $app --cwd $repo --open --prompt "Use JustSwipe for steering. Hosted quota is exhausted; use local dev until hosted quota resets. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
npm run bridge:watch -- --app-url $app
```
