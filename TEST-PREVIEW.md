# Golf Recon — Integration Test Preview (Phases 1–5)

Production GitHub Pages (`main` → https://golfrecon.app) is unchanged.

## Test URL

Open on iPad:

**https://cdn.jsdelivr.net/gh/Mikesweeney55/golfrecon@cursor-golfrecon-integration/index.html**

This serves the `cursor-golfrecon-integration` branch from GitHub via jsDelivr (no production Pages deploy).

Pinned commit (cache-safe):

`https://cdn.jsdelivr.net/gh/Mikesweeney55/golfrecon@COMMIT_SHA/index.html`

## Data protection

The test host activates `gr-test-env.js`:

- Banner: TEST BUILD
- Platoon `save_state` / `delete_mission` blocked
- Personal round `save` / `update` / `delete` / `backfill` blocked
- OCR parse still allowed (does not write Mission results by itself)
- Platoon edits use an isolated localStorage key on the test origin

Use disposable Missions only. Do not treat this as a place to edit official history.
