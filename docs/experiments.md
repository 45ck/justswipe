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
  - Later enhancement also claims the retried event, marks it sent, reloads the UI, verifies `Codex resumed` / `Last thread state: Codex resumed`, and verifies the retry success response is preserved in the sent bridge event.
  - Passing run used handoff `handoff-mqypihvh-l5ffl8`.
  - Enhanced retry-to-sent run passed with handoff `handoff-mqyu5nsa-w0dwcn`.
  - Follow-up schema UI smoke still passed with handoff `handoff-mqypjy3v-2uyt55`.
  - Build passed with Lakebed artifact hash `sha256:1f033647ab4b2314d9ae8fc32ff9a67f1f11865b6d8ecf0c5c34dac241d25884`.
  - Bridge smoke and local doctor passed with queued/running/failed all `0`.
- Result:
  - Failure recovery UX is now covered by browser-click proof for failed-relay visibility, retry requeue, and retry-to-sent completion.
  - This does not prove every possible Codex or hosted failure, but it proves the user can see the saved error and retry from the app.

### EXP-008: Natural Notes App Dogfood

- Date: 2026-06-29
- Status: partial
- Surface: `E:\justswipe-greenfield-notes-lab`, local app `http://localhost:3001`
- Prompt:
  - `I want a tiny local web app for capturing quick notes and turning them into a clean short list for later. Make it pleasant and useful. Start from this repo and do what setup makes sense.`
- Evidence:
  - Fresh repo started with only `README.md` and initial commit `549b23b Initial notes lab`.
  - `dogfood:target -- --cwd E:\justswipe-greenfield-notes-lab` installed the JustSwipe target contract and created Codex thread `019f11a0-3fdc-7973-a8e5-99d1620c0731`.
  - The vague app idea was sent through `dogfood:target:idea`, not typed directly into the target Codex thread.
  - Codex naturally emitted planning handoff `handoff-mqypztmx-o1fble` with card `notes-first-slice`.
  - The card asked for one focused planning decision: `Pick first notes slice`.
  - Swipe response was sent through JustSwipe with `Build capture, list, and local save first`.
  - Bridge relayed the response and Codex built the first app slice:
    - `index.html`
    - `styles.css`
    - `app.js`
    - updated `README.md`
    - screenshot artifact `output/playwright/notes-lab-home.png`
  - Independent browser smoke against `http://127.0.0.1:5188/index.html` verified:
    - HTTP 200
    - add note
    - split pasted bullet-ish text into separate notes
    - list rendering
    - complete note
    - reload persistence through localStorage
    - delete note
    - no mobile horizontal overflow at `390x844`
    - no browser console errors
  - Target repo committed locally at `32d8f92 Build notes app through JustSwipe dogfood`.
  - Local JustSwipe pairing was restored to `E:\justswipe`; final status returned queued/running/failed bridge events all `0`.
- Rough edges:
  - Setup output briefly said the pairing was still scoped to `E:\justswipe`, even though final bridge status correctly showed the target cwd. This copy is confusing during setup.
  - During the long relay/build, the thread/bridge status could look stale while the bridge event was still running. The event eventually completed, but this is still a trust problem.
  - Codex thread read showed the turn as `interrupted` even though files were created, verification ran, and the bridge event was later marked sent. JustSwipe should explain this class of Codex-side ambiguity better.
  - The target Codex run could not use the managed browser profile and fell back to a temp static server plus Playwright CLI screenshot. Independent smoke verified the app afterward.
- Result:
  - A normal vague greenfield idea can start in JustSwipe, cause Codex to ask a planning card, accept a swipe, build a real static app slice, and return to idle locally.
  - This is useful evidence for the core loop, but still local-only and not enough to claim phone/hosted/multi-day reliability.

### EXP-009: Self-Dogfood Trust Cue Improvement

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`
- Prompt sent from JustSwipe:
  - `Self-dogfood JustSwipe core sprint: inspect the app and docs, identify one small improvement that makes the core Codex asks -> swipe -> Codex continues loop feel more trustworthy, use JustSwipe cards if you need a decision, otherwise make the improvement, run focused verification, and report exact evidence. Do not expand dashboard features.`
- Evidence:
  - Idea was queued through JustSwipe to existing thread `019f11af-f4b9-76b2-ac6e-0ecbb4ab2dad`.
  - Bridge event `idea-mqyquxo0-ime6zw` moved to `running`, then completed and returned the app to idle.
  - Codex identified a core trust gap: after swiping, the sent state did not explain the saved -> bridge relay -> Codex resumes chain clearly enough.
  - Codex changed `client/index.tsx` to add a compact `ResumeEvidenceStrip` in the sent state:
    - `Swipe saved`
    - `Bridge relay`
    - `Codex continues` / `Codex resumed`
    - failed state copy points to retry via thread log.
  - Codex changed `scripts/justswipe-ui-smoke.mjs` so the mobile UI smoke asserts those three labels after submit.
  - Verification passed:
    - `npm run build`
    - `npm run ui:smoke`
    - `npm run bridge:smoke`
    - `npm --silent run bridge:doctor:ready:local`
  - `ui:smoke` passed with handoff `handoff-mqyr1iz6-y97fz7` and explicitly verified mobile render, HTML preview, schema fields, resume evidence, submit, and queued payload.
  - Final local status returned `currentCwd: E:\justswipe`, watcher online/fresh, and queued/running/failed bridge events all `0`.
- Rough edges:
  - The worker thread was visible as `interrupted` when read through Codex even though file changes were applied and the bridge event later completed. The supervising thread had to take over verification and commit.
  - During active relay, heartbeat temporarily appeared stale while `runningBridgeEvents: 1`; this reinforces that long-running relay state needs continued UX hardening.
- Result:
  - JustSwipe successfully improved itself through its own idea -> Codex worker -> verification path.
  - The improvement directly targets post-swipe trust without adding dashboard scope.
  - The interrupted-thread ambiguity remains an integration reliability gap to keep dogfooding.

### EXP-010: Multi-Shape Card Bundle Browser Smoke

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`, Playwright Chromium at `390x844`
- Command:
  - `npm run ui:smoke:card-shapes`
- Evidence:
  - Added a repeatable browser smoke mode that creates a four-card bundle and answers it one card at a time through the UI.
  - Passing handoff: `handoff-mqyrl43j-shjikz`.
  - Covered card shapes and actions:
    - `yes_no` card answered with `No / Reject` and quick reply `Too noisy`.
    - `free_text` card answered with `Yes / Continue` and custom response `Keep the prompt short and phone-friendly.`
    - `adaptive_form` card answered with required textarea `review_note`.
    - unsupported schema field type `slider` rendered as a harmless unsupported-field fallback.
    - `options`-style card answered with `More / Alternatives` and quick reply `Show 3 cleaner variants`.
  - Verified multi-card order: one card at a time, next card appears after each response, bridge event is queued only after the final card.
  - Verified final bridge event feedback contained all four responses with expected actions and payloads.
  - Verified no mobile horizontal overflow and no browser console errors.
  - Follow-up verification passed:
    - `npm run build`
    - `npm run ui:smoke`
    - `npm run ui:smoke:failure`
    - `npm run bridge:smoke`
    - `npm --silent run bridge:doctor:ready:local`
  - Final local status returned `currentCwd: E:\justswipe`, watcher online, and queued/running/failed bridge events all `0`.
- Rough edges:
  - Existing quick-reply behavior is intentionally one-tap submit when no extra required schema fields exist. The smoke initially expected an extra `Submit` tap and had to be corrected.
  - Failure smoke also needed a forced quick-reply tap because the card detached as the one-tap response submitted. This is acceptable for the script, but worth remembering when writing future Playwright tests.
- Result:
  - Rich card/form coverage is stronger: JustSwipe now has browser proof for yes/no, free text, adaptive form, unsupported schema fallback, options-style More, inline HTML preview, and multi-card bundle ordering.

### EXP-011: Natural Habit App Greenfield Dogfood

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe-greenfield-habit-lab`, local app `http://localhost:3001`
- Vague idea sent from JustSwipe:
  - `I want a tiny local web app that helps me pick and stick to one small habit for today. Make it calm, fast, and actually useful. Start from this empty repo and do what setup makes sense.`
- Evidence:
  - Created fresh repo `E:\justswipe-greenfield-habit-lab` with initial commit `a77ec0c Initial habit lab`.
  - Installed the JustSwipe target contract through `npm run dogfood:target -- --cwd E:\justswipe-greenfield-habit-lab`.
  - Setup created Codex thread `019f11d9-1680-7bb3-a6c8-2ea87b7a34d0`.
  - Target setup committed at `25e6628 Install JustSwipe steering contract`.
  - Sent the vague app idea through `npm --silent run dogfood:target:idea`, not directly into the Codex thread.
  - Codex naturally emitted planning handoff `handoff-mqys8mhd-c3jcmv` with card `today-focus-mvp`.
  - The planning card used inline HTML context showing the proposed first screen and asked one product-shape decision: `Build the today habit MVP?`.
  - Answered through JustSwipe with `Build today focus`.
  - Codex built a static dependency-free app:
    - `index.html`
    - `styles.css`
    - `app.js`
    - README usage note.
  - Codex naturally emitted review handoff `handoff-mqysjbch-kuknpb` with card `review-today-focus-slice`.
  - The review card included inline HTML evidence: current app flow, Chrome evidence, mobile viewport note, and quick replies.
  - Answered review through JustSwipe with `Keep first slice`.
  - Independent verification from the supervising thread:
    - `node --check app.js` passed.
    - temporary static server loaded `http://127.0.0.1:5191/index.html`.
    - Playwright Chromium at `390x844` verified title `Pick one small habit for today`.
    - committed preset habit.
    - marked it done.
    - ring value changed to `1`.
    - reload preserved done state through localStorage.
    - reset returned to the empty plan state.
    - no mobile horizontal overflow.
    - no browser console errors.
  - Target app committed at `8c2f255 Build habit app through JustSwipe dogfood`.
  - Local JustSwipe pairing was restored to `E:\justswipe` with thread `019f11eb-046f-78c2-b57e-9f958a1a9ab8`.
  - Final bridge status returned `currentCwd: E:\justswipe`, watcher online, and queued/running/failed bridge events all `0`.
- Rough edges:
  - `dogfood:target` setup took long enough that an early status check still showed the previous JustSwipe project before the final setup status corrected to the target repo.
  - During the build relay, bridge heartbeat looked stale while `runningBridgeEvents: 1`; it later recovered and emitted the review card.
  - The Codex worker turn was visible as `interrupted` during browser verification, even though files were created and the bridge later completed. Supervising verification was still required.
- Result:
  - This is the strongest natural-greenfield proof so far: vague idea from JustSwipe, natural planning card, swipe response, build, natural review card, review swipe, verified app, clean idle bridge state.
  - Remaining gap is not the core local loop; it is long-running reliability, hosted/phone proof, and clearer UX during stale-heartbeat active relays.

### EXP-012: Active Relay Stale-Heartbeat UX Smoke

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`, Playwright Chromium at `390x844`
- Command:
  - `npm run ui:smoke:relay-state`
- Evidence:
  - Added a repeatable browser smoke mode that creates a handoff, submits a response, claims the bridge event, and leaves it in `running`.
  - Passing handoff: `handoff-mqytmuk4-fq5cld`.
  - The post-swipe state showed `Codex resuming`.
  - It showed the new user-facing copy: `Your response is in the relay path... a stale heartbeat during active work is not by itself a failure.`
  - It showed the resume evidence strip, including `Bridge relay`.
  - The smoke asserted the active relay was not presented as `Bridge not observed`.
  - The smoke asserted the UI did not show `Start watcher` for this active relay state.
  - Sequential follow-up `npm run ui:smoke:failure` passed with handoff `handoff-mqytnkml-qyrhh8`.
  - Follow-up verification passed:
    - `npm run build`
    - `npm run ui:smoke`
    - `npm run bridge:smoke`
    - `npm --silent run bridge:doctor:ready:local`
  - Final local status returned `currentCwd: E:\justswipe`, watcher online, and queued/running/failed bridge events all `0`.
- Rough edges:
  - Running bridge smoke and UI relay-state smoke in parallel can contend on Lakebed DB dumps; run them sequentially.
  - Failure smoke had one timing miss while waiting for bridge event creation, so the event wait for failure and relay-state smokes was increased to 30 seconds.
- Result:
  - The most common long-running local trust issue is now explicitly covered: an active relay with stale/missing heartbeat reads as Codex work in progress, not as an offline bridge.

### EXP-013: Multi-Thread Project View Smoke

- Date: 2026-06-29
- Status: proven
- Surface: `E:\justswipe`, local app `http://localhost:3001`, Playwright Chromium at `390x844`
- Command:
  - `npm run ui:smoke:multi-thread`
- Evidence:
  - Added a repeatable browser smoke mode that pairs an isolated `guest:ui-smoke` connection and creates multiple tracked thread states in one project.
  - The smoke creates:
    - `Marketing copy thread` with a queued existing-thread idea.
    - `Backlog cleanup thread` as an idle existing thread.
    - A synthetic `New project idea` row for a queued new-thread idea.
  - Browser verified the no-card project view shows `Send an idea to Codex`.
  - Browser verified multiple thread rows are visible.
  - Browser verified active rows show `1 ideas`.
  - Browser verified search filters to `Marketing copy thread`.
  - Browser verified `Waiting` filter shows no matching rows when no cards are waiting.
  - Browser verified `Active` filter shows the queued idea rows.
  - Browser verified project filtering can select `justswipe`.
  - Browser verified the idea target selector can choose `Marketing copy thread` and changes the action to `Send to selected thread`.
  - Follow-up verification passed:
    - `npm run build`
    - `npm run ui:smoke:card-shapes`
    - `npm --silent run bridge:doctor:ready:local`
- Rough edges:
  - A blocking active handoff correctly takes over the home surface, so the multi-thread table should be tested in the no-card project view.
  - On mobile, hidden target selector options can duplicate visible row text; Playwright assertions need to target visible row title elements.
- Result:
  - Project-level multi-thread visibility is browser-tested for multiple tracked threads, queued ideas, active/idle filtering, project filtering, and sending ideas to an existing thread.

## Open Experiment Areas

- `partial`: long-running multi-thread use over hours or days.
- `partial`: long-running relay UX from a human perspective beyond the active-relay browser smoke.
- `proven`: browser-tested failure recovery for failed relay, retry requeue, and retry-to-sent completion.
- `proven`: rich schema forms and inline HTML previews across the current supported browser-tested card shapes.
- `proven`: natural greenfield planning behavior for local disposable static apps, including planning and review cards.
- `gap`: mobile/phone ergonomics, notifications, vibration, and real touch gestures.
- `gap`: hosted cloud proof after Lakebed quota reset, including phone pairing and notification permission.
- `proven`: browser-click proof for schema fields on mobile-width Chromium.
