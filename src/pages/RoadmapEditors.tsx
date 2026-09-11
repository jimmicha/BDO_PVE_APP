import {useState} from 'react';
import {enhancementLabel,slots,type Goal,type Step} from '../domain/types';
import {useApp} from '../lib/AppContext';
import {Button,Field,Modal,SubmitForm,str,Tag} from '../components/ui';
import {fmt,stepReadiness} from '../domain/roadmap';
export function GoalEditor({goal,onClose}:{goal?:Goal;onClose:()=>void}){
  const a=useApp(),s=a.snapshot!,catalog=s.catalogs.find(x=>x.status==='published'),[guided,setGuided]=useState(!goal&&!!catalog);
  return <Modal title={goal?'Edit roadmap':'Choose your next chapter'} onClose={onClose}><SubmitForm onSubmit={async d=>{if(await a.save(goal?'goal_update':'goal_create',{id:goal?.id,game_profile_id:a.familyId,character_id:a.characterId||null,title:str(d,'title'),description:str(d,'description'),priority:Number(str(d,'priority')),status:str(d,'status')||'active',first_step:str(d,'first_step'),catalog_version_id:guided?catalog?.id:null}))onClose();}}>
    {!goal&&<div className="segmented"><button type="button" className={guided?'selected':''} onClick={()=>setGuided(true)} disabled={!catalog}>Guided journey</button><button type="button" className={!guided?'selected':''} onClick={()=>setGuided(false)}>Custom roadmap</button></div>}
    {guided?<div className="guide-intro"><Tag tone="gold">NEW & RETURNING PLAYERS</Tag><h3>{catalog?.title}</h3><p>Follow this guide's milestones in order. Record any progress or rewards you already have without spending materials twice.</p><small>Verified {catalog?.checked_at} · PC NA/EU · Version {catalog?.version}</small></div>:<><Field label="Roadmap title"><input name="title" required maxLength={120} defaultValue={goal?.title} placeholder="e.g. My next armor upgrade"/></Field>{!goal&&<Field label="First step"><input name="first_step" maxLength={160} required placeholder="What needs to happen first?"/></Field>}</>}
    <Field label="Your notes"><textarea name="description" maxLength={3000} defaultValue={goal?.description} placeholder="What are you working toward?"/></Field><Field label="Priority"><select name="priority" defaultValue={goal?.priority??1}><option value={1}>1 · Focus now</option><option value={2}>2 · Work toward</option><option value={3}>3 · Later</option></select></Field>
    {goal&&<Field label="Status"><select name="status" defaultValue={goal.status==='completed'?'active':goal.status}><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived · release reservations</option></select></Field>}
    <Button type="submit" loading={a.pending} disabled={a.offline}>{goal?'Save roadmap':'Create roadmap'}</Button>
  </SubmitForm></Modal>;
}
export function StepEditor({goal,step,onClose}:{goal:Goal;step?:Step;onClose:()=>void}){
  const a=useApp(),s=a.snapshot!,resources=s.resources.filter(r=>r.game_profile_id===goal.game_profile_id),[selected,setSelected]=useState<string[]>(step?.requirements.map(r=>r.resource_id)??[]);
  return <Modal title={step?'Edit step':'Add a roadmap step'} onClose={onClose}><SubmitForm onSubmit={async d=>{const requirements=selected.map(id=>({resource_id:id,quantity:str(d,'quantity-'+id)}));if(await a.save('step_save',{id:step?.id,goal_id:goal.id,title:str(d,'title'),description:str(d,'description'),dependencies:d.getAll('dependency'),requirements}))onClose();}}>
    <Field label="Step title"><input name="title" defaultValue={step?.title} required maxLength={160}/></Field><Field label="Instructions or notes"><textarea name="description" maxLength={3000} defaultValue={step?.description}/></Field>
    <fieldset><legend>Prerequisite steps</legend>{s.steps.filter(x=>x.goal_id===goal.id&&x.id!==step?.id).map(x=><label className="check-row" key={x.id}><input type="checkbox" name="dependency" value={x.id} defaultChecked={step?.dependencies.includes(x.id)}/><span>{x.title}</span></label>)}</fieldset>
    <fieldset><legend>Material requirements</legend>{resources.length?resources.map(r=><div className="requirement-edit" key={r.id}><label className="check-row"><input type="checkbox" checked={selected.includes(r.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/><span>{r.name}</span></label>{selected.includes(r.id)&&<input aria-label={'Required '+r.name} name={'quantity-'+r.id} inputMode="numeric" pattern="[0-9]+" required defaultValue={step?.requirements.find(x=>x.resource_id===r.id)?.quantity??'1'}/>}</div>):<p className="muted">Add materials on the Resources screen first.</p>}</fieldset>
    <Button type="submit" loading={a.pending} disabled={a.offline}>Save step</Button></SubmitForm></Modal>;
}
export function CompletionDialog({step,onClose}:{step:Step;onClose:()=>void}){
  const a=useApp(),s=a.snapshot!,ready=stepReadiness(s,step),hasSource=!!step.reward?.source;
  const [mode,setMode]=useState(ready.claimed||(!step.requirements.length&&!hasSource)?'record':'spend');
  const [sourceId,setSourceId]=useState(ready.conversionOptions[0]?.id??'');
  const goal=s.goals.find(g=>g.id===step.goal_id)!,catalog=s.catalogs.find(c=>c.id===goal.catalog_version_id);
  const stale=!!catalog&&(catalog.status!=='published'||!catalog.valid_until||catalog.valid_until<new Date().toISOString().slice(0,10));
  return <Modal title="Review this completion" onClose={onClose}><h3>{step.title}</h3><p className="muted">Record progress after completing the action in Black Desert. The companion does not perform game actions.</p>
    {(!!step.requirements.length||hasSource)&&<div className="choice-list"><label className="check-row"><input type="radio" name="completion" checked={mode==='spend'} onChange={()=>setMode('spend')} disabled={ready.claimed||stale}/><span><strong>Apply materials{step.reward?' and add the reward':''}</strong><small>Use the transaction below to update your recorded inventory.</small></span></label><label className="check-row"><input type="radio" name="completion" checked={mode==='record'} onChange={()=>setMode('record')}/><span><strong>Already done · record progress only</strong><small>Inventory stays as recorded. Add missing equipment separately.</small></span></label></div>}
    {ready.claimed&&<p className="notice">This family has already recorded this reward. It cannot be awarded a second time.</p>}
    {stale&&<p className="notice">This catalog version needs review or migration before an inventory transaction.</p>}
    {mode==='spend'&&hasSource&&<fieldset><legend>Choose the item to convert</legend>
      {ready.conversionOptions.length?ready.conversionOptions.map(e=><label className="check-row" key={e.id}>
        <input type="radio" name="source" checked={sourceId===e.id} onChange={()=>setSourceId(e.id)}/>
        <span>{e.name} · {enhancementLabel(e.enhancement)}{e.slot?` · ${slots[e.slot as keyof typeof slots]}`:''}</span>
      </label>):<p className="inline-error">No compatible item found in this family's equipment.</p>}
    </fieldset>}
    {mode==='spend'&&<div className="transaction-preview">{ready.materials.map(r=><div key={r.resource_id}><span>{r.name}<small>{fmt(r.available)} available to this roadmap</small></span><strong>− {fmt(r.quantity)}</strong><Tag tone={r.missing?'gold':'green'}>{r.missing?fmt(r.missing)+' missing':fmt(BigInt(r.owned)-BigInt(r.quantity))+' remaining'}</Tag></div>)}{step.reward&&<p className="reward-line">{hasSource?`Convert ${ready.conversionOptions.find(e=>e.id===sourceId)?.name??'the selected item'} into `:'+ 1 '}{enhancementLabel(step.reward.enhancement)+' '+(catalog?.content.items.find(i=>i.key===step.reward?.item_key)?.name)}{hasSource?'':' → family equipment inventory'}</p>}</div>}
    {!!ready.missingPrerequisites.length&&<p className="inline-error">Complete the prerequisite steps first.</p>}
    <Button className="full" loading={a.pending} disabled={a.offline||!!ready.missingPrerequisites.length||(mode==='spend'&&(!ready.ready||stale||(hasSource&&!sourceId)))} onClick={async()=>{if(await a.save('step_complete',{id:step.id,mode,...(hasSource?{source_equipment_id:sourceId}:{})}))onClose();}}>{mode==='spend'?'Confirm inventory transaction':'Confirm prior completion'}</Button>
  </Modal>;
}
