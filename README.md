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

## Hosted-First Quick Start

JustSwipe is meant to feel like a hosted phone/browser remote with a local
Codex bridge behind it. The cloud app shows notifications, swipe cards, and
forms. The laptop bridge is the trusted process that can talk to your local
Codex thread and repo.

Use the live Lakebed URL as the user surface:

```powershell
$app = "https://your-justswipe.lakebed.app"
npm run bridge:start-thread -- --app-url $app --cwd C:\path\to\project --prompt "Use JustSwipe when you need steering. Wait for a JustSwipe response before editing if you emit a handoff."
npm run bridge:pair -- --app-url $app
npm run bridge:watch -- --app-url $app
```

Open the printed pair link in the browser or phone you want to use. The pair
code expires after 2 minutes; the paired browser stays connected for the day.

Copy this into the Codex thread for the repo you want to steer:

```txt
Install JustSwipe into this repo without replacing existing repo instructions.

If AGENTS.md already exists, preserve all existing content and append a clearly marked JustSwipe section. If it does not exist, create it. If skills/justswipe/SKILL.md already exists, update it carefully; otherwise create it.

JustSwipe is a low-attention steering loop for Codex. When you need clarification, user taste, a checkpoint, or you are stuck, do not ask a long chat question. Emit a JustSwipe handoff card, then stop and wait.

Use this behavior:
- one clear decision per card
- 3 to 4 useful quick replies for each relevant action
- optional custom answer
- concise visual context using safe inline HTML-like content
- no approval/permission wording unless the task is actually about approval
- treat JustSwipe responses as steering, not permission

When waiting, end with:
AWAITING_JUSTSWIPE_RESPONSE <handoff-id>
```

The runtime loop is:

```txt
Codex emits JUSTSWIPE_HANDOFF_JSON and waits
Hosted JustSwipe shows the card and sends the swipe/form response
Local bridge watches queued responses and reprompts the Codex thread
Codex continues, finishes, or emits the next JustSwipe handoff
```

## Run Locally

```powershell
npm run dev
npm run bridge:watch
```

The app runs on port `3001`.

`bridge:watch` uses the Codex app-server relay by default. That sends completed
JustSwipe packets into the saved Codex thread id and waits for the thread's turn
to complete. The default turn timeout is 15 minutes; override it with
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

## Install Shapes

JustSwipe has two parts:

- the Lakebed app, which can run locally or hosted
- the laptop bridge, which must run on the machine that can talk to Codex

For a local-only install, run the app and bridge on the same laptop:

```powershell
npm run dev
npm run bridge:pair
npm run bridge:watch
```

Open the printed pair link or paste the short code in the connection modal. The
browser session stays paired for the day.

For a hosted Lakebed install, deploy the app, then point the laptop bridge at the
hosted URL. This is the primary MVP path:

```powershell
npx lakebed deploy --json
npm run bridge:start-thread -- --app-url https://your-deploy-url --cwd C:\path\to\project --prompt "Wait for JustSwipe steering before editing."
npm run bridge:pair -- --app-url https://your-deploy-url
npm run bridge:watch -- --app-url https://your-deploy-url
```

Hosted JustSwipe starts disconnected on purpose. Lakebed cannot know which phone
or browser belongs to the local Codex bridge until you open a pair link such as:

```txt
https://your-deploy-url/?justswipe_pair=ABC-123
```

The code expires after 2 minutes. A successful pair creates a day-long
connection for that browser session.

Create or save the Codex thread before pairing, because the pair code copies the
current thread id and bridge prompt into the browser session.

For repo-agent install, copy these files into the repo Codex will work on:

```txt
AGENTS.md
skills/justswipe/SKILL.md
```

Then tell the Codex thread to use the `justswipe` skill when it needs human
steering. The thread should emit `JUSTSWIPE_HANDOFF_JSON` packets and stop with
`AWAITING_JUSTSWIPE_RESPONSE <handoff-id>` until the bridge sends a response.
If the repo already has `AGENTS.md`, append the JustSwipe section instead of
replacing existing project instructions.

## Pair A Phone Or Browser

Create a short-lived connection code from the laptop-side bridge:

```powershell
npm run bridge:pair
```

The code looks like `ABC-123`, expires after 2 minutes, and pairs the browser to
the current JustSwipe connection for the day.

Use `--app-url` when the app is hosted:

```powershell
npm run bridge:pair -- --app-url https://your-deploy-url
```

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

For a hosted todo-thread smoke test, use the same flow with `--app-url`:

```powershell
$app = "https://your-justswipe.lakebed.app"
$todo = "C:\path\to\fresh-todo-project"
npm run bridge:start-thread -- --app-url $app --cwd $todo --prompt "This repo is controlled through JustSwipe. First install JustSwipe by merging guidance into AGENTS.md and skills/justswipe/SKILL.md. Then wait for a JustSwipe response before building the todo app."
npm run bridge:pair -- --app-url $app
npm run handoff:todo -- --app-url $app
npm run bridge:watch -- --app-url $app
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
npm run bridge:clear
npm run handoff:todo
```

`bridge:watch` drains completed JustSwipe handoff responses. If Codex replies
with a marked `JUSTSWIPE_HANDOFF_JSON ... END_JUSTSWIPE_HANDOFF_JSON` block, the
bridge inserts the next handoff bundle into Lakebed.

Use thread ids created by `bridge:start-thread` or another app-server-compatible
Codex thread. Some background/app-created threads can be readable but not
resumable through the local app-server protocol; in that case the bridge fails
closed and tells you to use an app-server thread or `--relay exec`.

`bridge:clear` clears local handoffs and queued bridge events for the current
connection. Use it when you want the empty-deck planning prompt or a clean
manual test state.

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
