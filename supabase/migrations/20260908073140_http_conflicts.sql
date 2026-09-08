-- A revision mismatch is an application conflict, not a PostgreSQL serialization failure.
-- PostgREST can retry SQLSTATE 40001. PT409 returns a stable HTTP 409 immediately.
-- https://docs.postgrest.org/en/v14/references/errors.html
do $$
declare f record; definition text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private' and p.proname in ('companion_command','companion_catalog','companion_migrate_goal')
  loop
    definition:=replace(pg_get_functiondef(f.oid),'errcode=''40001''','errcode=''PT409''');
    execute definition;
  end loop;
end $$;
