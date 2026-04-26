-- ============================================================
-- Chaplain Connect — Phase 1 Foundation Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS (tenants)
-- ============================================================
create table public.organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  tier        text not null default 'starter' check (tier in ('starter', 'professional', 'enterprise')),
  stripe_customer_id text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references public.organizations(id) on delete set null,
  role        text not null default 'user' check (role in ('super_admin', 'org_admin', 'chaplain', 'user')),
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INVITATIONS
-- ============================================================
create table public.invitations (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('org_admin', 'chaplain', 'user')),
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by  uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.invitations enable row level security;

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  org_id                 uuid not null unique references public.organizations(id) on delete cascade,
  stripe_subscription_id text unique,
  tier                   text not null default 'starter' check (tier in ('starter', 'professional', 'enterprise')),
  status                 text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  period_start           timestamptz,
  period_end             timestamptz,
  cancel_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- ============================================================
-- AUDIT LOGS (append-only, hash-chained)
-- ============================================================
create table public.audit_logs (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references public.organizations(id) on delete set null,
  user_id       uuid references public.profiles(id) on delete set null,
  action        text not null,
  resource_type text not null,
  resource_id   text,
  metadata      jsonb default '{}',
  ip_address    inet,
  user_agent    text,
  prev_hash     text,
  hash          text not null,
  created_at    timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Prevent updates and deletes on audit_logs (append-only)
create or replace rule audit_logs_no_update as on update to public.audit_logs do instead nothing;
create or replace rule audit_logs_no_delete as on delete to public.audit_logs do instead nothing;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper function: get the calling user's org_id
create or replace function public.get_my_org_id()
returns uuid
language sql stable
security definer
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Helper function: get the calling user's role
create or replace function public.get_my_role()
returns text
language sql stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ORGANIZATIONS policies
create policy "Users can view their own organization"
  on public.organizations for select
  using (id = public.get_my_org_id());

create policy "Org admins can update their organization"
  on public.organizations for update
  using (id = public.get_my_org_id() and public.get_my_role() in ('org_admin', 'super_admin'));

create policy "Super admins can do anything with organizations"
  on public.organizations for all
  using (public.get_my_role() = 'super_admin');

-- PROFILES policies
create policy "Users can view profiles in their org"
  on public.profiles for select
  using (org_id = public.get_my_org_id() or id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Org admins can update profiles in their org"
  on public.profiles for update
  using (org_id = public.get_my_org_id() and public.get_my_role() in ('org_admin', 'super_admin'));

create policy "Super admins can do anything with profiles"
  on public.profiles for all
  using (public.get_my_role() = 'super_admin');

-- INVITATIONS policies
create policy "Org admins can manage invitations in their org"
  on public.invitations for all
  using (org_id = public.get_my_org_id() and public.get_my_role() in ('org_admin', 'super_admin'));

create policy "Anyone can view invitation by token"
  on public.invitations for select
  using (true);  -- token-gated at application layer

-- SUBSCRIPTIONS policies
create policy "Org members can view their subscription"
  on public.subscriptions for select
  using (org_id = public.get_my_org_id());

create policy "Super admins can manage all subscriptions"
  on public.subscriptions for all
  using (public.get_my_role() = 'super_admin');

-- AUDIT LOGS policies
create policy "Org admins can view audit logs for their org"
  on public.audit_logs for select
  using (org_id = public.get_my_org_id() and public.get_my_role() in ('org_admin', 'super_admin'));

create policy "Super admins can view all audit logs"
  on public.audit_logs for select
  using (public.get_my_role() = 'super_admin');

create policy "Service role can insert audit logs"
  on public.audit_logs for insert
  with check (true);

-- ============================================================
-- UPDATED_AT trigger function
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
