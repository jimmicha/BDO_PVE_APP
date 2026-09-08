import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
// @ts-expect-error Shared Node harness.
import {openDatabase,seedUsers,rpc,ALICE} from '../scripts/database.mjs';
it('reviews and publishes a version, preserves pinned goals, migrates pending steps and rolls back',async()=>{
  const db=await openDatabase();try{await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');
    const send=async(kind:string,data:unknown)=>{s=await rpc(db,ALICE,kind.startsWith('catalog_')?'companion_catalog':kind==='goal_migrate'?'companion_migrate_goal':'companion_command',{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});};
    const original=s.catalogs[0];await send('family_create',{family_name:'Catalog testers',region:'EU'});await send('goal_create',{game_profile_id:s.game_profiles[0].id,catalog_version_id:original.id});
    await send('step_complete',{id:s.steps.find((x:any)=>x.template_key==='olvia_enrollment').id,mode:'record'});
    await send('catalog_create',{id:original.id});const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await expect(send('catalog_transition',{id:draft.id,status:'review'})).rejects.toThrow('CATALOG_REVIEW');
    const content=structuredClone(draft.content);content.steps.find((x:any)=>x.key==='belt').requirements[0].quantity='12';
    await send('catalog_save',{id:draft.id,title:draft.title,content,sources:draft.sources,checked_at:new Date().toISOString().slice(0,10),valid_until:'2026-10-07',effective_patch:'Test-only catalog amendment'});
    await send('catalog_transition',{id:draft.id,status:'review'});await send('catalog_transition',{id:draft.id,status:'published'});
    expect(s.goals[0].catalog_version_id).toBe(original.id);expect(s.steps.find((x:any)=>x.template_key==='belt').requirements[0].quantity).toBe('10');
    await send('goal_migrate',{id:s.goals[0].id,catalog_version_id:draft.id});
    expect(s.steps.find((x:any)=>x.template_key==='belt').requirements[0].quantity).toBe('12');expect(s.steps.find((x:any)=>x.template_key==='olvia_enrollment').status).toBe('completed');
    await send('catalog_transition',{id:original.id,status:'published'});expect(s.catalogs.find((x:any)=>x.status==='published').id).toBe(original.id);expect(s.goals[0].catalog_version_id).toBe(draft.id);
  }finally{await db.close();}
});
