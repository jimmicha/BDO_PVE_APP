import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
// @ts-expect-error Shared Node SQL harness.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';

const CONTENT={
  platforms:['PC'],regions:['NA','EU'],
  resources:[{key:'black_stone',name:'Black Stone'}],
  items:[
    {key:'kharazad_ring',name:'Kharazad Ring',slots:['ring_1','ring_2'],enhancements:[19,20]},
    {key:'sovereign_ring',name:'Sovereign Ring',slots:['ring_1','ring_2'],enhancements:[21,22]},
    {key:'kharazad_main',name:'Kharazad Main',slots:['main_hand'],enhancements:[20]},
    {key:'sovereign_main',name:'Sovereign Main',slots:['main_hand'],enhancements:[21]}
  ],
  steps:[
    {key:'convert_ring',title:'Convert ring',description:'Test-only conversion, no cost.',dependencies:[],requirements:[],
      reward:{item_key:'sovereign_ring',enhancement:21,source:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20}}},
    {key:'convert_main',title:'Convert main weapon',description:'Test-only conversion with cost and claim.',dependencies:[],
      requirements:[{resource_key:'black_stone',quantity:'5'}],claim_key:'convert_main_claim',
      reward:{item_key:'sovereign_main',enhancement:21,source:{item_key:'kharazad_main',min_enhancement:20,max_enhancement:20,keep_assignment:false}}},
    {key:'convert_probe_a',title:'Convert probe A',description:'Test-only.',dependencies:[],requirements:[],
      reward:{item_key:'sovereign_ring',enhancement:21,source:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20}}},
    {key:'convert_probe_b',title:'Convert probe B',description:'Test-only.',dependencies:[],requirements:[],
      reward:{item_key:'sovereign_ring',enhancement:21,source:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20}}},
    {key:'convert_atomic',title:'Convert atomic',description:'Test-only.',dependencies:[],
      requirements:[{resource_key:'black_stone',quantity:'3'}],
      reward:{item_key:'sovereign_ring',enhancement:21,source:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20}}},
    {key:'acquire_plain',title:'Acquire plain reward',description:'Regression: plain acquire is unaffected.',dependencies:[],requirements:[],
      reward:{item_key:'kharazad_ring',enhancement:20}},
    {key:'upgrade_ring_same_item',title:'Upgrade ring in place',description:'Test-only same-item conversion.',dependencies:[],requirements:[],
      reward:{item_key:'sovereign_ring',enhancement:22,source:{item_key:'sovereign_ring',min_enhancement:21,max_enhancement:21}}},
    {key:'convert_reform_reset',title:'Convert reform reset check',description:'Test-only cross-item conversion.',dependencies:[],requirements:[],
      reward:{item_key:'sovereign_ring',enhancement:21,source:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20}}}
  ]
};

it('converts equipment in place with ownership, compatibility, atomicity, retry, reopen and migration checks',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');
    expect(s.capabilities).toContain('guided_conversions_v1');
    const send=async(kind:string,data:unknown)=>{
      const target=kind.startsWith('catalog_')?'companion_catalog':kind==='goal_migrate'?'companion_migrate_goal':'companion_command';
      s=await rpc(db,ALICE,target,{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});
      return s;
    };
    // A catalog-linked gear_save renames the row to the catalog item's canonical
    // name, so new rows are identified by set difference rather than by name.
    const addedEquipmentId=async(kind:string,data:unknown)=>{
      const before=new Set(s.equipment.map((e:any)=>e.id));
      await send(kind,data);
      return s.equipment.find((e:any)=>!before.has(e.id)).id;
    };

    // Build and publish a test-only guided catalog.
    const original=s.catalogs[0];
    await send('catalog_create',{id:original.id});
    const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await send('catalog_save',{id:draft.id,title:'Conversion test catalog',content:CONTENT,sources:draft.sources,checked_at:new Date().toISOString().slice(0,10),valid_until:'2027-01-01',effective_patch:'Test-only catalog amendment'});
    await send('catalog_transition',{id:draft.id,status:'review'});
    await send('catalog_transition',{id:draft.id,status:'published'});
    const catalogId=draft.id;

    await send('family_create',{family_name:'Conversion test',region:'EU'});
    const family=s.game_profiles.find((f:any)=>f.family_name==='Conversion test').id;
    await send('character_save',{game_profile_id:family,name:'Tester',class_name:'Warrior',level:60});
    const character=s.characters[0].id;
    await send('goal_create',{game_profile_id:family,catalog_version_id:catalogId});
    const goal=s.goals.find((g:any)=>g.catalog_version_id===catalogId).id;
    const blackStone=s.resources.find((r:any)=>r.item_key==='black_stone').id;
    await send('resource_save',{id:blackStone,quantity:'50'});
    const step=(key:string)=>s.steps.find((x:any)=>x.goal_id===goal&&x.template_key===key);

    // 2. Plain acquire is unaffected.
    const before=s.equipment.length;
    await send('step_complete',{id:step('acquire_plain').id,mode:'spend'});
    expect(s.equipment.length).toBe(before+1);
    const acquired=s.equipment.find((e:any)=>e.item_key==='kharazad_ring'&&e.character_id===null);
    expect(acquired.enhancement).toBe(20);

    // 3 & 4. Happy path conversion, with and without keeping assignment.
    const spareRing=await addedEquipmentId('gear_save',{game_profile_id:family,name:'Spare ring',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:20});
    await send('step_complete',{id:step('convert_ring').id,mode:'spend',source_equipment_id:spareRing});
    let converted=s.equipment.find((e:any)=>e.id===spareRing);
    expect(converted.item_key).toBe('sovereign_ring');expect(converted.enhancement).toBe(21);expect(converted.name).toBe('Sovereign Ring');
    expect(s.equipment.filter((e:any)=>e.item_key==='sovereign_ring')).toHaveLength(1);

    // 4b. A same-item conversion enhances in place and preserves reform/caphras investment.
    await db.query('update app_private.equipment_instances set reform=3,caphras=7 where id=$1',[spareRing]);
    await send('step_complete',{id:step('upgrade_ring_same_item').id,mode:'spend',source_equipment_id:spareRing});
    const sameItemResult=s.equipment.find((e:any)=>e.id===spareRing);
    expect(sameItemResult.item_key).toBe('sovereign_ring');expect(sameItemResult.enhancement).toBe(22);
    expect(sameItemResult.reform).toBe(3);expect(sameItemResult.caphras).toBe(7);

    // 4c. A genuine cross-item conversion still resets reform/caphras to zero.
    const reformedRing=await addedEquipmentId('gear_save',{game_profile_id:family,name:'Reformed ring',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:20});
    await db.query('update app_private.equipment_instances set reform=2,caphras=4 where id=$1',[reformedRing]);
    await send('step_complete',{id:step('convert_reform_reset').id,mode:'spend',source_equipment_id:reformedRing});
    const crossItemResult=s.equipment.find((e:any)=>e.id===reformedRing);
    expect(crossItemResult.item_key).toBe('sovereign_ring');expect(crossItemResult.reform).toBe(0);expect(crossItemResult.caphras).toBe(0);

    const mainWeapon=await addedEquipmentId('gear_save',{game_profile_id:family,character_id:character,slot:'main_hand',name:'Old main',catalog_version_id:catalogId,item_key:'kharazad_main',enhancement:20});
    const mainRequestId=randomUUID();
    const mainRevisionBefore=s.profile.revision;
    s=await rpc(db,ALICE,'companion_command',{kind:'step_complete',data:{id:step('convert_main').id,mode:'spend',source_equipment_id:mainWeapon},expected_revision:mainRevisionBefore,request_id:mainRequestId});
    converted=s.equipment.find((e:any)=>e.id===mainWeapon);
    expect(converted.item_key).toBe('sovereign_main');expect(converted.enhancement).toBe(21);
    expect(converted.character_id).toBeNull();expect(converted.slot).toBeNull();
    expect(s.resources.find((r:any)=>r.item_key==='black_stone').quantity).toBe('45');
    expect(s.claims.some((c:any)=>c.claim_key==='convert_main_claim')).toBe(true);

    // 5. Missing input.
    await expect(send('step_complete',{id:step('convert_probe_a').id,mode:'spend'})).rejects.toThrow('VALIDATION');

    // 6. Foreign input: cross-account and cross-family.
    let bob=await rpc(db,BOB,'companion_snapshot');
    bob=await rpc(db,BOB,'companion_command',{kind:'family_create',data:{family_name:'Bobs family',region:'NA'},expected_revision:bob.profile.revision,request_id:randomUUID()});
    bob=await rpc(db,BOB,'companion_command',{kind:'gear_save',data:{game_profile_id:bob.game_profiles[0].id,name:'Bobs item',enhancement:1},expected_revision:bob.profile.revision,request_id:randomUUID()});
    const bobsItem=bob.equipment[0].id;
    await expect(send('step_complete',{id:step('convert_probe_a').id,mode:'spend',source_equipment_id:bobsItem})).rejects.toThrow('NOT_FOUND');

    await send('family_create',{family_name:'Other family',region:'NA'});
    const otherFamily=s.game_profiles.find((f:any)=>f.family_name==='Other family').id;
    const otherFamilyItem=await addedEquipmentId('gear_save',{game_profile_id:otherFamily,name:'Other item',enhancement:1});
    await expect(send('step_complete',{id:step('convert_probe_a').id,mode:'spend',source_equipment_id:otherFamilyItem})).rejects.toThrow('NOT_FOUND');

    // 7. Incompatible input: wrong item_key, then wrong enhancement.
    await expect(send('step_complete',{id:step('convert_probe_a').id,mode:'spend',source_equipment_id:mainWeapon})).rejects.toThrow('INCOMPATIBLE_SOURCE');
    const lowRing=await addedEquipmentId('gear_save',{game_profile_id:family,name:'Low ring',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:19});
    await expect(send('step_complete',{id:step('convert_probe_a').id,mode:'spend',source_equipment_id:lowRing})).rejects.toThrow('INCOMPATIBLE_SOURCE');

    // 8. Reused input: convert once, then a second pending step cannot reuse the now-converted item.
    const probeRing=await addedEquipmentId('gear_save',{game_profile_id:family,name:'Probe ring',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:20});
    await send('step_complete',{id:step('convert_probe_a').id,mode:'spend',source_equipment_id:probeRing});
    expect(s.equipment.find((e:any)=>e.id===probeRing).item_key).toBe('sovereign_ring');
    await expect(send('step_complete',{id:step('convert_probe_b').id,mode:'spend',source_equipment_id:probeRing})).rejects.toThrow('INCOMPATIBLE_SOURCE');
    expect(step('convert_probe_b').status).toBe('pending');

    // 9. Atomicity: a forced failure after resource deduction leaves everything unchanged.
    const atomicRevision=s.profile.revision,atomicStone=s.resources.find((r:any)=>r.item_key==='black_stone').quantity;
    await expect(send('step_complete',{id:step('convert_atomic').id,mode:'spend',source_equipment_id:bobsItem})).rejects.toThrow('NOT_FOUND');
    expect(s.profile.revision).toBe(atomicRevision);
    expect(s.resources.find((r:any)=>r.item_key==='black_stone').quantity).toBe(atomicStone);
    expect(step('convert_atomic').status).toBe('pending');

    // 10. Rollback when the resource is reserved by another goal.
    await send('goal_create',{game_profile_id:family,title:'Reserve stone',first_step:'Hold materials'});
    const customGoal=s.goals.find((g:any)=>g.id!==goal).id;
    await send('allocation_set',{goal_id:customGoal,resource_id:blackStone,quantity:s.resources.find((r:any)=>r.item_key==='black_stone').quantity});
    const reservedRevision=s.profile.revision;
    await expect(send('step_complete',{id:step('convert_atomic').id,mode:'spend',source_equipment_id:probeRing})).rejects.toThrow('INSUFFICIENT_RESOURCES');
    expect(s.profile.revision).toBe(reservedRevision);
    expect(s.equipment.find((e:any)=>e.id===probeRing).item_key).toBe('sovereign_ring');
    await send('allocation_set',{goal_id:customGoal,resource_id:blackStone,quantity:'0'});

    // 11. Retry / idempotency.
    const replay=await rpc(db,ALICE,'companion_command',{kind:'step_complete',data:{id:step('convert_main').id,mode:'spend',source_equipment_id:mainWeapon},expected_revision:mainRevisionBefore,request_id:mainRequestId});
    expect(replay.resources.find((r:any)=>r.item_key==='black_stone').quantity).toBe(s.resources.find((r:any)=>r.item_key==='black_stone').quantity);

    // 12. Reopen does not refund or duplicate.
    await send('step_reopen',{id:step('convert_main').id});
    expect(s.equipment.find((e:any)=>e.id===mainWeapon).item_key).toBe('sovereign_main');
    expect(s.equipment.filter((e:any)=>e.item_key==='sovereign_main')).toHaveLength(1);
    await send('step_complete',{id:step('convert_main').id,mode:'record'});
    expect(s.equipment.filter((e:any)=>e.item_key==='sovereign_main')).toHaveLength(1);
    await expect(send('step_complete',{id:step('convert_main').id,mode:'spend',source_equipment_id:mainWeapon})).rejects.toThrow('ALREADY_COMPLETED');

    // 13. Two-slot precision: converting one instance by id leaves the sibling slot untouched.
    const ring1=await addedEquipmentId('gear_save',{game_profile_id:family,character_id:character,slot:'ring_1',name:'Ring one',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:20});
    const ring2=await addedEquipmentId('gear_save',{game_profile_id:family,character_id:character,slot:'ring_2',name:'Ring two',catalog_version_id:catalogId,item_key:'kharazad_ring',enhancement:20});
    const ring2Before=s.equipment.find((e:any)=>e.id===ring2);
    await send('step_complete',{id:step('convert_probe_b').id,mode:'spend',source_equipment_id:ring1});
    expect(s.equipment.find((e:any)=>e.id===ring1).item_key).toBe('sovereign_ring');
    expect(s.equipment.find((e:any)=>e.id===ring2)).toEqual(ring2Before);

    // 14. Migration preserves completed steps and updates pending ones.
    await send('catalog_create',{id:catalogId});
    const v2=s.catalogs.find((c:any)=>c.status==='draft');
    const v2Content=structuredClone(CONTENT);
    v2Content.steps.find((x:any)=>x.key==='convert_atomic').reward.source.min_enhancement=19;
    await send('catalog_save',{id:v2.id,title:'Conversion test catalog v2',content:v2Content,sources:draft.sources,checked_at:new Date().toISOString().slice(0,10),valid_until:'2027-01-01',effective_patch:'Test-only catalog amendment v2'});
    await send('catalog_transition',{id:v2.id,status:'review'});
    await send('catalog_transition',{id:v2.id,status:'published'});
    await send('goal_migrate',{id:goal,catalog_version_id:v2.id});
    expect(step('convert_main').reward.source.min_enhancement).toBe(20);
    expect(step('convert_atomic').reward.source.min_enhancement).toBe(19);

    // 15. The helper is not directly callable.
    await expect(db.transaction(async(tx:any)=>{await tx.exec('set local role authenticated');await tx.query("select app_private.convert_equipment($1,$2,'{}'::jsonb,null,'x','x',0,'[]'::jsonb)",[family,mainWeapon]);})).rejects.toThrow('permission denied');

    // 16. Malformed input: a garbage source id, and invalid catalog conversion specs.
    await expect(send('step_complete',{id:step('convert_atomic').id,mode:'spend',source_equipment_id:'not-a-uuid'})).rejects.toThrow();
    await send('catalog_create',{id:v2.id});
    const v3=s.catalogs.find((c:any)=>c.status==='draft');
    const saveV3=(content:unknown)=>send('catalog_save',{id:v3.id,title:v3.title,content,sources:draft.sources,checked_at:v3.checked_at,valid_until:v3.valid_until,effective_patch:v3.effective_patch});
    const badItemKey=structuredClone(CONTENT);badItemKey.steps[0].reward.source.item_key='does_not_exist';
    await expect(saveV3(badItemKey)).rejects.toThrow('VALIDATION');
    const sameItemNoIncrease=structuredClone(CONTENT);
    sameItemNoIncrease.steps[0].reward.source.item_key=sameItemNoIncrease.steps[0].reward.item_key;
    sameItemNoIncrease.steps[0].reward.source.max_enhancement=21;
    await expect(saveV3(sameItemNoIncrease)).rejects.toThrow('VALIDATION');
    const sameItemGenuineIncrease=structuredClone(CONTENT);
    sameItemGenuineIncrease.steps[0].reward.source.item_key=sameItemGenuineIncrease.steps[0].reward.item_key;
    await saveV3(sameItemGenuineIncrease);
    const badRange=structuredClone(CONTENT);badRange.steps[0].reward.source.min_enhancement=25;badRange.steps[0].reward.source.max_enhancement=1;
    await expect(saveV3(badRange)).rejects.toThrow('VALIDATION');
  }finally{await db.close();}
});
