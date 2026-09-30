-- SecureShield AI — Row Level Security.
-- Isolation is enforced here, in the database. The application never relies on UI checks alone.
--
-- Permission model
--   member : read every record in the workspace; create and edit accounts, leads, opportunities,
--            activities, conversations, actions; run AI features (credits permitting).
--   admin  : everything a member can do, plus delete records, bulk-import data, manage members
--            (invite/remove members), edit workspace details.
--   owner  : everything an admin can do, plus invite/remove admins and change member roles.
--            Subscription and credit state is written only by the service role (billing webhook).

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_usage enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.activities enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_analyses enable row level security;
alter table public.briefings enable row level security;
alter table public.actions enable row level security;
alter table public.insights enable row level security;
alter table public.reports enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.data_imports enable row level security;
alter table public.activity_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Organizations and membership
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- Members are listed to fellow members. Changes go through the security-definer RPCs only.
drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_org_admin(org_id));
drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.is_org_admin(org_id) and accepted_at is null);

-- ---------------------------------------------------------------------------
-- Plans, subscriptions, credits (read-only for users; written by RPCs / service role)
-- ---------------------------------------------------------------------------
drop policy if exists plan_catalog_select on public.plan_catalog;
create policy plan_catalog_select on public.plan_catalog for select to authenticated using (true);

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists credit_balances_select on public.credit_balances;
create policy credit_balances_select on public.credit_balances for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists credit_usage_select on public.credit_usage;
create policy credit_usage_select on public.credit_usage for select to authenticated
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Workspace data: members read/create/update, admins delete
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['accounts', 'contacts', 'leads', 'opportunities', 'conversations',
                           'conversation_analyses', 'actions']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_org_member(org_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_org_member(org_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_org_admin(org_id))', t);
  end loop;
end $$;

-- Stage history is written by a trigger; readable by members.
drop policy if exists stage_history_select on public.opportunity_stage_history;
create policy stage_history_select on public.opportunity_stage_history for select to authenticated
  using (public.is_org_member(org_id));

-- Activities: members create; the author or an admin edits; admins delete.
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated
  with check (public.is_org_member(org_id));
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update to authenticated
  using (public.is_org_member(org_id) and (created_by = auth.uid() or public.is_org_admin(org_id)))
  with check (public.is_org_member(org_id));
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete to authenticated
  using (public.is_org_admin(org_id));

-- Briefings and reports: members read and generate; admins delete.
drop policy if exists briefings_select on public.briefings;
create policy briefings_select on public.briefings for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists briefings_insert on public.briefings;
create policy briefings_insert on public.briefings for insert to authenticated
  with check (public.is_org_member(org_id));
drop policy if exists briefings_delete on public.briefings;
create policy briefings_delete on public.briefings for delete to authenticated
  using (public.is_org_admin(org_id));

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (public.is_org_member(org_id));
drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete to authenticated
  using (public.is_org_admin(org_id));

-- Insights are derived from workspace data and can be regenerated by any member.
drop policy if exists insights_select on public.insights;
create policy insights_select on public.insights for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists insights_insert on public.insights;
create policy insights_insert on public.insights for insert to authenticated
  with check (public.is_org_member(org_id));
drop policy if exists insights_delete on public.insights;
create policy insights_delete on public.insights for delete to authenticated
  using (public.is_org_member(org_id));

-- Assistant history is private to the user who asked.
drop policy if exists assistant_messages_select on public.assistant_messages;
create policy assistant_messages_select on public.assistant_messages for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists assistant_messages_insert on public.assistant_messages;
create policy assistant_messages_insert on public.assistant_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(org_id));

-- Import log entries can be written by any member who can create records.
drop policy if exists data_imports_select on public.data_imports;
create policy data_imports_select on public.data_imports for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists data_imports_insert on public.data_imports;
create policy data_imports_insert on public.data_imports for insert to authenticated
  with check (public.is_org_member(org_id));

-- Activity log is append-only for users (no update/delete policies).
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs for insert to authenticated
  with check (public.is_org_member(org_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Function privileges: RPCs are for signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
revoke execute on function public.create_invitation(uuid, text, public.org_role) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
revoke execute on function public.set_member_role(uuid, uuid, public.org_role) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, public.org_role) to authenticated;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
revoke execute on function public.credit_status(uuid) from public, anon;
grant execute on function public.credit_status(uuid) to authenticated;
revoke execute on function public.consume_credits(uuid, text, integer, text, jsonb) from public, anon;
grant execute on function public.consume_credits(uuid, text, integer, text, jsonb) to authenticated;
revoke execute on function public.refund_credits(uuid) from public, anon;
grant execute on function public.refund_credits(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for call recordings, scoped by org id in the object path
--   object path: <org_id>/<conversation_id>/<file name>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('conversation-files', 'conversation-files', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists conversation_files_select on storage.objects;
create policy conversation_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'conversation-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists conversation_files_insert on storage.objects;
create policy conversation_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'conversation-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists conversation_files_delete on storage.objects;
create policy conversation_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'conversation-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
