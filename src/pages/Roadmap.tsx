import {useState} from 'react';
import {Plus,Check,LockKeyhole,ArrowUp,ArrowDown,Pencil,Route,ChevronRight,RotateCcw,BookOpen,Package} from 'lucide-react';
import {useApp} from '../lib/AppContext';
import {stepCategories,type Goal,type Step,type StepCategory} from '../domain/types';
import {fmt,goalMissing,migrationPreview,orderedSteps,reserved,stepReadiness} from '../domain/roadmap';
import {Button,Empty,External,Field,Modal,PageTitle,Panel,SubmitForm,Tag,str} from '../components/ui';
import {CompletionDialog,GoalEditor,StepEditor} from './RoadmapEditors';
import {Onboarding} from '../components/Onboarding';

function Reservations({goal,onClose}:{goal:Goal;onClose:()=>void}){
  const a=useApp(),s=a.snapshot!,resources=s.resources.filter(r=>r.game_profile_id===goal.game_profile_id);
  const [resourceId,setResourceId]=useState(goalMissing(s,goal)[0]?.id??resources[0]?.id??'');
  const resource=resources.find(r=>r.id===resourceId),current=s.allocations.find(x=>x.goal_id===goal.id&&x.resource_id===resourceId)?.quantity??'0';
  return <Modal title="Reserve materials for this roadmap" onClose={onClose}><p className="muted">Reservations protect materials from other roadmaps. Set a quantity to zero to release it.</p><SubmitForm onSubmit={async d=>{if(await a.save('allocation_set',{goal_id:goal.id,resource_id:resourceId,quantity:str(d,'quantity')}))onClose();}}>
    <Field label="Material"><select value={resourceId} onChange={e=>setResourceId(e.target.value)}>{resources.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></Field>
    <Field label="Total to reserve" hint={resource?fmt(BigInt(resource.quantity)-reserved(s,resource.id,goal.id))+' available to this roadmap':undefined}><input key={resourceId} name="quantity" required pattern="[0-9]+" inputMode="numeric" defaultValue={current}/></Field>
    <Button type="submit" loading={a.pending} disabled={a.offline||!resourceId}>Save reservation</Button>
  </SubmitForm></Modal>;
}
export function Roadmap(){
  const a=useApp(),s=a.snapshot,[active,setActive]=useState(''),[goalEdit,setGoalEdit]=useState<Goal|true|null>(null),[stepEdit,setStepEdit]=useState<Step|true|null>(null),[complete,setComplete]=useState<Step|null>(null),[reopen,setReopen]=useState<Step|null>(null),[reserve,setReserve]=useState(false),[source,setSource]=useState(false),[migrate,setMigrate]=useState(false),[showArchived,setArchived]=useState(false);
  if(!s)return null;if(!a.familyId)return <Onboarding/>;
  const goals=s.goals.filter(g=>g.game_profile_id===a.familyId&&(showArchived||g.status!=='archived'));
  const goal=goals.find(g=>g.id===active)??goals[0],steps=goal?orderedSteps(s.steps.filter(x=>x.goal_id===goal.id)):[],done=steps.filter(x=>x.status==='completed').length;
  const catalog=s.catalogs.find(c=>c.id===goal?.catalog_version_id),latest=s.catalogs.find(c=>c.status==='published'),missing=goal?goalMissing(s,goal):[];
  const canEdit=goal?.status==='active'&&!a.offline;
  const bucket=(st:Step):StepCategory=>st.category??'other';
  // Sections are ordered by where each gear piece's earliest milestone falls
  // in the roadmap's own dependency order, not a fixed category priority, so
  // an ungrouped prerequisite (e.g. an academy enrollment step) still leads
  // when nothing gear-specific can happen before it.
  const sections=[...new Set(steps.map(bucket))]
    .map(cat=>({cat,label:stepCategories[cat],items:steps.filter(st=>bucket(st)===cat)}))
    .sort((a,b)=>steps.indexOf(a.items[0])-steps.indexOf(b.items[0]));
  async function move(step:Step,neighbor:Step|undefined){if(!goal||!neighbor)return;const ids=steps.map(x=>x.id),i=ids.indexOf(step.id),j=ids.indexOf(neighbor.id);[ids[i],ids[j]]=[ids[j],ids[i]];await a.save('step_reorder',{goal_id:goal.id,order:ids});}
  return <><PageTitle eyebrow="PROGRESSION, WITH PURPOSE" title="Your next chapter." description="Turn big ambitions into a journey you can follow." action={<Button onClick={()=>setGoalEdit(true)} disabled={a.offline}><Plus size={16}/>New roadmap</Button>}/>
    <div className="filter-row"><div className="tabs" aria-label="Roadmaps">{goals.map(g=><button key={g.id} onClick={()=>setActive(g.id)} className={goal?.id===g.id?'active':''}>{g.title}{g.status==='completed'&&<Check size={14}/>}</button>)}</div><label className="check-row compact"><input type="checkbox" checked={showArchived} onChange={e=>setArchived(e.target.checked)}/>Show archived</label></div>
    {!goal?<Panel><Empty title="Every adventure needs a direction" action={<Button onClick={()=>setGoalEdit(true)} disabled={a.offline}>Create your first roadmap<ChevronRight size={16}/></Button>}>Start with the reviewed Kharazad guide or build a plan around your own goals.</Empty></Panel>:<>
      <Panel className="roadmap-banner"><div className="roadmap-heading"><div><div className="actions"><Tag tone="gold">{catalog?'GUIDED JOURNEY':'YOUR CUSTOM PLAN'}</Tag><Tag tone={goal.status==='completed'?'green':'muted'}>{goal.status}</Tag><span className="muted text-small">Priority {goal.priority}</span></div><h2>{goal.title}</h2><p className="muted">{goal.description||'A clear path forward, one milestone at a time.'}</p></div><button className="icon-button" aria-label="Edit roadmap" onClick={()=>setGoalEdit(goal)} disabled={a.offline}><Pencil size={18}/></button></div>
        <div className="progress-label"><span>{done} of {steps.length} milestones completed</span><strong>{steps.length?Math.round(done/steps.length*100):0}%</strong></div><progress value={done} max={steps.length||1} aria-label="Roadmap completion"/>
        <div className="roadmap-meta">{catalog?<button className="text-link" onClick={()=>setSource(true)}><BookOpen size={14}/>Reviewed guide · v{catalog.version} · {catalog.checked_at}</button>:<span className="muted">Custom entries are based on your own research.</span>}<Button className="secondary small" onClick={()=>setReserve(true)} disabled={!canEdit}><LockKeyhole size={14}/>Reserve materials</Button></div>
        {latest&&catalog&&latest.id!==catalog.id&&<div className="notice">A newer guide is available. Your existing plan is pinned to v{catalog.version}.<Button className="small" onClick={()=>setMigrate(true)} disabled={a.offline}>Preview changes</Button></div>}
      </Panel>
      <div className="roadmap-layout"><Panel className="milestones"><div className="panel-heading"><h3>Your milestones</h3>{!catalog&&<Button className="small secondary" onClick={()=>setStepEdit(true)} disabled={!canEdit}><Plus size={14}/>Add step</Button>}</div>
        {sections.map(section=><section className="milestone-section" key={section.cat}><h4 className="milestone-section-title">{section.label}</h4>
        {section.items.map((step,index)=>{const r=stepReadiness(s,step),finished=step.status==='completed',prereq=r.missingPrerequisites.length>0,prev=section.items[index-1],next=section.items[index+1];return <article className={'milestone '+(finished?'completed':r.ready?'ready':'')} key={step.id}>
          <div className="milestone-track"><span className="milestone-marker">{finished?<Check size={16}/>:prereq?<LockKeyhole size={15}/>:String(index+1).padStart(2,'0')}</span></div>
          <div className="milestone-body"><div className="milestone-top"><h3>{step.title}</h3><Tag tone={finished?'green':r.ready?'gold':'muted'}>{finished?'Complete':prereq?'Prerequisite':r.claimed?'Claim recorded':r.ready?'Ready':'Gather materials'}</Tag></div><p>{step.description}</p>
            {!!step.dependencies.length&&<p className="step-dependencies">Requires: {step.dependencies.map(id=>s.steps.find(x=>x.id===id)?.title??'Missing step').join(' · ')}</p>}
            {!!r.materials.length&&<div className="material-chips">{r.materials.map(m=><span className={m.missing&&!finished?'missing':''} key={m.resource_id}><Package size={12}/>{fmt(m.quantity)} {m.name}{!finished&&<small>{m.missing?fmt(m.missing)+' missing':'Available'}</small>}</span>)}</div>}
            <div className="milestone-actions">{finished?<button className="text-link muted" disabled={a.offline||a.pending} onClick={()=>setReopen(step)}><RotateCcw size={13}/>Reopen step</button>:<Button className={r.ready?'small':'secondary small'} disabled={!canEdit||prereq} onClick={()=>setComplete(step)}>{r.ready?'Review & complete':'Record completion'}<ChevronRight size={14}/></Button>}
              <div className="actions">{!catalog&&!finished&&<button className="icon-button" aria-label={'Edit '+step.title} disabled={!canEdit} onClick={()=>setStepEdit(step)}><Pencil size={14}/></button>}
                <button className="icon-button" aria-label={'Move up '+step.title} disabled={!canEdit||!prev||step.dependencies.includes(prev.id)} onClick={()=>void move(step,prev)}><ArrowUp size={14}/></button><button className="icon-button" aria-label={'Move down '+step.title} disabled={!canEdit||!next||next.dependencies.includes(step.id)} onClick={()=>void move(step,next)}><ArrowDown size={14}/></button>
              </div></div>
          </div></article>;})}
        </section>)}
      </Panel><div className="roadmap-aside"><Panel><div className="panel-heading"><h3>Materials to gather</h3><Package size={17}/></div><p className="muted">For the remaining steps, after other reservations.</p>{missing.length?missing.map(m=><div className="material-row" key={m.id}><div><strong>{m.name}</strong><small>{fmt(m.available)} available / {fmt(m.required)} needed</small></div><Tag tone={m.missing?'gold':'green'}>{m.missing?fmt(m.missing)+' left':'Ready'}</Tag></div>):<p className="muted">No remaining material requirements.</p>}</Panel>
        <Panel className="quiet-panel"><Route size={24}/><h3>Move at your own pace.</h3><p>Complete each action in the game, then record it here. Already earned a reward? Choose “progress only” to keep your inventory accurate.</p><small>Market prices are not tracked in this beta.</small></Panel></div></div>
    </>}
    {goalEdit&&<GoalEditor goal={goalEdit===true?undefined:goalEdit} onClose={()=>setGoalEdit(null)}/>}
    {goal&&stepEdit&&<StepEditor goal={goal} step={stepEdit===true?undefined:stepEdit} onClose={()=>setStepEdit(null)}/>}
    {complete&&<CompletionDialog step={s.steps.find(x=>x.id===complete.id)??complete} onClose={()=>setComplete(null)}/>}
    {goal&&reserve&&<Reservations goal={goal} onClose={()=>setReserve(false)}/>}
    {reopen&&<Modal title="Reopen this milestone?" onClose={()=>setReopen(null)}><p><strong>{reopen.title}</strong></p><p>Completed dependent steps will also reopen. Previously spent materials and family reward claims remain recorded. Correct inventory separately through a journal adjustment.</p><Button className="secondary" loading={a.pending} disabled={a.offline} onClick={async()=>{if(await a.save('step_reopen',{id:reopen.id,reopen_dependents:true}))setReopen(null);}}>Reopen without a refund</Button></Modal>}
    {source&&catalog&&<Modal title="Guide provenance" onClose={()=>setSource(false)}><Tag tone="gold">PC · NA/EU · Version {catalog.version}</Tag><p>{catalog.effective_patch}</p><p>Verified {catalog.checked_at}. Review due {catalog.valid_until}.</p>{catalog.sources.map(x=><div className="source-row" key={x.url}><External href={x.url}>{x.name}</External><small>{x.scope}</small></div>)}<p className="muted">Olvia Academy enrollment availability can change. Check the live game notice before starting the prerequisite.</p></Modal>}
    {migrate&&goal&&latest&&<Modal title={'Review catalog v'+latest.version} onClose={()=>setMigrate(false)}><p>Completed steps retain their history. Pending steps adopt the new requirements below. Existing equipment keeps its original catalog version.</p>{migrationPreview(s,goal,latest.id).map((x,i)=><div className="migration-row" key={i}><strong>{x.title}</strong><Tag>{x.status}</Tag><small>{x.status==='completed'?'Preserved':x.before.map(r=>r.quantity+' '+r.name).join(', ')+' → '+(x.after.map(r=>r.quantity+' '+r.name).join(', ')||'No materials')}</small></div>)}<Button loading={a.pending} onClick={async()=>{if(await a.save('goal_migrate',{id:goal.id,catalog_version_id:latest.id}))setMigrate(false);}}>Confirm migration</Button></Modal>}
  </>;
}
