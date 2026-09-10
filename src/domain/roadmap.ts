import {z} from 'zod';
import type {Snapshot,Step,Goal,Equipment} from './types';
export const quantitySchema=z.string().regex(/^[0-9]{1,19}$/,'Enter a whole nonnegative number.').refine(x=>BigInt(x)<=9223372036854775807n,'This quantity is too large.');
export const fmt=(x:string|number|bigint)=>BigInt(x).toLocaleString('en-US');
export function reserved(s:Snapshot,id:string,exceptGoal?:string){return s.allocations.filter(x=>x.resource_id===id&&x.goal_id!==exceptGoal).reduce((n,x)=>n+BigInt(x.quantity),0n);}
export function orderedSteps(steps:Step[]):Step[] {
  const map=new Map(steps.map(s=>[s.id,s])), visiting=new Set<string>(),done=new Set<string>(),result:Step[]=[];
  function visit(s:Step){if(visiting.has(s.id))throw Error('Dependency cycle');if(done.has(s.id))return;visiting.add(s.id);for(const id of s.dependencies){const dep=map.get(id);if(!dep)throw Error('Missing prerequisite');visit(dep);}visiting.delete(s.id);done.add(s.id);result.push(s);}
  [...steps].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).forEach(visit);return result;
}
export function conversionSourceOptions(s:Snapshot,step:Step):Equipment[]{
  const src=step.reward?.source; if(!src) return [];
  const goal=s.goals.find(g=>g.id===step.goal_id);
  return s.equipment.filter(e=>e.game_profile_id===goal?.game_profile_id&&e.item_key===src.item_key&&e.enhancement>=(src.min_enhancement??0)&&e.enhancement<=(src.max_enhancement??25));
}
export function stepReadiness(s:Snapshot,step:Step){
  const missingPrerequisites=step.dependencies.filter(id=>s.steps.find(x=>x.id===id)?.status!=='completed');
  const materials=step.requirements.map(r=>{const resource=s.resources.find(x=>x.id===r.resource_id),available=BigInt(resource?.quantity??'0')-reserved(s,r.resource_id,step.goal_id),required=BigInt(r.quantity);return {...r,name:resource?.name??'Unknown material',owned:resource?.quantity??'0',available,missing:required>available?required-available:0n};});
  const goal=s.goals.find(x=>x.id===step.goal_id);
  const claimed=!!step.claim_key&&s.claims.some(x=>x.game_profile_id===goal?.game_profile_id&&x.claim_key===step.claim_key);
  const conversionOptions=conversionSourceOptions(s,step);
  return {missingPrerequisites,materials,claimed,conversionOptions,ready:step.status==='pending'&&goal?.status==='active'&&!missingPrerequisites.length&&materials.every(x=>x.missing===0n)&&!claimed&&(!step.reward?.source||conversionOptions.length>0)};
}
export function goalMissing(s:Snapshot,goal:Goal){
  const totals=new Map<string,bigint>();
  for(const st of s.steps.filter(x=>x.goal_id===goal.id&&x.status==='pending'))for(const r of st.requirements)totals.set(r.resource_id,(totals.get(r.resource_id)??0n)+BigInt(r.quantity));
  return [...totals].map(([id,required])=>{const r=s.resources.find(x=>x.id===id),available=BigInt(r?.quantity??'0')-reserved(s,id,goal.id);return {id,name:r?.name??'Unknown material',required,available,missing:required>available?required-available:0n};});
}
export function migrationPreview(s:Snapshot,goal:Goal,newCatalogId:string){
  const c=s.catalogs.find(x=>x.id===newCatalogId);if(!c)throw Error('Catalog not found');
  return c.content.steps.map(next=>{const old=s.steps.find(x=>x.goal_id===goal.id&&x.template_key===next.key);return {title:next.title,status:old?.status??'new',before:old?.requirements.map(r=>({name:s.resources.find(x=>x.id===r.resource_id)?.name,quantity:r.quantity}))??[],after:next.requirements.map(r=>({name:c.content.resources.find(x=>x.key===r.resource_key)?.name,quantity:r.quantity}))};});
}
