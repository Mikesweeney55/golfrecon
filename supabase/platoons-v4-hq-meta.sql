-- Golf Recon Platoons v4 — HQ meta (manual Records + Club Eagle)
-- Approved for production apply with V16.1 deploy.
--
-- Purpose: Persist administrator-maintained Platoon Records, Club Eagle
-- starting balances, overrides, and display modes across devices.
-- Stored as jsonb on the existing golfrecon_platoons row so save_state /
-- bootstrap can round-trip without a new table.
--
-- Does NOT modify or delete existing rows beyond adding a column
-- with a safe default. No data migrations of missions/results/members.

alter table public.golfrecon_platoons
  add column if not exists hq_meta jsonb not null default '{}'::jsonb;

comment on column public.golfrecon_platoons.hq_meta is
  'Client HQ meta: record modes, manual records, eagle balances/details, overrides. Shape owned by platoon-hq-records.js';
