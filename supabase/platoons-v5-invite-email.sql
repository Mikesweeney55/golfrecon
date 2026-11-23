-- Golf Recon Platoons v5 — roster invite emails
-- Chief/co-chief can assign an email per cadet seat in Setup.
-- On first sign-in, that email claims the existing seat (no new Platoon).

alter table public.golfrecon_platoon_members
  add column if not exists invite_email text;

comment on column public.golfrecon_platoon_members.invite_email is
  'Optional invite email for this roster seat. Normalized lowercase. Used to claim user_id on first login.';

-- One active seat per invite email across the whole app (closed league model).
create unique index if not exists golfrecon_platoon_members_invite_email_uq
  on public.golfrecon_platoon_members (lower(invite_email))
  where invite_email is not null and status = 'active';
