-- Golf Recon Platoons v1
-- Foundation for Platoon membership, Missions, mission-level results, feed/media,
-- Club Eagle, and future Cup scoring.
--
-- IMPORTANT INVARIANT:
-- A mission_result is NOT a Golf Recon round. It may link to a golfer's detailed
-- personal round, but mission imports never create duplicate personal rounds.

create extension if not exists pgcrypto;

create table if not exists public.golfrecon_platoons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  visibility text not null default 'private' check (visibility in ('private','invite_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.golfrecon_platoon_members (
  id uuid primary key default gen_random_uuid(),
  platoon_id uuid not null references public.golfrecon_platoons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  nickname text,
  role text not null default 'member' check (role in ('owner','admin','member','cadet')),
  status text not null default 'active' check (status in ('active','invited','inactive')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists golfrecon_platoon_members_linked_user_uq
  on public.golfrecon_platoon_members(platoon_id,user_id)
  where user_id is not null;
create index if not exists golfrecon_platoon_members_platoon_idx
  on public.golfrecon_platoon_members(platoon_id,status);

create table if not exists public.golfrecon_missions (
  id uuid primary key default gen_random_uuid(),
  platoon_id uuid not null references public.golfrecon_platoons(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text,
  mission_type text not null default 'skirmish' check (mission_type in ('skirmish','battle','war')),
  status text not null default 'planned' check (status in ('planned','ready','completed','cancelled')),
  played_on date not null,
  tee_time time,
  course_id text,
  location_name text not null,
  format text,
  rules_notes text,
  preview_text text,
  recap_text text,
  raw_points_rule jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists golfrecon_missions_platoon_date_idx
  on public.golfrecon_missions(platoon_id,played_on desc);

create table if not exists public.golfrecon_mission_participants (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.golfrecon_missions(id) on delete cascade,
  platoon_member_id uuid not null references public.golfrecon_platoon_members(id) on delete cascade,
  playing_handicap numeric(5,1),
  tee text,
  team_name text,
  participant_status text not null default 'playing' check (participant_status in ('playing','tentative','withdrawn')),
  created_at timestamptz not null default now(),
  unique(mission_id,platoon_member_id)
);

create table if not exists public.golfrecon_mission_imports (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.golfrecon_missions(id) on delete cascade,
  imported_by uuid not null references auth.users(id) on delete restrict,
  source_app text not null default '18Birdies',
  parsed jsonb not null default '{}'::jsonb,
  raw_meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.golfrecon_mission_results (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.golfrecon_missions(id) on delete cascade,
  participant_id uuid not null references public.golfrecon_mission_participants(id) on delete cascade,
  mission_import_id uuid references public.golfrecon_mission_imports(id) on delete set null,
  gross integer,
  net integer,
  finish_position integer,
  raw_points numeric(10,3),
  cup_score numeric(10,3),
  eagle_count integer not null default 0 check (eagle_count >= 0),
  result_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mission_id,participant_id)
);

create table if not exists public.golfrecon_mission_round_links (
  id uuid primary key default gen_random_uuid(),
  mission_result_id uuid not null unique references public.golfrecon_mission_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id text not null,
  link_method text not null default 'auto' check (link_method in ('auto','manual')),
  linked_at timestamptz not null default now(),
  unique(user_id,round_id)
);

create table if not exists public.golfrecon_platoon_posts (
  id uuid primary key default gen_random_uuid(),
  platoon_id uuid not null references public.golfrecon_platoons(id) on delete cascade,
  mission_id uuid references public.golfrecon_missions(id) on delete cascade,
  author_member_id uuid not null references public.golfrecon_platoon_members(id) on delete cascade,
  post_type text not null default 'post' check (post_type in ('post','mission_preview','mission_recap','achievement')),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists golfrecon_platoon_posts_feed_idx
  on public.golfrecon_platoon_posts(platoon_id,created_at desc);

create table if not exists public.golfrecon_platoon_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.golfrecon_platoon_posts(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.golfrecon_platoon_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.golfrecon_platoon_posts(id) on delete cascade,
  author_member_id uuid not null references public.golfrecon_platoon_members(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.golfrecon_platoon_achievements (
  id uuid primary key default gen_random_uuid(),
  platoon_id uuid not null references public.golfrecon_platoons(id) on delete cascade,
  member_id uuid not null references public.golfrecon_platoon_members(id) on delete cascade,
  mission_id uuid references public.golfrecon_missions(id) on delete set null,
  mission_result_id uuid references public.golfrecon_mission_results(id) on delete set null,
  achievement_type text not null check (achievement_type in ('eagle')),
  hole integer,
  note text,
  achieved_on date not null,
  created_at timestamptz not null default now()
);
create index if not exists golfrecon_platoon_achievements_idx
  on public.golfrecon_platoon_achievements(platoon_id,achievement_type,achieved_on desc);

-- Future Cup scoring can evolve without rewriting historical mission results.
-- raw_points stores what the event awarded; cup_score stores/derives the normalized
-- season value. Mission type weighting should be calculated separately.

-- Current Golf Recon security architecture uses the authenticated Edge Function
-- with a service-role client and explicit user/platoon membership checks.
-- Keep these tables unavailable to direct browser API access until dedicated RLS
-- policies and membership-aware direct access are intentionally introduced.
alter table public.golfrecon_platoons enable row level security;
alter table public.golfrecon_platoon_members enable row level security;
alter table public.golfrecon_missions enable row level security;
alter table public.golfrecon_mission_participants enable row level security;
alter table public.golfrecon_mission_imports enable row level security;
alter table public.golfrecon_mission_results enable row level security;
alter table public.golfrecon_mission_round_links enable row level security;
alter table public.golfrecon_platoon_posts enable row level security;
alter table public.golfrecon_platoon_post_media enable row level security;
alter table public.golfrecon_platoon_comments enable row level security;
alter table public.golfrecon_platoon_achievements enable row level security;

revoke all on table public.golfrecon_platoons from anon, authenticated;
revoke all on table public.golfrecon_platoon_members from anon, authenticated;
revoke all on table public.golfrecon_missions from anon, authenticated;
revoke all on table public.golfrecon_mission_participants from anon, authenticated;
revoke all on table public.golfrecon_mission_imports from anon, authenticated;
revoke all on table public.golfrecon_mission_results from anon, authenticated;
revoke all on table public.golfrecon_mission_round_links from anon, authenticated;
revoke all on table public.golfrecon_platoon_posts from anon, authenticated;
revoke all on table public.golfrecon_platoon_post_media from anon, authenticated;
revoke all on table public.golfrecon_platoon_comments from anon, authenticated;
revoke all on table public.golfrecon_platoon_achievements from anon, authenticated;
