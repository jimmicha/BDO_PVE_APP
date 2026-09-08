import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {encrypt} from './backup-crypto.mjs';
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const records=[];let offset=0;
while(true){
  const {data,error}=await client.storage.from('companion-deletion-ledger').list('',{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
  if(error)throw error;
  for(const file of data){if(!/^[a-f0-9-]{36}\.json$/i.test(file.name))continue;const {data:body,error}=await client.storage.from('companion-deletion-ledger').download(file.name);if(error)throw error;records.push(JSON.parse(await body.text()));}
  if(data.length<1000)break;offset+=data.length;
}
const output=resolve(process.env.DELETION_LEDGER_FILE||'.local/latest-deletions.enc');await mkdir(dirname(output),{recursive:true});
await writeFile(output,encrypt(Buffer.from(JSON.stringify(records)),process.env.BACKUP_KEY),{mode:0o600});
console.log('Exported current independent deletion ledger: '+records.length+' identifiers.');
