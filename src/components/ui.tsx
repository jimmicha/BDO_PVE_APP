import {useEffect,useId,useRef,type ReactNode,type FormEvent,type ButtonHTMLAttributes} from 'react';
import {X,LoaderCircle,ArrowUpRight,Compass} from 'lucide-react';
import {useApp} from '../lib/AppContext';
export function Button({children,className='',loading,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{loading?:boolean}){return <button {...props} disabled={props.disabled||loading} className={'button '+className}>{loading&&<LoaderCircle className="spin" size={16}/>} {children}</button>;}
export function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={'panel '+className}>{children}</section>;}
export function Tag({children,tone='muted'}:{children:ReactNode;tone?:string}){return <span className={'tag '+tone}>{children}</span>;}
export function Empty({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){return <div className="empty"><div className="empty-icon"><Compass size={30}/></div><h3>{title}</h3><p>{children}</p>{action}</div>;}
export function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <header className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<p className="muted">{description}</p>}</div>{action}</header>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){const id=useId();return <label className="field" id={id}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),titleId=useId();
  const {error,hasRetry,retry,refresh,pending}=useApp();
  useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close();},[]);
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={pending}><X size={20}/></button></div>{children}{error&&<div className="inline-error" role="alert">{error}{hasRetry&&<div className="actions"><Button onClick={()=>void retry()} loading={pending}>Retry same request</Button><Button className="secondary" onClick={()=>void refresh()}>Reload latest data</Button></div>}</div>}
  </dialog>;
}
export function SubmitForm({children,onSubmit,className=''}:{children:ReactNode;onSubmit:(data:FormData)=>void|Promise<void>;className?:string}){
  return <form className={'form '+className} onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();void onSubmit(new FormData(e.currentTarget));}}>{children}</form>;
}
export const str=(d:FormData,key:string)=>String(d.get(key)??'').trim();
export function External({href,children}:{href:string;children:ReactNode}){return <a className="text-link" href={/^https:\/\//.test(href)?href:undefined} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14}/></a>;}
