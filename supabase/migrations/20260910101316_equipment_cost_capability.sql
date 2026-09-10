-- Prevent a newer client offering deductions against an older backend that ignores costs.
do $migration$
declare definition text; anchor text:=$anchor$'profile',to_jsonb(p)$anchor$;
begin
  if position('spend_equipment_costs' in pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure))=0 then
    raise exception 'Install equipment upgrade transactions before advertising support';
  end if;
  definition:=pg_get_functiondef('app_private.companion_snapshot()'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Unexpected snapshot definition'; end if;
  execute replace(definition,anchor,$replacement$'capabilities',jsonb_build_array('equipment_costs_v1'),'profile',to_jsonb(p)$replacement$);
end $migration$;
