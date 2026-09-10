-- Manual, confirmed conversion recipe; this does not certify a game recipe.
-- Called only inside the account-locked command transaction.
create function app_private.convert_equipment(family uuid, src uuid, spec jsonb, ver uuid, key text, item_name text, enh integer, slots jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.actor(); before_doc jsonb; after_doc jsonb; keep boolean:=coalesce((spec->>'keep_assignment')::boolean,true);
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
  update equipment_instances e set name=item_name,catalog_version_id=ver,item_key=key,enhancement=enh,reform=0,caphras=0,
    character_id=case when keep then e.character_id else null end,
    slot=case when keep then e.slot else null end
  where e.id=src returning to_jsonb(e) into after_doc;
  return jsonb_build_object('before',before_doc,'after',after_doc);
end $$;
revoke all on function app_private.convert_equipment(uuid,uuid,jsonb,uuid,text,text,integer,jsonb) from public,anon,authenticated;

-- Preserve the existing ownership, revision and receipt checks in the dispatcher.
do $migration$
declare definition text;
  anchor1 text:=$anchor1$          insert into equipment_instances(owner_id,game_profile_id,name,catalog_version_id,item_key,enhancement) values(u,gp,itm->>'name',gl.catalog_version_id,s.reward->>'item_key',(s.reward->>'enhancement')::integer);$anchor1$;
  anchor2 text:=$anchor2$    after_doc:=after_doc||jsonb_build_object('resource_changes',coalesce(requirements,'[]'),'mode',d->>'mode');$anchor2$;
begin
  definition:=pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure);
  if position(anchor1 in definition)=0 then raise exception 'Unexpected reward insert in step_complete'; end if;
  if position(anchor2 in definition)=0 then raise exception 'Unexpected after_doc merge in step_complete'; end if;
  definition:=replace(definition,anchor1,$replacement1$          if s.reward->'source' is not null and s.reward->'source'<>'null'::jsonb then
            obj:=app_private.convert_equipment(gp,nullif(d->>'source_equipment_id','')::uuid,s.reward->'source',gl.catalog_version_id,s.reward->>'item_key',itm->>'name',(s.reward->>'enhancement')::integer,itm->'slots');
          else
            insert into equipment_instances(owner_id,game_profile_id,name,catalog_version_id,item_key,enhancement) values(u,gp,itm->>'name',gl.catalog_version_id,s.reward->>'item_key',(s.reward->>'enhancement')::integer);
          end if;$replacement1$);
  definition:=replace(definition,anchor2,anchor2||$addition$
    if obj is not null then after_doc:=after_doc||jsonb_build_object('equipment_before',obj->'before','equipment_after',obj->'after'); end if;
$addition$);
  execute definition;
end $migration$;
