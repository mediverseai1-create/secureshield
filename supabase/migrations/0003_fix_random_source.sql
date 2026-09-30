-- Supabase keeps pgcrypto in the `extensions` schema, which functions with search_path=public cannot see.
-- Use gen_random_uuid() (built in) for slugs and invitation tokens instead.
alter table public.invitations alter column token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

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

revoke execute on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
