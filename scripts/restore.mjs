// Operator-only. Restore into staging first, with app access disabled during the operation.
import {spawn} from 'node:child_process';
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {decrypt} from './backup-crypto.mjs';
const url=new URL(process.env.RESTORE_DATABASE_URL);
if(process.env.RESTORE_TARGET_CONFIRM!==url.hostname+url.pathname)throw Error('Set RESTORE_TARGET_CONFIRM to the exact destination hostname/database after reviewing it.');
if(!process.env.DELETION_LEDGER_FILE)throw Error('A fresh independent deletion ledger is required; an old database snapshot alone is not sufficient.');
const deleted=JSON.parse(decrypt(await readFile(process.env.DELETION_LEDGER_FILE),process.env.BACKUP_KEY).toString());
for(const item of deleted)if(!/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.user_id)||!Number.isFinite(Date.parse(item.requested_at)))throw Error('Invalid deletion ledger.');
const directory=resolve('.local/restore');await mkdir(directory,{recursive:true});
const dump=join(directory,'restore.dump'),sql=join(directory,'reapply-deletions.sql');
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'require'};
function run(name,args){return new Promise((yes,no)=>{const p=spawn(name,args,{env,stdio:['ignore','inherit','pipe'],windowsHide:true});let error='';p.stderr.on('data',x=>error+=x);p.on('error',no);p.on('exit',c=>c===0?yes():no(Error(name+' failed: '+error.replaceAll(env.PGPASSWORD,'[redacted]'))));});}
try{
  await writeFile(dump,decrypt(await readFile(process.env.BACKUP_FILE),process.env.BACKUP_KEY),{mode:0o600});
  const statements=deleted.map(x=>"insert into app_private.deletion_requests(user_id,requested_at,completed_at) values ('"+x.user_id+"','"+new Date(x.requested_at).toISOString()+"',now()) on conflict(user_id) do nothing; delete from auth.users where id='"+x.user_id+"';");
  await writeFile(sql,'begin;\n'+statements.join('\n')+'\ncommit;\n',{mode:0o600});
  await run('pg_restore',['--clean','--if-exists','--no-owner','--no-privileges','--exit-on-error','--single-transaction','--dbname='+env.PGDATABASE,dump]);
  await run('psql',['--no-psqlrc','--set=ON_ERROR_STOP=1','--file='+sql]);
  console.log('Restored database and reapplied '+deleted.length+' deletions. Keep app access disabled until account-isolation and session checks pass.');
}finally{await unlink(dump).catch(()=>undefined);await unlink(sql).catch(()=>undefined);}
