import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {applyLocalMigrations,schemaSignature} from './local-migrations.mjs';
export const ALICE='a1000000-0000-4000-8000-000000000001';
export const BOB='b1000000-0000-4000-8000-000000000002';
export async function openDatabase(directory) {
  const db = new PGlite(directory);
  try {
  const root=new URL('../supabase/migrations/',import.meta.url);
  const migrations=await Promise.all((await readdir(root)).filter(x=>x.endsWith('.sql')).sort().map(async name=>({name,sql:await readFile(new URL(name,root),'utf8')})));
  const existing=await db.query("select to_regclass('app_private.profiles') as t");
  let baseline=[];
  if(!existing.rows[0].t) {
    await bootstrap(db);
  } else if(!(await db.query("select to_regclass('local_meta.migrations') as t")).rows[0].t){
    const reference=new PGlite();
    try {
      await bootstrap(reference);
      const actual=await schemaSignature(db);let matched=false;
      for(const m of migrations.filter(m=>m.name<='20260908073140_http_conflicts.sql')){
        await reference.exec(m.sql);baseline.push(m);
        if(actual===await schemaSignature(reference)){matched=true;break;}
      }
      if(!matched)throw Error('Unrecognized untracked local schema. Back up the local database and reconcile its migrations before continuing; no player data was reset.');
    } finally {await reference.close();}
  }
  await applyLocalMigrations(db,migrations,baseline);
  await db.exec(await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
  return db;
  }catch(error){await db.close();throw error;}
}
async function bootstrap(db){
  // An interrupted first start may already have created the local Auth stand-in.
  if((await db.query("select to_regclass('auth.users') as t")).rows[0].t)return;
  await db.exec("create role anon; create role authenticated; create role supabase_auth_admin; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text not null unique,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
}
export async function seedUsers(db) {
  await db.query("insert into auth.users(id,email,email_confirmed_at) values ($1,'explorer@local.test',now()),($2,'ranger@local.test',now()) on conflict do nothing",[ALICE,BOB]);
  await db.exec("insert into app_private.beta_members(email,role) values ('explorer@local.test','admin'),('ranger@local.test','tester') on conflict do nothing");
}
const allowed = new Set(['companion_snapshot','companion_command','companion_export','companion_request_deletion','companion_catalog','companion_migrate_goal']);
export async function rpc(db,user,name,command) {
  if(!allowed.has(name)) throw Error('Unknown RPC');
  return db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);
    await tx.exec('set local role authenticated');
    const result=await tx.query('select public.'+name+'('+(command?'$1::jsonb':'')+') as result',command?[JSON.stringify(command)]:[]);
    return result.rows[0].result;
  });
}
