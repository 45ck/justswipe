## 2026-06-29T11:35:44.533Z

- appUrl: http://localhost:3001
- status: passed
- steps: 10
- failedSteps: none

### build

- command: `npm run build`
- exitCode: 0
- durationMs: 10139

```text
"artifactHash": "sha256:f6c3e6ad97ebb4735bc2e28c6cf1811c3602df2503a96361c35cb89d827900e1",
```

### bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9182

```text
"failedBridgeEvents": 0,
```

### ui smoke

- command: `npm run ui:smoke`
- exitCode: 0
- durationMs: 29840

```text
JustSwipe UI smoke passed.
verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload
```

### ui card shapes

- command: `npm run ui:smoke:card-shapes`
- exitCode: 0
- durationMs: 24222

```text
JustSwipe card shapes UI smoke passed.
verified: yes/no, free text, adaptive form, unsupported field fallback, more action, multi-card order
```

### ui multi-thread

- command: `npm run ui:smoke:multi-thread`
- exitCode: 0
- durationMs: 14468

```text
JustSwipe multi-thread UI smoke passed.
verified: multiple thread rows, active/empty waiting filters, project filter, existing-thread idea target
```

### ui relay state

- command: `npm run ui:smoke:relay-state`
- exitCode: 0
- durationMs: 42143

```text
JustSwipe relay state UI smoke passed.
verified: running relay is not presented as offline, stale heartbeat copy explains Codex work
```

### ui failure recovery

- command: `npm run ui:smoke:failure`
- exitCode: 0
- durationMs: 60533

```text
JustSwipe failure UI smoke passed.
verified: failed relay banner, failure detail, retry requeue, retry sent state
```

### bridge dry-run

- command: `npm run bridge:dry-run`
- exitCode: 0
- durationMs: 9130

```text
No JustSwipe responses waiting for Codex.
```

### dogfood snapshot

- command: `npm run dogfood:snapshot`
- exitCode: 0
- durationMs: 9536

```text
readyForDogfood: yes
threads: 5
bridgeEvents: queued=0 running=0 failed=0
```

### final bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9384

```text
"failedBridgeEvents": 0,
```

## 2026-06-29T11:42:31.727Z

- appUrl: http://localhost:3001
- status: passed
- steps: 10
- failedSteps: none

### build

- command: `npm run build`
- exitCode: 0
- durationMs: 10849

```text
"artifactHash": "sha256:e84a5c407f78027488bd2f03ef86b3586b8814f283ad5426c678b820e908a127",
```

### bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9761

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 5,
```

### ui smoke

- command: `npm run ui:smoke`
- exitCode: 0
- durationMs: 34038

```text
JustSwipe UI smoke passed.
verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload
```

### ui card shapes

- command: `npm run ui:smoke:card-shapes`
- exitCode: 0
- durationMs: 29954

```text
JustSwipe card shapes UI smoke passed.
verified: yes/no, free text, adaptive form, unsupported field fallback, more action, multi-card order
```

### ui multi-thread

- command: `npm run ui:smoke:multi-thread`
- exitCode: 0
- durationMs: 24141

```text
JustSwipe multi-thread UI smoke passed.
verified: multiple thread rows, active/empty waiting filters, project filter, existing-thread idea target
```

### ui relay state

- command: `npm run ui:smoke:relay-state`
- exitCode: 0
- durationMs: 34589

```text
JustSwipe relay state UI smoke passed.
verified: running relay is not presented as offline, stale heartbeat copy explains Codex work
```

### ui failure recovery

- command: `npm run ui:smoke:failure`
- exitCode: 0
- durationMs: 61037

```text
JustSwipe failure UI smoke passed.
verified: failed relay banner, failure detail, retry requeue, retry sent state
```

### bridge dry-run

- command: `npm run bridge:dry-run`
- exitCode: 0
- durationMs: 9445

```text
No JustSwipe responses waiting for Codex.
```

### dogfood snapshot

- command: `npm run dogfood:snapshot`
- exitCode: 0
- durationMs: 9279

```text
readyForDogfood: yes
threads: 5
bridgeEvents: queued=0 running=0 failed=0
```

### final bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9598

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 5,
```

## 2026-06-29T12:23:23.697Z

- appUrl: http://localhost:3001
- status: passed
- steps: 10
- failedSteps: none

### build

- command: `npm run build`
- exitCode: 0
- durationMs: 10562

```text
"artifactHash": "sha256:0a9e84af252a2dff98cac1975f4441d3e5266365d8e6a46f0ff64966d6fc1f31",
```

### bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9732

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 5,
```

### ui smoke

- command: `npm run ui:smoke`
- exitCode: 0
- durationMs: 40327

```text
JustSwipe UI smoke passed.
verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload
```

### ui card shapes

- command: `npm run ui:smoke:card-shapes`
- exitCode: 0
- durationMs: 30663

```text
JustSwipe card shapes UI smoke passed.
verified: yes/no, free text, adaptive form, unsupported field fallback, more action, multi-card order
```

### ui multi-thread

- command: `npm run ui:smoke:multi-thread`
- exitCode: 0
- durationMs: 20439

```text
JustSwipe multi-thread UI smoke passed.
verified: multiple thread rows, active/empty waiting filters, project filter, existing-thread idea target
```

### ui relay state

- command: `npm run ui:smoke:relay-state`
- exitCode: 0
- durationMs: 34695

```text
JustSwipe relay state UI smoke passed.
verified: running relay is not presented as offline, stale heartbeat copy explains Codex work
```

### ui failure recovery

- command: `npm run ui:smoke:failure`
- exitCode: 0
- durationMs: 63006

```text
JustSwipe failure UI smoke passed.
verified: failed relay banner, failure detail, retry requeue, retry sent state
```

### bridge dry-run

- command: `npm run bridge:dry-run`
- exitCode: 0
- durationMs: 16100

```text
No JustSwipe responses waiting for Codex.
```

### dogfood snapshot

- command: `npm run dogfood:snapshot`
- exitCode: 0
- durationMs: 9416

```text
readyForDogfood: yes
threads: 5
bridgeEvents: queued=0 running=0 failed=0
```

### final bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9421

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 5,
```

## 2026-06-29T13:07:42.717Z

- appUrl: http://localhost:3001
- status: passed
- steps: 10
- failedSteps: none

### build

- command: `npm run build`
- exitCode: 0
- durationMs: 9563

```text
"artifactHash": "sha256:375d7fa63cdace2a3a1c746796a9be3457f44a362cd65c9b7620dd9e022053ae",
```

### bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 8896

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 6,
```

### ui smoke

- command: `npm run ui:smoke`
- exitCode: 0
- durationMs: 25626

```text
JustSwipe UI smoke passed.
verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload
```

### ui card shapes

- command: `npm run ui:smoke:card-shapes`
- exitCode: 0
- durationMs: 23068

```text
JustSwipe card shapes UI smoke passed.
verified: yes/no, free text, adaptive form, unsupported field fallback, more action, multi-card order
```

### ui multi-thread

- command: `npm run ui:smoke:multi-thread`
- exitCode: 0
- durationMs: 15097

```text
JustSwipe multi-thread UI smoke passed.
verified: multiple thread rows, active/empty waiting filters, project filter, existing-thread idea target
```

### ui relay state

- command: `npm run ui:smoke:relay-state`
- exitCode: 0
- durationMs: 34884

```text
JustSwipe relay state UI smoke passed.
verified: running relay is not presented as offline, stale heartbeat copy explains Codex work
```

### ui failure recovery

- command: `npm run ui:smoke:failure`
- exitCode: 0
- durationMs: 50837

```text
JustSwipe failure UI smoke passed.
verified: failed relay banner, failure detail, retry requeue, retry sent state
```

### bridge dry-run

- command: `npm run bridge:dry-run`
- exitCode: 0
- durationMs: 9605

```text
No JustSwipe responses waiting for Codex.
```

### dogfood snapshot

- command: `npm run dogfood:snapshot`
- exitCode: 0
- durationMs: 10088

```text
readyForDogfood: yes
threads: 6
bridgeEvents: queued=0 running=0 failed=0
```

### final bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 9410

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 6,
```

## 2026-06-29T14:02:50.318Z

- appUrl: http://localhost:3001
- status: passed
- steps: 10
- failedSteps: none

### build

- command: `npm run build`
- exitCode: 0
- durationMs: 8339

```text
"artifactHash": "sha256:a827c88c21616ed6abab08be538ca686bb669bfa973ed6c9430fd92e54789c3e",
```

### bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 7684

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 6,
```

### ui smoke

- command: `npm run ui:smoke`
- exitCode: 0
- durationMs: 24916

```text
JustSwipe UI smoke passed.
verified: mobile render, HTML preview, schema fields, resume evidence, submit, queued payload
```

### ui card shapes

- command: `npm run ui:smoke:card-shapes`
- exitCode: 0
- durationMs: 22791

```text
JustSwipe card shapes UI smoke passed.
verified: yes/no, free text, adaptive form, unsupported field fallback, more action, multi-card order
```

### ui multi-thread

- command: `npm run ui:smoke:multi-thread`
- exitCode: 0
- durationMs: 12014

```text
JustSwipe multi-thread UI smoke passed.
verified: multiple thread rows, active/empty waiting filters, project filter, existing-thread idea target
```

### ui relay state

- command: `npm run ui:smoke:relay-state`
- exitCode: 0
- durationMs: 26642

```text
JustSwipe relay state UI smoke passed.
verified: running relay is not presented as offline, stale heartbeat copy explains Codex work
```

### ui failure recovery

- command: `npm run ui:smoke:failure`
- exitCode: 0
- durationMs: 42610

```text
JustSwipe failure UI smoke passed.
verified: failed relay banner, failure detail, retry requeue, retry sent state
```

### bridge dry-run

- command: `npm run bridge:dry-run`
- exitCode: 0
- durationMs: 8151

```text
No JustSwipe responses waiting for Codex.
```

### dogfood snapshot

- command: `npm run dogfood:snapshot`
- exitCode: 0
- durationMs: 8272

```text
readyForDogfood: yes
threads: 6
bridgeEvents: queued=0 running=0 failed=0
```

### final bridge status

- command: `npm run bridge:status -- --app-url http://localhost:3001 --json`
- exitCode: 0
- durationMs: 7608

```text
"activeHandoffs": 0,
"bridgeHeartbeat": {
"queuedBridgeEvents": 0,
"runningBridgeEvents": 0,
"failedBridgeEvents": 0,
"threads": 6,
```

