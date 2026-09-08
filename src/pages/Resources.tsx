import {useState} from 'react';
import {Coins,Package,Plus,Pencil,ArrowDownUp,LockKeyhole} from 'lucide-react';
import {useApp} from '../lib/AppContext';
import {Button,Empty,Field,Modal,PageTitle,Panel,SubmitForm,Tag,str} from '../components/ui';
import {fmt,quantitySchema,reserved} from '../domain/roadmap';
import type {Resource} from '../domain/types';
import {Onboarding} from '../components/Onboarding';
export function ResourceEditor({resource,adjust=false,onClose}:{resource?:Resource;adjust?:boolean;onClose:()=>void}){
  const a=useApp(),[validation,setValidation]=useState(''),[preview,setPreview]=useState<{data:Record<string,unknown>;after:bigint}|null>(null);
  if(preview&&resource)return <Modal title="Confirm resource deduction" onClose={onClose}><h3>{resource.name}</h3><div className="transaction-preview"><div><span>Recorded balance</span><strong>{fmt(resource.quantity)}</strong></div><div><span>Deduction</span><strong>− {fmt(BigInt(resource.quantity)-preview.after)}</strong></div><div><span>New balance</span><strong>{fmt(preview.after)}</strong></div></div><p className="muted">The server will verify your current revision and reservations before saving this adjustment.</p><div className="actions"><Button className="secondary" onClick={()=>setPreview(null)} disabled={a.pending}>Back</Button><Button loading={a.pending} disabled={a.offline} onClick={async()=>{if(await a.save(adjust?'resource_adjust':'resource_save',preview.data))onClose();}}>Confirm deduction</Button></div></Modal>;
  return <Modal title={adjust?'Record an acquisition or correction':resource?'Update '+resource.name:'Add a resource'} onClose={onClose}><SubmitForm onSubmit={async d=>{
    const amount=str(d,adjust?'delta':'quantity');
    if(!adjust&&!quantitySchema.safeParse(amount).success){setValidation('Use a whole nonnegative number within the supported range.');return;}
    if(adjust&&!/^-?[0-9]{1,19}$/.test(amount)){setValidation('Enter a whole positive or negative adjustment.');return;}
    const data={id:resource?.id,game_profile_id:a.familyId,name:str(d,'name'),quantity:amount,delta:amount,reason:str(d,'reason')},after=adjust?BigInt(resource?.quantity??'0')+BigInt(amount):BigInt(amount);
    if(after<0n){setValidation('The resulting balance cannot be negative.');return;}
    if(resource&&after<BigInt(resource.quantity)){setPreview({data,after});return;}
    if(await a.save(adjust?'resource_adjust':'resource_save',data))onClose();
  }}>
    {!resource&&<Field label="Resource name"><input name="name" required maxLength={120} placeholder="e.g. Memory Fragment"/></Field>}
    <Field label={adjust?'Quantity change':'Owned quantity'} hint={adjust?'Positive adds materials; negative records a correction.':'Reservations are part of this total, not additional materials.'}><input name={adjust?'delta':'quantity'} inputMode={adjust?'text':'numeric'} pattern={adjust?'-?[0-9]+':'[0-9]+'} defaultValue={adjust?'':resource?.quantity??'0'} required maxLength={20}/></Field>
    {adjust&&<Field label="Journal description"><input name="reason" placeholder="e.g. Gathered during today’s session" required maxLength={200}/></Field>}
    {resource&&<p className="muted">Currently recorded: {fmt(resource.quantity)} {resource.unit}</p>}
    {validation&&<p className="inline-error" role="alert">{validation}</p>}<Button loading={a.pending} disabled={a.offline} type="submit">Save {adjust?'adjustment':'balance'}</Button>
  </SubmitForm></Modal>;
}
export function Resources(){
  const a=useApp(),s=a.snapshot,[edit,setEdit]=useState<Resource|true|null>(null),[adjust,setAdjust]=useState<Resource|null>(null),[search,setSearch]=useState(''),[reservation,setReservation]=useState<Resource|null>(null);
  if(!s)return null;if(!a.familyId)return <Onboarding/>;
  const resources=s.resources.filter(r=>r.game_profile_id===a.familyId),silver=resources.find(r=>r.item_key==='silver'),items=resources.filter(r=>r.item_key!=='silver'&&r.name.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle eyebrow="YOUR SHARED INVENTORY" title="Make every material count." description="Track what you own, what’s reserved, and what comes next." action={<Button onClick={()=>setEdit(true)} disabled={a.offline}><Plus size={16}/>Add resource</Button>}/>
    <Panel className="silver-panel"><div className="silver-mark"><Coins size={36}/></div><div><p className="eyebrow">FAMILY SILVER</p><h2>{fmt(silver?.quantity??'0')}<small> silver</small></h2><p className="muted">{fmt(silver?reserved(s,silver.id):0n)} reserved · Manually recorded</p></div><div className="actions"><Button className="secondary" disabled={a.offline||!silver} onClick={()=>setAdjust(silver!)}><ArrowDownUp size={15}/>Record change</Button><Button disabled={a.offline||!silver} onClick={()=>setEdit(silver!)}><Pencil size={15}/>Update balance</Button></div></Panel>
    <Panel><div className="panel-heading"><div><h3>Materials & currencies</h3><p className="muted">Shared across characters in this family</p></div><input className="search-input" aria-label="Search resources" placeholder="Search materials…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {items.length?<div className="resource-table"><div className="resource-table-head"><span>MATERIAL</span><span>OWNED</span><span>RESERVED</span><span>AVAILABLE</span><span/></div>{items.map(r=>{const held=reserved(s,r.id);return <div className="resource-table-row" key={r.id}><div className="resource-name"><span className="item-icon"><Package size={21}/></span><div><strong>{r.name}</strong><small>{r.item_key?'Progression material':'Manual entry'}</small></div></div><div data-label="Owned">{fmt(r.quantity)}</div><div data-label="Reserved"><button className="number-link" onClick={()=>setReservation(r)}>{fmt(held)}<LockKeyhole size={11}/></button></div><div className="available" data-label="Available">{fmt(BigInt(r.quantity)-held)}</div><div className="actions"><button className="icon-button" aria-label={'Adjust '+r.name} onClick={()=>setAdjust(r)} disabled={a.offline}><ArrowDownUp size={16}/></button><button className="icon-button" aria-label={'Edit '+r.name} onClick={()=>setEdit(r)} disabled={a.offline}><Pencil size={16}/></button></div></div>;})}</div>:<Empty title={search?'No matching materials':'Give your inventory a home'} action={!search?<Button className="secondary" onClick={()=>setEdit(true)}>Add a resource</Button>:undefined}>Guided roadmaps add the materials they need. You can also add your own.</Empty>}
    </Panel><p className="subtle-note">Reserving materials does not spend them. Confirmed completion transactions record deductions and rewards.</p>
    {edit&&<ResourceEditor resource={edit===true?undefined:edit} onClose={()=>setEdit(null)}/>}
    {adjust&&<ResourceEditor resource={adjust} adjust onClose={()=>setAdjust(null)}/>}
    {reservation&&<Modal title={'Reservations · '+reservation.name} onClose={()=>setReservation(null)}>{s.allocations.filter(x=>x.resource_id===reservation.id).length?s.allocations.filter(x=>x.resource_id===reservation.id).map(x=><div className="material-row" key={x.id}><div><strong>{s.goals.find(g=>g.id===x.goal_id)?.title}</strong><small>{fmt(x.quantity)} reserved</small></div><Button className="secondary small" loading={a.pending} disabled={a.offline} onClick={()=>void a.save('allocation_set',{goal_id:x.goal_id,resource_id:x.resource_id,quantity:'0'})}>Release</Button></div>):<p>No materials are reserved.</p>}<Tag>Available: {fmt(BigInt(reservation.quantity)-reserved(s,reservation.id))}</Tag></Modal>}
  </>;
}
