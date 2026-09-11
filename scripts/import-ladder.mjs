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
const keys=new Set();for(const step of draft.content.steps){if(keys.has(step.key)||step.dependencies.some(dep=>!keys.has(dep)))throw Error('Invalid dependency order at '+step.key);keys.add(step.key);}
for(const step of catalog.content.steps)if(!keys.has(step.key))throw Error('Missing inherited template '+step.key);
await writeFile('src/data/catalog-ladder-draft.json',JSON.stringify(draft,null,2)+'\n');
console.log('Prepared '+draft.content.steps.length+' draft milestones; preserved version-one identities.');
