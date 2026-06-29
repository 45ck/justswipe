# JustSwipe Dogfood Runbook

Use this when proving the core loop still works:

```txt
Codex asks -> JustSwipe queues -> bridge relays -> Codex continues -> status returns idle
```

Keep README human-facing. Put operational proof here.

## Current Proof Targets

- Main repo: `E:\justswipe`
- Real target repo: `E:\random-number-generator`
- Local app: `http://localhost:3001`
- Hosted app: `https://clear-harbor-b4fc257b5a.lakebed.app`

## Preflight

```powershell
Set-Location E:\justswipe
git status -sb
npm run build
npm --silent run bridge:status -- --json
npm --silent run bridge:status:hosted -- --json
npm --silent run bridge:doctor:ready:local
npm --silent run bridge:doctor -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --json
npm --silent run bridge:doctor:ready:hosted
```

Required status before testing:

- `connected: true`
- `expectedCwdMatches: true` when using `--expect-cwd`
- `bridgeHeartbeat.status: online`
- `activeHandoffs: 0`
- `queuedBridgeEvents: 0`
- `runningBridgeEvents: 0`
- `failedBridgeEvents: 0`
- `doctor.status: ready`

If `bridgeHeartbeat.status` is `stale` or `missing`, start the watcher for that app URL:

```powershell
npm run bridge:watch -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --daemon
npm run bridge:watch:local:daemon
```

## Hosted Self-Dogfood

Use this to prove hosted JustSwipe can steer the JustSwipe repo itself.

```powershell
Set-Location E:\justswipe
npm --silent run bridge:idea:current:hosted -- --idea "Hosted self-dogfood proof: inspect the JustSwipe repo read-only, report bridge state briefly, and do not edit files. Emit a JustSwipe handoff only if a real decision is needed."
```

Then verify the watcher relays automatically:

```powershell
npm --silent run bridge:status:hosted -- --json
Get-Content .lakebed\bridge-watch-hosted-clear-harbor-b4fc257b5a-lakebed-app-local.out.log -Tail 50
```

Pass condition:

- log shows `Relaying JustSwipe response ...`
- log shows `Codex handled JustSwipe response ...`
- hosted status returns all bridge event counts to `0`
- `bridgeHeartbeat.status` stays `online`
- `git status -sb` in `E:\justswipe` stays clean unless the dogfood task intentionally edited files

## Local Self-Dogfood

Use this while hosted deploy work is not the priority and this repo should control itself through local JustSwipe.

Full local proof:

```powershell
Set-Location E:\justswipe
npm --silent run dogfood:local:proof
```

This verifies the current local connection, runs the disposable card/swipe E2E, restores local dogfood to `E:\justswipe`, and verifies the restored connection.

Fast local self-check:

```powershell
Set-Location E:\justswipe
npm run dogfood:local
npm --silent run dogfood:local:idea
npm --silent run dogfood:local:verify
```

Then verify:

```powershell
npm --silent run bridge:doctor:ready:local
npm --silent run bridge:status:local -- --json
Get-Content .lakebed\bridge-watch-local-localhost-local.out.log -Tail 50
git status -sb
```

Pass condition:

- local status says `currentProject: justswipe`
- local status says `currentCwd: E:\justswipe`
- `doctor.status: ready`
- bridge event counts return to `0`
- `git status -sb` stays clean unless the dogfood task intentionally edited files

## Real-Project Dogfood

Use this to prove a separate repo can be steered through JustSwipe.

```powershell
Set-Location E:\justswipe
npm run dogfood:target -- --cwd E:\random-number-generator
npm --silent run dogfood:target:idea -- --idea "Real-project dogfood proof for RNG: inspect current repo state read-only, run python -m unittest discover -s tests, report briefly, and do not edit files. Emit a JustSwipe handoff only if a real decision is needed."
```

Use `--thread-id <thread-id>` instead of the current-thread script when proving a specific older thread.

Then verify:

```powershell
npm --silent run bridge:status:local -- --json
npm --silent run bridge:doctor:ready -- --app-url http://localhost:3001 --expect-cwd E:\random-number-generator
Get-Content .lakebed\bridge-watch-local-localhost-local.out.log -Tail 50
Set-Location E:\random-number-generator
git status -sb
python -m unittest discover -s tests
```

Pass condition:

- local status returns all bridge event counts to `0`
- RNG thread returns `idle`
- RNG worktree is clean for read-only proofs
- tests pass

After a real-project proof, point local dogfood back at this repo when continuing JustSwipe development:

```powershell
Set-Location E:\justswipe
npm run dogfood:local
npm --silent run dogfood:local:verify
```

## If A Card Appears

Answer the first active card through the same path the UI uses:

```powershell
Set-Location E:\justswipe
npm --silent run bridge:answer-first-card -- --reply "Chosen quick reply or custom steering" --json
npm --silent run bridge:answer-first-card:hosted -- --reply "Chosen quick reply or custom steering" --json
```

Then wait for the watcher and recheck status. Do not leave queued, running, or failed bridge events behind.

## Known Good Evidence

Recent proven states:

- Hosted self-dogfood auto-relayed through the hosted watcher and returned idle.
- Local real-project dogfood against `E:\random-number-generator` emitted a card, accepted a swipe, implemented `--summary`, passed 15 tests, then later repeated read-only with no edits.
- Local current-thread real-project proof on `E:\random-number-generator` routed through `bridge:idea:current`, relayed to thread `019f1047-6dcb-7690-8286-549c9d77cfb4`, returned `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, `failedBridgeEvents: 0`, left the RNG worktree clean, and passed 15 tests.
- Local isolated E2E passed against `http://localhost:3001`: disposable target `E:\justswipe\.lakebed\e2e-targets\run-1782690731069-16628`, thread `019f10a5-d994-7092-9c17-f73d24861302`, initial handoff `handoff-mqyg5dnu-qv32c4`, simulated swipe `Build doctor fixture`, bridge relay back into Codex, generated `scripts/justswipe-doctor.ps1`, and normal/JSON doctor checks passed.
- Local self-dogfood is active for `E:\justswipe`: `bridge:up -- --app-url http://localhost:3001 --cwd E:\justswipe` created thread `019f10af-c1ce-7e83-bfa1-7543e40b8b8b`; `bridge:idea:current` relayed to that thread, `npm run build` passed, the worktree stayed clean, and `bridge:doctor:ready -- --app-url http://localhost:3001` returned `doctor.status: ready` with `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, and `failedBridgeEvents: 0`.
- Local self-dogfood repeat on `E:\justswipe` routed `dogfood:local:idea` to thread `019f10c5-f7c8-7873-a97f-416d62ca3e78`; the watcher relayed it, the thread returned idle, and `bridge:status:local -- --json` returned `queuedBridgeEvents: 0`, `runningBridgeEvents: 0`, and `failedBridgeEvents: 0`.
- Generic real-project dogfood passed using `dogfood:target -- --cwd E:\random-number-generator`; setup created thread `019f10e0-a0a2-7953-813f-d258a1ff2563`, `dogfood:target:idea` relayed a read-only test request, RNG stayed clean, and `python -m unittest discover -s tests` passed 15 tests. Running `dogfood:local` afterward restored the local app to `E:\justswipe` with thread `019f10e7-90cc-7040-993e-fd21c8f80725`.
- Local card/swipe E2E passed after accepting target doctor JSON status `ok`: disposable target `E:\justswipe\.lakebed\e2e-targets\run-1782697612435-21520`, thread `019f110e-d8b4-78a0-9e39-3a93e1800773`, handoff `handoff-mqyk8fqd-vwsr65`, simulated swipe `Build doctor fixture`, generated `scripts/justswipe-doctor.ps1`, and normal/JSON doctor modes passed.
- Full local proof command passed: `dogfood:local:proof` verified `E:\justswipe`, ran disposable target `E:\justswipe\.lakebed\e2e-targets\run-1782698576308-3412`, thread `019f111d-8dfd-7352-a521-e26418c88a59`, handoff `handoff-mqyksxs2-5t4e6g`, simulated swipe `Build doctor fixture`, restored local dogfood to `E:\justswipe` with thread `019f1122-6400-7693-b327-622c9edeeff9`, and final doctor returned ready with all bridge event counts `0`.
- `bridge:status` now exposes `bridgeHeartbeat` so stale watcher state is visible before the user swipes.
- Rich schema smoke passed: `bridge:smoke` now verifies required-field rejection, quick-reply bypass blocking, multi-card order, rich schema payload preservation, and inline `agentHtmlPreview` preservation.
- Mobile-width browser UI smoke passed: `ui:smoke` creates an isolated rich schema handoff, opens JustSwipe in Chromium at `390x844`, verifies inline HTML preview, fills select/text/toggle/checklist/rating fields, submits through the UI, checks no horizontal overflow, and verifies the queued bridge payload.
- Failure recovery UI smoke passed: `ui:smoke:failure` creates an isolated handoff, submits it, marks the bridge event failed, verifies the visible failure banner/error, retries from the thread log, and confirms the bridge event returns to `queued`.
- Local E2E regression passed after schema rendering changes: `bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 180000 --json` created thread `019f1170-4c24-78f0-a326-bf5a4437df33`, handoff `handoff-mqyo0yb3-nzl5f1`, relayed `Build doctor fixture`, generated `scripts/justswipe-doctor.ps1`, and passed normal plus `-Json` doctor checks.
- Local dogfood restored to `E:\justswipe` with thread `019f1175-56d5-7861-b5d7-0be86bd0b94a`; final doctor reported ready with queued/running/failed bridge events all `0`.
