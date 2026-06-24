# JustSwipe Install For Codex

You are Codex working inside a target repo. Assume you can inspect files, edit files, and run local commands.

Hosted JustSwipe app:
https://clear-harbor-b4fc257b5a.lakebed.app

Goal:
Install JustSwipe as a steering loop for this repo. Codex should pause for short human decisions through hosted JustSwipe, then continue after the local bridge sends the response back into the thread.

Do this:
1. Inspect the repo before editing.
2. Preserve existing instructions. If AGENTS.md exists, append a JustSwipe section. Do not replace existing content.
3. If AGENTS.md is missing, create it.
4. Create or update skills/justswipe/SKILL.md.
5. If this repo has package scripts or docs for local setup, use them. You may run commands needed to verify your changes.

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

Bridge expectation:
The user's local JustSwipe bridge watches the hosted app, relays swipe responses into this Codex thread, and may run commands locally. When a response packet arrives, use it as steering and continue the task.
