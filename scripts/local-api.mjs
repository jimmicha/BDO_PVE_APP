// LOCAL TEST HARNESS ONLY. Binds loopback; never bundled or deployed.
// Auth is a test substitute. Every player mutation executes the production SQL.
import {createServer} from 'node:http';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase,seedUsers,rpc,ALICE,BOB} from './database.mjs';
const port=Number(process.env.LOCAL_API_PORT||54329);
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
const db=await openDatabase(process.env.LOCAL_DB_DIR||fileURLToPath(new URL('../.local/database',import.meta.url)));
await seedUsers(db);
await db.exec("create table if not exists auth.local_passwords(id uuid primary key references auth.users on delete cascade,salt text not null,hash text not null)");
const hash=(password,salt)=>scryptSync(password,salt,32).toString('hex');
for(const id of [ALICE,BOB]){const salt=randomBytes(16).toString('hex');await db.query('insert into auth.local_passwords values ($1,$2,$3) on conflict do nothing',[id,salt,hash('LocalExplorer123!',salt)]);}
const sessions=new Map(),refreshes=new Map(),resetTokens=new Map(),inbox=[];
const userJson=row=>({id:row.id,email:row.email,aud:'authenticated',role:'authenticated',email_confirmed_at:row.email_confirmed_at,app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[{id:row.id,provider:'email',user_id:row.id,identity_data:{email:row.email}}],created_at:new Date().toISOString()});
async function userById(id){return (await db.query('select * from auth.users where id=$1',[id])).rows[0];}
function issue(user){const access=randomBytes(48).toString('base64url'),refresh=randomBytes(48).toString('base64url'),expires=Math.floor(Date.now()/1000)+3600;sessions.set(access,{id:user.id,expires});refreshes.set(refresh,user.id);return {access_token:access,refresh_token:refresh,expires_in:3600,expires_at:expires,token_type:'bearer',user:userJson(user)};}
const allowedOrigins=new Set(['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173']);
createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&!allowedOrigins.has(origin)){res.writeHead(403);res.end();return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','authorization, apikey, content-type, content-profile, accept-profile, prefer, x-client-info, x-supabase-api-version');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const respond=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
  try{
    const url=new URL(req.url,'http://localhost'),chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>300000)throw Error('Request too large');chunks.push(chunk);}
    const body=length?JSON.parse(Buffer.concat(chunks).toString()):{};
    const access=req.headers.authorization?.replace(/^Bearer /i,''),session=sessions.get(access);
    const uid=session&&session.expires>Date.now()/1000?session.id:null;
    if(url.pathname==='/health')return respond(200,{mode:'local-test',database:'PostgreSQL/PGlite'});
    if(url.pathname==='/local/inbox')return respond(200,inbox);
    if(url.pathname==='/auth/v1/token'){
      if(url.searchParams.get('grant_type')==='refresh_token'){
        const id=refreshes.get(body.refresh_token),user=id?await userById(id):null;
        if(!user)return respond(400,{msg:'Refresh token expired. Sign in again.',error_code:'refresh_token_not_found'});
        refreshes.delete(body.refresh_token);return respond(200,issue(user));
      }
      const result=await db.query('select a.*,p.salt,p.hash from auth.users a join auth.local_passwords p on p.id=a.id where lower(a.email)=lower($1)',[body.email||'']);
      const row=result.rows[0];
      if(!row||!timingSafeEqual(Buffer.from(row.hash,'hex'),Buffer.from(hash(body.password||'',row.salt),'hex')))return respond(400,{msg:'Invalid local test credentials',error_code:'invalid_credentials'});
      return respond(200,issue(row));
    }
    if(url.pathname==='/auth/v1/signup'){
      if(!/^[^@]+@local\.test$/.test(body.email||'')||(body.password||'').length<10)return respond(400,{msg:'Local signup requires an @local.test address and at least 10 password characters.'});
      const id=randomUUID(),salt=randomBytes(16).toString('hex');
      await db.transaction(async tx=>{await tx.query('insert into auth.users values ($1,lower($2),now())',[id,body.email]);await tx.query('insert into auth.local_passwords values($1,$2,$3)',[id,salt,hash(body.password,salt)]);await tx.query('insert into app_private.beta_members(email) values(lower($1)) on conflict do nothing',[body.email]);});
      return respond(200,issue(await userById(id)));
    }
    if(url.pathname==='/auth/v1/recover'){
      const user=(await db.query('select * from auth.users where lower(email)=lower($1)',[body.email||''])).rows[0];
      if(user){const token=randomBytes(32).toString('hex');resetTokens.set(token,{id:user.id,expires:Date.now()+900000});inbox.unshift({to:user.email,subject:'Local password reset',url:'http://localhost:5173/auth/reset?token_hash='+token+'&type=recovery'});}
      return respond(200,{});
    }
    if(url.pathname==='/auth/v1/verify'){
      const token=resetTokens.get(body.token_hash);
      if(!token||token.expires<Date.now())return respond(400,{msg:'This recovery link has expired.'});
      resetTokens.delete(body.token_hash);return respond(200,issue(await userById(token.id)));
    }
    if(url.pathname==='/auth/v1/logout'){
      sessions.delete(access);for(const [key,id] of refreshes)if(id===uid)refreshes.delete(key);return respond(200,{});
    }
    if(url.pathname==='/auth/v1/authorize'||url.pathname.includes('/identities'))return respond(400,{msg:'Google sign-in and identity linking require a configured Supabase project. This server tests email/password only.'});
    if(!uid)return respond(401,{msg:'Sign in again to continue.',message:'AUTH_REQUIRED: Sign in again to continue.'});
    const user=await userById(uid);if(!user)return respond(401,{msg:'Account no longer exists.'});
    if(url.pathname==='/auth/v1/user'){
      if(req.method==='PUT'&&body.password){if(body.password.length<10)throw Error('Use at least 10 characters');const salt=randomBytes(16).toString('hex');await db.query('update auth.local_passwords set salt=$2,hash=$3 where id=$1',[uid,salt,hash(body.password,salt)]);}
      return respond(200,userJson(user));
    }
    if(url.pathname==='/functions/v1/delete-account'){
      if(body.confirmation!=='DELETE')return respond(400,{message:'Explicit deletion confirmation is required.'});
      await rpc(db,uid,'companion_request_deletion');
      await db.query('delete from auth.users where id=$1',[uid]);
      await db.query('update app_private.deletion_requests set completed_at=now() where user_id=$1',[uid]);
      return respond(200,{status:'deleted'});
    }
    if(url.pathname.startsWith('/rest/v1/rpc/'))return respond(200,await rpc(db,uid,url.pathname.split('/').at(-1),body.command));
    respond(404,{message:'Not found'});
  }catch(error){const message=error.message||String(error);respond(message.includes('CONFLICT')?409:message.includes('BETA_ACCESS')?403:400,{message,code:error.code||'LOCAL_ERROR'});}
}).listen(port,'127.0.0.1',()=>process.stdout.write('Local test API: http://127.0.0.1:'+port+'\nTest accounts: explorer@local.test / ranger@local.test\nLocal password: LocalExplorer123!\n'));
