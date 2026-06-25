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
- Add Device modal in the app with QR and expiry countdown.
- Device list and revoke controls.
- Cleaner bridge status: connected repo, thread id, paired devices, queued cards, last response.
- Optional Google sign-in after accountless pairing is proven.
- Split send/receive skills only after live testing proves the single skill causes model confusion.
