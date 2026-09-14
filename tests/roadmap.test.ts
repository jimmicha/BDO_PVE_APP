import {it,expect} from 'vitest';
import {reorderSafe} from '../src/domain/roadmap';
import type {Step} from '../src/domain/types';
const step=(id:string,dependencies:string[]=[],category:Step['category']=null):Step=>({
  id,goal_id:'goal',title:id,description:'',position:0,status:'pending',dependencies,requirements:[],template_key:null,claim_key:null,reward:null,category,
});
it('refuses a section-local swap that would strand a dependency after its dependent',()=>{
  // Global order: A (weapon), B (armor, depends on A), C (weapon).
  // The Roadmap page's weapon section shows C's "up" neighbor as A (its
  // nearest same-category predecessor), skipping over B. Swapping A and C
  // directly would leave the order C, B, A — B now precedes its own
  // dependency A, which the server rejects with DEPENDENCY_ORDER.
  const a=step('A',[],'weapon'),b=step('B',['A'],'armor'),c=step('C',[],'weapon');
  const steps=[a,b,c];
  expect(reorderSafe(steps,'C','A')).toBe(false);
});
it('allows a swap that keeps every dependency before its dependent',()=>{
  const a=step('A',[],'weapon'),b=step('B',[],'weapon'),c=step('C',['A','B'],'armor');
  const steps=[a,b,c];
  expect(reorderSafe(steps,'A','B')).toBe(true);
});
it('refuses swapping a step directly past its own dependency',()=>{
  const a=step('A'),b=step('B',['A']);
  expect(reorderSafe([a,b],'A','B')).toBe(false);
});
it('returns false for an id outside the given step list',()=>{
  const a=step('A');
  expect(reorderSafe([a],'A','missing')).toBe(false);
});
