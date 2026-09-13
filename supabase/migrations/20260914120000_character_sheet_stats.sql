-- Self-reported sheet AP/DP on a character, matching the app's existing
-- philosophy of recording the player's own in-game values rather than
-- inferring them. Used to recommend a grind zone from the imported
-- zone-requirement reference table.
alter table app_private.characters
  add column sheet_ap integer check(sheet_ap is null or sheet_ap between 0 and 999),
  add column sheet_dp integer check(sheet_dp is null or sheet_dp between 0 and 999);

do $migration$
declare definition text;
  anchor1 text:=$anchor1$      update characters set name=trim(d->>'name'),class_name=trim(d->>'class_name'),level=(d->>'level')::integer,playstyle=coalesce(d->>'playstyle','PvE'),notes=coalesce(d->>'notes','') where id=target and owner_id=u returning to_jsonb(characters) into after_doc;$anchor1$;
  anchor2 text:=$anchor2$      insert into characters(owner_id,game_profile_id,name,class_name,level,playstyle,notes) values(u,gp,trim(d->>'name'),trim(d->>'class_name'),(d->>'level')::integer,coalesce(d->>'playstyle','PvE'),coalesce(d->>'notes','')) returning to_jsonb(characters) into after_doc;$anchor2$;
begin
  definition:=pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure);
  if position(anchor1 in definition)=0 then raise exception 'Unexpected character_save update in companion_command'; end if;
  if position(anchor2 in definition)=0 then raise exception 'Unexpected character_save insert in companion_command'; end if;
  definition:=replace(definition,anchor1,$replacement1$      update characters set name=trim(d->>'name'),class_name=trim(d->>'class_name'),level=(d->>'level')::integer,playstyle=coalesce(d->>'playstyle','PvE'),notes=coalesce(d->>'notes',''),sheet_ap=nullif(d->>'sheet_ap','')::integer,sheet_dp=nullif(d->>'sheet_dp','')::integer where id=target and owner_id=u returning to_jsonb(characters) into after_doc;$replacement1$);
  definition:=replace(definition,anchor2,$replacement2$      insert into characters(owner_id,game_profile_id,name,class_name,level,playstyle,notes,sheet_ap,sheet_dp) values(u,gp,trim(d->>'name'),trim(d->>'class_name'),(d->>'level')::integer,coalesce(d->>'playstyle','PvE'),coalesce(d->>'notes',''),nullif(d->>'sheet_ap','')::integer,nullif(d->>'sheet_dp','')::integer) returning to_jsonb(characters) into after_doc;$replacement2$);
  execute definition;
end $migration$;
