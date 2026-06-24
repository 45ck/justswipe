<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/justswipe-horizontal-primary-on-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/justswipe-horizontal-primary-on-light.svg" />
  <img src="assets/brand/justswipe-horizontal-primary-on-light.svg" alt="JustSwipe" width="420" />
</picture>

**Pause. Decide. Move forward.**

This repo contains the JustSwipe Lakebed app, local Codex bridge scripts, install prompt, and brand assets.

JustSwipe is a cloud swipe UI plus local Codex bridge.

It lets Codex pause with one clear decision card, wait while you swipe or add a short answer, then continue with that feedback in the same thread.

**Useful For**

- steering Codex without long back-and-forth chat
- yes/no calls, option picks, design taste, scope checks, and checkpoints
- phone-friendly feedback while an agent is working locally
- keeping Codex moving without giving it blind permission to guess

**Cloud Setup**

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "C:\path\to\your-repo"

npm run bridge:start-thread -- --app-url $app --cwd $repo --prompt "Use hosted JustSwipe for steering. Stop and wait after any JustSwipe handoff."
npm run bridge:pair -- --app-url $app
npm run bridge:watch -- --app-url $app
```

Open the printed pair link on your phone or browser. Pair codes last 2 minutes. A paired browser lasts for the day.

**Copy This Into Codex**

Paste this into the Codex thread for the repo you want to steer:

```txt
Use hosted JustSwipe for this repo.

Hosted app:
https://clear-harbor-b4fc257b5a.lakebed.app

Install JustSwipe without replacing existing repo instructions:
1. If AGENTS.md exists, append a "JustSwipe" section. Preserve all existing content.
2. If AGENTS.md is missing, create it.
3. Create or update skills/justswipe/SKILL.md with the same rules.

Rules:
- Use JustSwipe when you need user taste, clarification, a checkpoint, a visual decision, or you are stuck.
- Ask one clear decision per card.
- Give 3 to 4 useful quick replies, then allow custom text.
- Include only the context needed to decide: current state, tradeoff, risk, and next effect.
- Treat JustSwipe responses as steering, not permission.
- Do not claim you can see JustSwipe, the browser, or the user's machine unless tools prove it.

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
      "visualContext": "Current state, tradeoff, risk, and expected next effect.",
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

After emitting the packet, stop and end with:
AWAITING_JUSTSWIPE_RESPONSE next-decision
```

**Check It Works**

```powershell
npm run build
npm run bridge:dry-run -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app
```
