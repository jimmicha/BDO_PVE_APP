-- Prevent a newer client offering conversions against an older backend that ignores them.
do $migration$
declare definition text; anchor text:=$anchor$'capabilities',jsonb_build_array('equipment_costs_v1')$anchor$;
begin
  if position('convert_equipment' in pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure))=0 then
    raise exception 'Install guided equipment conversions before advertising support';
  end if;
  definition:=pg_get_functiondef('app_private.companion_snapshot()'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Unexpected capability list in snapshot definition'; end if;
  execute replace(definition,anchor,$replacement$'capabilities',jsonb_build_array('equipment_costs_v1','guided_conversions_v1')$replacement$);
end $migration$;
