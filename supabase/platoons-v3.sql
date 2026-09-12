-- Golf Recon Platoons v3
-- Add cross-device sync keys, Mission result snapshots, and a per-Platoon logo.

alter table public.golfrecon_platoons
  add column if not exists logo_data_url text;

alter table public.golfrecon_platoon_members
  add column if not exists client_key text;

alter table public.golfrecon_missions
  add column if not exists client_key text;

alter table public.golfrecon_missions
  add column if not exists results_snapshot jsonb;

create unique index if not exists golfrecon_platoon_member_client_key_uq
  on public.golfrecon_platoon_members(platoon_id, client_key);

create unique index if not exists golfrecon_mission_client_key_uq
  on public.golfrecon_missions(platoon_id, client_key);
