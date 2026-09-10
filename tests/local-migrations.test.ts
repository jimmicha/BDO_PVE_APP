import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
// @ts-expect-error Shared Node SQL harness.
import {openDatabase,seedUsers,rpc,ALICE} from '../scripts/database.mjs';
// @ts-expect-error Shared Node migration runner.
import {applyLocalMigrations} from '../scripts/local-migrations.mjs';
it('applies later local migrations once, preserves records, rejects edits and rolls back partial failures',async()=>{
  const db=new PGlite();try{
    const first={name:'001.sql',sql:'create table public.example(id integer primary key, name text); insert into public.example values(1,\'Saved character\');'};
    const next={name:'002.sql',sql:'alter table public.example add column level integer default 61;'};
    await applyLocalMigrations(db,[first]);await applyLocalMigrations(db,[first,next]);await applyLocalMigrations(db,[first,next]);
    expect((await db.query('select * from public.example')).rows).toEqual([{id:1,name:'Saved character',level:61}]);
    await expect(applyLocalMigrations(db,[{...first,sql:first.sql+' select 1;'},next])).rejects.toThrow('changed or is missing');
    await expect(applyLocalMigrations(db,[first,{name:'001a.sql',sql:'select 1;'},next])).rejects.toThrow('Out-of-order');
    await expect(applyLocalMigrations(db,[first,next,{name:'003.sql',sql:'update public.example set name=\'Broken\'; select missing_function();'}])).rejects.toThrow();
    expect((await db.query('select name from public.example')).rows[0].name).toBe('Saved character');
    expect((await db.query('select * from local_meta.migrations')).rows).toHaveLength(2);
    await applyLocalMigrations(db,[first,next,{name:'003.sql',sql:'update public.example set level=62;'}]);
    expect((await db.query('select level from public.example')).rows[0].level).toBe(62);
  }finally{await db.close();}
});
it('recognizes an older untracked database and upgrades it without losing the saved family',async()=>{
  const legacy=new PGlite();let upgraded:any;
  try{
    await legacy.exec("create role anon; create role authenticated; create role supabase_auth_admin; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text not null unique,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
    for(const name of (await readdir('supabase/migrations')).sort().slice(0,3))await legacy.exec(await readFile('supabase/migrations/'+name,'utf8'));
    await seedUsers(legacy);const s=await rpc(legacy,ALICE,'companion_snapshot');
    await rpc(legacy,ALICE,'companion_command',{kind:'family_create',data:{family_name:'Keep this family',region:'EU'},expected_revision:s.profile.revision,request_id:randomUUID()});
    upgraded=await openDatabase({loadDataDir:await legacy.dumpDataDir()});
    expect((await rpc(upgraded,ALICE,'companion_snapshot')).game_profiles[0].family_name).toBe('Keep this family');
    expect((await upgraded.query('select * from local_meta.migrations')).rows).toHaveLength((await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).length);
    expect((await upgraded.query("select pg_get_functiondef('app_private.companion_command(jsonb)'::regprocedure) as definition")).rows[0].definition).toContain('spend_equipment_costs');
  }finally{await upgraded?.close();await legacy.close();}
});
