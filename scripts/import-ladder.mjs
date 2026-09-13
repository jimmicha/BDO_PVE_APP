import {readFile,writeFile} from 'node:fs/promises';
import {catalog} from './catalog.mjs';
const original=JSON.parse(await readFile('data/reference/catalog-v2-ladder.json','utf8'));
const draft=structuredClone(original),aliases=new Map([['s2_olvia_enrollment','olvia_enrollment']]);
for(const step of draft.content.steps){const existing=catalog.content.steps.find(s=>s.claim_key&&s.claim_key===step.claim_key);if(existing)aliases.set(step.key,existing.key);}
for(const step of draft.content.steps){step.key=aliases.get(step.key)||step.key;step.dependencies=step.dependencies.map(key=>aliases.get(key)||key);}
// Keep the already-reviewed prerequisite unchanged; the supplied season dependency is not verified.
const olvia=draft.content.steps.find(s=>s.key==='olvia_enrollment');olvia.dependencies=[];
draft.status='draft';draft.checked_at=null;draft.valid_until=null;
draft.review_notes=[
  'Imported from the owner-supplied ZIP on 2026-09-10. Draft only; not certified for recommendations.',
  'Preserved the seven existing template identities and all six family claim keys for migration safety.',
  'Removed the new season-graduation prerequisite from Olvia pending official verification.',
  'Review costs and reward semantics: an empty requirements list means no deductions, not verified zero cost.',
  'Gear upgrades currently create equipment rewards rather than replacing or consuming an existing item; review every upgrade/conversion before publication.',
  'A Tuvala set reward creates one inventory entry, not thirteen independently equippable items.',
  'Review both ring and earring slots throughout later stages, class-specific weapon priorities, and stage-wide dependencies.',
  'Verify all new systems against current official PC NA/EU evidence and a second reference before setting review dates.',
  'Ring/earring conversions (SEP/NOV/Ekleta) share one item_key across both physical slots; the player explicitly selects which physical item to convert at step completion, so this is not ambiguous in practice.',
  'Several gear lines intentionally stop short of DEC in this guide (Sovereign awakening/sub-weapon at TET; Ekleta belt/ring/earring and three of four Edana pieces at their first tier) — this reflects the scope of the owner-supplied source material, not a missing step.'
];
// Tags each milestone with the gear piece it advances so the app's Roadmap
// page can group the ladder into sections (weapon/armor/accessory/alchemy
// stone/artifact progression). Untagged keys are general milestones (season
// graduation, Olvia enrollment, crystal presets, the AP/DP adventure-journal
// block) and render in a general section instead of a false-precision tag.
const CATEGORY_BY_KEY={
  s2_blackstar_main:'weapon',s2_blackstar_awakening:'weapon',s2_blackstar_sub:'weapon',
  s3_sovereign_main_base:'weapon',s3_sovereign_awakening_base:'weapon',s3_sovereign_sub_base:'weapon',
  s3_garmoth_main:'weapon',s3_garmoth_awakening:'weapon',
  s3_sovereign_main_tet:'weapon',s3_sovereign_awakening_tet:'weapon',s3_sovereign_sub_tet:'weapon',
  s4_sovereign_primary_pen:'weapon',s5_sovereign_hex:'weapon',s6_han_reforge:'weapon',s6_sovereign_dec:'weapon',
  s2_slumbering_base:'armor',s3_ancient_set:'armor',
  s3_labreska_helmet_tri:'armor',s3_fallen_god_armor_tri:'armor',s3_dahn_gloves_tri:'armor',s3_ator_shoes_tri:'armor',
  s4_labreska_helmet_tet:'armor',s4_fallen_god_armor_tet:'armor',s4_dahn_gloves_tet:'armor',s4_ator_shoes_tet:'armor',
  s4_edana_heavensmite_base:'armor',s4_edana_abyssveil_base:'armor',s4_edana_oathgrip_base:'armor',s4_edana_furystride_base:'armor',
  s5_edana_heavensmite_tri:'armor',s5_edana_abyssveil_tri:'armor',s5_edana_oathgrip_tri:'armor',s5_edana_furystride_tri:'armor',
  s6_edana_dec:'armor',
  necklace:'accessory',belt:'accessory',ring_1:'accessory',ring_2:'accessory',earring_1:'accessory',earring_2:'accessory',
  s3_kharazad_necklace_sep:'accessory',s3_kharazad_belt_sep:'accessory',s3_kharazad_ring_sep:'accessory',s3_kharazad_ring_2_sep:'accessory',s3_kharazad_earring_sep:'accessory',s3_kharazad_earring_2_sep:'accessory',
  s4_dawn_all_ap:'accessory',s4_accessory_cups:'accessory',
  s4_kharazad_necklace_nov:'accessory',s4_kharazad_belt_nov:'accessory',s4_kharazad_ring_nov:'accessory',s4_kharazad_ring_2_nov:'accessory',s4_kharazad_earring_nov:'accessory',s4_kharazad_earring_2_nov:'accessory',
  s5_ekleta_necklace_base:'accessory',s5_ekleta_belt_base:'accessory',s5_ekleta_ring_base:'accessory',s5_ekleta_ring_2_base:'accessory',s5_ekleta_earring_base:'accessory',s5_ekleta_earring_2_base:'accessory',
  s6_ekleta_dec:'accessory',
  s3_marsh_artifact:'artifact',s3_kabua_artifacts:'artifact',s4_kabua_heralding:'artifact',s5_amplified_lightstones:'artifact',
  ap_vells_heart:'alchemy_stone',
};
for(const step of draft.content.steps){const category=CATEGORY_BY_KEY[step.key];if(category)step.category=category;}
const keys=new Set();for(const step of draft.content.steps){if(keys.has(step.key)||step.dependencies.some(dep=>!keys.has(dep)))throw Error('Invalid dependency order at '+step.key);keys.add(step.key);}
for(const step of catalog.content.steps)if(!keys.has(step.key))throw Error('Missing inherited template '+step.key);
await writeFile('src/data/catalog-ladder-draft.json',JSON.stringify(draft,null,2)+'\n');
console.log('Prepared '+draft.content.steps.length+' draft milestones; preserved version-one identities.');
