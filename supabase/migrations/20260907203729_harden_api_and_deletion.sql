-- Keep privileged implementations outside the exposed Data API schema.
-- Public entry points run as the caller and have no direct table privileges.
grant usage on schema app_private to authenticated, supabase_auth_admin, service_role;
revoke all on all tables in schema app_private from public, anon, authenticated;
alter function app_private.quantity(text) set search_path=pg_catalog;

do $$
declare fname text; signature text; args text; call_args text;
begin
  foreach fname in array array['companion_snapshot','companion_command','companion_export','companion_request_deletion','companion_catalog','companion_migrate_goal'] loop
    args:=case when fname in ('companion_command','companion_catalog','companion_migrate_goal') then 'command jsonb' else '' end;
    signature:=case when args<>'' then 'jsonb' else '' end;
    call_args:=case when args<>'' then 'command' else '' end;
    execute format('alter function public.%I(%s) set schema app_private',fname,signature);
    execute format('create function public.%I(%s) returns jsonb language sql security invoker set search_path=pg_catalog as %L',fname,args,format('select app_private.%I(%s)',fname,call_args));
    execute format('revoke all on function public.%I(%s) from public,anon',fname,signature);
    execute format('grant execute on function public.%I(%s) to authenticated',fname,signature);
    execute format('revoke all on function app_private.%I(%s) from public,anon',fname,signature);
    execute format('grant execute on function app_private.%I(%s) to authenticated',fname,signature);
  end loop;
end $$;
alter function public.before_user_created(jsonb) set schema app_private;
create function public.before_user_created(event jsonb) returns jsonb language sql security invoker
set search_path=pg_catalog as $$ select app_private.before_user_created(event) $$;
revoke all on function public.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.before_user_created(jsonb),app_private.before_user_created(jsonb) to supabase_auth_admin;

-- The Edge Function calls this only after Supabase Auth has removed the user.
create function app_private.finish_deletion(subject uuid) returns void language plpgsql security definer
set search_path=pg_catalog,app_private as $$
begin
  if exists(select 1 from auth.users where id=subject) then raise exception 'AUTH_ACCOUNT_PRESENT'; end if;
  update deletion_requests set completed_at=coalesce(completed_at,now()) where user_id=subject;
end $$;
create function public.companion_finish_deletion(subject uuid) returns void language sql security invoker
set search_path=pg_catalog as $$ select app_private.finish_deletion(subject) $$;
revoke all on function app_private.finish_deletion(uuid),public.companion_finish_deletion(uuid) from public,anon,authenticated;
grant execute on function app_private.finish_deletion(uuid),public.companion_finish_deletion(uuid) to service_role;

-- Used by a server-side scheduled recovery job if Auth was temporarily unavailable.
create function app_private.pending_deletions() returns jsonb language sql security definer
set search_path=pg_catalog,app_private as $$
select coalesce(jsonb_agg(user_id),'[]') from deletion_requests where completed_at is null
$$;
create function public.companion_pending_deletions() returns jsonb language sql security invoker
set search_path=pg_catalog as $$ select app_private.pending_deletions() $$;
revoke all on function app_private.pending_deletions(),public.companion_pending_deletions() from public,anon,authenticated;
grant execute on function app_private.pending_deletions(),public.companion_pending_deletions() to service_role;

-- Ownership reads and cascading account deletion use these indexes.
create index characters_owner on app_private.characters(owner_id);
create index equipment_owner on app_private.equipment_instances(owner_id);
create index equipment_family_owner on app_private.equipment_instances(game_profile_id,owner_id);
create index equipment_catalog on app_private.equipment_instances(catalog_version_id);
create index balances_owner on app_private.resource_balances(owner_id);
create index goals_owner on app_private.goals(owner_id,priority,created_at);
create index goals_family_owner on app_private.goals(game_profile_id,owner_id);
create index goals_character_owner on app_private.goals(character_id,owner_id);
create index goals_catalog on app_private.goals(catalog_version_id);
create index steps_owner on app_private.goal_steps(owner_id);
create index allocations_owner on app_private.resource_allocations(owner_id);
create index allocations_resource_owner on app_private.resource_allocations(resource_id,owner_id);
create index claims_owner on app_private.family_claims(owner_id);

do $$
declare t text;
begin
  foreach t in array array['profiles','game_profiles','characters','equipment_instances','resource_balances','goals','goal_steps','resource_allocations','family_claims','progress_events','mutation_receipts'] loop
    execute format('alter policy owner_only on app_private.%I to authenticated using (%I=(select auth.uid())) with check (%I=(select auth.uid()))',t,case when t='profiles' then 'id' else 'owner_id' end,case when t='profiles' then 'id' else 'owner_id' end);
  end loop;
end $$;
alter table app_private.profiles add constraint preferences_object check(jsonb_typeof(preferences)='object');
alter table app_private.catalog_versions add constraint catalog_sources_array check(jsonb_typeof(sources)='array');
