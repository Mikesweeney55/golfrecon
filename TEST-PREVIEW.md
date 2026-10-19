# Golf Recon — Integration Test Preview (Phases 1–5)

Production GitHub Pages (`main` → https://golfrecon.app) is unchanged.

## Test URL

Open on iPad:

**https://raw.githack.com/Mikesweeney55/golfrecon/cursor-golfrecon-integration/index.html**

This serves the `cursor-golfrecon-integration` branch directly from GitHub with correct HTML/JS Content-Types. Production GitHub Pages (`main` → golfrecon.app) is not modified.

Pinned commit (cache-safe):

**https://rawcdn.githack.com/Mikesweeney55/golfrecon/a151744d2f125e7546b947ea96ff7ff909b0ba1a/index.html**

## Data protection

The test host activates `gr-test-env.js`:

- Banner: TEST BUILD
- Platoon `save_state` / `delete_mission` blocked
- Personal round `save` / `update` / `delete` / `backfill` blocked
- OCR parse still allowed (does not write Mission results by itself)
- Platoon edits use an isolated localStorage key on the test origin

Use disposable Missions only. Do not treat this as a place to edit official history.
