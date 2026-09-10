import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import ladder from '../src/data/catalog-ladder-draft.json';
// @ts-expect-error Shared Node SQL harness.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';
it('saves the 70-step ladder as an unreviewed draft without exposing it to player recommendations',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');const original=s.catalogs[0];
    const send=async(kind:string,data:unknown)=>{s=await rpc(db,ALICE,'companion_catalog',{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});};
    await send('catalog_create',{id:original.id});const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await send('catalog_save',{...ladder,id:draft.id});
    const saved=s.catalogs.find((c:any)=>c.id===draft.id);expect(saved.content.steps).toHaveLength(70);expect(saved.checked_at).toBeNull();
    for(const step of original.content.steps)expect(saved.content.steps.some((x:any)=>x.key===step.key)).toBe(true);
    expect(saved.content.steps.filter((x:any)=>x.claim_key).map((x:any)=>x.claim_key).sort()).toEqual(original.content.steps.filter((x:any)=>x.claim_key).map((x:any)=>x.claim_key).sort());
    await expect(send('catalog_transition',{id:draft.id,status:'review'})).rejects.toThrow('CATALOG_REVIEW');
    const player=await rpc(db,BOB,'companion_snapshot');expect(player.catalogs.some((c:any)=>c.id===draft.id)).toBe(false);
  }finally{await db.close();}
});
