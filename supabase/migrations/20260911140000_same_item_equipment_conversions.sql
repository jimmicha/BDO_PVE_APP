-- Allow reward.source to also express a same-item enhancement upgrade
-- (e.g. Sovereign TET -> PEN), not only a cross-item conversion (e.g.
-- Kharazad -> Ekleta). A same-item conversion must still strictly increase
-- enhancement beyond the source range, so a catalog cannot author a no-op
-- or a downgrade.
create or replace function app_private.validate_catalog(doc jsonb) returns void language plpgsql
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
    if x->'reward' is not null and x->'reward'<>'null'::jsonb and x->'reward'->'source' is not null and x->'reward'->'source'<>'null'::jsonb then
      if not exists(select 1 from jsonb_array_elements(doc->'items') i where i->>'key'=x->'reward'->'source'->>'item_key') then
        raise exception 'VALIDATION: Conversion source item does not exist in this catalog.';
      end if;
      if coalesce((x->'reward'->'source'->>'min_enhancement')::integer,0) not between 0 and 25
        or coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) not between 0 and 25
        or coalesce((x->'reward'->'source'->>'min_enhancement')::integer,0) > coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) then
        raise exception 'VALIDATION: Invalid conversion enhancement range.';
      end if;
      if x->'reward'->'source'->>'item_key' = x->'reward'->>'item_key'
        and coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) >= (x->'reward'->>'enhancement')::integer then
        raise exception 'VALIDATION: A same-item conversion must increase enhancement beyond the source range.';
      end if;
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null)<>(select count(distinct v->>'claim_key') from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null) then raise exception 'VALIDATION: Claim keys must be unique.'; end if;
end $$;
revoke all on function app_private.validate_catalog(jsonb) from public,anon,authenticated;

-- Preserve reform/caphras investment when a conversion enhances the same
-- item in place; only reset them when the item genuinely changes (a real
-- cross-item conversion resets crystal/caphras state on the new item).
create or replace function app_private.convert_equipment(family uuid, src uuid, spec jsonb, ver uuid, key text, item_name text, enh integer, slots jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.actor(); before_doc jsonb; after_doc jsonb; keep boolean:=coalesce((spec->>'keep_assignment')::boolean,true); same_item boolean;
begin
  if src is null then raise exception 'VALIDATION: Select the equipment to convert.'; end if;
  select to_jsonb(e) into before_doc from equipment_instances e where e.id=src and e.owner_id=u and e.game_profile_id=family for update;
  if before_doc is null then raise exception 'NOT_FOUND: Source equipment not found in this family.'; end if;
  if before_doc->>'item_key' is distinct from spec->>'item_key'
    or (before_doc->>'enhancement')::integer < coalesce((spec->>'min_enhancement')::integer,0)
    or (before_doc->>'enhancement')::integer > coalesce((spec->>'max_enhancement')::integer,25) then
    raise exception 'INCOMPATIBLE_SOURCE: This item does not meet the conversion requirements for this step.';
  end if;
  if keep and before_doc->>'slot' is not null and not (slots ? (before_doc->>'slot')) then
    raise exception 'VALIDATION: Resulting item is not compatible with the currently assigned slot.';
  end if;
  same_item:=before_doc->>'item_key'=key;
  update equipment_instances e set name=item_name,catalog_version_id=ver,item_key=key,enhancement=enh,
    reform=case when same_item then e.reform else 0 end,
    caphras=case when same_item then e.caphras else 0 end,
    character_id=case when keep then e.character_id else null end,
    slot=case when keep then e.slot else null end
  where e.id=src returning to_jsonb(e) into after_doc;
  return jsonb_build_object('before',before_doc,'after',after_doc);
end $$;
revoke all on function app_private.convert_equipment(uuid,uuid,jsonb,uuid,text,text,integer,jsonb) from public,anon,authenticated;
