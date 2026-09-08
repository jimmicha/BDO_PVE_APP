-- Private tables are deliberately outside PostgREST's exposed schemas.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.beta_members (
  email text primary key check (email = lower(email)),
  active boolean not null default true,
  role text not null default 'tester' check(role in ('tester','admin'))
);
create table app_private.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer' check(length(display_name) between 1 and 80),
  locale text not null default 'en',
  timezone text not null default 'UTC',
  preferences jsonb not null default '{}',
  revision integer not null default 0,
  created_at timestamptz not null default now()
);
create table app_private.game_profiles (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  family_name text not null check(length(trim(family_name)) between 1 and 60),
  platform text not null default 'PC' check(platform='PC'),
  region text not null check(region in ('NA','EU')), created_at timestamptz not null default now(),
  unique(id,owner_id), unique(owner_id,region)
);
create table app_private.characters (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  game_profile_id uuid not null, name text not null check(length(trim(name)) between 1 and 60),
  class_name text not null check(length(trim(class_name)) between 1 and 60),
  level integer not null check(level between 1 and 100), playstyle text not null default 'PvE' check(length(playstyle)<=80),
  notes text not null default '' check(length(notes)<=2000), created_at timestamptz not null default now(),
  foreign key(game_profile_id,owner_id) references app_private.game_profiles(id,owner_id) on delete cascade,
  unique(id,owner_id), unique(game_profile_id,name)
);
create table app_private.catalog_versions (
  id uuid primary key default gen_random_uuid(), version integer not null unique check(version>0),
  title text not null, status text not null check(status in ('draft','review','published','retired')),
  content jsonb not null, sources jsonb not null default '[]', checked_at date, valid_until date,
  effective_patch text not null default '', created_at timestamptz not null default now()
);
create unique index one_published_catalog on app_private.catalog_versions(status) where status='published';
create table app_private.equipment_instances (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  game_profile_id uuid not null, character_id uuid, slot text,
  name text not null check(length(trim(name)) between 1 and 120),
  catalog_version_id uuid references app_private.catalog_versions, item_key text,
  enhancement integer not null default 0 check(enhancement between 0 and 25),
  reform integer not null default 0 check(reform between 0 and 5),
  caphras integer not null default 0 check(caphras between 0 and 20),
  notes text not null default '' check(length(notes)<=2000),
  foreign key(game_profile_id,owner_id) references app_private.game_profiles(id,owner_id) on delete cascade,
  foreign key(character_id,owner_id) references app_private.characters(id,owner_id),
  check((character_id is null and slot is null) or (character_id is not null and slot is not null)),
  check(slot is null or slot in ('main_hand','awakening','off_hand','helmet','armor','gloves','shoes','necklace','belt','ring_1','ring_2','earring_1','earring_2','alchemy_stone')),
  check((catalog_version_id is null) = (item_key is null)),
  unique(character_id,slot), unique(id,owner_id)
);
create table app_private.resource_balances (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  game_profile_id uuid not null, name text not null check(length(trim(name)) between 1 and 120),
  item_key text, quantity bigint not null default 0 check(quantity>=0), unit text not null default 'items' check(unit in ('items','silver')),
  foreign key(game_profile_id,owner_id) references app_private.game_profiles(id,owner_id) on delete cascade,
  unique(game_profile_id,item_key), unique(id,owner_id)
);
create table app_private.goals (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  game_profile_id uuid not null, character_id uuid, title text not null check(length(trim(title)) between 1 and 120),
  description text not null default '' check(length(description)<=3000),
  priority integer not null default 1 check(priority between 1 and 3),
  status text not null default 'active' check(status in ('active','paused','completed','archived')),
  catalog_version_id uuid references app_private.catalog_versions,
  created_at timestamptz not null default now(),
  foreign key(game_profile_id,owner_id) references app_private.game_profiles(id,owner_id) on delete cascade,
  foreign key(character_id,owner_id) references app_private.characters(id,owner_id),
  unique(id,owner_id)
);
create table app_private.goal_steps (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  goal_id uuid not null, title text not null check(length(trim(title)) between 1 and 160),
  description text not null default '' check(length(description)<=3000), position integer not null default 0,
  status text not null default 'pending' check(status in ('pending','completed')),
  dependencies uuid[] not null default '{}', requirements jsonb not null default '[]',
  template_key text, claim_key text, reward jsonb,
  foreign key(goal_id,owner_id) references app_private.goals(id,owner_id) on delete cascade,
  unique(id,owner_id), unique(goal_id,template_key)
);
create table app_private.resource_allocations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  goal_id uuid not null, resource_id uuid not null, quantity bigint not null check(quantity>0),
  foreign key(goal_id,owner_id) references app_private.goals(id,owner_id) on delete cascade,
  foreign key(resource_id,owner_id) references app_private.resource_balances(id,owner_id) on delete cascade,
  unique(goal_id,resource_id)
);
create table app_private.family_claims (
  owner_id uuid not null references app_private.profiles on delete cascade, game_profile_id uuid not null,
  claim_key text not null, claimed_at timestamptz not null default now(),
  foreign key(game_profile_id,owner_id) references app_private.game_profiles(id,owner_id) on delete cascade,
  primary key(game_profile_id,claim_key)
);
create table app_private.progress_events (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.profiles on delete cascade,
  game_profile_id uuid, kind text not null, description text not null,
  before_state jsonb, after_state jsonb, request_id uuid not null,
  created_at timestamptz not null default now()
);
create index progress_owner_time on app_private.progress_events(owner_id,created_at desc);
create table app_private.mutation_receipts (
  owner_id uuid not null references app_private.profiles on delete cascade, request_id uuid not null,
  payload_hash text not null, created_at timestamptz not null default now(), primary key(owner_id,request_id)
);
-- This ledger contains identifiers only. Its independent backup must be replayed after a restore.
create table app_private.deletion_requests (
  user_id uuid primary key, requested_at timestamptz not null default now(), completed_at timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['profiles','game_profiles','characters','equipment_instances','resource_balances','goals','goal_steps','resource_allocations','family_claims','progress_events','mutation_receipts'] loop
    execute format('alter table app_private.%I enable row level security',t);
    execute format('create policy owner_only on app_private.%I using (%I = auth.uid()) with check (%I = auth.uid())',t,case when t='profiles' then 'id' else 'owner_id' end,case when t='profiles' then 'id' else 'owner_id' end);
  end loop;
  foreach t in array array['beta_members','catalog_versions','deletion_requests'] loop
    execute format('alter table app_private.%I enable row level security',t);
  end loop;
end $$;

create function app_private.actor() returns uuid language plpgsql security definer
set search_path = pg_catalog, app_private as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED: Sign in to continue.' using errcode='28000'; end if;
  if exists(select 1 from deletion_requests where user_id=u) then raise exception 'ACCOUNT_DELETING: Account deletion is in progress.'; end if;
  if not exists(select 1 from auth.users a join beta_members b on b.email=lower(a.email) where a.id=u and a.email_confirmed_at is not null and b.active) then
    raise exception 'BETA_ACCESS: This verified email is not on the beta list.' using errcode='42501';
  end if;
  insert into profiles(id) values(u) on conflict do nothing;
  return u;
end $$;

create function app_private.is_admin(u uuid) returns boolean language sql security definer
set search_path = pg_catalog, app_private as $$
  select exists(select 1 from auth.users a join beta_members b on b.email=lower(a.email) where a.id=u and b.active and b.role='admin');
$$;

create function public.before_user_created(event jsonb) returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private as $$
begin
  if not exists(select 1 from beta_members where email=lower(event->'user'->>'email') and active) then
    return '{"error":{"http_code":403,"message":"This beta is invitation-only. Ask the app owner to add your email."}}'::jsonb;
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

create function public.companion_snapshot() returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private as $$
declare u uuid := app_private.actor(); result jsonb;
begin
  select jsonb_build_object(
    'profile',to_jsonb(p),'is_admin',app_private.is_admin(u),
    'game_profiles',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from game_profiles x where owner_id=u),'[]'),
    'characters',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from characters x where owner_id=u),'[]'),
    'equipment',coalesce((select jsonb_agg(to_jsonb(x)) from equipment_instances x where owner_id=u),'[]'),
    'resources',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('quantity',x.quantity::text) order by x.name) from resource_balances x where owner_id=u),'[]'),
    'goals',coalesce((select jsonb_agg(to_jsonb(x) order by x.priority,x.created_at) from goals x where owner_id=u),'[]'),
    'steps',coalesce((select jsonb_agg(to_jsonb(x) order by x.position,x.id) from goal_steps x where owner_id=u),'[]'),
    'allocations',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('quantity',x.quantity::text)) from resource_allocations x where owner_id=u),'[]'),
    'claims',coalesce((select jsonb_agg(to_jsonb(x)) from family_claims x where owner_id=u),'[]'),
    'events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from (select * from progress_events where owner_id=u order by created_at desc,id limit 200) x),'[]'),
    'catalogs',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from catalog_versions x where status='published' or app_private.is_admin(u) or id in (select catalog_version_id from goals where owner_id=u) or id in (select catalog_version_id from equipment_instances where owner_id=u)),'[]')
  ) into result from profiles p where id=u;
  return result;
end $$;

create function app_private.quantity(value text) returns bigint language plpgsql immutable as $$
begin
  if value is null or value !~ '^[0-9]{1,19}$' then raise exception 'VALIDATION: Enter a whole nonnegative quantity.'; end if;
  return value::bigint;
exception when numeric_value_out_of_range then raise exception 'VALIDATION: Quantity exceeds the supported integer range.';
end $$;

create function app_private.validate_steps(g uuid,u uuid) returns void language plpgsql
set search_path = pg_catalog, app_private as $$
declare s record; r jsonb; rid uuid; visited integer; total integer;
begin
  for s in select * from goal_steps where goal_id=g and owner_id=u loop
    if exists(select 1 from unnest(s.dependencies) dep where not exists(select 1 from goal_steps where id=dep and goal_id=g and owner_id=u) or dep=s.id) then raise exception 'VALIDATION: Prerequisites must be other steps in this goal.'; end if;
    if jsonb_typeof(s.requirements)<>'array' or jsonb_array_length(s.requirements)>50 then raise exception 'VALIDATION: Invalid resource requirements.'; end if;
    if (select count(*) from jsonb_array_elements(s.requirements)) <> (select count(distinct value->>'resource_id') from jsonb_array_elements(s.requirements)) then raise exception 'VALIDATION: A resource may appear only once per step.'; end if;
    for r in select * from jsonb_array_elements(s.requirements) loop
      rid := (r->>'resource_id')::uuid;
      if app_private.quantity(r->>'quantity')<=0 then raise exception 'VALIDATION: Requirements must be positive.'; end if;
      if not exists(select 1 from resource_balances b join goals gl on gl.game_profile_id=b.game_profile_id where gl.id=g and b.id=rid and b.owner_id=u) then raise exception 'NOT_FOUND: Resource is not in this family.'; end if;
    end loop;
  end loop;
  if exists(
    with recursive walk as (
      select id, unnest(dependencies) dep, array[id] path, false cycle from goal_steps where goal_id=g
      union all
      select w.id, d, w.path||gs.id, gs.id=any(w.path) from walk w join goal_steps gs on gs.id=w.dep cross join unnest(gs.dependencies) d where not w.cycle
    ) select 1 from walk where cycle or dep=any(path)
  ) then raise exception 'DEPENDENCY_CYCLE: These prerequisites create a cycle.'; end if;
end $$;

-- A single locked account revision serializes writes across every device and family.
create function public.companion_command(command jsonb) returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private as $$
declare
  u uuid := app_private.actor(); rev integer; req uuid := (command->>'request_id')::uuid;
  kind text := command->>'kind'; d jsonb := command->'data'; fingerprint text := md5(command::text); prior text;
  target uuid; gp uuid; ch uuid; gid uuid; cid uuid; sid uuid; ver uuid; r_id uuid; dep uuid;
  qty bigint; reserved numeric; current_qty bigint; delta bigint;
  before_doc jsonb; after_doc jsonb; label text := ''; s goal_steps%rowtype; gl goals%rowtype; cv catalog_versions%rowtype;
  obj jsonb; itm jsonb; st jsonb; keymap jsonb; requirements jsonb; deps uuid[]; pos integer; affected uuid[];
begin
  if req is null or kind is null or jsonb_typeof(d) is distinct from 'object' or octet_length(command::text)>262144 then raise exception 'VALIDATION: Invalid command.'; end if;
  select revision into rev from profiles where id=u for update;
  select payload_hash into prior from mutation_receipts where owner_id=u and request_id=req;
  if prior is not null then
    if prior<>fingerprint then raise exception 'IDEMPOTENCY_REUSED: This request ID belongs to a different change.'; end if;
    return public.companion_snapshot();
  end if;
  if (command->>'expected_revision')::integer is distinct from rev then raise exception 'CONFLICT: Newer changes were saved on another device. Reload and review your change.' using errcode='40001'; end if;
  target := nullif(d->>'id','')::uuid;
  gp := nullif(d->>'game_profile_id','')::uuid;
  ch := nullif(d->>'character_id','')::uuid;
  if gp is not null and not exists(select 1 from game_profiles where id=gp and owner_id=u) then raise exception 'NOT_FOUND: Family not found.'; end if;
  if ch is not null then
    if not exists(select 1 from characters where id=ch and owner_id=u and (gp is null or game_profile_id=gp)) then raise exception 'NOT_FOUND: Character not found in this family.'; end if;
  end if;
  case kind
  when 'profile_update' then
    select to_jsonb(p) into before_doc from profiles p where id=u;
    update profiles set display_name=trim(d->>'display_name'), timezone=coalesce(d->>'timezone','UTC'), preferences=coalesce(d->'preferences','{}') where id=u returning to_jsonb(profiles) into after_doc;
    label := 'Updated account preferences';
  when 'family_create' then
    insert into game_profiles(owner_id,family_name,region) values(u,trim(d->>'family_name'),d->>'region') returning id,to_jsonb(game_profiles) into gp,after_doc;
    insert into resource_balances(owner_id,game_profile_id,name,item_key,unit) values(u,gp,'Silver','silver','silver');
    label := 'Created family '||(d->>'family_name');
  when 'family_update' then
    select to_jsonb(x) into before_doc from game_profiles x where id=target and owner_id=u;
    if before_doc is null then raise exception 'NOT_FOUND: Family not found.'; end if;
    -- Region is an immutable identity boundary; switching service uses another profile.
    update game_profiles set family_name=trim(d->>'family_name') where id=target and owner_id=u returning to_jsonb(game_profiles) into after_doc;
    gp:=target; label:='Renamed family';
  when 'character_save' then
    if target is not null then
      select to_jsonb(x),game_profile_id into before_doc,gp from characters x where id=target and owner_id=u;
      if before_doc is null then raise exception 'NOT_FOUND: Character not found.'; end if;
      update characters set name=trim(d->>'name'),class_name=trim(d->>'class_name'),level=(d->>'level')::integer,playstyle=coalesce(d->>'playstyle','PvE'),notes=coalesce(d->>'notes','') where id=target and owner_id=u returning to_jsonb(characters) into after_doc;
    else
      insert into characters(owner_id,game_profile_id,name,class_name,level,playstyle,notes) values(u,gp,trim(d->>'name'),trim(d->>'class_name'),(d->>'level')::integer,coalesce(d->>'playstyle','PvE'),coalesce(d->>'notes','')) returning to_jsonb(characters) into after_doc;
    end if;
    label:='Saved character '||(d->>'name');
  when 'character_delete' then
    select to_jsonb(x),game_profile_id into before_doc,gp from characters x where id=target and owner_id=u;
    if before_doc is null then raise exception 'NOT_FOUND: Character not found.'; end if;
    update equipment_instances set character_id=null,slot=null where character_id=target and owner_id=u;
    update goals set character_id=null where character_id=target and owner_id=u;
    delete from characters where id=target and owner_id=u;
    label:='Removed character; owned equipment returned to family inventory';
  when 'gear_save' then
    if target is not null then
      select to_jsonb(x) into before_doc from equipment_instances x where id=target and owner_id=u and game_profile_id=gp;
      if before_doc is null then raise exception 'NOT_FOUND: Equipment not found.'; end if;
    end if;
    ver:=nullif(d->>'catalog_version_id','')::uuid;
    if ver is not null then
      select item into itm from catalog_versions c cross join jsonb_array_elements(c.content->'items') item where c.id=ver and item->>'key'=d->>'item_key' and (c.status='published' or (before_doc->>'catalog_version_id'=ver::text and before_doc->>'item_key'=d->>'item_key'));
      if itm is null or not (itm->'enhancements' @> jsonb_build_array((d->>'enhancement')::integer)) then raise exception 'VALIDATION: Unsupported catalog item or enhancement.'; end if;
      if ch is not null and not (itm->'slots' ? (d->>'slot')) then raise exception 'VALIDATION: Item is not compatible with this slot.'; end if;
      if coalesce((d->>'reform')::integer,0)>0 or coalesce((d->>'caphras')::integer,0)>0 then raise exception 'VALIDATION: Reforms and Caphras are not verified for this catalog item.'; end if;
    end if;
    if target is null then
      insert into equipment_instances(owner_id,game_profile_id,character_id,slot,name,catalog_version_id,item_key,enhancement,reform,caphras,notes)
      values(u,gp,ch,case when ch is null then null else d->>'slot' end,coalesce(itm->>'name',trim(d->>'name')),ver,case when ver is null then null else d->>'item_key' end,(d->>'enhancement')::integer,coalesce((d->>'reform')::integer,0),coalesce((d->>'caphras')::integer,0),coalesce(d->>'notes','')) returning to_jsonb(equipment_instances) into after_doc;
    else
      update equipment_instances set character_id=ch,slot=case when ch is null then null else d->>'slot' end,name=coalesce(itm->>'name',trim(d->>'name')),catalog_version_id=ver,item_key=case when ver is null then null else d->>'item_key' end,enhancement=(d->>'enhancement')::integer,reform=coalesce((d->>'reform')::integer,0),caphras=coalesce((d->>'caphras')::integer,0),notes=coalesce(d->>'notes','') where id=target and owner_id=u returning to_jsonb(equipment_instances) into after_doc;
    end if;
    label:='Saved equipment '||(after_doc->>'name');
  when 'gear_delete' then
    delete from equipment_instances where id=target and owner_id=u returning to_jsonb(equipment_instances),game_profile_id into before_doc,gp;
    if before_doc is null then raise exception 'NOT_FOUND: Equipment not found.'; end if;
    label:='Removed equipment '||(before_doc->>'name');
  when 'resource_save','resource_adjust' then
    if target is not null then
      select to_jsonb(x)||jsonb_build_object('quantity',quantity::text),game_profile_id,quantity into before_doc,gp,current_qty from resource_balances x where id=target and owner_id=u;
      if before_doc is null then raise exception 'NOT_FOUND: Resource not found.'; end if;
    elsif kind='resource_adjust' then raise exception 'NOT_FOUND: Choose a resource.'; end if;
    if kind='resource_adjust' then
      if d->>'delta' !~ '^-?[0-9]{1,19}$' or length(trim(coalesce(d->>'reason','')))=0 then raise exception 'VALIDATION: Enter a whole adjustment and a reason.'; end if;
      delta:=(d->>'delta')::bigint; qty:=current_qty+delta;
    else qty:=app_private.quantity(d->>'quantity'); end if;
    select coalesce(sum(quantity),0) into reserved from resource_allocations where resource_id=target and owner_id=u;
    if qty<reserved or qty<0 then raise exception 'RESERVED_BALANCE: Release reservations before lowering this balance.'; end if;
    if target is null then
      insert into resource_balances(owner_id,game_profile_id,name,quantity,unit) values(u,gp,trim(d->>'name'),qty,'items') returning to_jsonb(resource_balances)||jsonb_build_object('quantity',quantity::text) into after_doc;
    else
      update resource_balances set quantity=qty where id=target and owner_id=u returning to_jsonb(resource_balances)||jsonb_build_object('quantity',quantity::text) into after_doc;
    end if;
    label:=case when kind='resource_adjust' then left(d->>'reason',200) else 'Updated '||(after_doc->>'name') end;
  when 'goal_create' then
    ver:=nullif(d->>'catalog_version_id','')::uuid;
    if ver is not null then
      select * into cv from catalog_versions where id=ver and status='published' and checked_at<=current_date and valid_until>=current_date;
      if cv.id is null then raise exception 'CATALOG_REVIEW: This guide needs a current review.'; end if;
      if exists(select 1 from goals where owner_id=u and game_profile_id=gp and catalog_version_id is not null and status<>'archived') then raise exception 'VALIDATION: This family already has a guided roadmap. Open it or archive it first.'; end if;
    end if;
    insert into goals(owner_id,game_profile_id,character_id,title,description,priority,catalog_version_id)
    values(u,gp,ch,coalesce(cv.title,trim(d->>'title')),coalesce(d->>'description',''),coalesce((d->>'priority')::integer,1),ver) returning id into gid;
    if ver is null then
      insert into goal_steps(owner_id,goal_id,title) values(u,gid,coalesce(nullif(trim(d->>'first_step'),''),'Plan the next step'));
    else
      for obj in select * from jsonb_array_elements(cv.content->'resources') loop
        insert into resource_balances(owner_id,game_profile_id,name,item_key,unit) values(u,gp,obj->>'name',obj->>'key','items') on conflict(game_profile_id,item_key) do nothing;
      end loop;
      keymap:='{}'; pos:=0;
      for st in select * from jsonb_array_elements(cv.content->'steps') loop keymap:=keymap||jsonb_build_object(st->>'key',gen_random_uuid()); end loop;
      for st in select * from jsonb_array_elements(cv.content->'steps') loop
        requirements:='[]'; deps:='{}';
        for obj in select * from jsonb_array_elements(coalesce(st->'requirements','[]')) loop
          select id into r_id from resource_balances where owner_id=u and game_profile_id=gp and item_key=obj->>'resource_key';
          requirements:=requirements||jsonb_build_array(jsonb_build_object('resource_id',r_id,'quantity',obj->>'quantity'));
        end loop;
        for obj in select * from jsonb_array_elements(coalesce(st->'dependencies','[]')) loop deps:=array_append(deps,(keymap->>(obj#>>'{}'))::uuid); end loop;
        insert into goal_steps(id,owner_id,goal_id,title,description,position,dependencies,requirements,template_key,claim_key,reward,status)
        values((keymap->>(st->>'key'))::uuid,u,gid,st->>'title',coalesce(st->>'description',''),pos,deps,requirements,st->>'key',st->>'claim_key',st->'reward',
        case when exists(select 1 from family_claims where game_profile_id=gp and claim_key=st->>'claim_key') then 'completed' else 'pending' end);
        pos:=pos+1;
      end loop;
      -- An already-claimed reward is evidence that the shared prerequisite was met.
      if exists(select 1 from goal_steps where goal_id=gid and status='completed') then update goal_steps set status='completed' where goal_id=gid and claim_key is null; end if;
    end if;
    perform app_private.validate_steps(gid,u);
    select to_jsonb(x) into after_doc from goals x where id=gid; label:='Created roadmap '||(after_doc->>'title');
  when 'goal_update' then
    select * into gl from goals where id=target and owner_id=u;
    if gl.id is null then raise exception 'NOT_FOUND: Goal not found.'; end if;
    before_doc:=to_jsonb(gl); gp:=gl.game_profile_id;
    if d->>'status' not in ('active','paused','archived') then raise exception 'VALIDATION: Invalid goal status.'; end if;
    update goals set title=trim(d->>'title'),description=coalesce(d->>'description',''),priority=(d->>'priority')::integer,status=d->>'status' where id=target returning to_jsonb(goals) into after_doc;
    if d->>'status'='archived' then delete from resource_allocations where goal_id=target; end if;
    label:='Updated roadmap '||gl.title;
  when 'step_save' then
    gid:=(d->>'goal_id')::uuid;
    select * into gl from goals where id=gid and owner_id=u;
    if gl.id is null then raise exception 'NOT_FOUND: Goal not found.'; end if;
    gp:=gl.game_profile_id;
    if gl.catalog_version_id is not null then raise exception 'VALIDATION: Guided steps are versioned. Use a custom goal for manual steps.'; end if;
    select coalesce(array_agg(value::uuid),'{}') into deps from jsonb_array_elements_text(coalesce(d->'dependencies','[]'));
    if target is null then
      insert into goal_steps(owner_id,goal_id,title,description,position,dependencies,requirements)
      values(u,gid,trim(d->>'title'),coalesce(d->>'description',''),(select count(*) from goal_steps where goal_id=gid),deps,coalesce(d->'requirements','[]')) returning to_jsonb(goal_steps) into after_doc;
    else
      select to_jsonb(x) into before_doc from goal_steps x where id=target and owner_id=u and goal_id=gid and status='pending';
      if before_doc is null then raise exception 'VALIDATION: Reopen this step before editing it.'; end if;
      update goal_steps set title=trim(d->>'title'),description=coalesce(d->>'description',''),dependencies=deps,requirements=coalesce(d->'requirements','[]') where id=target returning to_jsonb(goal_steps) into after_doc;
    end if;
    perform app_private.validate_steps(gid,u); label:='Saved roadmap step';
  when 'step_reorder' then
    gid:=(d->>'goal_id')::uuid;
    select * into gl from goals where id=gid and owner_id=u;
    if gl.id is null then raise exception 'NOT_FOUND: Goal not found.'; end if;
    if jsonb_typeof(d->'order') is distinct from 'array' then raise exception 'VALIDATION: Supply the complete step order.'; end if;
    select coalesce(array_agg(value::uuid),'{}') into affected from jsonb_array_elements_text(d->'order');
    if cardinality(affected)<>(select count(*) from goal_steps where goal_id=gid) or cardinality(affected)<>(select count(distinct x) from unnest(affected) x) or exists(select 1 from unnest(affected) x where not exists(select 1 from goal_steps where id=x and goal_id=gid)) then raise exception 'VALIDATION: Reorder must include every step once.'; end if;
    if exists(select 1 from goal_steps gs cross join unnest(gs.dependencies) as prereq(dep_id) where gs.goal_id=gid and array_position(affected,prereq.dep_id)>array_position(affected,gs.id)) then raise exception 'DEPENDENCY_ORDER: Prerequisites must stay before dependent steps.'; end if;
    update goal_steps set position=array_position(affected,id)-1 where goal_id=gid;
    gp:=gl.game_profile_id; label:='Reordered independent steps'; after_doc:=d;
  when 'allocation_set' then
    gid:=(d->>'goal_id')::uuid; r_id:=(d->>'resource_id')::uuid; qty:=app_private.quantity(d->>'quantity');
    select * into gl from goals where id=gid and owner_id=u and status<>'archived';
    if gl.id is null then raise exception 'NOT_FOUND: Active goal not found.'; end if;
    select quantity into current_qty from resource_balances where id=r_id and owner_id=u and game_profile_id=gl.game_profile_id;
    if current_qty is null then raise exception 'NOT_FOUND: Resource not found in this family.'; end if;
    select coalesce(sum(quantity),0) into reserved from resource_allocations where resource_id=r_id and goal_id<>gid;
    if qty+reserved>current_qty then raise exception 'INSUFFICIENT_RESOURCES: Reservations exceed the owned balance.'; end if;
    select to_jsonb(x)||jsonb_build_object('quantity',quantity::text) into before_doc from resource_allocations x where resource_id=r_id and goal_id=gid;
    delete from resource_allocations where resource_id=r_id and goal_id=gid;
    if qty>0 then insert into resource_allocations(owner_id,goal_id,resource_id,quantity) values(u,gid,r_id,qty); end if;
    after_doc:=d; gp:=gl.game_profile_id; label:='Updated resource reservation';
  when 'step_complete','step_reopen' then
    select * into s from goal_steps where id=target and owner_id=u;
    if s.id is null then raise exception 'NOT_FOUND: Step not found.'; end if;
    select * into gl from goals where id=s.goal_id and owner_id=u; gp:=gl.game_profile_id;
    before_doc:=to_jsonb(s);
    if kind='step_reopen' then
      with recursive downstream as (select id from goal_steps where id=s.id union select x.id from goal_steps x join downstream z on z.id=any(x.dependencies) where x.goal_id=s.goal_id)
      select array_agg(id) into affected from downstream;
      if exists(select 1 from goal_steps where id=any(affected) and id<>s.id and status='completed') and coalesce((d->>'reopen_dependents')::boolean,false)=false then raise exception 'DEPENDENTS_COMPLETE: Confirm reopening dependent steps too. Materials and claims are not reversed.'; end if;
      update goal_steps set status='pending' where id=any(affected);
      update goals set status='active' where id=s.goal_id and status='completed';
      label:='Reopened '||s.title||' (no inventory refund)';
    else
      if s.status='completed' then raise exception 'ALREADY_COMPLETED: This step is already complete.'; end if;
      if gl.status<>'active' then raise exception 'VALIDATION: Resume this goal before completing steps.'; end if;
      if exists(select 1 from goal_steps where id=any(s.dependencies) and status<>'completed') then raise exception 'PREREQUISITES: Complete the prerequisites first.'; end if;
      if d->>'mode' is null or d->>'mode' not in ('spend','record') then raise exception 'VALIDATION: Choose how to record this completion.'; end if;
      if d->>'mode'='spend' then
        if gl.catalog_version_id is not null and not exists(select 1 from catalog_versions where id=gl.catalog_version_id and status='published' and valid_until>=current_date and checked_at<=current_date) then raise exception 'CATALOG_REVIEW: This guide requires review or migration before spending resources.'; end if;
        if s.claim_key is not null and exists(select 1 from family_claims where game_profile_id=gp and claim_key=s.claim_key) then raise exception 'ALREADY_CLAIMED: This family already recorded the reward. Use record-only completion.'; end if;
        requirements:='[]';
        for obj in select * from jsonb_array_elements(s.requirements) loop
          r_id:=(obj->>'resource_id')::uuid; qty:=app_private.quantity(obj->>'quantity');
          select quantity into current_qty from resource_balances where id=r_id and owner_id=u and game_profile_id=gp;
          select coalesce(sum(quantity),0) into reserved from resource_allocations where resource_id=r_id and goal_id<>s.goal_id;
          if current_qty is null or current_qty-reserved<qty then raise exception 'INSUFFICIENT_RESOURCES: Materials are missing or reserved for another goal.'; end if;
          requirements:=requirements||jsonb_build_array(jsonb_build_object('resource_id',r_id,'before',current_qty::text,'after',(current_qty-qty)::text));
          update resource_balances set quantity=quantity-qty where id=r_id;
          delete from resource_allocations where resource_id=r_id and goal_id=s.goal_id and quantity<=qty;
          update resource_allocations set quantity=quantity-qty where resource_id=r_id and goal_id=s.goal_id;
        end loop;
        if s.reward is not null and s.reward<>'null'::jsonb then
          select item into itm from catalog_versions c cross join jsonb_array_elements(c.content->'items') item where c.id=gl.catalog_version_id and item->>'key'=s.reward->>'item_key';
          if itm is null then raise exception 'CATALOG_REVIEW: Reward item missing.'; end if;
          insert into equipment_instances(owner_id,game_profile_id,name,catalog_version_id,item_key,enhancement) values(u,gp,itm->>'name',gl.catalog_version_id,s.reward->>'item_key',(s.reward->>'enhancement')::integer);
        end if;
      end if;
      if s.claim_key is not null then insert into family_claims(owner_id,game_profile_id,claim_key) values(u,gp,s.claim_key) on conflict do nothing; end if;
      update goal_steps set status='completed' where id=s.id;
      label:=case when d->>'mode'='record' then 'Recorded prior completion: ' else 'Completed: ' end||s.title;
    end if;
    select to_jsonb(x) into after_doc from goal_steps x where id=s.id;
    after_doc:=after_doc||jsonb_build_object('resource_changes',coalesce(requirements,'[]'),'mode',d->>'mode');
  else raise exception 'VALIDATION: Unknown command.';
  end case;
  update goals g set status='completed' where owner_id=u and status='active' and exists(select 1 from goal_steps where goal_id=g.id) and not exists(select 1 from goal_steps where goal_id=g.id and status<>'completed');
  update profiles set revision=revision+1 where id=u;
  insert into progress_events(owner_id,game_profile_id,kind,description,before_state,after_state,request_id) values(u,gp,kind,label,before_doc,after_doc,req);
  insert into mutation_receipts(owner_id,request_id,payload_hash) values(u,req,fingerprint);
  return public.companion_snapshot();
end $$;

create function public.companion_export() returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private as $$
declare u uuid:=auth.uid(); result jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Export remains available to users removed from the beta.
  select jsonb_build_object('format','bdo-companion','version',1,'exported_at',now(),'profile',(select to_jsonb(p) from profiles p where id=u)) into result;
  declare t text; rows jsonb;
  begin
    foreach t in array array['game_profiles','characters','equipment_instances','resource_balances','goals','goal_steps','resource_allocations','family_claims','progress_events','mutation_receipts'] loop
      execute format('select coalesce(jsonb_agg(to_jsonb(x)%s),''[]''::jsonb) from app_private.%I x where owner_id=$1',case when t in ('resource_balances','resource_allocations') then '||jsonb_build_object(''quantity'',quantity::text)' else '' end,t) into rows using u;
      result:=result||jsonb_build_object(t,rows);
    end loop;
  end;
  result:=result||jsonb_build_object('catalog_versions',coalesce((select jsonb_agg(to_jsonb(c)) from catalog_versions c where id in (select catalog_version_id from goals where owner_id=u union select catalog_version_id from equipment_instances where owner_id=u)),'[]'));
  return result;
end $$;

create function public.companion_request_deletion() returns jsonb language plpgsql security definer
set search_path = pg_catalog, app_private as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Serialize with all in-flight writes, then block all future access before deleting.
  perform 1 from profiles where id=u for update;
  insert into deletion_requests(user_id) values(u) on conflict do nothing;
  delete from profiles where id=u;
  return jsonb_build_object('user_id',u,'status','pending_auth_deletion');
end $$;

revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.companion_snapshot(),public.companion_command(jsonb),public.companion_export(),public.companion_request_deletion() from public,anon;
grant execute on function public.companion_snapshot(),public.companion_command(jsonb),public.companion_export(),public.companion_request_deletion() to authenticated;
