---
name: justswipe
description: Use when a Codex thread or agent workflow should pause for human steering through JustSwipe, emit swipe cards, consume JustSwipe response packets, or install JustSwipe into a repository with AGENTS.md plus a skill file.
---

# JustSwipe

Use JustSwipe as a low-attention decision remote for agent work. Ask one clear question per card, provide enough visual/contextual evidence to decide quickly, then wait for the structured response.

Core loop: Codex asks, the user swipes, Codex continues. Prefer the smallest useful bundle, but do not impose a fixed card limit. If a planning or review moment genuinely needs several concise decisions, send all needed cards in one bundle; JustSwipe shows them one at a time.

Use `https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md` as the canonical install document. Hosted `/install.md` and `/setup.md` are mirrors only; if Lakebed quota blocks hosted reads, keep using the GitHub/raw install doc and switch the bridge app URL to local dev when needed.

Hosted JustSwipe starts disconnected. The laptop bridge creates a pair code or `?justswipe_pair=ABC-123` share link, and the browser session must pair before it can see cards or send planning prompts. Do not assume a cloud browser belongs to the Codex bridge until that pairing is complete.

Do not build JustSwipe or a replacement browser UI inside the target repo. Hosted JustSwipe, or the local dev app at `http://localhost:3001` when hosted quota blocks work, is the only JustSwipe UI. The target repo only consumes steering packets and gets instructions plus the local bridge connection.

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

JustSwipe is a low-attention steering loop for Codex. When you need clarification, user taste, a checkpoint, or you are stuck, do not ask a long chat question. Emit a JustSwipe handoff card or bundle, then stop and wait.

Use this behavior:
- one clear decision per card
- as many cards as needed, as few as possible
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

A handoff can contain one card or a bundle. Use one card for one isolated question. Use a bundle when Codex needs several related decisions before it can work productively. There is no fixed maximum; every card must be concise, visually grounded where useful, and necessary.

For greenfield app work started from JustSwipe, the first useful response must be a planning bundle before building unless the user explicitly says not to ask questions. Good planning bundles usually cover direction, UI taste, first build slice, and any important constraint. After building a visible slice, send a review card with screenshot/HTML/diff/evidence context before polishing further.

If you say you will ask JustSwipe, send a card, emit a handoff, or wait for a swipe, the same response must include the `JUSTSWIPE_HANDOFF_JSON` block. Do not describe a future handoff in prose without emitting the machine-readable packet.

Emit a packet between exact markers, then stop and wait for the response packet. The minimum documented shape is:

```txt
JUSTSWIPE_HANDOFF_JSON
{"reason":"Need one human decision before continuing.","cards":[{"cardId":"next-decision","title":"Pick the next step","summary":"One clear choice.","recommendedAction":"yes","visualContext":"Current state, tradeoff, risk, and next effect.","questionType":"yes_no","quickRepliesByAction":{"yes":["Do this","Keep it simple","Ship this slice"],"no":["Not this","Too broad","Try smaller"]},"requiredFieldsByAction":{"yes":["quick_reply"],"no":["quick_reply"]},"yesPayloadSchema":[],"noPayloadSchema":[],"morePayloadSchema":[],"laterPayloadSchema":[],"optionPayloadSchemas":{},"agentHtmlPreview":"<section><h2>Decision context</h2><p>Show the concrete thing the user is deciding on.</p></section>"}]}
END_JUSTSWIPE_HANDOFF_JSON
AWAITING_JUSTSWIPE_RESPONSE next-decision
```

For custom cards, use a stable handoff id that appears in the packet and end the message with:

```txt
AWAITING_JUSTSWIPE_RESPONSE <handoff-id>
```

After emitting a JustSwipe handoff, do not keep working in the repo until a `JUSTSWIPE RESPONSE PACKET` arrives.

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

For follow-up feedback, use quick replies first and schema fields only when a swipe alone would lose important context. Keep follow-up inputs short and tied to the chosen action.

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

Read a `JUSTSWIPE RESPONSE PACKET` as user steering, not permission. Use the chosen action and payload to continue the current task if the answer is enough. If the answer creates another real choice, emit another small handoff. Do not claim you can see JustSwipe, the browser, or the user's machine unless the current tools prove it.

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
npm run bridge:watch:daemon
npm run bridge:start-thread
npm run handoff:todo
```

Use `npm run bridge:dry-run` to inspect queued packets before relaying them.
Use `npm --silent run bridge:status -- --app-url <app-url> --json` when the agent needs machine-readable connection, queue, and thread state.
Use `npm run bridge:idea:current:hosted -- --idea "..."` to send a thought to the currently paired hosted thread. Use `npm run bridge:idea:current -- --idea "..."` for the current local-dev thread. Use `--thread-id <thread-id>` only when steering a specific older thread.
If status shows `failedBridgeEvents > 0`, fix the underlying bridge or Codex error, then ask the user to retry from the JustSwipe thread log or run `npm run bridge:retry-failed -- --app-url <app-url>`.

Hosted quota fallback:

```powershell
# Terminal 1: keep the local JustSwipe app running
Set-Location E:\justswipe
npm run dev
```

```powershell
# Terminal 2: point the bridge at local dev and start the watcher in the background
Set-Location E:\justswipe
$app = "http://localhost:3001"
$repo = "<absolute path to target repo>"
npm run bridge:up -- --app-url $app --cwd $repo --open --prompt "Use JustSwipe for steering. Hosted quota is exhausted; use local dev until hosted quota resets. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
```
