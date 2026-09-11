import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import ladder from '../src/data/catalog-ladder-draft.json';
// @ts-expect-error Shared Node SQL harness.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';

// Silver requirements summed directly from src/data/grind-reference.json's BDO
// Workshop expected-cost rows for the matching item_group/enhancement range.
const EXPECTED_SILVER:Record<string,string>={
  s3_sovereign_main_tet:'21877267634',s3_sovereign_awakening_tet:'21877267634',s3_sovereign_sub_tet:'21877267634',
  s4_sovereign_primary_pen:'33602984986',s5_sovereign_hex:'63076533248',s6_sovereign_dec:'1942722093189',
  s3_labreska_helmet_tri:'42839727868',s3_fallen_god_armor_tri:'42839727868',s3_dahn_gloves_tri:'42839727868',s3_ator_shoes_tri:'42839727868',
  s4_labreska_helmet_tet:'103666968534',s4_fallen_god_armor_tet:'103666968534',s4_dahn_gloves_tet:'103666968534',s4_ator_shoes_tet:'103666968534',
  s5_edana_heavensmite_tri:'78753095432',s5_edana_abyssveil_tri:'78753095432',s5_edana_oathgrip_tri:'78753095432',s5_edana_furystride_tri:'78753095432',
  s6_edana_dec:'2327809818237',
  s3_kharazad_necklace_sep:'49853183976',s3_kharazad_belt_sep:'49853183976',s3_kharazad_ring_sep:'49853183976',s3_kharazad_ring_2_sep:'49853183976',s3_kharazad_earring_sep:'49853183976',s3_kharazad_earring_2_sep:'49853183976',
  s4_kharazad_necklace_nov:'156692897781',s4_kharazad_belt_nov:'156692897781',s4_kharazad_ring_nov:'156692897781',s4_kharazad_ring_2_nov:'156692897781',s4_kharazad_earring_nov:'156692897781',s4_kharazad_earring_2_nov:'156692897781',
  s6_ekleta_dec:'613108645855',
};

// Cross-item conversions (the item genuinely changes: Blackstar -> Sovereign,
// Kharazad -> Ekleta) and same-item enhancement upgrades (item_key unchanged,
// enhancement increases) that the fixed draft is expected to wire via
// reward.source. Verified against data/reference/catalog-v2-ladder.json.
const EXPECTED_SOURCES:Record<string,{item_key:string,min_enhancement:number,max_enhancement:number}>={
  s3_sovereign_main_base:{item_key:'blackstar_main',min_enhancement:20,max_enhancement:20},
  s3_sovereign_awakening_base:{item_key:'blackstar_awakening',min_enhancement:20,max_enhancement:20},
  s3_sovereign_sub_base:{item_key:'blackstar_sub',min_enhancement:20,max_enhancement:20},
  s3_sovereign_main_tet:{item_key:'sovereign_main',min_enhancement:0,max_enhancement:0},
  s3_sovereign_awakening_tet:{item_key:'sovereign_awakening',min_enhancement:0,max_enhancement:0},
  s3_sovereign_sub_tet:{item_key:'sovereign_sub',min_enhancement:0,max_enhancement:0},
  s3_kharazad_necklace_sep:{item_key:'kharazad_necklace',min_enhancement:20,max_enhancement:20},
  s3_kharazad_belt_sep:{item_key:'kharazad_belt',min_enhancement:20,max_enhancement:20},
  s3_kharazad_ring_sep:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20},
  s3_kharazad_earring_sep:{item_key:'kharazad_earring',min_enhancement:20,max_enhancement:20},
  s4_labreska_helmet_tet:{item_key:'labreska_helmet',min_enhancement:18,max_enhancement:18},
  s4_fallen_god_armor_tet:{item_key:'fallen_god_armor',min_enhancement:18,max_enhancement:18},
  s4_dahn_gloves_tet:{item_key:'dahn_gloves',min_enhancement:18,max_enhancement:18},
  s4_ator_shoes_tet:{item_key:'ator_shoes',min_enhancement:18,max_enhancement:18},
  s4_edana_heavensmite_base:{item_key:'labreska_helmet',min_enhancement:19,max_enhancement:19},
  s4_edana_abyssveil_base:{item_key:'fallen_god_armor',min_enhancement:19,max_enhancement:19},
  s4_edana_oathgrip_base:{item_key:'dahn_gloves',min_enhancement:19,max_enhancement:19},
  s4_edana_furystride_base:{item_key:'ator_shoes',min_enhancement:19,max_enhancement:19},
  s4_kharazad_necklace_nov:{item_key:'kharazad_necklace',min_enhancement:22,max_enhancement:22},
  s4_kharazad_belt_nov:{item_key:'kharazad_belt',min_enhancement:22,max_enhancement:22},
  s4_kharazad_ring_nov:{item_key:'kharazad_ring',min_enhancement:22,max_enhancement:22},
  s4_kharazad_earring_nov:{item_key:'kharazad_earring',min_enhancement:22,max_enhancement:22},
  s5_edana_heavensmite_tri:{item_key:'edana_heavensmite',min_enhancement:0,max_enhancement:0},
  s5_edana_abyssveil_tri:{item_key:'edana_abyssveil',min_enhancement:0,max_enhancement:0},
  s5_edana_oathgrip_tri:{item_key:'edana_oathgrip',min_enhancement:0,max_enhancement:0},
  s5_edana_furystride_tri:{item_key:'edana_furystride',min_enhancement:0,max_enhancement:0},
  s5_sovereign_hex:{item_key:'sovereign_main',min_enhancement:19,max_enhancement:19},
  s5_ekleta_necklace_base:{item_key:'kharazad_necklace',min_enhancement:24,max_enhancement:24},
  s5_ekleta_belt_base:{item_key:'kharazad_belt',min_enhancement:24,max_enhancement:24},
  s5_ekleta_ring_base:{item_key:'kharazad_ring',min_enhancement:24,max_enhancement:24},
  s5_ekleta_earring_base:{item_key:'kharazad_earring',min_enhancement:24,max_enhancement:24},
  s6_sovereign_dec:{item_key:'sovereign_main',min_enhancement:21,max_enhancement:21},
  s6_edana_dec:{item_key:'edana_abyssveil',min_enhancement:18,max_enhancement:18},
  s6_ekleta_dec:{item_key:'ekleta_necklace',min_enhancement:0,max_enhancement:0},
  s3_kharazad_ring_2_sep:{item_key:'kharazad_ring',min_enhancement:20,max_enhancement:20},
  s4_kharazad_ring_2_nov:{item_key:'kharazad_ring',min_enhancement:22,max_enhancement:22},
  s5_ekleta_ring_2_base:{item_key:'kharazad_ring',min_enhancement:24,max_enhancement:24},
  s3_kharazad_earring_2_sep:{item_key:'kharazad_earring',min_enhancement:20,max_enhancement:20},
  s4_kharazad_earring_2_nov:{item_key:'kharazad_earring',min_enhancement:22,max_enhancement:22},
  s5_ekleta_earring_2_base:{item_key:'kharazad_earring',min_enhancement:24,max_enhancement:24},
};

it('saves the 76-step ladder as an unreviewed draft without exposing it to player recommendations',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');const original=s.catalogs[0];
    const send=async(kind:string,data:unknown)=>{s=await rpc(db,ALICE,'companion_catalog',{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});};
    await send('catalog_create',{id:original.id});const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await send('catalog_save',{...ladder,id:draft.id});
    const saved=s.catalogs.find((c:any)=>c.id===draft.id);expect(saved.content.steps).toHaveLength(76);expect(saved.checked_at).toBeNull();
    for(const step of original.content.steps)expect(saved.content.steps.some((x:any)=>x.key===step.key)).toBe(true);
    expect(saved.content.steps.filter((x:any)=>x.claim_key).map((x:any)=>x.claim_key).sort()).toEqual(original.content.steps.filter((x:any)=>x.claim_key).map((x:any)=>x.claim_key).sort());
    await expect(send('catalog_transition',{id:draft.id,status:'review'})).rejects.toThrow('CATALOG_REVIEW');
    const player=await rpc(db,BOB,'companion_snapshot');expect(player.catalogs.some((c:any)=>c.id===draft.id)).toBe(false);

    const byKey=(key:string)=>saved.content.steps.find((x:any)=>x.key===key);
    expect(byKey('s1_season_graduation').reward).toBeUndefined();
    expect(byKey('s4_sovereign_primary_pen').reward).toBeUndefined();
    for(const [key,source] of Object.entries(EXPECTED_SOURCES)){
      const found=byKey(key);
      expect(found,'missing step '+key).toBeDefined();
      expect(found.reward?.source,'missing reward.source on '+key).toEqual({...source,keep_assignment:true});
    }
    for(const [slot,ringOne] of [['ring','s3_kharazad_ring_sep'],['earring','s3_kharazad_earring_sep']] as const){
      const two=byKey(`s3_kharazad_${slot}_2_sep`),one=byKey(ringOne);
      expect(two.requirements).toEqual(one.requirements);
    }
    for(const [key,quantity] of Object.entries(EXPECTED_SILVER)){
      const found=byKey(key);
      expect(found.requirements,'missing silver requirement on '+key).toEqual([{resource_key:'silver',quantity}]);
    }
    expect(saved.content.resources.some((r:any)=>r.key==='silver')).toBe(true);
  }finally{await db.close();}
});

it('the fixed draft can pass review and reach published once dated and sourced',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');const original=s.catalogs[0];
    const send=async(kind:string,data:unknown)=>{s=await rpc(db,ALICE,'companion_catalog',{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});};
    await send('catalog_create',{id:original.id});const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await send('catalog_save',{
      ...ladder,id:draft.id,
      checked_at:new Date().toISOString().slice(0,10),valid_until:'2027-01-01',
    });
    await send('catalog_transition',{id:draft.id,status:'review'});
    await send('catalog_transition',{id:draft.id,status:'published'});
    expect(s.catalogs.find((c:any)=>c.id===draft.id).status).toBe('published');
  }finally{await db.close();}
});

it('a real chain (Blackstar -> Sovereign -> TET) converts in place with no duplicate equipment',async()=>{
  const db=await openDatabase();try{
    await seedUsers(db);let s=await rpc(db,ALICE,'companion_snapshot');const original=s.catalogs[0];
    const send=async(kind:string,data:unknown)=>{
      const target=kind.startsWith('catalog_')?'companion_catalog':'companion_command';
      s=await rpc(db,ALICE,target,{kind,data,expected_revision:s.profile.revision,request_id:randomUUID()});
      return s;
    };
    await send('catalog_create',{id:original.id});const draft=s.catalogs.find((c:any)=>c.status==='draft');
    await send('catalog_save',{...ladder,id:draft.id,checked_at:new Date().toISOString().slice(0,10),valid_until:'2027-01-01'});
    await send('catalog_transition',{id:draft.id,status:'review'});
    await send('catalog_transition',{id:draft.id,status:'published'});
    await send('family_create',{family_name:'Chain test',region:'EU'});
    const family=s.game_profiles[0].id;
    await send('goal_create',{game_profile_id:family,catalog_version_id:draft.id});
    const goal=s.goals.find((g:any)=>g.catalog_version_id===draft.id).id;
    const step=(key:string)=>s.steps.find((x:any)=>x.goal_id===goal&&x.template_key===key);
    await send('step_complete',{id:step('olvia_enrollment').id,mode:'spend'});
    const before=new Set(s.equipment.map((e:any)=>e.id));
    await send('step_complete',{id:step('s2_blackstar_main').id,mode:'spend'});
    const blackstar=s.equipment.find((e:any)=>!before.has(e.id)&&e.item_key==='blackstar_main').id;
    await send('step_complete',{id:step('s3_sovereign_main_base').id,mode:'spend',source_equipment_id:blackstar});
    let item=s.equipment.find((e:any)=>e.id===blackstar);
    expect(item.item_key).toBe('sovereign_main');expect(item.enhancement).toBe(0);
    const silver=s.resources.find((r:any)=>r.item_key==='silver').id;
    await send('resource_save',{id:silver,quantity:'999999999999999'});
    await send('step_complete',{id:step('s3_sovereign_main_tet').id,mode:'spend',source_equipment_id:blackstar});
    item=s.equipment.find((e:any)=>e.id===blackstar);
    expect(item.item_key).toBe('sovereign_main');expect(item.enhancement).toBe(19);
    expect(s.equipment.filter((e:any)=>e.item_key==='sovereign_main'||e.item_key==='blackstar_main')).toHaveLength(1);
    expect(s.resources.find((r:any)=>r.item_key==='silver').quantity).toBe('999978122732365');
  }finally{await db.close();}
});
