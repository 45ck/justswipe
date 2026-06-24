# JustSwipe

JustSwipe is a low-attention decision remote for Codex. Codex pauses when it
needs human steering, sends one or more cards to JustSwipe, and waits. The user
swipes or completes a small model-defined form. The local laptop bridge sends the
structured response back so Codex can continue or ask another handoff.

This is still a Lakebed/local MVP. Lakebed hosts the UI and state; the laptop
bridge remains the trusted local process that can talk to Codex.

```txt
Codex/laptop bridge -> JustSwipe handoff bundle
JustSwipe -> user swipe/form response
Laptop bridge -> Codex response packet
Codex -> continue work or create another JustSwipe handoff
```

## Run

```powershell
npm run dev
npm run bridge:watch
```

The app runs on port `3001`.

`bridge:watch` uses the Codex app-server relay by default. That sends completed
JustSwipe packets into the saved Codex thread id and waits for the thread's turn
to complete. The default turn timeout is 4 minutes; override it with
`--timeout-ms` for slower local work. The old isolated CLI fallback is still
available with:

```powershell
npm run bridge:watch -- --relay exec
```

If you need a resumable local Codex thread for JustSwipe, create one from the
bridge and save it into the app:

```powershell
npm run bridge:start-thread
```

You can target a specific local project and initial wait prompt:

```powershell
npm run bridge:start-thread -- --cwd C:\path\to\project --prompt "Wait for JustSwipe before editing. Ask for the first decision and end with AWAITING_JUSTSWIPE_RESPONSE."
```

## Pair A Phone Or Browser

Create a short-lived connection code from the laptop-side bridge:

```powershell
npm run bridge:pair
```

The code looks like `ABC-123`, expires after 2 minutes, and pairs the browser to
the current JustSwipe connection for the day.

## Demo Handoff

Reset the local demo bundle:

```powershell
npm run handoff:demo
```

The demo includes three cards:

- next build slice
- card copy density
- soft alert behavior

For a local todo-thread integration smoke test, create or save a native Codex
thread first, then queue the todo-specific handoff:

```powershell
npm run bridge:start-thread -- --cwd C:\path\to\todo-project --prompt "Wait for JustSwipe before editing. Ask for the first todo slice and end with AWAITING_JUSTSWIPE_RESPONSE."
npm run handoff:todo
```

Each card can define separate Yes/No/More/Later payload fields. The model owns
the schema, but JustSwipe renders safe native controls. Model-provided HTML-like
context is parsed into a native inline showcase so the card can show diagrams,
UI states, evidence, and answer choices without executing arbitrary scripts.

## Bridge Commands

```powershell
npm run bridge:dry-run
npm run bridge
npm run bridge:all
npm run bridge:watch
npm run bridge:start-thread
npm run handoff:todo
```

`bridge:watch` drains completed JustSwipe handoff responses. If Codex replies
with a marked `JUSTSWIPE_HANDOFF_JSON ... END_JUSTSWIPE_HANDOFF_JSON` block, the
bridge inserts the next handoff bundle into Lakebed.

Use thread ids created by `bridge:start-thread` or another app-server-compatible
Codex thread. Some background/app-created threads can be readable but not
resumable through the local app-server protocol; in that case the bridge fails
closed and tells you to use an app-server thread or `--relay exec`.

## Verify

```powershell
npm run build
npm run bridge:dry-run
npm run db
npm run logs
```

Manual UI checks:

- mobile width has no horizontal overflow
- card snaps back below swipe threshold
- left/right/up/down actions have distinct motion and glow
- required model-defined fields block submit
- response sent state appears after a bundle is complete
- duplicate swipes are blocked while the form or bridge is sending
