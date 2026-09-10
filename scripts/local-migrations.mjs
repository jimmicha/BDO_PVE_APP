import {createHash} from 'node:crypto';
const checksum=sql=>createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
export async function applyLocalMigrations(db,migrations,baseline=[]) {
  await db.exec('create schema if not exists local_meta; create table if not exists local_meta.migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now()); revoke all on schema local_meta from public;');
  if(baseline.length)await db.transaction(async tx=>{
    for(const m of baseline)await tx.query('insert into local_meta.migrations(name,checksum) values($1,$2)',[m.name,checksum(m.sql)]);
  });
  const applied=(await db.query('select name,checksum from local_meta.migrations order by name')).rows;
  for(const row of applied){
    const source=migrations.find(m=>m.name===row.name);
    if(!source||checksum(source.sql)!==row.checksum)throw Error('Applied local migration changed or is missing: '+row.name+'. Restore the original file; add a new migration for changes.');
  }
  const latest=applied.at(-1)?.name;
  for(const m of migrations){
    if(applied.some(row=>row.name===m.name))continue;
    if(latest&&m.name<latest)throw Error('Out-of-order local migration: '+m.name);
    await db.transaction(async tx=>{
      await tx.exec(m.sql);
      await tx.query('insert into local_meta.migrations(name,checksum) values($1,$2)',[m.name,checksum(m.sql)]);
    });
  }
}

// Recognize the old, untracked local schema before establishing its baseline.
// No player data is compared or changed. Unknown schemas fail without guessing.
export async function schemaSignature(db){
  const result=await db.query(`select 'function' kind,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')
    union all select 'index',schemaname||'.'||indexname,indexdef from pg_indexes where schemaname='app_private'
    union all select 'column',table_schema||'.'||table_name||'.'||column_name,concat_ws('|',data_type,udt_name,is_nullable,column_default,character_maximum_length::text) from information_schema.columns where table_schema='app_private'
    union all select 'constraint',n.nspname||'.'||c.relname||'.'||x.conname,pg_get_constraintdef(x.oid) from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private'
    union all select 'table security',n.nspname||'.'||c.relname,concat_ws('|',c.relrowsecurity::text,c.relforcerowsecurity::text,c.relacl::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relkind='r'
    union all select 'function permissions',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',coalesce(p.proacl::text,'default') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')
    union all select 'policy',schemaname||'.'||tablename||'.'||policyname,concat_ws('|',permissive,roles::text,cmd,qual,with_check) from pg_policies where schemaname='app_private'
    order by 1,2`);
  return JSON.stringify(result.rows).replaceAll('\\r\\n','\\n');
}
