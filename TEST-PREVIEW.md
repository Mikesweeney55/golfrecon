# Golf Recon — Integration Test Preview (Phases 1–5)

Production GitHub Pages (`main` → https://golfrecon.app) is **unchanged**.

## Test URL (open on iPad)

**https://companies-programmer-projected-cpu.trycloudflare.com/index.html**

This tunnel serves the `cursor-golfrecon-integration` branch from this Cloud Agent. It stays up while the agent session is running.

### Durable GitHub Pages URL (pending)

A separate public repo `golfrecon-preview` is required for a permanent
`https://mikesweeney55.github.io/golfrecon-preview/` site without touching
production Pages settings. Create that empty repo and tell the agent to finish the publish.

## Data protection

TEST BUILD mode (`gr-test-env.js` + inline guards):

- Fixed banner: TEST BUILD
- Platoon `save_state` / `delete_mission` blocked
- Personal round `save` / `update` / `delete` / `backfill` blocked
- OCR parse still allowed (does not write Mission results by itself)
- Platoon edits use an isolated localStorage key on the test origin

Use disposable Missions only. Do not edit official historical results here.
