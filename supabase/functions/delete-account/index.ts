import {createClient} from 'npm:@supabase/supabase-js@2.115.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
    const authorization=req.headers.get('Authorization')??'';
    if(!authorization.startsWith('Bearer '))return reply({error:'Sign in to delete your account.'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await client.auth.getUser(authorization.slice(7));
    if(authError||!user)return reply({error:'Your session expired. Sign in again.'},401);
    const body=await req.json();
    if(body.confirmation!=='DELETE')return reply({error:'Explicit deletion confirmation is required.'},400);
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    // This private Storage ledger is intentionally outside the logical database restore scope.
    // Persist it before confirming deletion so restoring older player rows cannot resurrect the account.
    const bucket='companion-deletion-ledger';
    const {data:existing}=await admin.storage.getBucket(bucket);
    if(!existing){
      const {error:createError}=await admin.storage.createBucket(bucket,{public:false,fileSizeLimit:4096,allowedMimeTypes:['application/json']});
      if(createError&&createError.message!=='The resource already exists')return reply({error:'Deletion ledger is temporarily unavailable. Retry.'},503);
    }
    const {error:ledgerError}=await admin.storage.from(bucket).upload(user.id+'.json',JSON.stringify({user_id:user.id,requested_at:new Date().toISOString()}),{contentType:'application/json',upsert:true});
    if(ledgerError)return reply({error:'Deletion could not be recorded safely. Retry.'},503);
    // This transaction removes player data and blocks stale JWTs before privileged Auth deletion.
    const {error:requestError}=await client.rpc('companion_request_deletion');
    if(requestError)return reply({error:'Could not start deletion. Retry.'},503);
    await admin.auth.admin.signOut(authorization.slice(7),'global');
    const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);
    if(deleteError)return reply({status:'pending_auth_deletion'},202);
    const {error:finishError}=await admin.rpc('companion_finish_deletion',{subject:user.id});
    // A scheduled server job reconciles an unacknowledged completion marker.
    if(finishError)console.error('Deletion completion marker pending');
    return reply({status:'deleted'});
  }catch{return reply({error:'Deletion could not be confirmed. Retry when connected.'},503);}
});
