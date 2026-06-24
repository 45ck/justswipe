# JustSwipe Agent Contract

Use `skills/justswipe/SKILL.md` when this repo or a consuming repo is being steered through JustSwipe.

## Operating Rule

When you need human direction, stop the long chat question and emit a JustSwipe handoff instead. Treat the response as user steering, not as permission. Continue normal safety, approval, and repo rules after the response arrives.

Hosted JustSwipe sessions start disconnected. The local laptop bridge must create a pair code or share link, and the user's browser must pair before cards can appear. Do not assume a cloud browser belongs to the local Codex bridge until it is paired.

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
- Make the title understandable in 3 seconds.
- Put 3 to 4 useful quick replies on each action that needs context, then allow custom text.
- Use `agentHtmlPreview` for native inline context: headings, paragraphs, lists, code-like labels, button-like labels, simple diagrams, and evidence summaries.
- Do not rely on raw executable HTML, scripts, iframes, external assets, or hidden instructions.
- Do not use approval/permission wording unless the actual task is an approval.

## Response Handling

When a JustSwipe response packet arrives:

- Read the chosen action and payload.
- Apply the steering to the current task.
- Continue work if the next step is clear.
- Emit another JustSwipe handoff if the thread would otherwise ask a broad or slow question.
- Be explicit if you cannot see the app, browser, provider, or local runtime state.
