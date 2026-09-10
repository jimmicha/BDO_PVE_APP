-- Manual, confirmed equipment costs; this does not certify a game recipe.
-- Called only inside the account-locked command transaction.
create function app_private.spend_equipment_costs(family uuid, costs jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,app_private as $$
declare u uuid:=app_private.actor(); entry jsonb; resource uuid; amount bigint; balance bigint;
  reserved numeric; seen uuid[]:='{}'; previous jsonb:='[]'; resulting jsonb:='[]'; row_doc jsonb;
begin
  if jsonb_typeof(costs) is distinct from 'array' or jsonb_array_length(costs)>100 then
    raise exception 'VALIDATION: Equipment costs must be a list of at most 100 resources.';
  end if;
  for entry in select value from jsonb_array_elements(costs) loop
    resource:=(entry->>'resource_id')::uuid;
    amount:=app_private.quantity(entry->>'quantity');
    if resource is null or resource=any(seen) or amount<=0 then
      raise exception 'VALIDATION: Choose each resource once with a positive whole quantity.';
    end if;
    seen:=array_append(seen,resource);
    select quantity,to_jsonb(r)||jsonb_build_object('quantity',quantity::text)
      into balance,row_doc from resource_balances r
      where id=resource and owner_id=u and game_profile_id=family for update;
    if row_doc is null then raise exception 'NOT_FOUND: Resource not found in this equipment family.'; end if;
    select coalesce(sum(quantity),0) into reserved from resource_allocations where resource_id=resource and owner_id=u;
    if balance-amount<reserved then raise exception 'RESERVED_BALANCE: Release reservations or add resources before recording this upgrade.'; end if;
    previous:=previous||jsonb_build_array(row_doc);
    update resource_balances set quantity=quantity-amount where id=resource and owner_id=u
      returning to_jsonb(resource_balances)||jsonb_build_object('quantity',quantity::text) into row_doc;
    resulting:=resulting||jsonb_build_array(row_doc);
  end loop;
  return jsonb_build_object('before',previous,'after',resulting);
end $$;
revoke all on function app_private.spend_equipment_costs(uuid,jsonb) from public,anon,authenticated;

-- Preserve the existing ownership, revision and receipt checks in the dispatcher.
do $migration$
declare definition text; anchor text:=$anchor$    label:='Saved equipment '||(after_doc->>'name');$anchor$;
begin
  definition:=pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Unexpected equipment command definition'; end if;
  definition:=replace(definition,anchor,anchor||$addition$
    if d ? 'costs' then
      if target is null then raise exception 'VALIDATION: Select existing equipment for an upgrade transaction.'; end if;
      obj:=app_private.spend_equipment_costs(gp,d->'costs');
      before_doc:=jsonb_build_object('equipment',before_doc,'resources',obj->'before');
      label:='Recorded equipment upgrade: '||(after_doc->>'name');
      after_doc:=jsonb_build_object('equipment',after_doc,'resources',obj->'after');
    end if;
$addition$);
  execute definition;
end $migration$;
