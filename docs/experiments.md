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

### EXP-014: Same-Thread Local Dogfood Idea

- Date: 2026-06-29
- Status: proven locally
- Surface: `E:\justswipe`, local app `http://localhost:3001`, current thread `019f11eb-046f-78c2-b57e-9f958a1a9ab8`
- Commands:
  - `npm run dogfood:local:idea`
  - `npm --silent run bridge:status:local -- --json --expect-cwd .`
- Evidence:
  - `npm run dogfood:local:idea` queued `idea-mqyw3uib-jp0uoz` to the existing current thread.
  - Local status immediately after queueing showed `queuedBridgeEvents: 0`, `runningBridgeEvents: 1`, `failedBridgeEvents: 0`, and the current thread `justswipe thread 019f11eb` as `running`.
  - Local watcher stdout showed `Relaying JustSwipe response idea-mqyw3uib-jp0uoz` and `Codex handled JustSwipe response: idea-mqyw3uib-jp0uoz`.
  - Codex responded with the requested read-only proof: `npm run build` passed, `.lakebed/artifacts/app.json` was produced, `git status --short` stayed clean, and no handoff was emitted because no real product/integration decision was needed.
  - Final local status returned `activeHandoffs: 0`, `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, `failedBridgeEvents: 0`, and both known threads `idle`.
- Rough edges:
  - During the same-thread relay, status correctly read as `running` for about a minute while Codex generated the response. This is a trust-sensitive state: the UI copy must make clear that the bridge has claimed the work and Codex is replying.
  - The local watcher stderr still contains older environmental failures: no available credits, Lakebed DB dump failures, a Windows paging-file error, and a transient Codex sqlite database lock. Those were not active in this proof, but they explain why long-running dogfood needs repeated observation.
- Result:
  - Same-thread local JustSwipe idea routing works end to end for a read-only self-dogfood request: idea queued, bridge claimed it, Codex replied, and the bridge returned to idle with no stuck events.

### EXP-015: Hosted Watcher Quota Failure UX

- Date: 2026-06-29
- Status: improved, hosted still blocked
- Surface: `E:\justswipe`, hosted app `https://clear-harbor-b4fc257b5a.lakebed.app`
- Commands:
  - `npm run bridge:watch -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --daemon`
  - `npm run build`
  - `npm --silent run bridge:doctor:ready:local`
  - `npm run ui:smoke:relay-state`
- Evidence:
  - Foreground hosted watcher failed on first heartbeat with `hosted mutation quota exhausted; switch bridge app URL to local dev`.
  - Daemon startup now waits for the first heartbeat window and exits non-zero if the child process dies before the heartbeat lands.
  - Re-run daemon output now reports the current startup failure directly instead of claiming the watcher started:
    - `JustSwipe bridge watcher exited before the first heartbeat.`
    - `hosted mutation quota exhausted; switch bridge app URL to local dev`
    - `Run: npm run dev`
    - `Then use: --app-url http://localhost:3001`
  - Hosted stale-heartbeat UI copy now tells the user that if the hosted watcher exits immediately, hosted quota is likely exhausted and local dev should be used until hosted mutations reset.
  - Verification passed:
    - `npm run build`
    - `npm --silent run bridge:doctor:ready:local`
    - `npm run ui:smoke:relay-state`
- Result:
  - The hosted app is still not usable for live relay while hosted mutations are exhausted, but the bridge startup now fails honestly instead of giving a false “started” signal.

### EXP-016: Timer Lab Greenfield Dogfood

- Date: 2026-06-29
- Status: proven locally with rough edges
- Target repo: `E:\justswipe-greenfield-timer-lab`
- Target commits:
  - `7022317 Initial timer lab`
  - `4caa41a Build timer app through JustSwipe dogfood`
- Thread:
  - `019f1255-a4b5-75c0-9e6d-5ca0878bc347`
  - `justswipe-greenfield-timer-lab thread 019f1255`
- Commands and flow:
  - Created a fresh disposable repo with only `README.md`.
  - Ran `npm run dogfood:target -- --cwd E:\justswipe-greenfield-timer-lab`.
  - Setup first inspected read-only and correctly did not write missing repo contract files.
  - Sent a write-enabled install idea through JustSwipe: `idea-mqyx0psl-9gesu6`.
  - Codex installed `AGENTS.md` and `skills/justswipe/SKILL.md` without modifying `README.md`.
  - Sent a vague app idea through JustSwipe: `I want a tiny useful browser app for focus sessions...`.
  - Codex naturally emitted planning handoff `handoff-mqyx6nsa-hg6v9s` with card `focus-first-slice`, title `Build the calm timer slice?`, quick replies, and `agentHtmlPreview`.
  - Answered the card with `npm run bridge:answer-first-card -- --app-url http://localhost:3001 --yes --quick-reply "Build calm first slice"`.
  - Codex built `index.html`, `styles.css`, and `app.js`.
- Verification:
  - `node --check app.js` passed.
  - Browser smoke loaded `file:///E:/justswipe-greenfield-timer-lab/index.html` at `390x844`.
  - Browser smoke filled session intent, clicked `Complete`, verified history row, verified `1` minute today, reloaded, verified localStorage persistence, detected no horizontal overflow, and captured no console/page errors.
  - Final bridge status returned `activeHandoffs: 0`, `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, `failedBridgeEvents: 0`, and both known threads idle.
- Rough edges:
  - The default target setup prompt was read-only, so it did not install missing contract files until a separate write-enabled idea was sent.
  - The long-lived watcher process still had an old command-line cwd (`E:\random-number-generator`) even after the active project changed to the timer repo. Event metadata still carried the correct target cwd, but this is confusing operational evidence.
  - After answering the planning card, app files appeared before the bridge marked the handoff sent. The bridge stayed in `responding_to_codex` / `running` for several minutes, with stale heartbeat, then eventually returned to idle.
- Result:
  - Strong local proof for the core loop: fresh repo, install contract via JustSwipe, vague greenfield idea, natural planning card, swipe response, working app build, browser verification, and clean idle bridge state.

### EXP-017: One-Pass Target Contract Setup

- Date: 2026-06-29
- Status: improved and proven locally
- Target repo: `E:\justswipe-greenfield-breath-lab`
- Target commits:
  - `abceda6 Initial breath lab`
  - `6da2600 Install JustSwipe contract through dogfood setup`
- Thread:
  - `019f1270-d193-7612-9393-b687ab055c38`
  - `justswipe-greenfield-breath-lab thread 019f1270`
- Change:
  - Updated `package.json` `dogfood:target` prompt so it explicitly installs or updates the target repo JustSwipe contract instead of telling Codex to inspect read-only.
- Evidence:
  - Fresh target repo started with only `README.md`.
  - Ran `npm run dogfood:target -- --cwd E:\justswipe-greenfield-breath-lab`.
  - In one setup pass, Codex created `AGENTS.md` and `skills/justswipe/SKILL.md`.
  - README content was preserved.
  - Final setup state showed `currentProject: justswipe-greenfield-breath-lab`, `currentCwd: E:\justswipe-greenfield-breath-lab`, `expectedCwdMatches: yes`, `bridgeHeartbeat: online`, and `bridgeEvents: queued=0 running=0 failed=0`.
- Rough edges:
  - Codex's natural-language setup response briefly claimed the bridge was paired to the previous timer repo, but the authoritative bridge status printed immediately after showed the correct breath repo. The UI/CLI should keep making authoritative status more prominent than model prose.
- Result:
  - The target setup path now satisfies the “paste and it works” expectation better: a fresh repo gets the JustSwipe contract in one pass.

### EXP-018: Watcher Scope Clarity

- Date: 2026-06-29
- Status: improved and verified locally
- Context:
  - EXP-016 found confusing operational evidence: the long-lived watcher process command line could still show an old `--cwd`, even though the active JustSwipe connection and event metadata routed to the current project correctly.
- Change:
  - `bridge:watch --daemon` output now states that there is one watcher per app URL and guest, and that current project routing comes from JustSwipe state rather than the daemon command cwd.
  - Setup current-state output now includes `watcherScope: app-url + guest; project routing uses currentCwd/currentThread above.`
- Verification:
  - Re-ran `npm run dogfood:target -- --cwd E:\justswipe-greenfield-breath-lab`.
  - Output showed the new daemon scope line after `JustSwipe bridge watcher is already running.`
  - Output showed the new `watcherScope` line after setup current state.
  - Direct doctor passed for `E:\justswipe-greenfield-breath-lab` with `expectedCwdMatches: true`, heartbeat online, and queued/running/failed events all `0`.
  - `npm run build` passed.
- Result:
  - The CLI now makes the authoritative routing source explicit, reducing confusion when a reused watcher daemon has stale-looking process arguments.

### EXP-019: Setup Prose Defers To Bridge Status

- Date: 2026-06-29
- Status: improved and verified locally
- Context:
  - EXP-017 found that Codex setup prose could briefly claim stale bridge pairing state even when the authoritative bridge status printed afterward was correct.
- Change:
  - Added a setup prompt rule: Codex must not report bridge pairing, watcher heartbeat, queue, or current-thread state as authoritative in prose because the bridge CLI prints that status after the setup turn.
- Verification:
  - Re-ran `npm run dogfood:target -- --cwd E:\justswipe-greenfield-breath-lab`.
  - Codex setup prose now said it was not reporting bridge pairing/heartbeat/queue/current-thread state as authoritative and deferred to the bridge CLI.
  - The bridge CLI then printed the authoritative state: `currentProject: justswipe-greenfield-breath-lab`, `currentCwd: E:\justswipe-greenfield-breath-lab`, `expectedCwdMatches: yes`, heartbeat online, and `queued=0 running=0 failed=0`.
  - Direct doctor passed for `E:\justswipe-greenfield-breath-lab`.
  - `npm run build` passed.
- Result:
  - Setup output now separates model-managed repo setup from bridge-managed routing truth, which is less confusing during dogfood.

### EXP-020: Existing Non-Current Thread Routing

- Date: 2026-06-29
- Status: proven locally with a scope limitation
- Target repo: `E:\justswipe-greenfield-breath-lab`
- Threads:
  - Current/newer thread before test: `019f1288-7988-7571-9ec8-371c3ad4d679`
  - Explicitly targeted older thread: `019f127c-1e88-7c63-822d-b7c68f31cf46`
- Flow:
  - Queried Lakebed DB for known `codexThreads`.
  - Sent an idea explicitly to the older thread with `--thread-id 019f127c-1e88-7c63-822d-b7c68f31cf46`.
  - The event was queued as `idea-mqyzd0ut-spii04`.
  - Status showed the older thread `running` while the newer Breath Lab thread stayed `idle`.
  - Watcher relayed the response and Codex completed a read-only inspection.
- Evidence:
  - Final status returned `currentThread: justswipe-greenfield-breath-lab thread 019f127c`, `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, `failedBridgeEvents: 0`, and both known Breath Lab threads idle.
  - Target repo `git status -sb` stayed clean.
  - Watcher log showed `Relaying JustSwipe response idea-mqyzd0ut-spii04` and `Codex handled JustSwipe response: idea-mqyzd0ut-spii04`.
- Rough edges:
  - Because `dogfood:target` clears connection state for a new target setup, older cross-project threads such as the Timer Lab thread were no longer visible in the active connection. Multi-thread routing is proven within the current project connection, but long-running multi-project continuity is not yet proven.
  - Normal idea responses can still include bridge-status prose. The setup prompt now defers bridge status to the CLI, but a broader packet-response instruction may be needed if this keeps causing confusion.
- Result:
  - Existing-thread routing works for a non-current thread in the active project: JustSwipe can target an older thread, relay work, and return to a clean idle state.

### EXP-021: Additive Cross-Project Setup And Routing

- Date: 2026-06-29
- Status: improved and proven locally
- Change:
  - Added `--preserve-connection` / `--no-clear` to the bridge setup path.
  - Added `npm run dogfood:target:add` for additive target setup without clearing the existing JustSwipe connection.
- Target repos:
  - Existing: `E:\justswipe-greenfield-breath-lab`
  - Added: `E:\justswipe-greenfield-stretch-lab`
- Target commits:
  - Stretch Lab `f4a9223 Initial stretch lab`
  - Stretch Lab `393c98d Install JustSwipe contract additively`
- Flow:
  - Before additive setup, the connection had two Breath Lab threads.
  - Ran `npm run dogfood:target:add -- --cwd E:\justswipe-greenfield-stretch-lab`.
  - Setup preserved existing connection state, installed `AGENTS.md` and `skills/justswipe/SKILL.md` in Stretch Lab, and kept the Breath Lab threads visible.
  - After setup, status showed three threads across two projects:
    - `019f12a5-8814-7873-86f9-7fa1aa31820f` Stretch Lab
    - `019f1288-7988-7571-9ec8-371c3ad4d679` Breath Lab
    - `019f127c-1e88-7c63-822d-b7c68f31cf46` Breath Lab
  - Sent a cross-project read-only idea to the older Breath Lab thread while Stretch Lab was also present.
  - The Breath thread ran, Stretch stayed idle, and final status returned all three threads idle with `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, and `failedBridgeEvents: 0`.
- Verification:
  - Both Breath Lab and Stretch Lab `git status -sb` were clean after the cross-project relay.
  - Watcher relayed `idea-mqz0ag56-yuevkz` to the older Breath Lab thread.
- Result:
  - The active local JustSwipe connection can now keep multiple projects visible and route to an older cross-project thread, as long as setup uses the additive path.

### EXP-022: Long-Running Dogfood Snapshot Command

- Date: 2026-06-29
- Status: improved and first snapshot captured
- Change:
  - Added `scripts/justswipe-dogfood-snapshot.mjs`.
  - Added `npm run dogfood:snapshot` and `npm run dogfood:snapshot:hosted`.
  - The snapshot command records app URL, connection, current project/cwd/thread, heartbeat, bridge event counts, active handoffs, visible thread/project list, and a `readyForDogfood` flag.
- Evidence:
  - Ran `npm run dogfood:snapshot` against `http://localhost:3001`.
  - Snapshot appended to `docs/dogfood-snapshots.md`.
  - First snapshot captured three idle threads across two projects:
    - Stretch Lab thread `019f12a5`
    - Breath Lab thread `019f1288`
    - Breath Lab thread `019f127c`
  - Snapshot reported `readyForDogfood: yes`, heartbeat online/fresh, active handoffs `0`, and bridge events `queued=0 running=0 failed=0`.
- Result:
  - Long-running dogfood now has a repeatable evidence collection command. This does not prove multi-day reliability yet, but it makes repeated checks comparable over time.

### EXP-023: Local Dev Restart Recovery Snapshot

- Date: 2026-06-29
- Status: failure captured, partial recovery proven
- Flow:
  - Ran a second `npm run dogfood:snapshot` after the first healthy multi-project snapshot.
  - The snapshot reported `readyForDogfood: no`, `connectionId: none`, missing heartbeat, and `threads: 0`.
  - Direct status explained the cause: `local JustSwipe app is not reachable at http://localhost:3001. Start it with: npm run dev`.
  - Restarted local Lakebed dev with `npm run dev`.
  - Started the watcher with `npm run bridge:watch -- --app-url http://localhost:3001 --daemon`.
  - Re-ran additive setup for `E:\justswipe-greenfield-stretch-lab`.
  - Ran `npm run dogfood:snapshot` again.
- Evidence:
  - `docs/dogfood-snapshots.md` now has:
    - healthy 3-thread snapshot across Stretch/Breath at `2026-06-29T09:37:15.687Z`
    - failed unavailable-app snapshot at `2026-06-29T09:46:44.514Z`
    - recovered 1-thread Stretch snapshot at `2026-06-29T09:56:46.021Z`
  - Recovery status returned heartbeat online/fresh and bridge events `queued=0 running=0 failed=0`.
- Rough edges:
  - Restarting local dev lost the previous in-memory multi-project state; recovery restored a fresh Stretch connection only.
  - This is a serious long-running local reliability limit unless the app persists or rehydrates prior known threads across dev restarts.
- Result:
  - Snapshot tooling caught a real failure and proved partial recovery. It also exposed that local dev restart does not preserve the richer multi-project thread set.

### EXP-024: Dogfood Thread Cache Rehydrate Command

- Date: 2026-06-29
- Status: command path proven, richer recovery still partial
- Change:
  - `npm run dogfood:snapshot` now writes a local sidecar cache at `.lakebed/dogfood-thread-cache.json`.
  - Added `--rehydrate-threads` to the bridge CLI and `npm run dogfood:rehydrate` for local recovery.
- Evidence:
  - Ran `npm run dogfood:snapshot` against `http://localhost:3001`.
  - Snapshot reported `readyForDogfood: yes`, `threads: 1`, `cachedThreads: 1`, and bridge events `queued=0 running=0 failed=0`.
  - Ran `npm run dogfood:rehydrate`.
  - The command rehydrated 1 cached thread into connection `conn-mqz1ie67-5fqnku`, then printed healthy local status with heartbeat online/fresh, `activeHandoffs: 0`, and no queued/running/failed bridge events.
  - Ran `npm run build`; Lakebed build passed.
- Limit:
  - This proves the cache and rehydrate command path, but only against the currently cached one-thread state.
  - It does not yet prove full recovery of the earlier richer three-thread, two-project dogfood state after a local dev restart.
- Result:
  - Local long-running dogfood has a recovery primitive now. The next reliability proof should intentionally cache multiple active project threads, restart local dev, rehydrate, and confirm the thread list comes back intact.

### EXP-025: Multi-Thread Rehydrate And Restored-Thread Relay

- Date: 2026-06-29
- Status: improved and proven locally
- Flow:
  - Rebuilt a richer local dogfood state with additive setup across:
    - `E:\justswipe-greenfield-stretch-lab`
    - `E:\justswipe-greenfield-breath-lab`
    - `E:\justswipe-greenfield-habit-lab`
  - Ran `npm run dogfood:snapshot`; it reported `readyForDogfood: yes`, `threads: 3`, `cachedThreads: 3`, and bridge events `queued=0 running=0 failed=0`.
  - Cleared active local connection state with `npm run bridge:clear -- --app-url http://localhost:3001`.
  - Confirmed the degraded state: connected browser record still existed, but heartbeat was missing and `threads: 0`.
  - Re-established a fresh connection through `E:\justswipe-greenfield-notes-lab`.
  - Ran `npm run dogfood:rehydrate`.
  - Rehydrate restored the 3 cached threads into the active connection, producing 4 visible idle threads across Notes, Breath, Stretch, and Habit.
  - Sent an idea to the restored Notes thread `019f12ec-52e1-7201-b71d-3747372bac6d`.
  - Watcher relayed `idea-mqz2y40b-if1rjc`; the Notes thread moved `running` then back to `idle`.
- Evidence:
  - Final status showed `threads: 4`, `threadStatuses: {"idle":4}`, heartbeat online/fresh, `activeHandoffs: 0`, `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, and `failedBridgeEvents: 0`.
  - Watcher log showed `Relaying JustSwipe response idea-mqz2y40b-if1rjc` and `Codex handled JustSwipe response: idea-mqz2y40b-if1rjc`.
  - The restored Notes thread performed a read-only contract check, edited no files, and did not emit an unnecessary card.
  - Target repos `notes`, `breath`, `habit`, and `stretch` were clean after the relay.
- Rough edges:
  - Rehydrate can change `currentProject` / `currentThread` to the most recently touched cached thread. The thread list is correct, but the "current" headline can feel surprising after recovery.
  - Clearing connection state can leave a connected browser record but missing heartbeat/thread metadata. The UI must keep this state visually obvious as "bridge needs recovery", not "ready".
- Result:
  - Multi-thread local recovery is now proven for the practical failure case: lose thread metadata, recover from cache, route an idea to a restored thread, and return to clean idle state.

### EXP-026: Serial UI Smoke Matrix

- Date: 2026-06-29
- Status: proven serially, not parallel-safe
- Verification:
  - `npm run ui:smoke` passed.
    - Verified mobile render, HTML preview, schema fields, resume evidence, submit, and queued payload.
  - `npm run ui:smoke:card-shapes` passed when run serially.
    - Verified yes/no, free text, adaptive form, unsupported field fallback, more action, and multi-card order.
  - `npm run ui:smoke:multi-thread` passed when run serially.
    - Verified multiple thread rows, active/empty waiting filters, project filter, and existing-thread idea target.
  - `npm run ui:smoke:relay-state` passed when run serially.
    - Verified running relay is not presented as offline, and stale heartbeat copy explains Codex work.
  - `npm run ui:smoke:failure` passed when run serially.
    - Verified failed relay banner, failure detail, retry requeue, and retry sent state.
  - `npm run build` passed.
- Test isolation issue:
  - Running some UI smoke modes concurrently against the same local app state caused false failures:
    - card-shapes: final card did not queue a bridge event
    - multi-thread: idle idea composer was not visible
    - relay/failure: relay copy or retry event was missing
  - The same modes passed when rerun one at a time.
- Result:
  - The current UI smoke coverage is materially stronger, but the tests should be treated as serial stateful browser tests unless each mode gets isolated app/guest data.

### EXP-027: Natural Greenfield Ritual Lab Dogfood

- Date: 2026-06-29
- Status: proven locally, with one bridge heartbeat fix
- Target repo:
  - `E:\justswipe-greenfield-ritual-lab`
  - Setup commit: `c0db3cc Install JustSwipe steering contract`
  - App commit: `30759f1 Build ritual planner via JustSwipe`
- Flow:
  - Created a fresh disposable repo with only `README.md`.
  - Ran additive setup through JustSwipe for `E:\justswipe-greenfield-ritual-lab`.
  - Setup created `AGENTS.md` and `skills/justswipe/SKILL.md`, preserved the README purpose, and did not build a replacement JustSwipe UI.
  - Sent a normal greenfield app idea to the current Ritual Lab thread:
    - "Build a tiny greenfield browser app ... Use JustSwipe for steering whenever you need a human product/taste/scope decision."
  - Codex naturally emitted a planning card without being directly forced to emit a marker:
    - Handoff `handoff-mqz3rc7y-bi03hy`
    - Card `ritual-first-slice`
    - Title `Start practical?`
    - Included quick replies and inline `agentHtmlPreview`.
  - Answered the planning card with `npm run bridge:answer-first-card -- --app-url http://localhost:3001`.
  - Codex resumed, built the static local-first Ritual Lab app, verified it, and naturally emitted a review card:
    - Handoff `handoff-mqz42hi9-qxwmzv`
    - Card `review-ritual-first-slice`
    - Title `Keep this direction?`
    - Included evidence in inline HTML preview.
  - Answered the review card with the default quick reply.
  - Codex resumed again and completed a polish pass.
- App result:
  - Generated `index.html`, `styles.css`, `app.js`, `assets/morning-ritual.svg`, and `ritual-lab-mobile-proof.png`.
  - Static local-first app with ritual presets, today status, short review note, local history, local stats, current streak, last-picked ritual, note character count, save feedback, and safe saved-note escaping.
  - No JustSwipe UI, dashboard, bridge UI, or auth shell was built in the target repo.
- Verification:
  - Target Codex reported `node --check app.js`, Edge/Playwright smoke, reload persistence, saved-note escaping, no page errors, and no desktop/mobile overflow.
  - Independent browser smoke passed from this thread:
    - mobile viewport `390x844`
    - picked a ritual with `Pick a ritual for me`
    - marked `Done`
    - saved `<b>steady start</b>`
    - reloaded and confirmed the note persisted as text
    - confirmed no raw/rendered saved HTML and no horizontal overflow
  - Final JustSwipe status reported `threads: 5`, all idle, `activeHandoffs: 0`, `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, and `failedBridgeEvents: 0`.
  - Final snapshot reported `readyForDogfood: yes`, `threads: 5`, and `cachedThreads: 5`.
- Rough edges:
  - During both build and polish turns, the bridge heartbeat became stale while Codex was still doing a long relay. The relay eventually completed, but the UI could look less trustworthy while waiting.
  - Fixed bridge code so the relay lease interval now also forces `touchBridgeHeartbeat`, keeping the app visibly online during long Codex turns.
  - Setup took more than a minute; the app should make setup/running state feel intentional and visible.
- Result:
  - This is the strongest local proof so far of the intended core loop: start from JustSwipe, Codex asks one planning card, user swipes, Codex builds, Codex asks a review card, user swipes, Codex polishes, and the system returns to clean idle.

### EXP-028: Serial Dogfood Verify Command

- Date: 2026-06-29
- Status: repeatable local verification added and passed
- Change:
  - Added `scripts/justswipe-dogfood-verify.mjs`.
  - Added `npm run dogfood:verify`.
  - The verifier runs stateful browser smokes serially to avoid the false failures seen when shared Lakebed/UI state was exercised in parallel.
  - The verifier appends a compact run report to `docs/dogfood-verify-runs.md`.
- Verification run:
  - Ran `npm run dogfood:verify` twice against `http://localhost:3001`; the second run used the richer bridge-status report summarizer.
  - Passed `npm run build`.
  - Passed initial bridge status with connection `conn-mqz1ie67-5fqnku`, 5 idle threads, fresh heartbeat, and no queued/running/failed events.
  - Passed `ui:smoke`.
  - Passed `ui:smoke:card-shapes`.
  - Passed `ui:smoke:multi-thread`.
  - Passed `ui:smoke:relay-state`.
  - Passed `ui:smoke:failure`.
  - Passed `bridge:dry-run`.
  - Appended a dogfood snapshot with `readyForDogfood: yes`, `threads: 5`, `cachedThreads: 5`, and bridge events `queued=0 running=0 failed=0`.
  - Final bridge status again showed 5 idle threads, no active handoffs, and no queued/running/failed events.
  - Latest report artifact: `docs/dogfood-verify-runs.md`, timestamp `2026-06-29T11:42:32.538Z`.
- Result:
  - Local dogfood now has one command for a high-signal regression pass across build, core UI card behavior, schema/card shape handling, multi-thread UI, relay state UX, failure recovery UX, bridge idle state, and snapshot evidence.

### EXP-029: Long-Running Monitor Primitive

- Date: 2026-06-29
- Status: monitor added and short-run proof passed
- Change:
  - Added `scripts/justswipe-dogfood-monitor.mjs`.
  - Added `npm run dogfood:monitor`.
  - The monitor repeatedly runs `scripts/justswipe-dogfood-snapshot.mjs` on an interval and appends compact run evidence to `docs/dogfood-monitor-runs.md`.
  - Default interval is 15 minutes; `--max-runs 0` means unbounded.
- Verification:
  - Ran `npm run dogfood:monitor -- --interval-ms 5000 --max-runs 2`.
  - Fixed the first implementation to avoid passing duplicate `--app-url` through the npm snapshot wrapper.
  - Reran the same two-iteration monitor proof.
  - Both clean monitor runs passed with `readyForDogfood: yes`, `threads: 5`, `cachedThreads: 5`, and bridge events `queued=0 running=0 failed=0`.
  - The snapshot log captured stable five-thread idle state for Ritual, Breath, Stretch, Notes, and Habit.
- Result:
  - JustSwipe now has a practical long-running observation primitive. This does not prove hours/days yet, but it makes that proof collectable without manual polling.

### EXP-030: Dogfood Monitor Daemon Mode

- Date: 2026-06-29
- Status: daemon monitor added and bounded background proof passed
- Change:
  - Added `--daemon` support to `scripts/justswipe-dogfood-monitor.mjs`.
  - Added `npm run dogfood:monitor:daemon`.
  - Daemon mode writes pid/stdout/stderr files under `.lakebed/dogfood-monitor/` and continues appending monitor evidence to `docs/dogfood-monitor-runs.md`.
- Verification:
  - Ran `npm run dogfood:monitor -- --interval-ms 5000 --max-runs 2 --daemon --name daemon-smoke`.
  - The command started background pid `16212` and wrote logs under `.lakebed/dogfood-monitor/daemon-smoke.*`.
  - The bounded daemon exited after two runs as intended.
  - Both daemon runs passed with `readyForDogfood: yes`, `threads: 5`, `cachedThreads: 5`, and bridge events `queued=0 running=0 failed=0`.
- Result:
  - Long-running dogfood can now be left running as a background evidence collector. The bounded proof passed; the next proof is a real multi-hour run.

### EXP-031: Active Local Long-Run Monitor Started

- Date: 2026-06-29
- Status: active collection started
- Flow:
  - Started the real local dogfood monitor daemon with `npm run dogfood:monitor:daemon -- --name local-longrun`.
  - Daemon pid: `13884`.
  - Pid file: `.lakebed/dogfood-monitor/local-longrun.pid`.
  - Stdout log: `.lakebed/dogfood-monitor/local-longrun.out.log`.
  - Stderr log: `.lakebed/dogfood-monitor/local-longrun.err.log`.
  - Interval: `900000ms` / 15 minutes.
  - Max runs: unbounded.
- First evidence:
  - First daemon snapshot appended at `2026-06-29T12:03:58.625Z`.
  - `readyForDogfood: yes`.
  - `threads: 5`.
  - `cachedThreads: 5`.
  - Bridge events: `queued=0 running=0 failed=0`.
  - Snapshot captured Ritual, Breath, Stretch, Notes, and Habit threads idle.
- Result:
  - Multi-hour/multi-day reliability evidence is now actively collecting locally. This is not yet proof of hours/days continuity; it is the start of the long-run observation window.

### EXP-032: Compact Monitor Status Check

- Date: 2026-06-29
- Status: status command added and verifier passed
- Change:
  - Added `scripts/justswipe-dogfood-monitor-status.mjs`.
  - Added `npm run dogfood:monitor:status`.
  - The command summarizes the active monitor pid, daemon logs, latest monitor run, latest dogfood snapshot, and live bridge heartbeat/events in one compact output.
- Verification:
  - Ran `npm run dogfood:monitor:status -- --name local-longrun`.
  - Status showed pid `13884` alive, bridge `online`, `fresh=true`, `events=0/0/0`, latest monitor run `passed`, `readyForDogfood: yes`, `threads: 5`, and `bridgeEvents: queued=0 running=0 failed=0`.
  - Ran `node --check scripts\justswipe-dogfood-monitor-status.mjs`.
  - Ran `npm run build`.
  - Ran `npm run bridge:dry-run`; no JustSwipe responses were waiting.
  - Ran `npm run dogfood:verify`; it passed build, bridge status, UI smoke, card shapes, multi-thread UI, relay state, failure recovery, bridge dry-run, snapshot append, and final bridge status.
  - Fresh verify snapshot reported `readyForDogfood: yes`, `threads: 5`, `cachedThreads: 5`, and bridge events `queued=0 running=0 failed=0`.
- Result:
  - Dogfood health is now easy to inspect without manually tailing several files. This improves long-running reliability work, but it is still a monitoring improvement rather than proof of multi-day usage.

### EXP-033: Requirement-Level Dogfood Audit

- Date: 2026-06-29
- Status: audit command added and first audit recorded
- Change:
  - Added `scripts/justswipe-dogfood-audit.mjs`.
  - Added `npm run dogfood:audit`.
  - Added generated audit output at `docs/dogfood-audit.md`.
  - The audit maps the current dogfood evidence against the actual goal: local bridge relay, long-running multi-thread use, failure recovery UX, rich schema/HTML cards, natural greenfield planning, and hosted/phone pairing.
- Verification:
  - Ran `node --check scripts\justswipe-dogfood-audit.mjs`.
  - Ran `npm run dogfood:audit`; it wrote `docs/dogfood-audit.md`.
  - Audit result:
    - `proven-local`: current local bridge can relay.
    - `partial`: long-running multi-thread use over hours/days, with 8 passed monitor runs across 0.51h and 17 ready snapshots.
    - `proven-local`: failure recovery UX from the user perspective.
    - `proven-local`: rich schema forms and HTML artifact previews.
    - `partial`: Codex naturally uses JustSwipe during greenfield planning, based on one local disposable app.
    - `gap`: hosted cloud and phone pairing path.
  - Ran `npm run build`; Lakebed build passed.
  - Ran `npm run bridge:dry-run`; no JustSwipe responses were waiting for Codex.
- Result:
  - The remaining completion gaps are now machine-readable and documented. The goal remains active because hours/days continuity, repeated natural greenfield use, and hosted/phone proof are not complete.

### EXP-034: Natural Focus Lab Greenfield Dogfood With Negative Review

- Date: 2026-06-29
- Status: second current greenfield loop passed with feedback correction
- Target repo:
  - `E:\justswipe-greenfield-focus-lab`
  - Codex thread `019f1365-9e13-7f81-8475-383b48fd0ddd`
  - Target commit `078fb70 Build Focus Lab through JustSwipe`
- Flow:
  - Created a fresh disposable repo and initial commit.
  - Ran `npm run dogfood:target:add -- --cwd E:\justswipe-greenfield-focus-lab`.
  - Setup installed only `AGENTS.md` and `skills/justswipe/SKILL.md`; no replacement JustSwipe UI was created.
  - Sent a normal app idea through `npm run dogfood:target:idea`: build a tiny local-first Focus Lab app for choosing a 10-minute work session.
  - Codex naturally emitted planning handoff `handoff-mqz7mnro-dl0j3s` with card `focus-first-slice`.
  - Answered the planning card with `Build calm chooser`.
  - Codex built `index.html`, `styles.css`, and `app.js`, then naturally emitted review handoff `handoff-mqz7x55y-5q9eyf` with card `review-focus-first-slice`.
  - Manual browser smoke found a real accessibility defect: intent controls were buttons but had `role="listitem"`, so role-based access and Playwright could not find Write/Clear/Plan as buttons.
  - Added `--action` support to `bridge:answer-first-card` and submitted a `no` response with that feedback.
  - Codex applied the feedback, removed the incorrect roles, verified the target app, and returned to idle.
- Verification:
  - Target repo `node --check app.js` passed.
  - Independent Playwright smoke at `390x844` loaded `file:///E:/justswipe-greenfield-focus-lab/index.html`.
  - Smoke selected `Clear` by role, filled the outcome, started, paused, and reset the timer.
  - No page errors, no console errors, and no horizontal overflow.
  - Final bridge status showed `currentProject: justswipe-greenfield-focus-lab`, `activeHandoffs: 0`, all 6 threads idle, and bridge events `queued=0 running=0 failed=0`.
- Result:
  - This is a stronger proof than a happy-path auto-yes flow: JustSwipe carried planning, build review, negative feedback, correction, and return-to-idle for a fresh greenfield app.

### EXP-035: Hosted Watcher Quota Recheck

- Date: 2026-06-29
- Status: hosted still blocked by mutation quota
- Hosted app:
  - `https://clear-harbor-b4fc257b5a.lakebed.app`
  - Hosted connection `conn-mqvfklrk-flxv7l`
  - Current hosted project `justswipe`
  - Current hosted cwd `E:\justswipe`
  - Current hosted thread `justswipe thread 019f100e`
- Flow:
  - Ran `npm run bridge:doctor:ready:hosted`.
  - Doctor showed hosted app is connected, paired, has known project/thread, no active handoffs, and no queued/running/failed events.
  - Doctor failed `bridgeHeartbeatOnline`: hosted heartbeat was stale, last seen `2026-06-29T03:09:35.565Z`, age about `36067s`.
  - Ran `npm run bridge:status:hosted -- --json`; it confirmed the same stale hosted heartbeat and suggested starting the watcher.
  - Ran `npm run bridge:watch:hosted:daemon`.
  - Hosted watcher exited before first heartbeat with the exact blocker:
    - `hosted mutation quota exhausted; switch bridge app URL to local dev`
  - Ran `npx --yes --cache .lakebed/npm-cache lakebed deploy . --json`; deploy metadata was reachable and reported hosted limits including `mutationsPerDay: 1000` and `requestsPerDay: 10000`.
- Result:
  - Hosted is not ready for the phone/cloud proof yet. The app is readable and paired, but the bridge cannot update hosted heartbeat while hosted mutations are exhausted. Continue active dogfood against `http://localhost:3001` until hosted mutation quota resets.

## Open Experiment Areas

- `gap`: hosted bridge readiness is not currently proven live. On 2026-06-29, `npm --silent run bridge:doctor:ready:hosted` returned connected/pairing/project/thread checks as true, but failed `bridgeHeartbeatOnline`; hosted watcher startup now fails fast with `hosted mutation quota exhausted; switch bridge app URL to local dev`. Use local dev for active dogfood until hosted heartbeat can be updated and rechecked.
- `partial`: long-running multi-thread use over hours or days. Local multi-thread recovery, foreground monitor tooling, and daemon monitor tooling are proven; an active local long-run monitor is now collecting evidence, but multi-hour/multi-day continuity is not yet proven.
- `partial`: long-running relay UX from a human perspective. Local long-turn heartbeat is improved, but still needs repeated observation over hours/days.
- `proven`: browser-tested failure recovery for failed relay, retry requeue, and retry-to-sent completion.
- `proven`: rich schema forms and inline HTML previews across the current supported browser-tested card shapes.
- `proven`: natural greenfield planning behavior for local disposable static apps, including planning, build, review, polish, and return-to-idle.
- `gap`: mobile/phone ergonomics, notifications, vibration, and real touch gestures.
- `gap`: hosted cloud proof after Lakebed quota reset, including phone pairing and notification permission.
- `proven`: browser-click proof for schema fields on mobile-width Chromium.
