# JustSwipe Dogfood Audit

Generated: 2026-06-29T12:31:59.194Z
App URL: http://localhost:3001

| Status | Requirement | Current evidence |
| --- | --- | --- |
| proven-local | Current local bridge can relay | bridge=online, fresh=true, threads=5, events=0/0/0 |
| partial | Long-running multi-thread use over hours/days | 8 passed monitor runs across 0.51h; 17 ready snapshots |
| proven-local | Failure recovery UX from user perspective | failure UI smoke and documented retry flow passed |
| proven-local | Rich schema forms and HTML artifact previews | card shapes smoke covers schema fields, unsupported fallback, HTML preview, multi-card order |
| partial | Codex naturally uses JustSwipe in greenfield planning | one local disposable app proved plan/build/review/polish loop |
| gap | Hosted cloud and phone pairing path | hosted and real phone/touch proof still missing |

## Interpretation

- `proven-local` means the local dev path has current automated or observed evidence, but hosted/mobile may still be unproven.
- `partial` means the behavior has credible evidence, but the requirement scope is broader than the current proof.
- `gap` means current evidence is missing or contradictory for the requested end state.

