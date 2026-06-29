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

### EXP-004: Bridge Mechanics Smoke And Busy Relay Copy

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`
- Commands:
  - `npm run build`
  - `npm --silent run bridge:doctor:ready:local`
  - `npm run bridge:smoke`
- Evidence:
  - Build passed with Lakebed artifact hash `sha256:7133147a22134053264cdd2997037161430aa7784b8df7c63a0e587f8bb5b897`.
  - Local doctor returned `doctor.status: ready` with `currentCwd` set to `E:\justswipe`.
  - Doctor reported queued/running/failed bridge events all `0`.
  - Smoke verified pair code format, superseded-code hiding, idea queueing, duplicate-claim blocking, multi-card advancement, required-field validation, and quota fallback guidance.
  - UI bridge health now prioritizes active relay state before queued/offline state and labels stale heartbeat during active relay as `Busy relaying`.
- Result:
  - The local bridge mechanics are covered better than before.
  - The app should no longer imply the bridge is offline just because heartbeat copy lags while Codex is actively resuming.

### EXP-005: Rich Schema Cards And Local E2E Regression

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`
- Commands:
  - `npm run build`
  - `npm run bridge:smoke`
  - `npm run bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 180000 --json`
  - `npm run dogfood:local`
  - `npm --silent run dogfood:local:verify`
- Evidence:
  - Client now renders model-defined schema fields in the response sheet: text, textarea, select, toggle, checklist, rating, evidence, plus unknown-safe fallback.
  - Schema-only payloads can enable submit; required schema fields block submit until filled.
  - Server validation no longer lets `quick_reply` or `custom_response` bypass required model fields.
  - Smoke verified required-field rejection for empty payload and quick-reply bypass.
  - Smoke verified rich schema preservation for select, text, toggle, checklist, rating, evidence, and `agentHtmlPreview`.
  - Local E2E created disposable target `E:\justswipe\.lakebed\e2e-targets\run-1782703998599-18164`.
  - Local E2E created Codex thread `019f1170-4c24-78f0-a326-bf5a4437df33`.
  - Codex emitted handoff `handoff-mqyo0yb3-nzl5f1` with card `doctor-fixture`.
  - Simulated swipe response `Build doctor fixture` relayed back into Codex.
  - Codex generated `scripts/justswipe-doctor.ps1` and updated the fixture README.
  - Normal and `-Json` doctor checks passed with 8/8 contract checks.
  - Local dogfood restored to `E:\justswipe` with thread `019f1175-56d5-7861-b5d7-0be86bd0b94a`.
  - Final doctor returned `doctor.status: ready`, expected cwd matched `E:\justswipe`, and queued/running/failed bridge events were all `0`.
- Rough edges:
  - The E2E can be quiet for 1-2 minutes before first progress output, which feels like a hang even when it later passes.
  - Browser-click UI proof for schema fields was not completed because the available Playwright package had no Chromium binary installed on this machine.
- Result:
  - Rich schema payloads and HTML preview preservation are now repeatably smoke-tested.
  - Local Codex handoff/response/build verification still passes after the schema changes.
  - The next QA improvement should add a reliable browser-click runner or install browser binaries for mobile-width UI verification.

### EXP-006: Mobile Browser UI Schema Smoke

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`, Playwright Chromium
- Commands:
  - `npm install --save-dev playwright`
  - `npm run ui:smoke`
  - `npm run build`
  - `npm run bridge:smoke`
  - `npm --silent run bridge:doctor:ready:local`
- Evidence:
  - `ui:smoke` uses isolated guest `guest:ui-smoke`, so it does not disturb the normal local pairing.
  - The script creates a rich schema handoff, opens JustSwipe at `390x844`, pairs through the URL, and verifies the card title plus inline `agentHtmlPreview`.
  - It opens the Yes response sheet and fills a select, text input, toggle, checklist, and rating field.
  - It submits through the UI and verifies a visible sent/resuming state.
  - It dumps Lakebed state and verifies the queued bridge event payload includes the expected schema values.
  - It checks mobile horizontal overflow before and after filling the form.
  - Passing run used handoff `handoff-mqyp19zd-i6ixll`.
  - Build passed with Lakebed artifact hash `sha256:327c7595644d0783c23ea779be28bc873f4d4c746e745fab2e0a859e5b724d1a`.
  - Bridge smoke still passed after adding the browser UI smoke.
  - Local doctor returned `doctor.status: ready` with queued/running/failed all `0`.
- Rough edges:
  - The first browser test attempts found brittle selectors around the toggle, checklist, and success state; the final script scopes selectors to field containers.
  - This proves desktop Chromium at mobile viewport, not a real phone browser, notification permission, or vibration.
- Result:
  - Browser-click proof for schema fields on mobile width is now covered by a repeatable script.
  - The rich schema gap moves from backend-only proof to real rendered UI proof.

### EXP-007: Failure Recovery UI Smoke

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`, Playwright Chromium
- Commands:
  - `npm run ui:smoke:failure`
  - `npm run ui:smoke`
  - `npm run build`
  - `npm run bridge:smoke`
  - `npm --silent run bridge:doctor:ready:local`
- Evidence:
  - `ui:smoke:failure` uses isolated guest `guest:ui-smoke`.
  - The script creates a one-card handoff, submits it through the UI, claims the bridge event, then marks it failed with `Simulated relay failure for UI smoke.`
  - Browser verifies the visible `Bridge needs attention` state.
  - Browser verifies the exact failure detail appears to the user.
  - Browser opens the thread log, clicks `Retry relay`, and verifies the retry toast.
  - Lakebed state verifies the same bridge event returns to `queued`.
  - Passing run used handoff `handoff-mqypihvh-l5ffl8`.
  - Follow-up schema UI smoke still passed with handoff `handoff-mqypjy3v-2uyt55`.
  - Build passed with Lakebed artifact hash `sha256:1f033647ab4b2314d9ae8fc32ff9a67f1f11865b6d8ecf0c5c34dac241d25884`.
  - Bridge smoke and local doctor passed with queued/running/failed all `0`.
- Result:
  - Failure recovery UX is now covered by browser-click proof for the main failed-relay path.
  - This does not prove every possible Codex or hosted failure, but it proves the user can see the saved error and retry from the app.

## Open Experiment Areas

- `gap`: long-running multi-thread use over hours or days.
- `partial`: failure recovery UX from a human perspective.
- `partial`: rich schema forms and HTML artifact previews across many card shapes.
- `partial`: natural greenfield planning behavior beyond controlled prompts.
- `gap`: mobile/phone ergonomics, notifications, vibration, and real touch gestures.
- `gap`: hosted cloud proof after Lakebed quota reset, including phone pairing and notification permission.
- `proven`: browser-click proof for schema fields on mobile-width Chromium.
