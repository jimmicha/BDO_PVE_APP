create function app_private.validate_catalog(doc jsonb) returns void language plpgsql
set search_path=pg_catalog,app_private as $$
declare x jsonb; r jsonb; dep text; keys text[];
begin
  if jsonb_typeof(doc->'steps') is distinct from 'array' or jsonb_typeof(doc->'items') is distinct from 'array' or jsonb_typeof(doc->'resources') is distinct from 'array' then raise exception 'VALIDATION: Catalog requires steps, items and resources arrays.'; end if;
  if jsonb_array_length(doc->'steps') not between 1 and 100 then raise exception 'VALIDATION: Catalog must contain 1–100 steps.'; end if;
  foreach dep in array array['steps','items','resources'] loop
    if exists(select 1 from jsonb_array_elements(doc->dep) v where length(trim(coalesce(v->>'key','')))=0) or
      (select count(*) from jsonb_array_elements(doc->dep))<>(select count(distinct v->>'key') from jsonb_array_elements(doc->dep) v) then raise exception 'VALIDATION: Catalog keys must be present and unique.'; end if;
  end loop;
  keys:='{}';
  for x in select * from jsonb_array_elements(doc->'items') loop
    if length(trim(coalesce(x->>'name','')))=0 or jsonb_typeof(x->'enhancements') is distinct from 'array' or jsonb_typeof(x->'slots') is distinct from 'array' then raise exception 'VALIDATION: Invalid catalog equipment.'; end if;
    for r in select * from jsonb_array_elements(x->'enhancements') loop
      if (r#>>'{}')::integer not between 0 and 25 then raise exception 'VALIDATION: Invalid enhancement.'; end if;
    end loop;
  end loop;
  for x in select * from jsonb_array_elements(doc->'steps') loop
    if length(trim(coalesce(x->>'title','')))=0 then raise exception 'VALIDATION: Every step needs a title.'; end if;
    for dep in select * from jsonb_array_elements_text(coalesce(x->'dependencies','[]')) loop
      if not dep=any(keys) then raise exception 'DEPENDENCY_CYCLE: Catalog prerequisites must exist earlier in the step list.'; end if;
    end loop;
    keys:=array_append(keys,x->>'key');
    for r in select * from jsonb_array_elements(coalesce(x->'requirements','[]')) loop
      if app_private.quantity(r->>'quantity')<1 or not exists(select 1 from jsonb_array_elements(doc->'resources') v where v->>'key'=r->>'resource_key') then raise exception 'VALIDATION: Invalid catalog resource requirement.'; end if;
    end loop;
    if x->'reward' is not null and x->'reward'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(doc->'items') i where i->>'key'=x->'reward'->>'item_key' and i->'enhancements' @> jsonb_build_array((x->'reward'->>'enhancement')::integer)) then raise exception 'VALIDATION: Invalid reward.'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null)<>(select count(distinct v->>'claim_key') from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null) then raise exception 'VALIDATION: Claim keys must be unique.'; end if;
end $$;

create function public.companion_catalog(command jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.actor(); c catalog_versions%rowtype; d jsonb:=command->'data'; op text:=command->>'kind'; next_status text; current_rev integer; req uuid:=(command->>'request_id')::uuid; old_hash text;
begin
  if req is null or jsonb_typeof(d) is distinct from 'object' or octet_length(command::text)>262144 then raise exception 'VALIDATION: Invalid catalog command.'; end if;
  if not app_private.is_admin(u) then raise exception 'FORBIDDEN: Catalog administration requires an administrator.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(7918461);
  select revision into current_rev from profiles where id=u for update;
  select payload_hash into old_hash from mutation_receipts where owner_id=u and request_id=req;
  if old_hash is not null then
    if old_hash<>md5(command::text) then raise exception 'IDEMPOTENCY_REUSED'; end if;
    return public.companion_snapshot();
  end if;
  if (command->>'expected_revision')::integer is distinct from current_rev then raise exception 'CONFLICT: Reload before changing the catalog.' using errcode='40001'; end if;
  if op='catalog_create' then
    select * into c from catalog_versions where id=(d->>'id')::uuid;
    if c.id is null then raise exception 'NOT_FOUND: Catalog not found.'; end if;
    insert into catalog_versions(version,title,status,content,sources,effective_patch)
      values((select coalesce(max(version),0)+1 from catalog_versions),c.title,'draft',c.content,c.sources,c.effective_patch);
  elsif op='catalog_save' then
    perform app_private.validate_catalog(d->'content');
    update catalog_versions set title=d->>'title',content=d->'content',sources=d->'sources',checked_at=(d->>'checked_at')::date,valid_until=(d->>'valid_until')::date,effective_patch=d->>'effective_patch' where id=(d->>'id')::uuid and status='draft' returning * into c;
    if c.id is null then raise exception 'VALIDATION: Only draft versions can be edited.'; end if;
  elsif op='catalog_transition' then
    select * into c from catalog_versions where id=(d->>'id')::uuid for update;
    next_status:=d->>'status';
    if c.id is null then raise exception 'NOT_FOUND: Catalog not found.'; end if;
    if not ((c.status='draft' and next_status='review') or (c.status='review' and next_status in ('draft','published')) or (c.status='retired' and next_status='published')) then raise exception 'VALIDATION: Invalid catalog transition.'; end if;
    perform app_private.validate_catalog(c.content);
    if next_status in ('review','published') and (c.checked_at is null or c.checked_at>current_date or c.valid_until is null or c.valid_until<current_date or length(c.effective_patch)=0 or jsonb_array_length(c.sources)<2 or not exists(select 1 from jsonb_array_elements(c.sources) v where v->>'url' like 'https://support.pearlabyss.com/blackdesert_naeu/%' or v->>'url' like 'https://www.naeu.playblackdesert.com/%')) then raise exception 'CATALOG_REVIEW: Supply current dates, a live patch reference and two sources including official NA/EU evidence.'; end if;
    if next_status='published' then update catalog_versions set status='retired' where status='published'; end if;
    update catalog_versions set status=next_status where id=c.id;
  else raise exception 'VALIDATION: Unknown catalog action.'; end if;
  update profiles set revision=revision+1 where id=u;
  insert into mutation_receipts(owner_id,request_id,payload_hash) values(u,req,md5(command::text));
  insert into progress_events(owner_id,kind,description,after_state,request_id) values(u,op,'Catalog: '||op,d,req);
  return public.companion_snapshot();
end $$;

create function public.companion_migrate_goal(command jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.actor(); d jsonb:=command->'data'; g goals%rowtype; c catalog_versions%rowtype;
  rev integer; req uuid:=(command->>'request_id')::uuid; old_hash text; st jsonb; obj jsonb; keymap jsonb:='{}'; deps uuid[]; requirements jsonb; rid uuid; pos integer:=0;
begin
  if req is null or jsonb_typeof(d) is distinct from 'object' or octet_length(command::text)>262144 then raise exception 'VALIDATION: Invalid migration command.'; end if;
  select revision into rev from profiles where id=u for update;
  select payload_hash into old_hash from mutation_receipts where owner_id=u and request_id=req;
  if old_hash is not null then
    if old_hash<>md5(command::text) then raise exception 'IDEMPOTENCY_REUSED'; end if;
    return public.companion_snapshot();
  end if;
  if (command->>'expected_revision')::integer is distinct from rev then raise exception 'CONFLICT: Review the latest state before migrating.' using errcode='40001'; end if;
  select * into g from goals where id=(d->>'id')::uuid and owner_id=u;
  select * into c from catalog_versions where id=(d->>'catalog_version_id')::uuid and status='published' and valid_until>=current_date;
  if g.id is null or g.catalog_version_id is null or c.id is null then raise exception 'NOT_FOUND: Compatible goal or catalog not found.'; end if;
  -- Keep existing template identities and completion evidence; removing completed steps is never implicit.
  if exists(select 1 from goal_steps s where s.goal_id=g.id and not exists(select 1 from jsonb_array_elements(c.content->'steps') v where v->>'key'=s.template_key)) then raise exception 'MIGRATION_REVIEW: This version removes existing steps. Keep this plan and create a new goal instead.'; end if;
  for obj in select * from jsonb_array_elements(c.content->'resources') loop
    insert into resource_balances(owner_id,game_profile_id,name,item_key) values(u,g.game_profile_id,obj->>'name',obj->>'key') on conflict(game_profile_id,item_key) do nothing;
  end loop;
  for st in select * from jsonb_array_elements(c.content->'steps') loop
    select id into rid from goal_steps where goal_id=g.id and template_key=st->>'key';
    keymap:=keymap||jsonb_build_object(st->>'key',coalesce(rid,gen_random_uuid()));
  end loop;
  for st in select * from jsonb_array_elements(c.content->'steps') loop
    requirements:='[]'; deps:='{}';
    for obj in select * from jsonb_array_elements(coalesce(st->'requirements','[]')) loop
      select id into rid from resource_balances where owner_id=u and game_profile_id=g.game_profile_id and item_key=obj->>'resource_key';
      requirements:=requirements||jsonb_build_array(jsonb_build_object('resource_id',rid,'quantity',obj->>'quantity'));
    end loop;
    for obj in select * from jsonb_array_elements(coalesce(st->'dependencies','[]')) loop deps:=array_append(deps,(keymap->>(obj#>>'{}'))::uuid); end loop;
    insert into goal_steps(id,owner_id,goal_id,title,description,position,dependencies,requirements,template_key,claim_key,reward)
    values((keymap->>(st->>'key'))::uuid,u,g.id,st->>'title',coalesce(st->>'description',''),pos,deps,requirements,st->>'key',st->>'claim_key',st->'reward')
    on conflict(id) do update set title=excluded.title,description=excluded.description,position=excluded.position,dependencies=excluded.dependencies,requirements=excluded.requirements,claim_key=excluded.claim_key,reward=excluded.reward where goal_steps.status='pending';
    pos:=pos+1;
  end loop;
  perform app_private.validate_steps(g.id,u);
  update goals set catalog_version_id=c.id where id=g.id;
  update profiles set revision=revision+1 where id=u;
  insert into mutation_receipts(owner_id,request_id,payload_hash) values(u,req,md5(command::text));
  insert into progress_events(owner_id,game_profile_id,kind,description,before_state,after_state,request_id)
  values(u,g.game_profile_id,'goal_migrate','Migrated roadmap to catalog '||c.version,to_jsonb(g),jsonb_build_object('catalog_version_id',c.id),req);
  return public.companion_snapshot();
end $$;
revoke all on function app_private.validate_catalog(jsonb) from public,anon,authenticated;
revoke all on function public.companion_catalog(jsonb),public.companion_migrate_goal(jsonb) from public,anon;
grant execute on function public.companion_catalog(jsonb),public.companion_migrate_goal(jsonb) to authenticated;
