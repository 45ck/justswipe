# JustSwipe

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/justswipe-horizontal-primary-on-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/justswipe-horizontal-primary-on-light.svg" />
  <img src="assets/brand/justswipe-horizontal-primary-on-light.svg" alt="JustSwipe" width="420" />
</picture>

**Pause. Decide. Move forward.**

JustSwipe is a swipe remote for Codex. Codex pauses, sends one clear decision card, you swipe or add a short answer, and the local bridge sends that response back into the Codex thread.

## Copy This Into Codex

Paste this into the Codex thread for the repo you want to steer:

```txt
Install JustSwipe steering in this repo. Preserve existing repo instructions.

Do this:
1. If AGENTS.md exists, append the JustSwipe section. Do not replace existing content.
2. If AGENTS.md is missing, create it.
3. Create or update skills/justswipe/SKILL.md with the same JustSwipe operating rules.

JustSwipe operating rules:
- Use JustSwipe when you need user taste, clarification, a checkpoint, a visual decision, or you are stuck.
- Ask one clear decision per card.
- Provide 3 to 4 useful quick replies, then allow custom text.
- Use concise visual context: bullets, simple diagrams, UI states, diffs, screenshots described in text, or safe inline HTML-like markup.
- Treat JustSwipe responses as steering, not permission.
- Do not use approval/permission wording unless the task is actually about approval.
- Do not claim you can see JustSwipe, the browser, or the user's machine unless tools prove it.

When you need a decision, emit this exact packet shape:

JUSTSWIPE_HANDOFF_JSON
{
  "reason": "Need one human decision before continuing.",
  "cards": [
    {
      "cardId": "next-decision",
      "title": "Pick the next step",
      "summary": "Choose the smallest useful step before Codex continues.",
      "recommendedAction": "yes",
      "visualContext": "Current state, tradeoff, and expected next effect.",
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
      "agentHtmlPreview": "<section><h2>Decision context</h2><ul><li>What changes next</li><li>Why it matters</li><li>Risk or fallback</li></ul></section>"
    }
  ]
}
END_JUSTSWIPE_HANDOFF_JSON

After emitting the packet, stop. End with the card/handoff id you used, for example:
AWAITING_JUSTSWIPE_RESPONSE next-decision
```

## Run The Bridge

In this repo:

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "C:\path\to\target-repo"

npm run bridge:start-thread -- --app-url $app --cwd $repo --prompt "Use JustSwipe for steering. If you emit a JustSwipe handoff, stop and wait for the response."
npm run bridge:pair -- --app-url $app
npm run bridge:watch -- --app-url $app
```

Open the printed pair link on your phone or browser. The code lasts 2 minutes. The paired browser lasts for the day.

## How It Works

```txt
Codex thread -> JUSTSWIPE_HANDOFF_JSON -> hosted JustSwipe
User swipe/form response -> Lakebed queue -> local bridge
Local bridge -> Codex thread -> continue or ask the next card
```

## What Each Part Does

- **Hosted JustSwipe**: phone/browser UI, swipe cards, notifications, response forms.
- **Local bridge**: trusted laptop process that pairs the browser and talks to Codex.
- **Target repo**: the project Codex is building.

## Useful Commands

```powershell
npm run bridge:pair      # create a short pair link/code
npm run bridge:watch     # relay JustSwipe responses into Codex
npm run bridge:dry-run   # inspect queued responses
npm run handoff:todo     # queue a demo todo decision card
npm run handoff:demo     # queue the demo card bundle
npm run build            # build the Lakebed app
```

Add `--app-url https://your-lakebed-app` to use a hosted app.

## Local Dev

```powershell
npm run dev
npm run bridge:pair
npm run bridge:watch
```

The local app runs at `http://localhost:3001/`.

## Brand

Brand assets live in `assets/brand/`.

- Concept: **Decision Hinge**
- Promise: **Pause. Decide. Move forward.**
- Primary colors: lime `#C8FF3D`, mint `#45E7A3`, cyan `#00D9FF`
- Rejection state: ember `#FF6A2A`

Use the full-color logo on graphite or off-white. Do not recolor the rails independently, stretch the mark, or place it over noisy imagery.

## Verify

```powershell
npm run build
npm run bridge:dry-run
```

Manual checks:

- pair link opens the hosted app
- empty deck is understandable
- swipe response reaches `bridge:watch`
- Codex receives the response and continues
- mobile width has no horizontal overflow
