# JustSwipe Dogfood Experiments

Use this log for evidence that is broader than the repeatable runbook in `docs/dogfood.md`.

## Confidence Labels

- `proven`: directly verified with command output or browser/runtime evidence.
- `partial`: core path worked, but coverage is narrow or manual.
- `gap`: not proven yet, or behavior did not meet the product bar.

## Experiment Log

### EXP-001: Local Core Loop Baseline

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`
- Command: `npm --silent run dogfood:local:proof`
- Evidence:
  - Verified local `E:\justswipe` connection.
  - Ran disposable card/swipe E2E.
  - Codex emitted a JustSwipe handoff.
  - Simulated swipe response returned to Codex.
  - Codex built a non-UI doctor fixture in the disposable target.
  - Local dogfood restored to `E:\justswipe`.
  - Final doctor returned ready with queued/running/failed bridge events all `0`.
- Result:
  - Core local loop is proven: Codex asks, JustSwipe queues, bridge relays, Codex continues, status returns idle.

### EXP-002: Real Repo Routing Baseline

- Date: 2026-06-29
- Status: proven
- Surface: `E:\random-number-generator`
- Evidence:
  - `dogfood:target -- --cwd E:\random-number-generator` created a real target thread.
  - `dogfood:target:idea` relayed to the target thread.
  - `python -m unittest discover -s tests` passed 15 tests.
  - RNG worktree stayed clean for the read-only proof.
  - Local dogfood restored back to `E:\justswipe`.
- Result:
  - Local bridge can route to a separate real repo and return to the JustSwipe repo.

### EXP-003: Natural Greenfield Planning And Review

- Date: 2026-06-29
- Status: partial
- Surface: `E:\justswipe-greenfield-lab`
- Prompt:
  - `I want a tiny local web app for choosing dinner. Make it pleasant and useful. Start from this empty repo and do whatever setup makes sense.`
- Evidence:
  - Fresh repo started with only `README.md`.
  - `dogfood:target -- --cwd E:\justswipe-greenfield-lab` installed the JustSwipe contract.
  - `dogfood:target:idea` queued the greenfield app idea without explicitly asking Codex to emit a handoff.
  - Codex naturally emitted planning handoff `handoff-mqylutir-3g4i8k` with card `dinner-app-shape`.
  - JustSwipe rendered the card with project/thread context, concise decision text, quick replies, and an inline `agentHtmlPreview`.
  - Simulated response `Practical picker` relayed to Codex.
  - Codex built a static dinner picker app:
    - `index.html`
    - `styles.css`
    - `app.js`
    - `assets/dinner-board.svg`
  - Browser smoke over `http://127.0.0.1:5177` loaded the app and showed filters, recommendation, and meal cards.
  - `Pick dinner` interaction updated the recommendation.
  - Codex then emitted review handoff `handoff-mqym71wo-vx9mnx` with card `review-practical-picker`.
  - Review card included evidence from the built app and asked whether to keep direction.
  - Simulated response `Keep direction` relayed back to Codex.
  - Final bridge status returned idle with queued/running/failed all `0`.
  - Greenfield lab repo committed locally at `47c0612 Build dinner picker via JustSwipe dogfood`.
- Rough edges:
  - During long Codex work the app showed `responding_to_codex` and `runningBridgeEvents: 1` for several minutes. This is accurate, but the heartbeat can look stale while the watcher is busy.
  - Browser smoke reported one console error for missing `favicon.ico`; app JavaScript still worked.
  - The first broad Playwright `Save` selector failed because there were multiple Save buttons. This was a test-selector issue, not an app bug.
  - This was local desktop/browser only; it does not prove phone notifications, vibration, or real touch gestures.
- Result:
  - Natural greenfield planning works locally: Codex asked JustSwipe before building without the user prompt explicitly requiring a handoff.
  - Build-after-swipe works locally.
  - Review-after-build works locally.
  - Failure/long-running UX needs polish so stale heartbeat during active relay feels less alarming.

## Open Experiment Areas

- `gap`: long-running multi-thread use over hours or days.
- `gap`: failure recovery UX from a human perspective.
- `gap`: rich schema forms and HTML artifact previews across many card shapes.
- `partial`: natural greenfield planning behavior beyond controlled prompts.
- `gap`: mobile/phone ergonomics, notifications, vibration, and real touch gestures.
