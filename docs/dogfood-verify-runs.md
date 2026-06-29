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

