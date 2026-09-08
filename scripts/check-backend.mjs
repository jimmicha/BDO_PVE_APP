// Read-only cutover checks. Use Node --env-file=.env.next-backend before changing .env.local.
const base=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!base||!key)throw Error('Public backend URL and publishable key are required.');
const headers={apikey:key,'Content-Type':'application/json'};
const settings=await fetch(base+'/auth/v1/settings',{headers,signal:AbortSignal.timeout(15000)});
if(!settings.ok)throw Error('Auth settings unavailable: HTTP '+settings.status);
const auth=await settings.json();
const snapshot=await fetch(base+'/rest/v1/rpc/companion_snapshot',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(15000)});
const body=await snapshot.json();
const missing=body.code==='PGRST202';
console.log(JSON.stringify({backend:base,emailEnabled:auth.external?.email,googleEnabled:auth.external?.google,emailConfirmationRequired:!auth.mailer_autoconfirm,snapshotInstalled:!missing,anonymousDenied:!snapshot.ok&&!missing},null,2));
if(missing||snapshot.ok)process.exitCode=1;
