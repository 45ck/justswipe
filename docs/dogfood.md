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
npm --silent run bridge:doctor -- --app-url http://localhost:3001 --json
npm --silent run bridge:doctor -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --json
npm --silent run bridge:doctor:ready -- --app-url http://localhost:3001
npm --silent run bridge:doctor:ready:hosted
```

Required status before testing:

- `connected: true`
- `bridgeHeartbeat.status: online`
- `activeHandoffs: 0`
- `queuedBridgeEvents: 0`
- `runningBridgeEvents: 0`
- `failedBridgeEvents: 0`
- `doctor.status: ready`

If `bridgeHeartbeat.status` is `stale` or `missing`, start the watcher for that app URL:

```powershell
npm run bridge:watch -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --daemon
npm run bridge:watch -- --app-url http://localhost:3001 --daemon
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

## Real-Project Dogfood

Use this to prove a separate repo can be steered through JustSwipe.

```powershell
Set-Location E:\justswipe
npm --silent run bridge:idea:current -- --idea "Real-project dogfood proof for RNG: inspect current repo state read-only, run python -m unittest discover -s tests, report briefly, and do not edit files. Emit a JustSwipe handoff only if a real decision is needed."
```

Use `--thread-id <thread-id>` instead of `--current-thread` when proving a specific older thread.

Then verify:

```powershell
npm --silent run bridge:status -- --json
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
- `bridge:status` now exposes `bridgeHeartbeat` so stale watcher state is visible before the user swipes.
