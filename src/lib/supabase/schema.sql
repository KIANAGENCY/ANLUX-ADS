-- ANLUX Ads Intelligence — FUTURE persistence reference only. NOT auto-executed.
-- Every table is RLS fail-closed. Production migrations require explicit review and policies.
create table if not exists public.users (id uuid primary key references auth.users(id) on delete cascade,email text not null unique,full_name text,role text not null default 'analyst',created_at timestamptz not null default now());
create table if not exists public.clients (id text primary key,name text not null,slug text not null unique,industry text,accent_color text,created_at timestamptz not null default now());
create table if not exists public.meta_ad_accounts (id text primary key,client_id text not null references public.clients(id) on delete cascade,meta_account_id text not null,currency text,timezone text,created_at timestamptz not null default now());
create table if not exists public.business_goals (id bigint generated always as identity primary key,ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,target_cost_per_result numeric,minimum_roas numeric,monthly_budget numeric,gross_margin_percent numeric,risk_tolerance text not null default 'balanced',updated_at timestamptz not null default now(),unique(ad_account_id));
create table if not exists public.campaign_snapshots (id bigint generated always as identity primary key,campaign_id text not null,ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,date date not null,spend numeric not null default 0,impressions bigint not null default 0,reach bigint not null default 0,clicks bigint not null default 0,results numeric not null default 0,created_at timestamptz not null default now(),unique(campaign_id,date));
create table if not exists public.adset_snapshots (id bigint generated always as identity primary key,adset_id text not null,campaign_id text not null,date date not null,spend numeric not null default 0,impressions bigint not null default 0,reach bigint not null default 0,clicks bigint not null default 0,results numeric not null default 0,created_at timestamptz not null default now(),unique(adset_id,date));
create table if not exists public.ad_snapshots (id bigint generated always as identity primary key,ad_id text not null,adset_id text not null,date date not null,spend numeric not null default 0,impressions bigint not null default 0,reach bigint not null default 0,clicks bigint not null default 0,results numeric not null default 0,created_at timestamptz not null default now(),unique(ad_id,date));
create table if not exists public.decision_history (id bigint generated always as identity primary key,ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,entity_type text not null,entity_id text not null,action text not null,score integer not null,confidence text not null,risk text not null,evidence jsonb not null default '[]',created_at timestamptz not null default now());
create table if not exists public.decision_feedback (id bigint generated always as identity primary key,decision_id bigint not null references public.decision_history(id) on delete cascade,reviewed_by uuid references public.users(id) on delete set null,outcome text not null,notes text,observed_result jsonb,created_at timestamptz not null default now());
create table if not exists public.ai_analyses (id bigint generated always as identity primary key,client_id text not null references public.clients(id) on delete cascade,requested_by uuid references public.users(id) on delete set null,date_from date not null,date_to date not null,question text,summary text not null,issues jsonb not null default '[]',opportunities jsonb not null default '[]',recommendations jsonb not null default '[]',priority text not null default 'low',provider text,created_at timestamptz not null default now());
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.business_goals enable row level security;
alter table public.campaign_snapshots enable row level security;
alter table public.adset_snapshots enable row level security;
alter table public.ad_snapshots enable row level security;
alter table public.decision_history enable row level security;
alter table public.decision_feedback enable row level security;
alter table public.ai_analyses enable row level security;
-- No policies intentionally: publishable-key access remains denied until a reviewed authorization model exists.
