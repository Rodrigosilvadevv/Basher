-- =====================================================================
--  BASHER — schema completo do Supabase
--  Cole no SQL Editor do Supabase (ou rode com `supabase db push`).
--
--  Princípios:
--   • Privacidade de localização: NUNCA guardamos a posição exata.
--     Só uma posição "encaixada" numa grade de ~200 m (anti-trilateração).
--   • 18+ obrigatório: data de nascimento + sinal de idade verificado
--     (ECA Digital, Lei 15.211/2025 — autodeclaração não basta).
--   • Tudo que envolve dinheiro (Pro, créditos de álbum, grupos) só é
--     gravado pelo servidor (service_role) ou por funções que validam cota.
-- =====================================================================

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------
--  Configuração (edite os valores aqui, sem mexer no código)
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('album_free_monthly',       '20'),     -- envios de álbum grátis por mês
  ('album_pack_size',          '10'),     -- pacote extra de envios (R$ 2,99)
  ('pro_includes_groups',      'true'),   -- Pro cria grupos sem pagar
  ('free_grid_limit',          '99'),     -- perfis visíveis no plano grátis
  ('now_post_minutes',         '60'),     -- duração de um post "Agora"
  ('story_hours',              '24'),
  ('location_grid_deg',        '0.002'),  -- ~200 m: tamanho da grade de privacidade
  ('album_request_radius_m',   '10000'),  -- pode pedir álbum de quem está a até 10 km
  ('nearby_radius_m',          '150000'),
  ('require_age_verification', 'true'),
  ('auto_suspend_reports',     '5')
on conflict (key) do nothing;

alter table public.app_config enable row level security;
drop policy if exists "config: leitura" on public.app_config;
create policy "config: leitura" on public.app_config for select to anon, authenticated using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;

create or replace function public.cfg(k text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.app_config where key = k
$$;

create or replace function public.jtext_array(j jsonb)
returns text[] language sql immutable as $$
  select case when j is null or jsonb_typeof(j) <> 'array' then '{}'::text[]
              else coalesce(array(select jsonb_array_elements_text(j)), '{}'::text[]) end
$$;

-- ---------------------------------------------------------------------
--  Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 30),
  bio           text not null default '' check (char_length(bio) <= 500),
  status_text   text not null default '' check (char_length(status_text) <= 60),
  sex_position  text check (sex_position in ('top','vers_top','versatile','vers_bottom','bottom','side')),
  height_cm     smallint check (height_cm between 120 and 230),
  weight_kg     smallint check (weight_kg between 35 and 250),
  body_type     text check (char_length(body_type) <= 30),
  relationship  text check (char_length(relationship) <= 30),
  pronouns      text check (char_length(pronouns) <= 20),
  tribes        text[] not null default '{}',
  looking_for   text[] not null default '{}',
  interests     text[] not null default '{}',
  meet_at       text[] not null default '{}',
  avatar_url    text,
  onboarded     boolean not null default false,
  suspended_at  timestamptz,
  last_active   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (cardinality(tribes) <= 8 and cardinality(looking_for) <= 8 and cardinality(interests) <= 20 and cardinality(meet_at) <= 6)
);
create index if not exists profiles_last_active_idx on public.profiles (last_active desc);

-- Dados privados: só o dono lê. Outras pessoas veem só o que as funções expõem.
create table if not exists public.profile_private (
  id                      uuid primary key references public.profiles(id) on delete cascade,
  birthdate               date,
  age_verified_at         timestamptz,
  age_verification_method text,
  location_snapped        extensions.geography(point, 4326),
  location_updated_at     timestamptz,
  incognito               boolean not null default false,  -- Pro
  hide_distance           boolean not null default false,
  hide_age                boolean not null default false,
  on_prep                 boolean,
  last_tested             date,
  show_health             boolean not null default false,
  accepted_terms_at       timestamptz,
  sensitive_consent_at    timestamptz                     -- LGPD: dado sensível (orientação/saúde)
);
create index if not exists profile_private_loc_idx on public.profile_private using gist (location_snapped);

-- Carteira / direitos comprados (escrita só pelo servidor)
create table if not exists public.entitlements (
  user_id                     uuid primary key references public.profiles(id) on delete cascade,
  pro_until                   timestamptz,
  pro_product_id              text,
  pro_original_transaction_id text,
  album_credits               int not null default 0 check (album_credits >= 0),
  group_credits               int not null default 0 check (group_credits >= 0),
  updated_at                  timestamptz not null default now()
);

create table if not exists public.purchases (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.profiles(id) on delete set null,
  product_id              text not null,
  kind                    text not null check (kind in ('pro','album_pack','group')),
  transaction_id          text not null unique,
  original_transaction_id text,
  environment             text,
  quantity                int not null default 1,
  purchased_at            timestamptz,
  expires_at              timestamptz,
  revoked_at              timestamptz,
  raw                     jsonb,
  created_at              timestamptz not null default now()
);

create or replace function public.is_pro(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.pro_until > now() from public.entitlements e where e.user_id = uid), false)
$$;

-- Novo usuário → cria perfil, dados privados e carteira.
-- Não importamos a foto do Google/Apple de propósito (discrição).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1);
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 30)) on conflict do nothing;
  insert into public.profile_private (id) values (new.id) on conflict do nothing;
  insert into public.entitlements (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Regras do perfil privado: 18+, data travada após verificação, invisível só Pro.
create or replace function public.guard_profile_private()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.birthdate is not null and new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'UNDERAGE' using hint = 'Basher é só para maiores de 18 anos.';
  end if;
  if tg_op = 'UPDATE' then
    if old.age_verified_at is not null and new.birthdate is distinct from old.birthdate
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'BIRTHDATE_LOCKED';
    end if;
    if new.incognito and not old.incognito and not public.is_pro(new.id) then
      raise exception 'PRO_REQUIRED';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profile_private_guard on public.profile_private;
create trigger profile_private_guard before insert or update on public.profile_private
  for each row execute function public.guard_profile_private();

-- ---------------------------------------------------------------------
--  Bloqueios e denúncias
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('underage','fake','harassment','spam','explicit_public','violence','selling','other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at  timestamptz not null default now()
);

-- Suspende automaticamente com N denúncias distintas em 7 dias, ou 1 de menor de idade
-- (perfil some até moderação revisar).
create or replace function public.auto_moderate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  select count(distinct reporter_id) into v_count from public.reports
   where reported_id = new.reported_id and created_at > now() - interval '7 days';
  if new.reason = 'underage' or v_count >= (public.cfg('auto_suspend_reports'))::int then
    update public.profiles set suspended_at = coalesce(suspended_at, now()) where id = new.reported_id;
  end if;
  return new;
end $$;

drop trigger if exists reports_moderate on public.reports;
create trigger reports_moderate after insert on public.reports
  for each row execute function public.auto_moderate();

-- ---------------------------------------------------------------------
--  Fotos públicas do perfil (sem nudez — regra da App Store)
-- ---------------------------------------------------------------------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  path       text not null,
  url        text not null,
  sort       smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_idx on public.photos (user_id, sort);

create or replace function public.limit_photos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.photos where user_id = new.user_id) >= 6 then
    raise exception 'PHOTO_LIMIT';
  end if;
  return new;
end $$;
drop trigger if exists photos_limit on public.photos;
create trigger photos_limit before insert on public.photos
  for each row execute function public.limit_photos();

-- ---------------------------------------------------------------------
--  Álbuns privados
-- ---------------------------------------------------------------------
create table if not exists public.albums (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'Álbum privado' check (char_length(title) between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists albums_owner_idx on public.albums (owner_id);

create table if not exists public.album_items (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albums(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  path       text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  created_at timestamptz not null default now()
);
create index if not exists album_items_album_idx on public.album_items (album_id);

create table if not exists public.album_shares (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz
);
create index if not exists album_shares_owner_month_idx on public.album_shares (owner_id, created_at);
create index if not exists album_shares_recipient_idx on public.album_shares (recipient_id, album_id);

create table if not exists public.album_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> owner_id)
);
create unique index if not exists album_requests_one_pending
  on public.album_requests (requester_id, owner_id) where status = 'pending';

create or replace function public.has_album_access(p_album text, p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.album_shares s
    where s.album_id::text = p_album and s.recipient_id = p_uid
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
      and not public.is_blocked_pair(s.owner_id, p_uid))
$$;

-- ---------------------------------------------------------------------
--  Conversas (diretas e grupos)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  is_group             boolean not null default false,
  direct_key           text unique,
  title                text check (char_length(title) <= 60),
  description          text check (char_length(description) <= 300),
  avatar_url           text,
  invite_code          text unique,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  last_message_preview text not null default ''
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner','admin','member')),
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  muted           boolean not null default false,
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  kind            text not null default 'text'
                  check (kind in ('text','image','album','album_request','location','tap','system','safe_date')),
  body            text not null default '' check (char_length(body) <= 4000),
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at desc);

create or replace function public.is_member(p_conv uuid, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = p_uid)
$$;

create or replace function public.direct_peer(p_conv uuid, p_uid uuid default auth.uid())
returns uuid language sql stable security definer set search_path = '' as $$
  select m.user_id from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conv and not c.is_group and m.user_id <> p_uid
  limit 1
$$;

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set
    last_message_at = new.created_at,
    last_message_preview = left(case new.kind
      when 'image' then '📷 Foto'
      when 'album' then '🔒 Álbum compartilhado'
      when 'album_request' then '🔑 Pedido de álbum'
      when 'location' then '📍 Localização'
      when 'tap' then '⚡ Faísca'
      when 'safe_date' then '🛡️ Encontro seguro'
      else new.body end, 120)
  where id = new.conversation_id;
  if new.sender_id is not null then
    update public.conversation_members set last_read_at = new.created_at
     where conversation_id = new.conversation_id and user_id = new.sender_id;
  end if;
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------------
--  Faíscas (taps), visitas, feed, Agora e stories
-- ---------------------------------------------------------------------
create table if not exists public.taps (
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'fire' check (kind in ('fire','wave','wink')),
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists taps_to_idx on public.taps (to_id, created_at desc);

create table if not exists public.profile_views (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id)
);
create index if not exists profile_views_viewed_idx on public.profile_views (viewed_id, viewed_at desc);

create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references public.profiles(id) on delete cascade,
  kind             text not null check (kind in ('feed','now')),
  body             text not null default '' check (char_length(body) <= 600),
  media_url        text,
  media_path       text,
  location_snapped extensions.geography(point, 4326),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);
create index if not exists posts_kind_created_idx on public.posts (kind, created_at desc);
create index if not exists posts_loc_idx on public.posts using gist (location_snapped);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  media_url  text not null,
  media_path text,
  caption    text not null default '' check (char_length(caption) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_author_idx on public.stories (author_id, expires_at);

create table if not exists public.story_views (
  story_id  uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- Post "Agora": expira em 60 min, herda a posição encaixada e substitui o anterior.
create or replace function public.prepare_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  select location_snapped into new.location_snapped from public.profile_private where id = new.author_id;
  if new.kind = 'now' then
    new.expires_at := now() + make_interval(mins => (public.cfg('now_post_minutes'))::int);
    delete from public.posts where author_id = new.author_id and kind = 'now';
  else
    new.expires_at := null;
  end if;
  return new;
end $$;
drop trigger if exists posts_prepare on public.posts;
create trigger posts_prepare before insert on public.posts
  for each row execute function public.prepare_post();

create or replace function public.prepare_story()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  new.expires_at := now() + make_interval(hours => (public.cfg('story_hours'))::int);
  return new;
end $$;
drop trigger if exists stories_prepare on public.stories;
create trigger stories_prepare before insert on public.stories
  for each row execute function public.prepare_story();

-- =====================================================================
--  RLS — Row Level Security
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.profile_private      enable row level security;
alter table public.entitlements         enable row level security;
alter table public.purchases            enable row level security;
alter table public.blocks               enable row level security;
alter table public.reports              enable row level security;
alter table public.photos               enable row level security;
alter table public.albums               enable row level security;
alter table public.album_items          enable row level security;
alter table public.album_shares         enable row level security;
alter table public.album_requests       enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.taps                 enable row level security;
alter table public.profile_views        enable row level security;
alter table public.posts                enable row level security;
alter table public.post_likes           enable row level security;
alter table public.post_comments        enable row level security;
alter table public.stories              enable row level security;
alter table public.story_views          enable row level security;

-- Nada é público para usuários anônimos.
revoke all on all tables in schema public from anon;
grant select on public.app_config to anon;

-- profiles: lê quem não está bloqueado/suspenso; edita só o próprio (colunas permitidas).
drop policy if exists "profiles: leitura" on public.profiles;
create policy "profiles: leitura" on public.profiles for select to authenticated
  using (id = auth.uid() or (onboarded and suspended_at is null and not public.is_blocked_pair(id, auth.uid())));
drop policy if exists "profiles: edição própria" on public.profiles;
create policy "profiles: edição própria" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, bio, status_text, sex_position, height_cm, weight_kg, body_type, relationship,
              pronouns, tribes, looking_for, interests, meet_at, avatar_url, last_active)
  on public.profiles to authenticated;

-- profile_private: só o dono. Verificação de idade e localização só via funções.
drop policy if exists "private: dono lê" on public.profile_private;
create policy "private: dono lê" on public.profile_private for select to authenticated using (id = auth.uid());
drop policy if exists "private: dono edita" on public.profile_private;
create policy "private: dono edita" on public.profile_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profile_private from authenticated;
grant update (birthdate, incognito, hide_distance, hide_age, on_prep, last_tested, show_health,
              accepted_terms_at, sensitive_consent_at)
  on public.profile_private to authenticated;

-- entitlements / purchases: só leitura do próprio. Escrita: servidor (service_role).
drop policy if exists "entitlements: dono lê" on public.entitlements;
create policy "entitlements: dono lê" on public.entitlements for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.entitlements from authenticated;
drop policy if exists "purchases: dono lê" on public.purchases;
create policy "purchases: dono lê" on public.purchases for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.purchases from authenticated;

-- blocks
drop policy if exists "blocks: próprios" on public.blocks;
create policy "blocks: próprios" on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks: criar" on public.blocks;
create policy "blocks: criar" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "blocks: remover" on public.blocks;
create policy "blocks: remover" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- reports
drop policy if exists "reports: criar" on public.reports;
create policy "reports: criar" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and reported_id <> auth.uid());
drop policy if exists "reports: próprios" on public.reports;
create policy "reports: próprios" on public.reports for select to authenticated using (reporter_id = auth.uid());
revoke update, delete on public.reports from authenticated;

-- photos
drop policy if exists "photos: leitura" on public.photos;
create policy "photos: leitura" on public.photos for select to authenticated
  using (user_id = auth.uid() or not public.is_blocked_pair(user_id, auth.uid()));
drop policy if exists "photos: criar" on public.photos;
create policy "photos: criar" on public.photos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "photos: editar" on public.photos;
create policy "photos: editar" on public.photos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "photos: apagar" on public.photos;
create policy "photos: apagar" on public.photos for delete to authenticated using (user_id = auth.uid());

-- albums
drop policy if exists "albums: leitura" on public.albums;
create policy "albums: leitura" on public.albums for select to authenticated
  using (owner_id = auth.uid() or public.has_album_access(id::text, auth.uid()));
drop policy if exists "albums: criar" on public.albums;
create policy "albums: criar" on public.albums for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "albums: editar" on public.albums;
create policy "albums: editar" on public.albums for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "albums: apagar" on public.albums;
create policy "albums: apagar" on public.albums for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "album_items: leitura" on public.album_items;
create policy "album_items: leitura" on public.album_items for select to authenticated
  using (owner_id = auth.uid() or public.has_album_access(album_id::text, auth.uid()));
drop policy if exists "album_items: criar" on public.album_items;
create policy "album_items: criar" on public.album_items for insert to authenticated
  with check (owner_id = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.owner_id = auth.uid()));
drop policy if exists "album_items: apagar" on public.album_items;
create policy "album_items: apagar" on public.album_items for delete to authenticated using (owner_id = auth.uid());

-- shares e pedidos: leitura pelos envolvidos; escrita só pelas funções (cota!)
drop policy if exists "album_shares: envolvidos" on public.album_shares;
create policy "album_shares: envolvidos" on public.album_shares for select to authenticated
  using (owner_id = auth.uid() or recipient_id = auth.uid());
revoke insert, update, delete on public.album_shares from authenticated;
drop policy if exists "album_requests: envolvidos" on public.album_requests;
create policy "album_requests: envolvidos" on public.album_requests for select to authenticated
  using (owner_id = auth.uid() or requester_id = auth.uid());
revoke insert, update, delete on public.album_requests from authenticated;

-- conversas
drop policy if exists "conversations: membros" on public.conversations;
create policy "conversations: membros" on public.conversations for select to authenticated using (public.is_member(id));
drop policy if exists "conversations: admin edita" on public.conversations;
create policy "conversations: admin edita" on public.conversations for update to authenticated
  using (is_group and exists (select 1 from public.conversation_members m where m.conversation_id = id
                               and m.user_id = auth.uid() and m.role in ('owner','admin')));
revoke insert, update, delete on public.conversations from authenticated;
grant update (title, description, avatar_url) on public.conversations to authenticated;

drop policy if exists "members: leitura" on public.conversation_members;
create policy "members: leitura" on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
drop policy if exists "members: editar própria" on public.conversation_members;
create policy "members: editar própria" on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "members: sair" on public.conversation_members;
create policy "members: sair" on public.conversation_members for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.conversation_members from authenticated;
grant update (last_read_at, muted) on public.conversation_members to authenticated;

drop policy if exists "messages: leitura" on public.messages;
create policy "messages: leitura" on public.messages for select to authenticated using (public.is_member(conversation_id));
drop policy if exists "messages: enviar" on public.messages;
create policy "messages: enviar" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text','image','location','safe_date')
    and public.is_member(conversation_id)
    and (public.direct_peer(conversation_id) is null or not public.is_blocked_pair(auth.uid(), public.direct_peer(conversation_id)))
  );
revoke update, delete on public.messages from authenticated;

-- taps / visitas
drop policy if exists "taps: envolvidos" on public.taps;
create policy "taps: envolvidos" on public.taps for select to authenticated using (to_id = auth.uid() or from_id = auth.uid());
revoke insert, update, delete on public.taps from authenticated;
drop policy if exists "views: próprias" on public.profile_views;
create policy "views: próprias" on public.profile_views for select to authenticated using (viewer_id = auth.uid());
revoke insert, update, delete on public.profile_views from authenticated;

-- posts / likes / comentários
drop policy if exists "posts: leitura" on public.posts;
create policy "posts: leitura" on public.posts for select to authenticated
  using (author_id = auth.uid() or ((expires_at is null or expires_at > now()) and not public.is_blocked_pair(author_id, auth.uid())));
drop policy if exists "posts: criar" on public.posts;
create policy "posts: criar" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts: apagar" on public.posts;
create policy "posts: apagar" on public.posts for delete to authenticated using (author_id = auth.uid());
revoke update on public.posts from authenticated;

drop policy if exists "likes: leitura" on public.post_likes;
create policy "likes: leitura" on public.post_likes for select to authenticated using (true);
drop policy if exists "likes: curtir" on public.post_likes;
create policy "likes: curtir" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes: descurtir" on public.post_likes;
create policy "likes: descurtir" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments: leitura" on public.post_comments;
create policy "comments: leitura" on public.post_comments for select to authenticated
  using (not public.is_blocked_pair(author_id, auth.uid()));
drop policy if exists "comments: criar" on public.post_comments;
create policy "comments: criar" on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id
              and not public.is_blocked_pair(p.author_id, auth.uid())));
drop policy if exists "comments: apagar" on public.post_comments;
create policy "comments: apagar" on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- stories
drop policy if exists "stories: leitura" on public.stories;
create policy "stories: leitura" on public.stories for select to authenticated
  using (author_id = auth.uid() or (expires_at > now() and not public.is_blocked_pair(author_id, auth.uid())));
drop policy if exists "stories: criar" on public.stories;
create policy "stories: criar" on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "stories: apagar" on public.stories;
create policy "stories: apagar" on public.stories for delete to authenticated using (author_id = auth.uid());
revoke update on public.stories from authenticated;

drop policy if exists "story_views: autor e viewer" on public.story_views;
create policy "story_views: autor e viewer" on public.story_views for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));
drop policy if exists "story_views: registrar" on public.story_views;
create policy "story_views: registrar" on public.story_views for insert to authenticated with check (viewer_id = auth.uid());

-- =====================================================================
--  Funções (RPC) usadas pelo app
-- =====================================================================

-- Localização: grava SÓ a posição encaixada na grade.
create or replace function public.update_my_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g  double precision := (public.cfg('location_grid_deg'))::double precision;
  pt extensions.geometry;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_LOCATION';
  end if;
  pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326);
  update public.profile_private
     set location_snapped = extensions.st_snaptogrid(pt, g)::extensions.geography,
         location_updated_at = now()
   where id = auth.uid();
  update public.profiles set last_active = now() where id = auth.uid();
end $$;

-- Sinal de idade da loja (Apple Declared Age Range) ou do provedor de verificação.
create or replace function public.record_age_signal(p_lower int, p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lower is null then raise exception 'AGE_SIGNAL_MISSING'; end if;
  if p_lower < 18 then
    update public.profiles set suspended_at = now(), onboarded = false where id = me;
    raise exception 'UNDERAGE';
  end if;
  update public.profile_private
     set age_verified_at = now(), age_verification_method = left(coalesce(p_source, 'unknown'), 60)
   where id = me;
  return jsonb_build_object('verified', true);
end $$;

create or replace function public.complete_onboarding()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pp public.profile_private; p public.profiles;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into pp from public.profile_private where id = me;
  select * into p from public.profiles where id = me;
  if p.suspended_at is not null then raise exception 'SUSPENDED'; end if;
  if char_length(trim(p.display_name)) = 0 then raise exception 'NAME_REQUIRED'; end if;
  if pp.birthdate is null then raise exception 'BIRTHDATE_REQUIRED'; end if;
  if pp.birthdate > (current_date - interval '18 years')::date then raise exception 'UNDERAGE'; end if;
  if pp.accepted_terms_at is null or pp.sensitive_consent_at is null then raise exception 'CONSENT_REQUIRED'; end if;
  if (public.cfg('require_age_verification'))::boolean and pp.age_verified_at is null then
    raise exception 'AGE_VERIFICATION_REQUIRED';
  end if;
  update public.profiles set onboarded = true, last_active = now() where id = me;
  return jsonb_build_object('onboarded', true);
end $$;

-- Status da conta: Pro, cotas, créditos.
create or replace function public.my_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'is_pro', coalesce(e.pro_until > now(), false),
    'pro_until', e.pro_until,
    'album_free_limit', (public.cfg('album_free_monthly'))::int,
    'album_used', (select count(*)::int from public.album_shares s where s.owner_id = auth.uid()
                     and s.created_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')),
    'album_credits', coalesce(e.album_credits, 0),
    'group_credits', coalesce(e.group_credits, 0),
    'pro_includes_groups', (public.cfg('pro_includes_groups'))::boolean,
    'age_verified', pp.age_verified_at is not null,
    'onboarded', p.onboarded,
    'suspended', p.suspended_at is not null
  )
  from public.profiles p
  left join public.entitlements e on e.user_id = p.id
  left join public.profile_private pp on pp.id = p.id
  where p.id = auth.uid()
$$;

-- Grade "Perto": ordenada por distância. Grátis: 99 perfis e filtros básicos.
-- Pro: ilimitado, filtros avançados e "Explorar" outra cidade (p_lat/p_lng).
create or replace function public.nearby_profiles(
  p_lat double precision default null,
  p_lng double precision default null,
  p_filters jsonb default '{}'::jsonb,
  p_limit int default 60,
  p_offset int default 0)
returns table (
  id uuid, display_name text, age int, sex_position text, avatar_url text, status_text text,
  tribes text[], looking_for text[], interests text[], distance_m int,
  approx_lat double precision, approx_lng double precision,
  online boolean, last_active timestamptz, is_pro boolean, has_story boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me        uuid := auth.uid();
  v_pro     boolean := public.is_pro(auth.uid());
  v_origin  extensions.geography;
  v_limit   int := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_offset  int := greatest(coalesce(p_offset, 0), 0);
  v_max     int := (public.cfg('free_grid_limit'))::int;
  v_radius  double precision := (public.cfg('nearby_radius_m'))::double precision;
  f         jsonb := coalesce(p_filters, '{}'::jsonb);
  v_online  boolean := coalesce((f->>'online_only')::boolean, false);
  v_photo   boolean := coalesce((f->>'with_photo')::boolean, false);
  v_age_min int := coalesce((f->>'age_min')::int, 18);
  v_age_max int := coalesce((f->>'age_max')::int, 99);
  v_pos     text[] := public.jtext_array(f->'positions');
  v_tribes  text[] := public.jtext_array(f->'tribes');
  v_look    text[] := public.jtext_array(f->'looking_for');
  v_max_m   double precision := coalesce((f->>'max_km')::double precision * 1000, null);
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;

  if p_lat is not null and p_lng is not null then
    if not v_pro then raise exception 'PRO_REQUIRED'; end if;
    v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  else
    select pp.location_snapped into v_origin from public.profile_private pp where pp.id = me;
  end if;

  if not v_pro then
    -- filtros avançados são Pro
    v_pos := '{}'; v_tribes := '{}'; v_look := '{}';
    if v_offset >= v_max then return; end if;
    v_limit := least(v_limit, v_max - v_offset);
  end if;

  return query
  select
    p.id, p.display_name,
    case when pp.hide_age or pp.birthdate is null then null else extract(year from age(pp.birthdate))::int end,
    p.sex_position, p.avatar_url, p.status_text, p.tribes, p.looking_for, p.interests,
    case when pp.hide_distance or v_origin is null or pp.location_snapped is null then null
         else (round(extensions.st_distance(pp.location_snapped, v_origin) / 10) * 10)::int end,
    case when pp.hide_distance or pp.location_snapped is null then null
         else extensions.st_y(pp.location_snapped::extensions.geometry) end,
    case when pp.hide_distance or pp.location_snapped is null then null
         else extensions.st_x(pp.location_snapped::extensions.geometry) end,
    p.last_active > now() - interval '10 minutes',
    p.last_active,
    coalesce(e.pro_until > now(), false),
    exists (select 1 from public.stories s where s.author_id = p.id and s.expires_at > now())
  from public.profiles p
  join public.profile_private pp on pp.id = p.id
  left join public.entitlements e on e.user_id = p.id
  where p.onboarded and p.suspended_at is null and p.id <> me and not pp.incognito
    and not public.is_blocked_pair(me, p.id)
    and (v_origin is null
         or (pp.location_snapped is not null
             and extensions.st_dwithin(pp.location_snapped, v_origin, coalesce(v_max_m, v_radius))))
    and (not v_online or p.last_active > now() - interval '10 minutes')
    and (not v_photo or p.avatar_url is not null)
    and (pp.birthdate is null or extract(year from age(pp.birthdate)) between v_age_min and v_age_max)
    and (cardinality(v_pos) = 0 or p.sex_position = any(v_pos))
    and (cardinality(v_tribes) = 0 or p.tribes && v_tribes)
    and (cardinality(v_look) = 0 or p.looking_for && v_look)
  order by
    (v_origin is null or pp.location_snapped is null),
    extensions.st_distance(pp.location_snapped, v_origin) nulls last,
    p.last_active desc
  limit v_limit offset v_offset;
end $$;

create or replace function public.can_request_album(p_requester uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_requester <> p_owner
    and not public.is_blocked_pair(p_requester, p_owner)
    and exists (select 1 from public.albums a where a.owner_id = p_owner)
    and (
      -- já conversaram
      exists (select 1 from public.conversations c
              where c.direct_key = least(p_requester::text, p_owner::text) || ':' || greatest(p_requester::text, p_owner::text)
                and c.last_message_preview <> '')
      -- ou estão próximos (viu por aproximação)
      or exists (select 1 from public.profile_private x, public.profile_private y
                 where x.id = p_requester and y.id = p_owner
                   and x.location_snapped is not null and y.location_snapped is not null
                   and extensions.st_dwithin(x.location_snapped, y.location_snapped,
                                             (public.cfg('album_request_radius_m'))::double precision))
    )
$$;

-- Perfil completo de alguém (registra visita, exceto em modo invisível).
create or replace function public.get_profile(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me       uuid := auth.uid();
  v_origin extensions.geography;
  v_incog  boolean;
  r        jsonb;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id <> me and public.is_blocked_pair(me, p_id) then return null; end if;
  select location_snapped, incognito into v_origin, v_incog from public.profile_private where id = me;

  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'bio', p.bio, 'status_text', p.status_text,
    'age', case when pp.hide_age or pp.birthdate is null then null else extract(year from age(pp.birthdate))::int end,
    'sex_position', p.sex_position, 'height_cm', p.height_cm, 'weight_kg', p.weight_kg,
    'body_type', p.body_type, 'relationship', p.relationship, 'pronouns', p.pronouns,
    'tribes', p.tribes, 'looking_for', p.looking_for, 'interests', p.interests, 'meet_at', p.meet_at,
    'avatar_url', p.avatar_url,
    'online', p.last_active > now() - interval '10 minutes', 'last_active', p.last_active,
    'distance_m', case when pp.hide_distance or v_origin is null or pp.location_snapped is null then null
                       else (round(extensions.st_distance(pp.location_snapped, v_origin) / 10) * 10)::int end,
    'health', case when pp.show_health then jsonb_build_object('on_prep', pp.on_prep, 'last_tested', pp.last_tested) end,
    'is_pro', public.is_pro(p.id),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url) order by ph.sort, ph.created_at)
                        from public.photos ph where ph.user_id = p.id), '[]'::jsonb),
    'albums_count', (select count(*) from public.albums a where a.owner_id = p.id),
    'shared_albums', coalesce((select jsonb_agg(jsonb_build_object('album_id', a.id, 'title', a.title,
                                 'share_id', s.id, 'expires_at', s.expires_at))
                               from public.album_shares s join public.albums a on a.id = s.album_id
                               where s.owner_id = p.id and s.recipient_id = me and s.revoked_at is null
                                 and (s.expires_at is null or s.expires_at > now())), '[]'::jsonb),
    'pending_request', exists (select 1 from public.album_requests q where q.requester_id = me and q.owner_id = p.id and q.status = 'pending'),
    'can_request_album', public.can_request_album(me, p.id),
    'tapped_at', (select t.created_at from public.taps t where t.from_id = me and t.to_id = p.id),
    'has_story', exists (select 1 from public.stories s where s.author_id = p.id and s.expires_at > now()),
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = p.id)
  ) into r
  from public.profiles p
  join public.profile_private pp on pp.id = p.id
  where p.id = p_id and (p.id = me or (p.onboarded and p.suspended_at is null));

  if r is not null and p_id <> me and not coalesce(v_incog, false) then
    insert into public.profile_views (viewer_id, viewed_id, viewed_at) values (me, p_id, now())
    on conflict (viewer_id, viewed_id) do update set viewed_at = excluded.viewed_at;
  end if;
  return r;
end $$;

-- Quem me viu: Pro vê a lista, grátis vê só a contagem (borrada no app).
create or replace function public.my_viewers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_count int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) into v_count from public.profile_views v
   where v.viewed_id = me and v.viewed_at > now() - interval '30 days'
     and not public.is_blocked_pair(me, v.viewer_id);
  if not public.is_pro(me) then
    return jsonb_build_object('locked', true, 'count', v_count, 'viewers', '[]'::jsonb);
  end if;
  return jsonb_build_object('locked', false, 'count', v_count, 'viewers', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
                                        'viewed_at', v.viewed_at) order by v.viewed_at desc)
    from public.profile_views v join public.profiles p on p.id = v.viewer_id
    where v.viewed_id = me and v.viewed_at > now() - interval '30 days'
      and p.suspended_at is null and not public.is_blocked_pair(me, v.viewer_id)), '[]'::jsonb));
end $$;

-- Conversa direta (cria se não existir).
create or replace function public.get_or_create_direct(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_key text; v_id uuid;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_other is null or p_other = me then raise exception 'INVALID_USER'; end if;
  if public.is_blocked_pair(me, p_other) then raise exception 'BLOCKED'; end if;
  if not exists (select 1 from public.profiles where id = p_other and suspended_at is null) then raise exception 'NOT_FOUND'; end if;
  v_key := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is null then
    insert into public.conversations (is_group, direct_key, created_by) values (false, v_key, me)
      on conflict (direct_key) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.conversations where direct_key = v_key; end if;
  end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, me), (v_id, p_other)
    on conflict do nothing;
  return v_id;
end $$;

create or replace function public.my_conversations()
returns table (
  id uuid, is_group boolean, title text, avatar_url text, other_id uuid, other_online boolean,
  last_message_at timestamptz, last_message_preview text, unread int, member_count int, muted boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.is_group,
         case when c.is_group then c.title else op.display_name end,
         case when c.is_group then c.avatar_url else op.avatar_url end,
         o.user_id,
         coalesce(op.last_active > now() - interval '10 minutes', false),
         c.last_message_at, c.last_message_preview,
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.created_at > me.last_read_at
             and m.sender_id is distinct from auth.uid()),
         (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
         me.muted
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (select cm.user_id from public.conversation_members cm
                     where cm.conversation_id = c.id and cm.user_id <> auth.uid() and not c.is_group limit 1) o on true
  left join public.profiles op on op.id = o.user_id
  where me.user_id = auth.uid()
    and (c.is_group or c.last_message_preview <> '')
    and (c.is_group or o.user_id is null or not public.is_blocked_pair(auth.uid(), o.user_id))
  order by c.last_message_at desc
$$;

create or replace function public.mark_read(p_conv uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conv and user_id = auth.uid()
$$;

create or replace function public.unsend_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set deleted_at = now(), body = '', meta = '{}'::jsonb
   where id = p_message and sender_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Grupo: sem limite de pessoas. Cada criação custa 1 crédito (R$ 1,99) — Pro grátis se configurado.
create or replace function public.create_group(p_title text, p_members uuid[] default '{}', p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_id uuid; v_free boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 then raise exception 'TITLE_REQUIRED'; end if;
  v_free := public.is_pro(me) and (public.cfg('pro_includes_groups'))::boolean;
  if not v_free then
    update public.entitlements set group_credits = group_credits - 1, updated_at = now()
     where user_id = me and group_credits > 0;
    if not found then raise exception 'GROUP_CREDIT_REQUIRED'; end if;
  end if;
  insert into public.conversations (is_group, title, description, created_by, invite_code)
  values (true, left(trim(p_title), 60), left(p_description, 300), me, substr(md5(gen_random_uuid()::text), 1, 10))
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, role) values (v_id, me, 'owner');
  insert into public.conversation_members (conversation_id, user_id)
    select v_id, u from unnest(coalesce(p_members, '{}')) u
    where u <> me and not public.is_blocked_pair(me, u)
      and exists (select 1 from public.profiles p where p.id = u and p.onboarded and p.suspended_at is null)
  on conflict do nothing;
  insert into public.messages (conversation_id, sender_id, kind, body) values (v_id, me, 'system', 'Grupo criado');
  return v_id;
end $$;

create or replace function public.add_group_members(p_conv uuid, p_members uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_n int;
begin
  if not exists (select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
                 where m.conversation_id = p_conv and m.user_id = me and m.role in ('owner','admin') and c.is_group) then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.conversation_members (conversation_id, user_id)
    select p_conv, u from unnest(p_members) u
    where not public.is_blocked_pair(me, u)
      and exists (select 1 from public.profiles p where p.id = u and p.onboarded and p.suspended_at is null)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into v_id from public.conversations where invite_code = p_code and is_group;
  if v_id is null then raise exception 'NOT_FOUND'; end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

create or replace function public.remove_group_member(p_conv uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversation_members
                 where conversation_id = p_conv and user_id = auth.uid() and role in ('owner','admin')) then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.conversation_members where conversation_id = p_conv and user_id = p_user and role <> 'owner';
end $$;

-- Enviar álbum: 20/mês grátis, depois consome créditos (pacote +10 por R$ 2,99). Pro: ilimitado.
create or replace function public.share_album(p_album uuid, p_recipient uuid, p_expires_hours int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); v_title text; v_share uuid; v_used int; v_conv uuid; v_exp timestamptz;
  v_month timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select title into v_title from public.albums where id = p_album and owner_id = me;
  if v_title is null then raise exception 'NOT_FOUND'; end if;
  if p_recipient = me or public.is_blocked_pair(me, p_recipient) then raise exception 'BLOCKED'; end if;
  v_exp := case when p_expires_hours is null then null else now() + make_interval(hours => p_expires_hours) end;

  select id into v_share from public.album_shares
   where album_id = p_album and recipient_id = p_recipient and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1;

  if v_share is null then
    if not public.is_pro(me) then
      perform pg_advisory_xact_lock(hashtext(me::text));
      select count(*) into v_used from public.album_shares where owner_id = me and created_at >= v_month;
      if v_used >= (public.cfg('album_free_monthly'))::int then
        update public.entitlements set album_credits = album_credits - 1, updated_at = now()
         where user_id = me and album_credits > 0;
        if not found then raise exception 'ALBUM_QUOTA_EXCEEDED'; end if;
      end if;
    end if;
    insert into public.album_shares (album_id, owner_id, recipient_id, expires_at)
    values (p_album, me, p_recipient, v_exp) returning id into v_share;
  else
    update public.album_shares set expires_at = v_exp where id = v_share;
  end if;

  v_conv := public.get_or_create_direct(p_recipient);
  insert into public.messages (conversation_id, sender_id, kind, body, meta)
  values (v_conv, me, 'album', v_title, jsonb_build_object('album_id', p_album, 'share_id', v_share, 'expires_at', v_exp));
  update public.album_requests set status = 'accepted', responded_at = now()
   where requester_id = p_recipient and owner_id = me and status = 'pending';
  return v_share;
end $$;

create or replace function public.revoke_album_share(p_share uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.album_shares set revoked_at = now() where id = p_share and owner_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create or replace function public.request_album(p_owner uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v_id uuid; v_conv uuid;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_request_album(me, p_owner) then raise exception 'ALBUM_REQUEST_NOT_ALLOWED'; end if;
  select id into v_id from public.album_requests where requester_id = me and owner_id = p_owner and status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into public.album_requests (requester_id, owner_id) values (me, p_owner) returning id into v_id;
  v_conv := public.get_or_create_direct(p_owner);
  insert into public.messages (conversation_id, sender_id, kind, body, meta)
  values (v_conv, me, 'album_request', 'Pediu para ver seus álbuns', jsonb_build_object('request_id', v_id));
  return v_id;
end $$;

create or replace function public.decline_album_request(p_request uuid)
returns void language sql security definer set search_path = '' as $$
  update public.album_requests set status = 'declined', responded_at = now()
   where id = p_request and owner_id = auth.uid() and status = 'pending'
$$;

create or replace function public.my_album_requests()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'requester_id', p.id, 'display_name', p.display_name,
                                               'avatar_url', p.avatar_url, 'created_at', q.created_at)
                            order by q.created_at desc), '[]'::jsonb)
  from public.album_requests q join public.profiles p on p.id = q.requester_id
  where q.owner_id = auth.uid() and q.status = 'pending' and not public.is_blocked_pair(auth.uid(), p.id)
$$;

-- Faíscas
create or replace function public.send_tap(p_to uuid, p_kind text default 'fire')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_to = auth.uid() or public.is_blocked_pair(auth.uid(), p_to) then raise exception 'BLOCKED'; end if;
  insert into public.taps (from_id, to_id, kind) values (auth.uid(), p_to, coalesce(p_kind, 'fire'))
  on conflict (from_id, to_id) do update set kind = excluded.kind, created_at = now(), seen_at = null;
end $$;

create or replace function public.my_taps()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('from_id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
                                               'kind', t.kind, 'created_at', t.created_at, 'seen', t.seen_at is not null)
                            order by t.created_at desc), '[]'::jsonb)
  from public.taps t join public.profiles p on p.id = t.from_id
  where t.to_id = auth.uid() and t.created_at > now() - interval '7 days'
    and p.suspended_at is null and not public.is_blocked_pair(auth.uid(), p.id)
$$;

create or replace function public.mark_taps_seen()
returns void language sql security definer set search_path = '' as $$
  update public.taps set seen_at = now() where to_id = auth.uid() and seen_at is null
$$;

-- Feed e "Agora" por proximidade
create or replace function public.nearby_posts(p_kind text, p_limit int default 30, p_before timestamptz default null)
returns table (
  id uuid, kind text, body text, media_url text, created_at timestamptz, expires_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_age int, author_position text, author_online boolean,
  distance_m int, likes int, liked boolean, comments int)
language sql stable security definer set search_path = '' as $$
  with me as (select location_snapped as loc from public.profile_private where id = auth.uid())
  select po.id, po.kind, po.body, po.media_url, po.created_at, po.expires_at,
         p.id, p.display_name, p.avatar_url,
         case when pp.hide_age or pp.birthdate is null then null else extract(year from age(pp.birthdate))::int end,
         p.sex_position, p.last_active > now() - interval '10 minutes',
         case when pp.hide_distance or me.loc is null or po.location_snapped is null then null
              else (round(extensions.st_distance(po.location_snapped, me.loc) / 10) * 10)::int end,
         (select count(*)::int from public.post_likes l where l.post_id = po.id),
         exists (select 1 from public.post_likes l where l.post_id = po.id and l.user_id = auth.uid()),
         (select count(*)::int from public.post_comments c where c.post_id = po.id)
  from public.posts po
  join public.profiles p on p.id = po.author_id
  join public.profile_private pp on pp.id = p.id
  cross join me
  where po.kind = p_kind
    and (po.expires_at is null or po.expires_at > now())
    and (p_before is null or po.created_at < p_before)
    and p.suspended_at is null
    and (po.author_id = auth.uid() or not public.is_blocked_pair(auth.uid(), po.author_id))
    and (me.loc is null or po.location_snapped is null
         or extensions.st_dwithin(po.location_snapped, me.loc, case when p_kind = 'now' then 50000 else 300000 end))
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 60)
$$;

create or replace function public.post_comments_list(p_post uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at,
                                               'author_id', p.id, 'author_name', p.display_name, 'author_avatar', p.avatar_url)
                            order by c.created_at), '[]'::jsonb)
  from public.post_comments c join public.profiles p on p.id = c.author_id
  where c.post_id = p_post and not public.is_blocked_pair(auth.uid(), c.author_id)
$$;

-- Bandeja de stories: eu primeiro, depois quem está perto com story ativo.
create or replace function public.stories_tray()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select location_snapped as loc from public.profile_private where id = auth.uid()),
  authors as (
    select s.author_id, max(s.created_at) as last_at,
           bool_or(not exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) as unseen
    from public.stories s
    where s.expires_at > now() and (s.author_id = auth.uid() or not public.is_blocked_pair(auth.uid(), s.author_id))
    group by s.author_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('author_id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
                                               'unseen', a.unseen, 'last_at', a.last_at, 'is_me', p.id = auth.uid())
                            order by (p.id = auth.uid()) desc, a.unseen desc,
                                     extensions.st_distance(pp.location_snapped, me.loc) nulls last), '[]'::jsonb)
  from authors a
  join public.profiles p on p.id = a.author_id
  join public.profile_private pp on pp.id = p.id
  cross join me
  where p.suspended_at is null
    and (p.id = auth.uid() or me.loc is null or pp.location_snapped is null
         or extensions.st_dwithin(pp.location_snapped, me.loc, 100000))
$$;

-- Lista de bloqueados (os perfis não passam no RLS de leitura, por isso uma função)
create or replace function public.my_blocked()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name,
                                               'avatar_url', p.avatar_url, 'created_at', b.created_at)
                            order by b.created_at desc), '[]'::jsonb)
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
$$;

-- Denunciar + bloquear de uma vez
create or replace function public.report_user(p_user uuid, p_reason text, p_details text default '', p_block boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.reports (reporter_id, reported_id, reason, details) values (auth.uid(), p_user, p_reason, coalesce(p_details, ''));
  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  end if;
end $$;

-- Permissões das funções: só usuários logados.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- Usada só pelo servidor (service_role) depois de validar a compra na Apple.
create or replace function public.grant_entitlement(
  p_user uuid, p_kind text, p_qty int default 1, p_pro_until timestamptz default null,
  p_product text default null, p_original_tx text default null, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into public.entitlements (user_id) values (p_user) on conflict do nothing;
  if p_kind = 'pro' then
    update public.entitlements set
      pro_until = case when p_force or pro_until is null or p_pro_until > pro_until then p_pro_until else pro_until end,
      pro_product_id = coalesce(p_product, pro_product_id),
      pro_original_transaction_id = coalesce(p_original_tx, pro_original_transaction_id),
      updated_at = now()
    where user_id = p_user;
  elsif p_kind = 'album_pack' then
    update public.entitlements
       set album_credits = greatest(0, album_credits + p_qty * (public.cfg('album_pack_size'))::int), updated_at = now()
     where user_id = p_user;
  elsif p_kind = 'group' then
    update public.entitlements set group_credits = greatest(0, group_credits + p_qty), updated_at = now()
     where user_id = p_user;
  else
    raise exception 'UNKNOWN_KIND';
  end if;
  return (select to_jsonb(e) from public.entitlements e where e.user_id = p_user);
end $$;
revoke execute on function public.grant_entitlement(uuid, text, int, timestamptz, text, text, boolean) from public, anon, authenticated;
grant execute on function public.grant_entitlement(uuid, text, int, timestamptz, text, text, boolean) to service_role;

-- =====================================================================
--  Storage (buckets + políticas)
--   photos  → público  : {uid}/arquivo            (fotos do perfil)
--   posts   → público  : {uid}/arquivo            (feed, Agora, stories)
--   albums  → PRIVADO  : {uid}/{album_id}/arquivo (só dono e quem recebeu)
--   chat    → PRIVADO  : {conversation_id}/arquivo (só membros)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('posts',  'posts',  true,  26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('albums', 'albums', false, 26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('chat',   'chat',   false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "basher: upload próprio" on storage.objects;
create policy "basher: upload próprio" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','posts','albums') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "basher: apagar próprio" on storage.objects;
create policy "basher: apagar próprio" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','posts','albums') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "basher: ler álbum" on storage.objects;
create policy "basher: ler álbum" on storage.objects for select to authenticated
  using (bucket_id = 'albums' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_album_access((storage.foldername(name))[2], auth.uid())));

drop policy if exists "basher: chat upload" on storage.objects;
create policy "basher: chat upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and exists (select 1 from public.conversation_members m
              where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));

drop policy if exists "basher: chat leitura" on storage.objects;
create policy "basher: chat leitura" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and exists (select 1 from public.conversation_members m
         where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));

-- =====================================================================
--  Realtime (chat ao vivo, faíscas e pedidos de álbum)
-- =====================================================================
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.taps; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.album_requests; exception when duplicate_object then null; end;
end $$;

-- =====================================================================
--  Limpeza automática (opcional — precisa da extensão pg_cron ativa)
-- =====================================================================
create or replace function public.cleanup_expired()
returns void language sql security definer set search_path = '' as $$
  delete from public.posts where kind = 'now' and expires_at < now() - interval '1 day';
  delete from public.stories where expires_at < now() - interval '2 days';
  delete from public.profile_views where viewed_at < now() - interval '60 days';
$$;
revoke execute on function public.cleanup_expired() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('basher-cleanup', '17 4 * * *', 'select public.cleanup_expired()');
exception when others then
  raise notice 'pg_cron indisponível — ative em Database > Extensions e rode: select cron.schedule(''basher-cleanup'', ''17 4 * * *'', ''select public.cleanup_expired()'');';
end $$;
