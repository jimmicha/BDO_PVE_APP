import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {Session} from '@supabase/supabase-js';
import type {Command,Snapshot} from '../domain/types';
import {supabase,configured,humanError} from './client';

const CACHE_PREFIX='bdo-cache-v1:';
function clearPrivateCache(){for(const k of Object.keys(localStorage))if(k.startsWith(CACHE_PREFIX))localStorage.removeItem(k);}
function readCache(id?:string):Snapshot|undefined{if(!id)return;try{const data=JSON.parse(localStorage.getItem(CACHE_PREFIX+id)||'null');return data?.profile?.id===id?data:undefined;}catch{return;}}
function cache(data:Snapshot){try{localStorage.setItem(CACHE_PREFIX+data.profile.id,JSON.stringify(data));}catch{/* Server remains authoritative when device storage is full. */}}
type AppState={
  session:Session|null;authReady:boolean;snapshot:Snapshot|undefined;loading:boolean;error:string;notice:string;pending:boolean;offline:boolean;
  familyId:string;characterId:string;setFamilyId:(id:string)=>void;setCharacterId:(id:string)=>void;
  save:(kind:string,data:Record<string,unknown>,expectedRevision?:number)=>Promise<boolean>;refresh:()=>Promise<unknown>;signOut:()=>Promise<void>;
  retry:()=>Promise<boolean>;clearNotice:()=>void;hasRetry:boolean;
};
const Context=createContext<AppState|null>(null);
export function AppProvider({children}:{children:ReactNode}){
  const queryClient=useQueryClient(),[session,setSession]=useState<Session|null>(null),[authReady,setReady]=useState(!configured);
  const [offline,setOffline]=useState(!navigator.onLine),[familyId,setFamily]=useState(''),[characterId,setCharacter]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[denied,setDenied]=useState(false);
  const uncertain=useRef<Command|null>(null),activeUser=useRef<string|undefined>(undefined),busy=useRef(false);
  useEffect(()=>{
    const update=(next:Session|null)=>{
      if(activeUser.current!==next?.user.id){queryClient.clear();if(activeUser.current||!next)clearPrivateCache();uncertain.current=null;setFamily('');setCharacter('');setError('');setNotice('');setDenied(false);}
      activeUser.current=next?.user.id;setSession(next);setReady(true);
    };
    supabase.auth.getSession().then(({data})=>update(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>update(next));
    const online=()=>setOffline(!navigator.onLine);window.addEventListener('online',online);window.addEventListener('offline',online);
    return()=>{data.subscription.unsubscribe();window.removeEventListener('online',online);window.removeEventListener('offline',online);};
  },[queryClient]);
  const user=session?.user.id;
  const query=useQuery<Snapshot>({
    queryKey:['snapshot',user],enabled:!!user&&!offline&&configured,
    initialData:()=>offline?readCache(user):undefined,staleTime:15000,refetchOnWindowFocus:true,retry:false,
    queryFn:async()=>{
      const actor=user;
      const {data,error:err}=await supabase.rpc('companion_snapshot');
      if(err){if(/AUTH_REQUIRED|BETA_ACCESS|ACCOUNT_DELETING|JWT expired/.test(err.message)){clearPrivateCache();setDenied(true);}throw err;}
      if(activeUser.current!==actor)throw Error('Account changed');
      setDenied(false);cache(data);return data as Snapshot;
    }
  });
  const snapshot=denied?undefined:query.data??(offline?readCache(user):undefined);
  const selectedFamily=snapshot?.game_profiles.find(f=>f.id===familyId)?.id??snapshot?.game_profiles[0]?.id??'';
  const selectedCharacter=snapshot?.characters.find(c=>c.id===characterId&&c.game_profile_id===selectedFamily)?.id??snapshot?.characters.find(c=>c.game_profile_id===selectedFamily)?.id??'';
  async function execute(cmd:Command){
    if(busy.current)return false;
    if(offline){setError('Reconnect before making changes.');return false;}
    const actor=user;busy.current=true;setPending(true);setError('');setNotice('');
    const endpoint=cmd.kind.startsWith('catalog_')?'companion_catalog':cmd.kind==='goal_migrate'?'companion_migrate_goal':'companion_command';
    try{
      const {data,error:err}=await supabase.rpc(endpoint,{command:cmd});
      if(err)throw err;
      if(activeUser.current!==actor)return false;
      uncertain.current=null;cache(data);queryClient.setQueryData(['snapshot',actor],data);setNotice('Saved to your account');return true;
    }catch(err){
      if(activeUser.current===actor){setError(humanError(err));const e=err as {message?:string;code?:string};uncertain.current=(!e.code||e.code==='40001'||/fetch|network|CONFLICT/i.test(e.message??''))?cmd:null;}
      return false;
    }finally{busy.current=false;setPending(false);}
  }
  async function save(kind:string,data:Record<string,unknown>,expectedRevision?:number){
    if(!snapshot)return false;
    if(uncertain.current){setError('Resolve the previous change with Retry or Reload before saving another. Your form is still available.');return false;}
    return execute({kind,data,expected_revision:expectedRevision??snapshot.profile.revision,request_id:crypto.randomUUID()});
  }
  async function refresh(){uncertain.current=null;setError('');return query.refetch();}
  async function signOut(){
    clearPrivateCache();queryClient.clear();uncertain.current=null;
    setSession(null);activeUser.current=undefined;
    await supabase.auth.signOut({scope:'local'});
  }
  return <Context.Provider value={{session,authReady,snapshot,loading:query.isLoading,error:error||(query.error?humanError(query.error):''),notice,pending,offline,
    familyId:selectedFamily,characterId:selectedCharacter,setFamilyId:id=>{setFamily(id);setCharacter('');},setCharacterId:setCharacter,save,refresh,signOut,retry:async()=>uncertain.current?execute(uncertain.current):false,hasRetry:!!uncertain.current,clearNotice:()=>{setNotice('');}}}>{children}</Context.Provider>;
}
export function useApp(){const ctx=useContext(Context);if(!ctx)throw Error('AppProvider missing');return ctx;}
