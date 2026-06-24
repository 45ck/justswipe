<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/justswipe-horizontal-primary-on-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="assets/brand/justswipe-horizontal-primary-on-light.svg" />
  <img src="assets/brand/justswipe-horizontal-primary-on-light.svg" alt="JustSwipe" width="420" />
</picture>

**Pause. Decide. Move forward.**

This repo contains the JustSwipe Lakebed app, local Codex bridge, public install doc, and brand assets.

JustSwipe is a cloud swipe UI for steering Codex. Codex pauses with one clear decision card, you swipe or add a short answer, and the local bridge sends that response back into the thread.

**Useful For**

- quick yes/no calls
- option picks
- design taste checks
- scope and risk checkpoints
- phone-friendly feedback while Codex works locally

**Paste Into Codex**

```txt
Read and follow this JustSwipe install doc:

https://clear-harbor-b4fc257b5a.lakebed.app/install.md

Assume you can inspect this repo, edit files, and run local commands. Preserve existing repo instructions. Install JustSwipe steering, verify it, and use hosted JustSwipe whenever you need a human decision.
```

**Run The Bridge**

```powershell
$app = "https://clear-harbor-b4fc257b5a.lakebed.app"
$repo = "C:\path\to\your-repo"

npm run bridge:start-thread -- --app-url $app --cwd $repo --prompt "Use hosted JustSwipe for steering. Stop and wait after any JustSwipe handoff."
npm run bridge:pair -- --app-url $app
npm run bridge:watch -- --app-url $app
```

Open the printed pair link on your phone or browser. Pair codes last 2 minutes. A paired browser lasts for the day.

**Public Install Docs**

- Hosted: `https://clear-harbor-b4fc257b5a.lakebed.app/install.md`
- Alias: `https://clear-harbor-b4fc257b5a.lakebed.app/setup.md`
- Repo copy: `INSTALL.md`

**Check**

```powershell
npm run build
npm run bridge:dry-run -- --app-url https://clear-harbor-b4fc257b5a.lakebed.app
```
