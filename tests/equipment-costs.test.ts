import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
// @ts-expect-error Shared Node SQL harness.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';
it('updates one equipment instance and deducts costs atomically with ownership, reservations and replay checks',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');
    expect(s.capabilities).toContain('equipment_costs_v1');
    const send=async(kind:string,data:unknown)=>s=await rpc(db,ALICE,'companion_command',{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});
    await send('family_create',{family_name:'Upgrade test',region:'EU'});const family=s.game_profiles[0].id;
    await send('resource_save',{id:s.resources[0].id,quantity:'9007199254740993'});const silver=s.resources[0].id;
    await send('gear_save',{game_profile_id:family,name:'Original helmet',enhancement:19});
    const gear=s.equipment[0].id;
    const data={id:gear,game_profile_id:family,name:'Upgraded helmet',enhancement:20,costs:[{resource_id:silver,quantity:'10'}]};
    const command={kind:'gear_save',data,expected_revision:s.profile.revision,request_id:randomUUID()};
    s=await rpc(db,ALICE,'companion_command',command);
    expect(s.equipment).toHaveLength(1);expect(s.equipment[0].id).toBe(gear);expect(s.equipment[0].enhancement).toBe(20);
    expect(s.resources[0].quantity).toBe('9007199254740983');
    const event=s.events.find((e:any)=>e.request_id===command.request_id);
    expect(event.before_state.equipment.name).toBe('Original helmet');expect(event.after_state.resources[0].quantity).toBe('9007199254740983');
    expect((await rpc(db,ALICE,'companion_command',command)).resources[0].quantity).toBe('9007199254740983');
    await expect(rpc(db,ALICE,'companion_command',{...command,request_id:randomUUID()})).rejects.toThrow('CONFLICT');
    const bob=await rpc(db,BOB,'companion_snapshot');
    await expect(rpc(db,BOB,'companion_command',{...command,request_id:randomUUID(),expected_revision:bob.profile.revision})).rejects.toThrow('NOT_FOUND');
    await send('goal_create',{game_profile_id:family,title:'Reserve',first_step:'Save'});
    await send('allocation_set',{goal_id:s.goals[0].id,resource_id:silver,quantity:s.resources[0].quantity});
    const revision=s.profile.revision;
    await expect(send('gear_save',{...data,name:'Must roll back'})).rejects.toThrow('RESERVED_BALANCE');
    s=await rpc(db,ALICE,'companion_snapshot');expect(s.profile.revision).toBe(revision);expect(s.equipment[0].name).toBe('Upgraded helmet');
    await send('allocation_set',{goal_id:s.goals[0].id,resource_id:silver,quantity:'0'});
    for(const costs of [[data.costs[0],data.costs[0]],[data.costs[0],{resource_id:randomUUID(),quantity:'1'}]]){
      await expect(send('gear_save',{...data,costs})).rejects.toThrow();
      expect((await rpc(db,ALICE,'companion_snapshot')).resources[0].quantity).toBe('9007199254740983');
    }
    await send('family_create',{family_name:'Other family',region:'NA'});const other=s.resources.find((r:any)=>r.game_profile_id!==family);
    await expect(send('gear_save',{...data,costs:[{resource_id:other.id,quantity:'1'}]})).rejects.toThrow('NOT_FOUND');
    await expect(db.transaction(async(tx:any)=>{await tx.exec('set local role authenticated');await tx.query("select app_private.spend_equipment_costs($1,'[]')",[family]);})).rejects.toThrow('permission denied');
  }finally{await db.close();}
});
