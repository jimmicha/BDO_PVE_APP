export async function checkServices({url,key,appUrl,requireOAuth=false,fetchImpl=fetch}) {
  if(!url||!key)throw Error('Public backend URL and publishable key are required.');
  const headers={apikey:key,'Content-Type':'application/json'};
  const request=(path,options={})=>fetchImpl(path,{...options,signal:AbortSignal.timeout(15000)});
  const settings=await request(url+'/auth/v1/settings',{headers});
  if(!settings.ok)throw Error('Auth settings unavailable: HTTP '+settings.status);
  const auth=await settings.json();
  if(!auth.external?.email||auth.mailer_autoconfirm!==false)throw Error('Email sign-in or email-confirmation configuration is unexpected.');
  if(requireOAuth&&(!auth.external?.google||!auth.external?.discord))throw Error('An expected OAuth provider is disabled.');
  const snapshot=await request(url+'/rest/v1/rpc/companion_snapshot',{method:'POST',headers,body:'{}'});
  const body=await snapshot.json();
  // A missing function, outage, or gateway failure is not evidence of access control.
  if(![401,403].includes(snapshot.status)||body.code!=='42501')throw Error('Snapshot did not return the expected anonymous permission denial: HTTP '+snapshot.status);
  if(appUrl){
    const page=await request(appUrl);
    if(!page.ok||!(await page.text()).includes('<title>BDO Companion</title>'))throw Error('Web origin did not return the expected application.');
  }
  return {backend:url,emailEnabled:true,googleEnabled:!!auth.external.google,discordEnabled:!!auth.external.discord,emailConfirmationRequired:true,snapshotInstalled:true,anonymousDenied:true,...(appUrl?{webOrigin:appUrl,webAvailable:true}:{})};
}
