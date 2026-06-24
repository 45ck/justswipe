---
name: justswipe
description: Use when a Codex thread or agent workflow should pause for human steering through JustSwipe, emit swipe cards, consume JustSwipe response packets, or install JustSwipe into a repository with AGENTS.md plus a skill file.
---

# JustSwipe

Use JustSwipe as a low-attention decision remote for agent work. Ask one clear question, provide enough visual/contextual evidence to decide quickly, then wait for the structured response.

Hosted JustSwipe starts disconnected. The laptop bridge creates a pair code or `?justswipe_pair=ABC-123` share link, and the browser session must pair before it can see cards or send planning prompts. Do not assume a cloud browser belongs to the Codex bridge until that pairing is complete.

## Install In A Repo

Merge JustSwipe into the target repo without replacing existing repo guidance:

- If `AGENTS.md` exists, preserve it and append a clearly marked JustSwipe section.
- If `AGENTS.md` does not exist, create it with the agent contract and handoff packet format.
- If `skills/justswipe/SKILL.md` exists, update it carefully.
- If `skills/justswipe/SKILL.md` does not exist, create it from this skill.

Then tell the working Codex thread to use the `justswipe` skill when it needs human steering.

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
- `agentHtmlPreview`: short inline context rendered natively by JustSwipe.

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
