# JustSwipe Protocol Notes

This is the working product contract for the MVP.

## One Skill For Now

Use one `justswipe` skill with two responsibilities:

1. Emit handoff cards when Codex needs human steering.
2. Consume response packets when the bridge relays a swipe back into Codex.

Do not split this into `justswipe-send` and `justswipe-receive` yet. A single skill keeps the repo install simple and lets the model understand the full loop in one place.

Split later only if live testing shows one of these problems:

- Codex emits good cards but mishandles responses.
- Codex handles responses but forgets the card format.
- The installed skill becomes too long for target repos.
- Different agents need separate producer and consumer roles.

## Response Packet Rule

Every bridge-relayed JustSwipe response should remind Codex to use the installed JustSwipe skill:

```txt
Use the repo JustSwipe skill to consume this response:
- skills/justswipe/SKILL.md
- /justswipe if this host supports slash skills
```

Then the packet should include the handoff id, connection id, thread id, custom steering prompt, and user responses.

Codex should treat the response as steering, not permission. It should continue the task if the response is enough, or emit another small handoff if another real decision is needed.

## Accountless Pairing Model

The MVP does not need accounts.

```txt
connectionId = one local bridge, repo, and Codex thread
deviceToken = one paired browser or phone
handoff = card bundle for the connection
response = one swipe/form answer for a card
```

Hosted JustSwipe can store a swipe response without Codex seeing it. Codex receives the response only when the local bridge claims the queued bridge event and relays it into the thread. If `bridge:status:hosted` shows `queuedBridgeEvents > 0`, run `npm run bridge:watch:hosted` or `npm run bridge:dry-run:hosted` from the bridge repo before debugging Codex itself.

The bridge watcher writes a low-frequency heartbeat while it is running. The UI should show stale or missing heartbeat as "Bridge not observed", and queued events as "Bridge watcher offline". If the paired project path is an E2E fixture or otherwise wrong, the user should forget that project connection and re-pair from the real repo instead of relaying stale packets.

Multiple devices can pair to the same connection:

```txt
Codex thread
  <-> local bridge
  <-> hosted JustSwipe state
  <-> desktop browser
  <-> phone browser
```

When Codex emits a handoff, the bridge sends it to hosted JustSwipe with the `connectionId`. Every active device token paired to that connection sees the same card. When one device answers, the hosted state marks the card as answered and the other devices update to sent/answered.

## Add Phone Later

The expected flow is:

1. Desktop is already paired.
2. User chooses Add Device or runs `npm run bridge:pair -- --app-url <hosted-url>`.
3. Bridge creates a 2-minute pair code or QR link for the same connection.
4. User opens it on phone.
5. Phone receives its own device token for that connection.
6. Desktop and phone now show the same cards.

Phones should not connect directly to local IPs in the default MVP. Hosted JustSwipe is the shared state and the local bridge is the trusted messenger.

## Cloud-First Install Contract

Every normal user starts with the hosted app. The target repo should not receive a JustSwipe app implementation.

The canonical install instructions live at `https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md`. Hosted `/install.md` and `/setup.md` are mirrors only; if Lakebed quota blocks those hosted reads, Codex should keep using the GitHub/raw install doc and continue with local-dev bridge fallback when needed.

Install means:

1. Add the repo steering contract.
2. Locate or clone the local bridge tooling outside the target repo.
3. Create a hosted pair code/link.
4. Open the pair link automatically for desktop pairing when possible.
5. Print the same code/link for phone or second-browser pairing.
6. Queue a setup handoff so the user can confirm the connection from hosted JustSwipe.
7. Stop before project work until setup is proven or the exact blocker is reported.

If Codex cannot identify the current thread id, it should use the automatic bridge-created thread path. If a thread id is known, it can use the existing-thread path with `--thread-id`.

Default pairing posture:

- Use the cloud app first for every user.
- Auto-open the desktop pair link when possible.
- Print the same pair link and code for phone setup.
- Let the user pair desktop, phone, or both against the same day-long connection.
- If hosted Lakebed reports `mutations quota exceeded`, stop hosted mutation retries and point the bridge at a local JustSwipe dev server until hosted quota resets.
- Treat failed pairing as a setup blocker, not a reason to build another UI.

Hosted quota fallback:

1. Confirm the limit with `npx lakebed inspect <deploy-url-or-id> --json` when needed. The current hosted deploy reports `mutationsPerDay: 1000` and `requestsPerDay: 10000`.
2. Run `npm run dev` in the JustSwipe bridge repo and keep that terminal running.
3. In a second terminal, set the bridge app URL to `http://localhost:3001`.
4. Run the same `bridge:setup`, `bridge:pair`, `handoff:setup`, and `bridge:watch` commands against that local app URL.
5. Report the exact blocker as `hosted mutation quota exhausted; switch bridge app URL to local dev`, including `resetAt` or `retryAfterSeconds` if Lakebed includes them in the 429 body.

This fallback changes only the JustSwipe app URL. It does not put a JustSwipe implementation into the target repo, and it does not change the bridge/watch contract.

## Future Account Model

Google sign-in or another identity layer is useful later for convenience, not for MVP routing.

Useful account features:

- recover after browser storage is cleared
- list paired devices
- revoke old phones or browsers
- see multiple projects/repos
- keep a long-lived phone login
- route notifications across devices cleanly

Even with accounts, the bridge still needs to register a trusted local connection for each repo/thread. Identity does not replace the local bridge.

## Future Work

- `justswipe doctor`: verify hosted app, bridge, repo install, pair status, and one round trip.
- `npm run bridge:doctor -- --app-url <app-url>` now verifies the raw install doc, app mirror state, pairing state, queue state, and next action without mutating hosted state.
- `npm run bridge:e2e-local -- --app-url http://localhost:3001 --timeout-ms 300000` now runs the local full-loop proof against a disposable target repo.
- After quota resets, `npm run deploy:hosted` refreshes the hosted app and `npm run bridge:e2e-hosted -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app --timeout-ms 300000` runs the same proof against hosted JustSwipe.
- Add Device modal in the app with QR and expiry countdown.
- Device list and revoke controls.
- Cleaner bridge status: connected repo, thread id, paired devices, queued cards, last response.
- Better current-thread attachment so a pasted prompt can bind the current Codex thread without creating a bridge-managed thread.
- Optional Google sign-in after accountless pairing is proven.
- Split send/receive skills only after live testing proves the single skill causes model confusion.
