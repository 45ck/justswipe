<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/justswipe-horizontal-primary-on-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/justswipe-horizontal-primary-on-light.svg" />
  <img src="assets/brand/justswipe-horizontal-primary-on-light.svg" alt="JustSwipe" width="420" />
</picture>

**Pause. Decide. Move forward.**

JustSwipe is a swipe-first decision layer for Codex.

Codex can build faster than you can watch every thread. JustSwipe lets Codex pause when it needs human taste, scope, risk, or review input, send one clear card to your browser or phone, then continue after you swipe or add a short answer.

Use it when you want to:

- steer Codex without sitting in chat all day
- answer one clear decision instead of reading a long interruption
- review app screens, HTML artifacts, diagrams, diffs, screenshots, or evidence quickly
- start a planning discussion from your phone or browser
- keep agent work moving while still giving high-quality human signal

## Paste Into Codex

Paste this into Codex inside the repo you want to steer:

```txt
I want to use JustSwipe in this repo.

Read and follow the JustSwipe install doc:

https://raw.githubusercontent.com/45ck/justswipe/main/INSTALL.md

Use the hosted JustSwipe app as the only JustSwipe UI:

https://clear-harbor-b4fc257b5a.lakebed.app

Do not build JustSwipe, recreate its UI, or make a local replacement in this repo.

Install the repo steering contract first. Preserve existing repo instructions, append JustSwipe guidance to AGENTS.md, create or update skills/justswipe/SKILL.md, then set up pairing through the local JustSwipe bridge.

Use the frictionless hosted path by default: open the hosted pair link automatically, print the same code/link for my phone or another browser, and start the bridge watcher in the background.

If hosted Lakebed reports mutations quota exceeded, stop retrying hosted setup and use the local-dev fallback from the install doc. Do not build a replacement UI.

After setup is proven, continue my project normally. When you need human taste, scope, risk, planning, review, or clarification, send a concise JustSwipe card or bundle and stop until the response packet arrives.
```

## More

- Full install instructions: [INSTALL.md](INSTALL.md)
- Agent contract: [AGENTS.md](AGENTS.md)
- Protocol notes: [docs/protocol.md](docs/protocol.md)
- Why this exists: [RATIONALE.md](RATIONALE.md)
