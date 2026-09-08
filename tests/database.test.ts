import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
// @ts-expect-error The local harness is shared with the Node development server.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';
let db:any, a:any, b:any;
async function read(user=ALICE){return rpc(db,user,'companion_snapshot');}
async function send(kind:string,data:any,state=a,user=ALICE,id=randomUUID()){
  const result=await rpc(db,user,'companion_command',{kind,data,expected_revision:state.profile.revision,request_id:id});
  if(user===ALICE)a=result;else b=result;
  return result;
}
beforeAll(async()=>{db=await openDatabase();await seedUsers(db);a=await read();b=await read(BOB);});
afterAll(async()=>{await db?.close();});
describe('production SQL through authenticated RPCs',()=>{
  it('onboards two isolated accounts',async()=>{
    await send('family_create',{family_name:'Dawnward',region:'EU'});
    await send('character_save',{game_profile_id:a.game_profiles[0].id,name:'Aster',class_name:'Scholar',level:61});
    await send('family_create',{family_name:'Northwind',region:'NA'},b,BOB);
    await send('character_save',{game_profile_id:b.game_profiles[0].id,name:'Rowan',class_name:'Ranger',level:60},b,BOB);
    expect((await read()).characters[0].name).toBe('Aster');
    expect((await read(BOB)).characters.map((x:any)=>x.name)).toEqual(['Rowan']);
    await expect(send('character_save',{id:a.characters[0].id,name:'Intruder',class_name:'Ranger',level:60},b,BOB)).rejects.toThrow('NOT_FOUND');
    await expect(send('resource_save',{game_profile_id:a.game_profiles[0].id,name:'Stolen',quantity:'12'},b,BOB)).rejects.toThrow('NOT_FOUND');
  });
  it('blocks raw table access, anonymous sessions and uninvited accounts',async()=>{
    await expect(db.transaction(async(tx:any)=>{await tx.exec('set local role authenticated');return tx.query('select * from app_private.characters');})).rejects.toThrow(/permission denied/);
    await expect(rpc(db,null,'companion_snapshot')).rejects.toThrow('AUTH_REQUIRED');
    const stranger=randomUUID();await db.query("insert into auth.users values ($1,'outsider@local.test',now())",[stranger]);
    await expect(read(stranger)).rejects.toThrow('BETA_ACCESS');
  });
  it('persists equipment, checks ownership and prevents duplicate equipped slots',async()=>{
    const data={game_profile_id:a.game_profiles[0].id,character_id:a.characters[0].id,slot:'helmet',name:'My helmet',enhancement:20};
    await send('gear_save',data);
    expect((await read()).equipment[0].name).toBe('My helmet');
    await expect(send('gear_save',data)).rejects.toThrow(/duplicate key/);
    await expect(send('gear_delete',{id:a.equipment[0].id},b,BOB)).rejects.toThrow('NOT_FOUND');
  });
  it('rejects stale writes and provides replay-safe idempotency',async()=>{
    const old=a,id=randomUUID();
    const data={id:a.resources[0].id,quantity:'9007199254740993'};
    await send('resource_save',data,a,ALICE,id);
    expect(a.resources[0].quantity).toBe('9007199254740993');
    const count=a.events.length;
    await send('resource_save',data,old,ALICE,id);
    expect(a.events.length).toBe(count);
    await expect(send('resource_save',{...data,quantity:'1'},old,ALICE,id)).rejects.toThrow('IDEMPOTENCY_REUSED');
    await expect(send('resource_save',{...data,quantity:'2'},old)).rejects.toThrow('CONFLICT');
    await expect(send('resource_save',{...data,quantity:'1.5'})).rejects.toThrow('VALIDATION');
  });
  it('creates the reviewed guide with independent family claims',async()=>{
    await send('goal_create',{game_profile_id:a.game_profiles[0].id,character_id:a.characters[0].id,catalog_version_id:a.catalogs[0].id});
    expect(a.steps).toHaveLength(7);
    expect(new Set(a.steps.filter((x:any)=>x.claim_key).map((x:any)=>x.claim_key)).size).toBe(6);
    const reward=a.steps.find((x:any)=>x.template_key==='necklace');
    await expect(send('step_complete',{id:reward.id,mode:'spend'})).rejects.toThrow('PREREQUISITES');
    await send('step_complete',{id:a.steps.find((x:any)=>x.template_key==='olvia_enrollment').id,mode:'record'});
  });
  it('reserves shared resources and applies deductions and rewards atomically once',async()=>{
    const resource=(key:string)=>a.resources.find((x:any)=>x.item_key===key);
    await send('resource_save',{id:resource('essence_of_dawn').id,quantity:'30'});
    await send('resource_save',{id:resource('sharp_black_crystal_shard').id,quantity:'150'});
    const guide=a.goals[0];
    await send('allocation_set',{goal_id:guide.id,resource_id:resource('essence_of_dawn').id,quantity:'20'});
    await expect(send('resource_save',{id:resource('essence_of_dawn').id,quantity:'19'})).rejects.toThrow('RESERVED_BALANCE');
    await send('goal_create',{game_profile_id:a.game_profiles[0].id,title:'Another goal',first_step:'Save'});
    const custom=a.goals.find((x:any)=>!x.catalog_version_id);
    await send('allocation_set',{goal_id:custom.id,resource_id:resource('essence_of_dawn').id,quantity:'10'});
    const step=a.steps.find((x:any)=>x.template_key==='necklace');
    const old=a,id=randomUUID();await send('step_complete',{id:step.id,mode:'spend'},a,ALICE,id);
    expect(resource('essence_of_dawn').quantity).toBe('20');
    expect(a.allocations.find((x:any)=>x.goal_id===guide.id).quantity).toBe('10');
    expect(a.equipment.filter((x:any)=>x.item_key==='kharazad_necklace')).toHaveLength(1);
    await send('step_complete',{id:step.id,mode:'spend'},old,ALICE,id);
    expect(resource('essence_of_dawn').quantity).toBe('20');
    await send('step_reopen',{id:step.id});
    expect(resource('essence_of_dawn').quantity).toBe('20');
    await expect(send('step_complete',{id:step.id,mode:'spend'})).rejects.toThrow('ALREADY_CLAIMED');
    await send('step_complete',{id:step.id,mode:'record'});
    expect(resource('essence_of_dawn').quantity).toBe('20');
  });
  it('rolls back the entire transaction when a later ingredient is insufficient',async()=>{
    const step=a.steps.find((x:any)=>x.template_key==='belt');
    const shard=a.resources.find((x:any)=>x.item_key==='sharp_black_crystal_shard');
    await send('resource_save',{id:shard.id,quantity:'0'});
    const before=await read();
    await expect(send('step_complete',{id:step.id,mode:'spend'})).rejects.toThrow('INSUFFICIENT_RESOURCES');
    expect(await read()).toEqual(before);
  });
  it('rejects dependency cycles, cross-family requirements and invalid order',async()=>{
    const goal=a.goals.find((x:any)=>!x.catalog_version_id), first=a.steps.find((x:any)=>x.goal_id===goal.id);
    await send('step_save',{goal_id:goal.id,title:'Second',dependencies:[first.id]});
    const second=a.steps.find((x:any)=>x.goal_id===goal.id&&x.id!==first.id);
    await expect(send('step_save',{id:first.id,goal_id:goal.id,title:'Cycle',dependencies:[second.id]})).rejects.toThrow('DEPENDENCY_CYCLE');
    await expect(send('step_reorder',{goal_id:goal.id,order:[second.id,first.id]})).rejects.toThrow('DEPENDENCY_ORDER');
    await expect(send('step_save',{goal_id:goal.id,title:'Steal',requirements:[{resource_id:b.resources[0].id,quantity:'1'}]})).rejects.toThrow('NOT_FOUND');
  });
  it('exports complete owned records and enforces admin authorization',async()=>{
    const exported=await rpc(db,ALICE,'companion_export');
    expect(exported.characters[0].name).toBe('Aster');
    expect(exported.resource_balances.find((x:any)=>x.item_key==='silver').quantity).toBe('9007199254740993');
    await expect(rpc(db,BOB,'companion_catalog',{kind:'catalog_create',data:{id:a.catalogs[0].id},expected_revision:b.profile.revision,request_id:randomUUID()})).rejects.toThrow('FORBIDDEN');
  });
  it('deletion erases player state and disables subsequent reads and writes',async()=>{
    await rpc(db,BOB,'companion_request_deletion');
    await expect(read(BOB)).rejects.toThrow('ACCOUNT_DELETING');
    const exp=await rpc(db,BOB,'companion_export');
    expect(exp.characters).toEqual([]);expect(exp.profile).toBeNull();
    expect((await read()).characters[0].name).toBe('Aster');
  });
});
