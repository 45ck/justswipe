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
I want to use JustSwipe in this repo.

First read and follow this JustSwipe install doc from GitHub:

https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md

Use the hosted JustSwipe app as the only JustSwipe UI:

https://clear-harbor-b4fc257b5a.lakebed.app

Do not build JustSwipe, do not recreate its UI, and do not make a local replacement in this repo.

If hosted Lakebed reports `mutations quota exceeded`, stop retrying hosted mutations or hosted normal reads. Continue from the GitHub install doc above, switch the bridge app URL to local development (`npm run dev` in the JustSwipe bridge repo, then `$app = "http://localhost:3001"`) until hosted quota resets, and do not build a replacement JustSwipe UI in the target repo.

Phase 1 is mandatory setup. Do not decide JustSwipe is unnecessary. Before doing my project work, install only the repo steering contract, preserve existing repo instructions, then set up hosted pairing through the local bridge.

Default to the frictionless path: open the hosted pair link automatically with the justswipe_pair parameter, print the same code/link for my phone, and ask me only if you need to know whether I want desktop, phone, or both.

Prove setup status: AGENTS.md updated, skills/justswipe/SKILL.md present, hosted pair link/code created or opened, or local-dev pair link/code created if hosted quota is exhausted, setup handoff queued, and bridge watch command running or exact blocker reported.

After setup is proven, continue my project request normally. When the first real product, design, scope, or implementation choice appears, send that choice to JustSwipe instead of deciding silently.
```

**Why This Exists**

AI agents make software work faster, but they also create more tiny decisions: approve this direction, pick this option, clarify this edge case, review this screen, continue or stop. That oversight load can become its own fatigue.

JustSwipe is a direct response to that. It gamifies the human-input loop without turning it into a toy: one card, clear context, quick action, agent resumes. It is built for shorter attention windows, interruption-heavy days, and agentic systems that need occasional high-quality human signal.

Research background: [RATIONALE.md](RATIONALE.md)

**What Codex Should Run**

Most users should paste the prompt above and let Codex run this. The bridge lives outside your target repo; your repo only gets `AGENTS.md` and `skills/justswipe/SKILL.md`.

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "C:\path\to\your-repo"

npm run bridge:setup -- --app-url $app --cwd $repo --open --prompt "Use hosted JustSwipe for steering. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
npm run bridge:watch -- --app-url $app
```

`bridge:setup` creates or saves the Codex thread link, opens the hosted pair URL, prints the same phone/browser code, and queues the setup card. `bridge:watch` relays swipe responses back into Codex. Pair codes last 2 minutes. A paired browser lasts for the day.

**Hosted Quota Fallback**

The hosted Lakebed deployment currently exposes its limits through `npx lakebed inspect <deploy-url-or-id> --json`; for this deploy, the important operational limits are `mutationsPerDay: 1000` and `requestsPerDay: 10000`. When the hosted app reaches the mutation quota, stop pushing more hosted pair/session/handoff mutations and switch active work to local development:

```powershell
# Terminal 1: keep the local JustSwipe app running
Set-Location E:\justswipe
npm run dev
```

```powershell
# Terminal 2: point the bridge at local dev
Set-Location E:\justswipe
$app = "http://localhost:3001"
$repo = "C:\path\to\your-repo"

npm run bridge:setup -- --app-url $app --cwd $repo --open --prompt "Use JustSwipe for steering. Hosted quota is exhausted; use local dev until hosted quota resets. Do not build a replacement JustSwipe UI. Stop and wait after any JustSwipe handoff."
npm run bridge:watch -- --app-url $app
```

Report the exact blocker as: `hosted mutation quota exhausted; switch bridge app URL to local dev`. If Lakebed's 429 body includes `resetAt` or `retryAfterSeconds`, include that timing in the report, then continue active work locally. Hosted can resume after the Lakebed quota resets.

**Public Install Docs**

- Primary, quota-safe: `https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md`
- Repo copy: `INSTALL.md`
- Hosted mirror: `https://clear-harbor-b4fc257b5a.lakebed.app/install.md`
- Alias mirror: `https://clear-harbor-b4fc257b5a.lakebed.app/setup.md`
- Protocol and future flow: [docs/protocol.md](docs/protocol.md)

Use the GitHub/raw doc for installation. The hosted mirrors are convenient when Lakebed quota is available, but they can be blocked by hosted quota because they are served by the Lakebed app.

**Check**

```powershell
npm run build
npm run bridge:doctor -- --app-url http://localhost:3001
npm --silent run bridge:doctor -- --app-url http://localhost:3001 --json
npm run bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 300000
npm run bridge:status -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app
npm --silent run bridge:status -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --json
npm run bridge:dry-run -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app
```

Use `npm --silent run bridge:status -- --app-url http://localhost:3001 --json` while hosted quota is exhausted.
Use `npm run bridge:doctor -- --app-url http://localhost:3001` to verify the raw install doc, local install mirror, pairing state, queue state, and next bridge action without touching hosted quota.
Use `npm run bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 300000` for a full local round trip: disposable target repo, setup handoff, swipe response, bridge relay, follow-up card, second response, and target-repo doctor proof.
`npm run bridge:smoke` uses an isolated `guest:smoke` session unless you pass `--guest`.
