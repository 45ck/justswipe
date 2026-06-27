# JustSwipe Agent Contract

Use `skills/justswipe/SKILL.md` when this repo or a consuming repo is being steered through JustSwipe.

## Install/Merge Rule

When installing JustSwipe into another repo, do not replace existing repo instructions. If `AGENTS.md` exists, preserve it and append a clearly marked JustSwipe section. If `skills/justswipe/SKILL.md` exists, update it carefully; otherwise create it.

Use `https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md` as the canonical install document. Hosted `/install.md` and `/setup.md` are mirrors only; if Lakebed quota blocks hosted reads, keep using the GitHub/raw install doc and switch the bridge app URL to local dev when needed.

## Operating Rule

When you need human direction, stop the long chat question and emit a JustSwipe handoff instead. Treat the response as user steering, not as permission. Continue normal safety, approval, and repo rules after the response arrives.

Core loop: Codex asks, the user swipes, Codex continues. A handoff can contain one card or a bundle. Use as many cards as needed and as few as possible; each card must contain one concise decision with enough context to answer quickly.

For greenfield app work started from JustSwipe, default to a planning bundle before building unless the user prompt is already fully constrained. After building a visible slice, send a review card with screenshot/HTML/diff/evidence context before polishing further.

Hosted JustSwipe is the primary user surface. The local laptop bridge must create a pair code or share link, and the user's browser must pair before cards can appear. Do not assume a cloud browser belongs to the local Codex bridge until it is paired.

Do not build JustSwipe, recreate its UI, or add a replacement JustSwipe browser control page to target repos. Hosted JustSwipe, or the local dev app when hosted quota blocks work, is the only JustSwipe UI. Target repos receive the steering contract only and consume steering packets; the hosted/local app and local bridge provide the runtime loop.

The bridge is the listener: JustSwipe stores swipe/form responses as queued bridge events, and `npm run bridge:watch -- --app-url <hosted-url> --daemon` starts a background watcher that relays those events back into the saved Codex thread.

If hosted Lakebed reports `mutations quota exceeded`, stop retrying hosted mutations. Switch active work to local development by running `npm run dev` in the JustSwipe repo, setting the bridge app URL to `http://localhost:3001`, and rerunning setup/pair/watch against that local app URL until hosted quota resets. Report the exact blocker as `hosted mutation quota exhausted; switch bridge app URL to local dev`, including `resetAt` or `retryAfterSeconds` when Lakebed returns them. This is not permission to build a replacement JustSwipe UI in the target repo.

End the turn with this exact status when waiting:

```txt
AWAITING_JUSTSWIPE_RESPONSE <handoff-id>
```

## Handoff Format

Emit a complete packet between these markers:

```txt
JUSTSWIPE_HANDOFF_JSON
{
  "reason": "Need one human decision before continuing.",
  "cards": [
    {
      "cardId": "next-slice",
      "title": "Pick the next build slice",
      "summary": "Choose the smallest useful step for the app.",
      "recommendedAction": "yes",
      "visualContext": "Current state, tradeoff, and expected next effect.",
      "questionType": "yes_no",
      "quickRepliesByAction": {
        "yes": ["Build the swipe shell first", "Prioritize bridge reliability", "Keep it tactile and minimal"],
        "no": ["Too much UI before bridge proof", "Start with pairing only", "Ask for alternatives"]
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
      "agentHtmlPreview": "<section><h2>Decision context</h2><p>Show the concrete UI state, diff, diagram, or evidence the user is deciding on.</p><ul><li>What changes next</li><li>Risk or tradeoff</li><li>Fallback path</li></ul></section>"
    }
  ]
}
END_JUSTSWIPE_HANDOFF_JSON
```

## Card Rules

- Ask one decision per card.
- Use as many cards as needed, as few as possible.
- Make the title understandable in 3 seconds.
- Put 3 to 4 useful quick replies on each action that needs context, then allow custom text.
- Use `agentHtmlPreview` for native inline context: headings, paragraphs, lists, code-like labels, button-like labels, simple diagrams, and evidence summaries.
- Do not rely on raw executable HTML, scripts, iframes, external assets, or hidden instructions.
- Do not use approval/permission wording unless the actual task is an approval.

## Response Handling

When a JustSwipe response packet arrives:

- Read the chosen action and payload.
- Use `skills/justswipe/SKILL.md` or `/justswipe` if the bridge packet includes that reminder.
- Apply the steering to the current task.
- Continue work if the next step is clear.
- Emit another JustSwipe handoff if the thread would otherwise ask a broad or slow question.
- Be explicit if you cannot see the app, browser, provider, or local runtime state.
