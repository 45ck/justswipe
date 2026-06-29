# JustSwipe Dogfood Audit

Generated: 2026-06-29T17:39:15.539Z
App URL: http://localhost:3001

| Status | Requirement | Current evidence |
| --- | --- | --- |
| proven-local | Current local bridge can relay | bridge=online, fresh=true, threads=6, events=0/0/0 |
| partial | Long-running multi-thread use over hours/days | 29 passed monitor runs from 2026-06-29T11:48:48.765Z to 2026-06-29T17:37:45.931Z (5.82h); 42 ready snapshots; latest snapshot 2026-06-29T17:37:45.891Z; 18.18h remaining to 24h proof |
| proven-local | Failure recovery UX from user perspective | failure UI smoke and documented retry flow passed |
| proven-local | Rich schema forms and HTML artifact previews | card shapes smoke covers schema fields, unsupported fallback, HTML preview, multi-card order |
| proven-local | Codex naturally uses JustSwipe in greenfield planning | 5 documented local greenfield proofs include planning cards, build/review loops, or return-to-idle evidence |
| gap | Hosted cloud and phone pairing path | hosted app is paired/readable, but watcher heartbeat is blocked by hosted mutation quota; real phone/touch proof still missing |

## Interpretation

- `proven-local` means the local dev path has current automated or observed evidence, but hosted/mobile may still be unproven.
- `partial` means the behavior has credible evidence, but the requirement scope is broader than the current proof.
- `gap` means current evidence is missing or contradictory for the requested end state.

