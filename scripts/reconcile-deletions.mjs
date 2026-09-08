import {createClient} from '@supabase/supabase-js';
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const {data,error}=await client.rpc('companion_pending_deletions');if(error)throw error;
for(const id of data){
  const {error:err}=await client.auth.admin.deleteUser(id);
  if(err&&err.status!==404)throw Error('Auth deletion retry failed');
  const {error:finish}=await client.rpc('companion_finish_deletion',{subject:id});if(finish)throw finish;
}
console.log('Pending account deletions reconciled: '+data.length);
