<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/justswipe-horizontal-primary-on-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/justswipe-horizontal-primary-on-light.svg" />
  <img src="assets/brand/justswipe-horizontal-primary-on-light.svg" alt="JustSwipe" width="420" />
</picture>

**Pause. Decide. Move forward.**

JustSwipe is a low-attention decision layer for Codex and agentic engineering.

Codex is great when you are sitting in the thread. JustSwipe is for the moments when Codex needs quick human judgment while you are doing something else. It turns agent questions into small swipe cards you can answer from your phone, laptop, or desktop, then the local bridge sends that answer back into the same Codex thread.

**Why Use It Over Normal Codex Chat**

- Codex can keep working without you watching the thread all day.
- You get one clear decision at a time instead of a long chat interruption.
- You can respond from anywhere with a swipe, quick reply, or short custom answer.
- Codex can ask for taste, scope, risk, planning, or checkpoint input without derailing your day.
- The response is structured, so Codex can resume with the exact signal it asked for.

**What It Is Useful For**

- approving the next build slice
- choosing between implementation options
- giving UI/UX taste feedback
- catching risk before Codex keeps going
- starting planning discussions from an empty deck
- checking agent work while away from your main machine
- reviewing HTML artifacts, diagrams, screenshots, diffs, and app previews

Codex decides what context belongs on each card. A card can stay as plain text, or it can include a small HTML artifact, diagram, screenshot summary, UI state, code diff, evidence checklist, or custom schema form. The point is not more content. The point is the right context in a format you can judge quickly.

**Paste Into Codex**

```txt
Read and follow this JustSwipe install doc:

https://clear-harbor-b4fc257b5a.lakebed.app/install.md

Assume you can inspect this repo, edit files, and run local commands. Preserve existing repo instructions. Install JustSwipe steering, verify it, and use hosted JustSwipe whenever you need a human decision.
```

**Why This Exists**

AI agents make software work faster, but they also create more tiny decisions: approve this direction, pick this option, clarify this edge case, review this screen, continue or stop. That oversight load can become its own fatigue.

JustSwipe is a direct response to that. It gamifies the human-input loop without turning it into a toy: one card, clear context, quick action, agent resumes. It is built for shorter attention windows, interruption-heavy days, and agentic systems that need occasional high-quality human signal.

Research background: [RATIONALE.md](RATIONALE.md)

**Run The Bridge**

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "C:\path\to\your-repo"

npm run bridge:start-thread -- --app-url $app --cwd $repo --prompt "Use hosted JustSwipe for steering. Stop and wait after any JustSwipe handoff."
npm run bridge:pair -- --app-url $app
npm run bridge:watch -- --app-url $app
```

Open the printed pair link on your phone or browser. Pair codes last 2 minutes. A paired browser lasts for the day.

**Public Install Docs**

- Hosted: `https://clear-harbor-b4fc257b5a.lakebed.app/install.md`
- Alias: `https://clear-harbor-b4fc257b5a.lakebed.app/setup.md`
- Repo copy: `INSTALL.md`

**Check**

```powershell
npm run build
npm run bridge:dry-run -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app
```
