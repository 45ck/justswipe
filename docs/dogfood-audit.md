# JustSwipe Dogfood Audit

Generated: 2026-06-29T23:57:41.965Z
App URL: http://localhost:3001

| Status | Requirement | Current evidence |
| --- | --- | --- |
| proven-local | Current local bridge can relay | bridge=online, fresh=true, threads=6, events=0/0/0 |
| partial | Long-running multi-thread use over hours/days | 55 passed monitor runs, 2 failed, from 2026-06-29T11:48:48.765Z to 2026-06-29T23:52:50.160Z (12.07h); 69 ready snapshots; latest snapshot 2026-06-29T23:52:50.130Z; 11.93h remaining to 24h proof |
| proven-local | Failure recovery UX from user perspective | failure UI smoke and documented retry flow passed |
| proven-local | Rich schema forms and HTML artifact previews | card shapes smoke covers schema fields, unsupported fallback, HTML preview, multi-card order |
| proven-local | Codex naturally uses JustSwipe in greenfield planning | 5 documented local greenfield proofs include planning cards, build/review loops, or return-to-idle evidence |
| gap | Hosted cloud and phone pairing path | hosted app is paired/readable, but watcher heartbeat is blocked by hosted mutation quota; real phone/touch proof still missing |

## Interpretation

- `proven-local` means the local dev path has current automated or observed evidence, but hosted/mobile may still be unproven.
- `partial` means the behavior has credible evidence, but the requirement scope is broader than the current proof.
- `gap` means current evidence is missing or contradictory for the requested end state.

