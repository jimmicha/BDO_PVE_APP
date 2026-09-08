// Requires PostgreSQL client tools and server-side environment variables.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,unlink,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {encrypt} from './backup-crypto.mjs';
const url=new URL(process.env.DATABASE_URL),directory=resolve(process.env.BACKUP_DIR||'.local/backups');
const pgEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1)||'postgres',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'require'};
function run(program,args){return new Promise((ok,no)=>{const p=spawn(program,args,{env:pgEnv,stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',error='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>error+=d);p.on('error',no);p.on('exit',code=>code===0?ok(out):no(Error(program+' failed: '+error.replaceAll(pgEnv.PGPASSWORD,'[redacted]'))));});}
await mkdir(directory,{recursive:true});
const stamp=new Date().toISOString().replaceAll(':','-'),temporary=join(directory,stamp+'.dump.tmp');
try{
  // The restore procedure deliberately leaves external Storage and its deletion ledger untouched.
  await run('pg_dump',['--format=custom','--no-owner','--no-acl','--schema=auth','--schema=public','--schema=app_private','--schema=supabase_migrations','--file='+temporary]);
  const tombstones=await run('psql',['--no-psqlrc','--tuples-only','--no-align','--command',"select coalesce(json_agg(row_to_json(d)),'[]') from app_private.deletion_requests d"]);
  await writeFile(join(directory,stamp+'.pgdump.enc'),encrypt(await readFile(temporary),process.env.BACKUP_KEY),{mode:0o600});
  await writeFile(join(directory,stamp+'.deletions.enc'),encrypt(Buffer.from(tombstones),process.env.BACKUP_KEY),{mode:0o600});
  for(const name of await readdir(directory)){if(!/^[\dT.Z-]+\.(pgdump|deletions)\.enc$/.test(name))continue;const file=join(directory,name);if((await stat(file)).mtimeMs<Date.now()-7*86400000)await unlink(file);}
  console.log('Encrypted database and deletion snapshot saved. Seven-day local retention applied.');
}finally{await unlink(temporary).catch(()=>undefined);}
