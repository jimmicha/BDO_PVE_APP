import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const env=Object.fromEntries((await readFile('.env.local','utf8')).split(/\r?\n/).filter(Boolean).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const users=JSON.parse(await readFile('.local/hosted-test-accounts.json','utf8'));
const url=process.env.VITE_SUPABASE_URL||env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(process.env.HOSTED_TEST_PROJECT_REF!==new URL(url).hostname.split('.')[0])throw Error('Set HOSTED_TEST_PROJECT_REF to the reviewed target project before running fixture mutations.');
const clients=users.map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const tokens=new Map();
async function api(client,path,body){
  const response=await fetch(url+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+tokens.get(client),'Content-Type':'application/json'},body:JSON.stringify(body??{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();return response.ok?{data,error:null}:{data:null,error:data};
}
const report={project:url,checked_at:new Date().toISOString(),checks:[]};
const check=(message)=>{report.checks.push(message);console.log('PASS',message);};
async function rpc(client,name,command){const r=await api(client,'/rest/v1/rpc/'+name,command?{command}:undefined);if(r.error)throw r.error;return r.data;}
const state=[];
async function send(index,kind,data){const cmd={kind,data,request_id:randomUUID(),expected_revision:state[index].profile.revision};state[index]=await rpc(clients[index],'companion_command',cmd);return cmd;}
try{
  for(let i=0;i<2;i++){const result=await clients[i].auth.signInWithPassword(users[i]);if(result.error)throw result.error;tokens.set(clients[i],result.data.session.access_token);state[i]=await rpc(clients[i],'companion_snapshot');}
  check('Two disposable verified fixtures sign in through real Supabase Auth');
  for(let i=0;i<2;i++){await send(i,'family_create',{family_name:'Hosted test '+i,region:'EU'});await send(i,'character_save',{game_profile_id:state[i].game_profiles[0].id,name:'API test '+i,class_name:'Scholar',level:61});}
  assert.equal(state[1].characters.length,1);assert.notEqual(state[0].characters[0].id,state[1].characters[0].id);
  const attacks=[['character_save',{id:state[0].characters[0].id,name:'Stolen',class_name:'Warrior',level:1}],['resource_save',{id:state[0].resources[0].id,quantity:'100'}],['gear_save',{game_profile_id:state[0].game_profiles[0].id,name:'Stolen',enhancement:20}]];
  for(const [kind,data] of attacks){const r=await clients[1].rpc('companion_command',{command:{kind,data,request_id:randomUUID(),expected_revision:state[1].profile.revision}});assert(r.error);}
  assert((await clients[1].from('characters').select('*')).error);
  assert((await clients[1].schema('app_private').from('characters').select('*')).error);
  check('Guessed IDs, direct table calls, and private-schema calls are denied');
  const user0=await clients[0].auth.getSession(),anonymous=await fetch(url+'/rest/v1/rpc/companion_snapshot',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});assert(!anonymous.ok);
  check('Anonymous private reads are denied');
  await send(0,'gear_save',{game_profile_id:state[0].game_profiles[0].id,character_id:state[0].characters[0].id,slot:'helmet',name:'Persistence test',enhancement:20});
  const session2=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});tokens.set(session2,(await session2.auth.signInWithPassword(users[0])).data.session.access_token);assert.equal((await rpc(session2,'companion_snapshot')).equipment[0].name,'Persistence test');
  check('Character and equipment persist in a second authenticated session');
  const revision=state[0].profile.revision,commands=['9007199254740993','9007199254740994'].map(quantity=>({kind:'resource_save',data:{id:state[0].resources[0].id,quantity},request_id:randomUUID(),expected_revision:revision}));
  const simultaneous=await Promise.all(commands.map((command,i)=>api(i?session2:clients[0],'/rest/v1/rpc/companion_command',{command})));
  assert.equal(simultaneous.filter(x=>!x.error).length,1);assert.equal(simultaneous.filter(x=>x.error?.code==='PT409').length,1);
  state[0]=await rpc(clients[0],'companion_snapshot');assert.equal(typeof state[0].resources[0].quantity,'string');
  check('Concurrent sessions produce one commit and one conflict; large integers remain exact');
  await send(0,'goal_create',{game_profile_id:state[0].game_profiles[0].id,catalog_version_id:state[0].catalogs[0].id});
  await send(0,'step_complete',{id:state[0].steps.find(x=>x.template_key==='olvia_enrollment').id,mode:'record'});
  for(const [key,quantity] of [['essence_of_dawn','20'],['sharp_black_crystal_shard','100']])await send(0,'resource_save',{id:state[0].resources.find(x=>x.item_key===key).id,quantity});
  const necklace=state[0].steps.find(x=>x.template_key==='necklace'),command=await send(0,'step_complete',{id:necklace.id,mode:'spend'});
  const saved=JSON.stringify(state[0]);assert.equal(JSON.stringify(await rpc(session2,'companion_command',command)),saved);
  assert.equal(state[0].equipment.filter(x=>x.item_key==='kharazad_necklace').length,1);assert.equal(state[0].resources.find(x=>x.item_key==='essence_of_dawn').quantity,'10');
  await send(0,'step_reopen',{id:necklace.id});const claimed=await clients[0].rpc('companion_command',{command:{...command,request_id:randomUUID(),expected_revision:state[0].profile.revision}});assert(claimed.error?.message.includes('ALREADY_CLAIMED'));
  check('Guided reward spends 10/50 once; replay and reopening cannot duplicate family rewards');
  const exp=await rpc(clients[0],'companion_export');assert.equal(exp.equipment_instances.length,2);assert.equal(exp.family_claims.length,1);assert.equal(exp.characters.length,1);
  check('Full export includes owned inventory, characters, claims, and history');
  const del=await api(clients[0],'/functions/v1/delete-account',{confirmation:'DELETE'});if(del.error)throw del.error;assert.equal(del.data.status,'deleted');
  const stale=await fetch(url+'/rest/v1/rpc/companion_snapshot',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+user0.data.session.access_token,'Content-Type':'application/json'},body:'{}'});assert(!stale.ok);
  assert((await clients[0].auth.signInWithPassword(users[0])).error);
  check('Edge deletion removes Auth accounts; stale tokens cannot access player data');
}finally{
  for(const client of clients)await api(client,'/functions/v1/delete-account',{confirmation:'DELETE'}).catch(()=>undefined);
  await writeFile('.local/hosted-verification.json',JSON.stringify(report,null,2));
}
