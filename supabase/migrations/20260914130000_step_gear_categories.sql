-- Let a roadmap step be tagged with the gear piece it advances, so the
-- Roadmap page can group milestones into sections (weapon progression,
-- armor progression, accessory progression, alchemy stone progression,
-- artifact progression, lifeskill/utility) instead of one flat list.
-- Uncategorized steps (existing rows, and steps that are not about a
-- specific gear piece) keep category=null and render in a general section.
alter table app_private.goal_steps
  add column category text check (category is null or category in ('weapon','armor','accessory','alchemy_stone','artifact','lifeskill','other'));

do $migration$
declare definition text;
  anchor_guard text:=$anchor_guard$    if gl.catalog_version_id is not null then raise exception 'VALIDATION: Guided steps are versioned. Use a custom goal for manual steps.'; end if;$anchor_guard$;
  anchor_insert text:=$anchor_insert$      insert into goal_steps(owner_id,goal_id,title,description,position,dependencies,requirements)
      values(u,gid,trim(d->>'title'),coalesce(d->>'description',''),(select count(*) from goal_steps where goal_id=gid),deps,coalesce(d->'requirements','[]')) returning to_jsonb(goal_steps) into after_doc;$anchor_insert$;
  anchor_update text:=$anchor_update$      update goal_steps set title=trim(d->>'title'),description=coalesce(d->>'description',''),dependencies=deps,requirements=coalesce(d->'requirements','[]') where id=target returning to_jsonb(goal_steps) into after_doc;$anchor_update$;
  anchor_template text:=$anchor_template$        insert into goal_steps(id,owner_id,goal_id,title,description,position,dependencies,requirements,template_key,claim_key,reward,status)
        values((keymap->>(st->>'key'))::uuid,u,gid,st->>'title',coalesce(st->>'description',''),pos,deps,requirements,st->>'key',st->>'claim_key',st->'reward',
        case when exists(select 1 from family_claims where game_profile_id=gp and claim_key=st->>'claim_key') then 'completed' else 'pending' end);$anchor_template$;
begin
  definition:=pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure);
  if position(anchor_guard in definition)=0 then raise exception 'Unexpected step_save guided-goal guard in companion_command'; end if;
  if position(anchor_insert in definition)=0 then raise exception 'Unexpected step_save insert in companion_command'; end if;
  if position(anchor_update in definition)=0 then raise exception 'Unexpected step_save update in companion_command'; end if;
  if position(anchor_template in definition)=0 then raise exception 'Unexpected guided-step insert in companion_command'; end if;
  definition:=replace(definition,anchor_guard,anchor_guard||$repl_guard$
    if nullif(d->>'category','') is not null and d->>'category' not in ('weapon','armor','accessory','alchemy_stone','artifact','lifeskill','other') then raise exception 'VALIDATION: Invalid step category.'; end if;$repl_guard$);
  definition:=replace(definition,anchor_insert,$repl_insert$      insert into goal_steps(owner_id,goal_id,title,description,position,dependencies,requirements,category)
      values(u,gid,trim(d->>'title'),coalesce(d->>'description',''),(select count(*) from goal_steps where goal_id=gid),deps,coalesce(d->'requirements','[]'),nullif(d->>'category','')) returning to_jsonb(goal_steps) into after_doc;$repl_insert$);
  definition:=replace(definition,anchor_update,$repl_update$      update goal_steps set title=trim(d->>'title'),description=coalesce(d->>'description',''),dependencies=deps,requirements=coalesce(d->'requirements','[]'),category=nullif(d->>'category','') where id=target returning to_jsonb(goal_steps) into after_doc;$repl_update$);
  definition:=replace(definition,anchor_template,$repl_template$        insert into goal_steps(id,owner_id,goal_id,title,description,position,dependencies,requirements,template_key,claim_key,reward,status,category)
        values((keymap->>(st->>'key'))::uuid,u,gid,st->>'title',coalesce(st->>'description',''),pos,deps,requirements,st->>'key',st->>'claim_key',st->'reward',
        case when exists(select 1 from family_claims where game_profile_id=gp and claim_key=st->>'claim_key') then 'completed' else 'pending' end,nullif(st->>'category',''));$repl_template$);
  execute definition;
end $migration$;

-- Guided-catalog migrations (companion_migrate_goal) also carry the
-- template's category forward, and refresh it on an already-created step
-- so a catalog correction can retag a step's section.
create or replace function public.companion_migrate_goal(command jsonb) returns jsonb language plpgsql security definer
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
    insert into goal_steps(id,owner_id,goal_id,title,description,position,dependencies,requirements,template_key,claim_key,reward,category)
    values((keymap->>(st->>'key'))::uuid,u,g.id,st->>'title',coalesce(st->>'description',''),pos,deps,requirements,st->>'key',st->>'claim_key',st->'reward',nullif(st->>'category',''))
    on conflict(id) do update set title=excluded.title,description=excluded.description,position=excluded.position,dependencies=excluded.dependencies,requirements=excluded.requirements,claim_key=excluded.claim_key,reward=excluded.reward,category=excluded.category where goal_steps.status='pending';
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
revoke all on function public.companion_migrate_goal(jsonb) from public,anon;
grant execute on function public.companion_migrate_goal(jsonb) to authenticated;
