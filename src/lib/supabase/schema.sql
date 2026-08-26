-- =============================================================================
-- ANLUX Ads Intelligence — esquema futuro de Supabase (referencia)
-- =============================================================================
-- Este archivo es SOLO documentación: no se ejecuta automáticamente en
-- ningún sitio. Cuando conectemos Supabase de verdad, estas sentencias se
-- convertirán en migraciones reales (p. ej. con la Supabase CLI en
-- `supabase/migrations/`). Ninguna migración aquí es destructiva.
--
-- Filosofía: `campaign_snapshots` / `adset_snapshots` / `ad_snapshots`
-- guardan una fila por entidad y día (igual que `DailyMetrics` en
-- `lib/types`), para poder auditar histórico e independizarnos de los
-- límites de retención de la Graph API de Meta.
-- =============================================================================

-- Usuarios de la agencia con acceso a la app (además de auth.users de Supabase Auth).
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'analyst', -- 'admin' | 'analyst'
  created_at timestamptz not null default now()
);

-- Clientes de la agencia (Orthobasic, Hotel Expert, ...).
create table if not exists public.clients (
  id text primary key,
  name text not null,
  slug text not null unique,
  industry text,
  accent_color text,
  created_at timestamptz not null default now()
);

-- Cuentas publicitarias de Meta asociadas a cada cliente.
create table if not exists public.meta_ad_accounts (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  meta_account_id text not null,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Snapshot diario de métricas a nivel de campaña.
create table if not exists public.campaign_snapshots (
  id bigint generated always as identity primary key,
  campaign_id text not null,
  ad_account_id text not null references public.meta_ad_accounts (id) on delete cascade,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  results bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, date)
);

-- Snapshot diario de métricas a nivel de ad set.
create table if not exists public.adset_snapshots (
  id bigint generated always as identity primary key,
  adset_id text not null,
  campaign_id text not null,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  results bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (adset_id, date)
);

-- Snapshot diario de métricas a nivel de anuncio.
create table if not exists public.ad_snapshots (
  id bigint generated always as identity primary key,
  ad_id text not null,
  adset_id text not null,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  results bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (ad_id, date)
);

-- Historial de análisis generados por el AI Performance Analyst (mock hoy, Claude a futuro).
create table if not exists public.ai_analyses (
  id bigint generated always as identity primary key,
  client_id text not null references public.clients (id) on delete cascade,
  requested_by uuid references public.users (id) on delete set null,
  date_from date not null,
  date_to date not null,
  question text,
  summary text not null,
  issues jsonb not null default '[]',
  opportunities jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  priority text not null default 'low', -- 'low' | 'medium' | 'high'
  created_at timestamptz not null default now()
);

-- Row Level Security: a activar cuando haya más de un usuario por cliente.
-- alter table public.clients enable row level security;
-- alter table public.campaign_snapshots enable row level security;
-- -- ... políticas por definir según el modelo de permisos de la agencia.
