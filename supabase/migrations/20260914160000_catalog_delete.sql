-- Admin > Progression catalog has no way to remove a draft: "Copy to new
-- draft" happily piles up abandoned drafts (e.g. from an accidental copy, or
-- one superseded by a fresh reimport) with no cleanup path. Add a
-- catalog_delete op, restricted to status='draft' the same way catalog_save
-- already is. Drafts can never be referenced by a goal or equipment_instances
-- row: companion_command only assigns catalog_version_id from a 'published'
-- catalog (or an equipment row's own prior value, which was published when
-- set), so the delete needs no cascade or reference check beyond the status
-- guard.
create or replace function public.companion_catalog(command jsonb) returns jsonb language plpgsql security definer
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
  elsif op='catalog_delete' then
    delete from catalog_versions where id=(d->>'id')::uuid and status='draft' returning * into c;
    if c.id is null then raise exception 'VALIDATION: Only draft versions can be deleted.'; end if;
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
