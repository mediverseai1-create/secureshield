-- SecureShield AI — core schema, helper functions, triggers.
-- Row Level Security policies live in 0002_rls.sql.
-- Every customer-data table carries org_id; isolation is enforced in the database.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Generic trigger functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.prevent_org_change() returns trigger
language plpgsql as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles, organizations, membership
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  job_title text,
  role_in_org text,
  industry text,
  country text,
  company_size text,
  revenue_goals text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  industry text,
  country text,
  company_size text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member' check (role in ('admin', 'member')),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invitations_org_idx on public.invitations (org_id);

-- ---------------------------------------------------------------------------
-- Membership helper functions (security definer so policies do not recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where org_id = _org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where org_id = _org and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where org_id = _org and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_org_with(_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = _user
  );
$$;

-- ---------------------------------------------------------------------------
-- Profile auto-creation on sign-up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plan catalogue, subscriptions, credits
-- ---------------------------------------------------------------------------
create table if not exists public.plan_catalog (
  plan text primary key check (plan in ('free', 'starter', 'pro', 'scale')),
  name text not null,
  price_usd_month integer not null check (price_usd_month >= 0),
  monthly_credits integer not null check (monthly_credits > 0)
);
insert into public.plan_catalog (plan, name, price_usd_month, monthly_credits) values
  ('free', 'Free', 0, 200),
  ('starter', 'Starter', 47, 4000),
  ('pro', 'Pro', 57, 7000),
  ('scale', 'Scale', 97, 11000)
on conflict (plan) do update
  set name = excluded.name, price_usd_month = excluded.price_usd_month, monthly_credits = excluded.monthly_credits;

create table if not exists public.subscriptions (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null default 'free' references public.plan_catalog (plan),
  status text not null default 'free' check (status in ('free', 'active', 'past_due', 'canceled')),
  provider text,
  provider_reference text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_balances (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null default 'free' references public.plan_catalog (plan),
  monthly_allocation integer not null check (monthly_allocation > 0),
  balance integer not null check (balance >= 0),
  period_start timestamptz not null default now(),
  period_end timestamptz not null default (now() + interval '1 month'),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('debit', 'refund', 'grant', 'reset')),
  action text not null,
  credits integer not null check (credits >= 0),
  balance_after integer not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists credit_usage_org_created_idx on public.credit_usage (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Revenue data
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  domain text,
  industry text,
  company_size text,
  country text,
  status text not null default 'prospect' check (status in ('prospect', 'customer', 'at_risk', 'former')),
  owner_id uuid references auth.users (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index if not exists accounts_org_idx on public.accounts (org_id, name);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, org_id) references public.accounts (id, org_id) on delete cascade
);
create index if not exists contacts_account_idx on public.contacts (org_id, account_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text,
  phone text,
  company text,
  job_title text,
  source text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  owner_id uuid references auth.users (id) on delete set null,
  account_id uuid,
  last_contacted_at timestamptz,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (account_id, org_id) references public.accounts (id, org_id) on delete set null (account_id)
);
create index if not exists leads_org_status_idx on public.leads (org_id, status);
create index if not exists leads_org_created_idx on public.leads (org_id, created_at desc);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  account_id uuid,
  lead_id uuid,
  stage text not null default 'prospecting'
    check (stage in ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  probability integer not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  owner_id uuid references auth.users (id) on delete set null,
  next_step text,
  lost_reason text,
  source text,
  notes text,
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (account_id, org_id) references public.accounts (id, org_id) on delete set null (account_id),
  foreign key (lead_id, org_id) references public.leads (id, org_id) on delete set null (lead_id)
);
create index if not exists opportunities_org_stage_idx on public.opportunities (org_id, stage);
create index if not exists opportunities_org_close_idx on public.opportunities (org_id, expected_close_date);
create index if not exists opportunities_account_idx on public.opportunities (org_id, account_id);

create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  amount numeric(14, 2),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists stage_history_org_idx on public.opportunity_stage_history (org_id, changed_at desc);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null check (char_length(subject) between 1 and 300),
  notes text,
  account_id uuid,
  lead_id uuid,
  opportunity_id uuid,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (account_id, org_id) references public.accounts (id, org_id) on delete cascade,
  foreign key (lead_id, org_id) references public.leads (id, org_id) on delete cascade,
  foreign key (opportunity_id, org_id) references public.opportunities (id, org_id) on delete cascade
);
create index if not exists activities_org_time_idx on public.activities (org_id, occurred_at desc);
create index if not exists activities_account_idx on public.activities (org_id, account_id);
create index if not exists activities_opp_idx on public.activities (org_id, opportunity_id);
create index if not exists activities_lead_idx on public.activities (org_id, lead_id);

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  source_type text not null default 'transcript' check (source_type in ('transcript', 'audio')),
  transcript text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size integer,
  account_id uuid,
  opportunity_id uuid,
  participants text,
  occurred_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'analyzed', 'failed')),
  error text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (transcript is not null or storage_path is not null),
  foreign key (account_id, org_id) references public.accounts (id, org_id) on delete set null (account_id),
  foreign key (opportunity_id, org_id) references public.opportunities (id, org_id) on delete set null (opportunity_id)
);
create index if not exists conversations_org_time_idx on public.conversations (org_id, occurred_at desc);

create table if not exists public.conversation_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  summary text not null,
  intent text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_reasoning text,
  objections jsonb not null default '[]'::jsonb,
  commitments jsonb not null default '[]'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  decision_criteria jsonb not null default '[]'::jsonb,
  next_action text,
  model text,
  credits_used integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id),
  foreign key (conversation_id, org_id) references public.conversations (id, org_id) on delete cascade
);
create index if not exists conversation_analyses_org_idx on public.conversation_analyses (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Intelligence outputs
-- ---------------------------------------------------------------------------
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  period_start date not null,
  period_end date not null,
  content jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  model text,
  credits_used integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists briefings_org_idx on public.briefings (org_id, created_at desc);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  reason text,
  type text not null default 'other'
    check (type in ('follow_up', 'review_opportunity', 'address_objection', 'post_call', 'stalled_deal', 'lead_outreach', 'other')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  due_date date,
  source_type text check (source_type in ('opportunity', 'lead', 'account', 'conversation', 'briefing', 'manual')),
  source_id uuid,
  dedupe_key text,
  generated_by text not null default 'manual' check (generated_by in ('rules', 'ai', 'manual')),
  assigned_to uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
create index if not exists actions_org_status_idx on public.actions (org_id, status, priority);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'watch', 'risk', 'positive')),
  title text not null,
  body text not null,
  evidence jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
create index if not exists insights_org_idx on public.insights (org_id, generated_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type in ('pipeline_overview', 'revenue_intelligence', 'lead_performance', 'account_activity', 'conversation_intelligence')),
  title text not null,
  params jsonb not null default '{}'::jsonb,
  data jsonb not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists reports_org_idx on public.reports (org_id, created_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_idx on public.assistant_messages (org_id, user_id, created_at);

create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('accounts', 'leads', 'opportunities')),
  file_name text,
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists data_imports_org_idx on public.data_imports (org_id, created_at desc);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  action text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_org_idx on public.activity_logs (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, org immutability, owner membership, stage tracking
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'organizations', 'accounts', 'contacts', 'leads', 'opportunities',
                           'conversations', 'conversation_analyses', 'actions', 'subscriptions', 'credit_balances']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;

  foreach t in array array['accounts', 'contacts', 'leads', 'opportunities', 'activities', 'conversations',
                           'conversation_analyses', 'briefings', 'actions', 'insights', 'reports',
                           'assistant_messages', 'data_imports', 'activity_logs']
  loop
    execute format('drop trigger if exists prevent_org_change on public.%I', t);
    execute format('create trigger prevent_org_change before update on public.%I for each row execute function public.prevent_org_change()', t);
  end loop;
end $$;

-- An owner/assignee must belong to the same organization.
create or replace function public.check_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.organization_members where org_id = new.org_id and user_id = new.owner_id
  ) then
    raise exception 'owner must be a member of the workspace' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.check_assignee_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.organization_members where org_id = new.org_id and user_id = new.assigned_to
  ) then
    raise exception 'assignee must be a member of the workspace' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists check_owner_member on public.accounts;
create trigger check_owner_member before insert or update on public.accounts
  for each row execute function public.check_owner_member();
drop trigger if exists check_owner_member on public.leads;
create trigger check_owner_member before insert or update on public.leads
  for each row execute function public.check_owner_member();
drop trigger if exists check_owner_member on public.opportunities;
create trigger check_owner_member before insert or update on public.opportunities
  for each row execute function public.check_owner_member();
drop trigger if exists check_assignee_member on public.actions;
create trigger check_assignee_member before insert or update on public.actions
  for each row execute function public.check_assignee_member();

create or replace function public.opportunity_stage_before() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.stage_changed_at := now();
    if new.stage in ('closed_won', 'closed_lost') then new.closed_at := now(); end if;
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.closed_at := case when new.stage in ('closed_won', 'closed_lost') then now() else null end;
  end if;
  return new;
end $$;

create or replace function public.opportunity_stage_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.opportunity_stage_history (org_id, opportunity_id, from_stage, to_stage, amount, changed_by)
    values (new.org_id, new.id, case when tg_op = 'INSERT' then null else old.stage end, new.stage, new.amount, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists opportunity_stage_before on public.opportunities;
create trigger opportunity_stage_before before insert or update on public.opportunities
  for each row execute function public.opportunity_stage_before();
drop trigger if exists opportunity_stage_after on public.opportunities;
create trigger opportunity_stage_after after insert or update on public.opportunities
  for each row execute function public.opportunity_stage_after();

-- Logging a call/email/meeting against a lead updates its last-contacted date.
create or replace function public.activity_touch_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.type in ('call', 'email', 'meeting') then
    update public.leads
      set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
      where id = new.lead_id and org_id = new.org_id;
  end if;
  return null;
end $$;
drop trigger if exists activity_touch_lead on public.activities;
create trigger activity_touch_lead after insert on public.activities
  for each row execute function public.activity_touch_lead();

-- ---------------------------------------------------------------------------
-- Workspace RPCs (membership changes never happen through direct table writes)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  _name text, _industry text, _country text, _company_size text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _org uuid;
  _slug text;
  _credits integer;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.organization_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a workspace' using errcode = 'P0001';
  end if;
  _slug := regexp_replace(lower(coalesce(nullif(trim(_name), ''), 'workspace')), '[^a-z0-9]+', '-', 'g');
  _slug := trim(both '-' from _slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug, industry, country, company_size, created_by)
  values (trim(_name), _slug, _industry, _country, _company_size, auth.uid())
  returning id into _org;

  insert into public.organization_members (org_id, user_id, role) values (_org, auth.uid(), 'owner');
  insert into public.subscriptions (org_id, plan, status) values (_org, 'free', 'free');
  select monthly_credits into _credits from public.plan_catalog where plan = 'free';
  insert into public.credit_balances (org_id, plan, monthly_allocation, balance)
  values (_org, 'free', _credits, _credits);
  insert into public.credit_usage (org_id, user_id, kind, action, credits, balance_after, description)
  values (_org, auth.uid(), 'grant', 'plan_allocation', _credits, _credits, 'Free plan monthly credits');
  insert into public.activity_logs (org_id, user_id, action, entity_type, entity_id, summary)
  values (_org, auth.uid(), 'workspace.created', 'organization', _org, 'Workspace created');
  return _org;
end $$;

create or replace function public.create_invitation(_org uuid, _email text, _role public.org_role)
returns text
language plpgsql security definer set search_path = public as $$
declare _token text;
begin
  if not public.is_org_admin(_org) then raise exception 'not authorized' using errcode = '42501'; end if;
  if _role = 'owner' then raise exception 'cannot invite an owner' using errcode = '42501'; end if;
  if _role = 'admin' and not public.is_org_owner(_org) then
    raise exception 'only owners can invite admins' using errcode = '42501';
  end if;
  insert into public.invitations (org_id, email, role, invited_by)
  values (_org, lower(trim(_email)), _role, auth.uid())
  returning token into _token;
  insert into public.activity_logs (org_id, user_id, action, entity_type, summary, metadata)
  values (_org, auth.uid(), 'member.invited', 'invitation', 'Invited ' || lower(trim(_email)) || ' as ' || _role,
          jsonb_build_object('role', _role));
  return _token;
end $$;

create or replace function public.accept_invitation(_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare _inv public.invitations%rowtype; _email text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  _email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into _inv from public.invitations where token = _token for update;
  if not found or _inv.accepted_at is not null or _inv.expires_at < now() then
    raise exception 'invitation is invalid or expired' using errcode = 'P0001';
  end if;
  if lower(_inv.email) <> _email then
    raise exception 'invitation was issued to a different email address' using errcode = '42501';
  end if;
  if exists (select 1 from public.organization_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a workspace' using errcode = 'P0001';
  end if;
  insert into public.organization_members (org_id, user_id, role) values (_inv.org_id, auth.uid(), _inv.role);
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = _inv.id;
  insert into public.activity_logs (org_id, user_id, action, entity_type, summary)
  values (_inv.org_id, auth.uid(), 'member.joined', 'member', 'A new member joined as ' || _inv.role);
  return _inv.org_id;
end $$;

create or replace function public.set_member_role(_org uuid, _user uuid, _role public.org_role)
returns void
language plpgsql security definer set search_path = public as $$
declare _current public.org_role;
begin
  if not public.is_org_owner(_org) then raise exception 'only owners can change roles' using errcode = '42501'; end if;
  if _role = 'owner' then raise exception 'ownership transfer is not supported' using errcode = '42501'; end if;
  select role into _current from public.organization_members where org_id = _org and user_id = _user;
  if _current is null then raise exception 'member not found' using errcode = 'P0001'; end if;
  if _current = 'owner' then raise exception 'the owner role cannot be changed' using errcode = '42501'; end if;
  update public.organization_members set role = _role where org_id = _org and user_id = _user;
  insert into public.activity_logs (org_id, user_id, action, entity_type, entity_id, summary)
  values (_org, auth.uid(), 'member.role_changed', 'member', _user, 'Changed a member role to ' || _role);
end $$;

create or replace function public.remove_member(_org uuid, _user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare _target public.org_role;
begin
  if not public.is_org_admin(_org) then raise exception 'not authorized' using errcode = '42501'; end if;
  select role into _target from public.organization_members where org_id = _org and user_id = _user;
  if _target is null then raise exception 'member not found' using errcode = 'P0001'; end if;
  if _target = 'owner' then raise exception 'the owner cannot be removed' using errcode = '42501'; end if;
  if _target = 'admin' and not public.is_org_owner(_org) then
    raise exception 'only owners can remove admins' using errcode = '42501';
  end if;
  delete from public.organization_members where org_id = _org and user_id = _user;
  insert into public.activity_logs (org_id, user_id, action, entity_type, entity_id, summary)
  values (_org, auth.uid(), 'member.removed', 'member', _user, 'Removed a member from the workspace');
end $$;

-- ---------------------------------------------------------------------------
-- Credits: lazy monthly refresh, atomic debit, refund, plan application
-- ---------------------------------------------------------------------------
create or replace function public.credit_status(_org uuid) returns public.credit_balances
language plpgsql security definer set search_path = public as $$
declare _row public.credit_balances;
begin
  if auth.uid() is null or not public.is_org_member(_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.credit_balances
    set balance = monthly_allocation,
        period_start = now(),
        period_end = now() + interval '1 month'
    where org_id = _org and period_end <= now()
    returning * into _row;
  if found then
    insert into public.credit_usage (org_id, user_id, kind, action, credits, balance_after, description)
    values (_org, null, 'reset', 'monthly_refresh', _row.monthly_allocation, _row.balance,
            'Monthly credit allowance refreshed');
  end if;
  select * into _row from public.credit_balances where org_id = _org;
  return _row;
end $$;

create or replace function public.consume_credits(
  _org uuid, _action text, _credits integer, _description text default null, _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _new integer; _usage uuid;
begin
  if auth.uid() is null or not public.is_org_member(_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _credits is null or _credits <= 0 then raise exception 'invalid credit amount' using errcode = '22023'; end if;
  perform public.credit_status(_org);
  update public.credit_balances
    set balance = balance - _credits
    where org_id = _org and balance >= _credits
    returning balance into _new;
  if not found then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into public.credit_usage (org_id, user_id, kind, action, credits, balance_after, description, metadata)
  values (_org, auth.uid(), 'debit', _action, _credits, _new, _description, coalesce(_metadata, '{}'::jsonb))
  returning id into _usage;
  return jsonb_build_object('usage_id', _usage, 'balance', _new);
end $$;

create or replace function public.refund_credits(_usage uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare _u public.credit_usage%rowtype; _new integer;
begin
  select * into _u from public.credit_usage where id = _usage for update;
  if not found or _u.kind <> 'debit' or _u.refunded then return null; end if;
  if auth.uid() is null or _u.user_id is distinct from auth.uid() or not public.is_org_member(_u.org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.credit_balances
    set balance = least(monthly_allocation, balance + _u.credits)
    where org_id = _u.org_id
    returning balance into _new;
  update public.credit_usage set refunded = true where id = _u.id;
  insert into public.credit_usage (org_id, user_id, kind, action, credits, balance_after, description, metadata)
  values (_u.org_id, auth.uid(), 'refund', _u.action, _u.credits, _new, 'Refund: the operation did not complete',
          jsonb_build_object('refunds', _u.id));
  return _new;
end $$;

-- Service-role only. Called by the billing webhook once a payment provider confirms a payment.
create or replace function public.apply_plan(
  _org uuid, _plan text, _status text, _provider text default null, _reference text default null,
  _period_start timestamptz default null, _period_end timestamptz default null
) returns void
language plpgsql security definer set search_path = public as $$
declare _credits integer; _start timestamptz; _end timestamptz;
begin
  select monthly_credits into _credits from public.plan_catalog where plan = _plan;
  if _credits is null then raise exception 'unknown plan' using errcode = '22023'; end if;
  _start := coalesce(_period_start, now());
  _end := coalesce(_period_end, _start + interval '1 month');
  insert into public.subscriptions (org_id, plan, status, provider, provider_reference, current_period_start, current_period_end)
  values (_org, _plan, _status, _provider, _reference, _start, _end)
  on conflict (org_id) do update
    set plan = excluded.plan, status = excluded.status, provider = excluded.provider,
        provider_reference = excluded.provider_reference,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        updated_at = now();
  insert into public.credit_balances (org_id, plan, monthly_allocation, balance, period_start, period_end)
  values (_org, _plan, _credits, _credits, _start, _end)
  on conflict (org_id) do update
    set plan = excluded.plan, monthly_allocation = excluded.monthly_allocation, balance = excluded.balance,
        period_start = excluded.period_start, period_end = excluded.period_end;
  insert into public.credit_usage (org_id, user_id, kind, action, credits, balance_after, description, metadata)
  values (_org, null, 'grant', 'plan_allocation', _credits, _credits, 'Plan credits applied: ' || _plan,
          jsonb_build_object('plan', _plan, 'status', _status));
  insert into public.activity_logs (org_id, user_id, action, entity_type, summary, metadata)
  values (_org, null, 'subscription.updated', 'subscription', 'Subscription set to ' || _plan || ' (' || _status || ')',
          jsonb_build_object('plan', _plan, 'status', _status));
end $$;

revoke all on function public.apply_plan(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_plan(uuid, text, text, text, text, timestamptz, timestamptz) to service_role;
