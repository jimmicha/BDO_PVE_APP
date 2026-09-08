import {Component,useEffect,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Capacitor} from '@capacitor/core';
import {App as NativeApp} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {useRegisterSW} from 'virtual:pwa-register/react';
import App from './App';
import {AppProvider,useApp} from './lib/AppContext';
import {supabase} from './lib/client';
import './styles.css';
import './accessibility.css';

const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnReconnect:true},mutations:{retry:false}}});
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="standalone"><h1>Something interrupted your journey.</h1><p>Your confirmed changes are stored in your account. Reload to try again.</p><button className="button" onClick={()=>window.location.reload()}>Reload companion</button></main>:this.props.children;}
}
function DeviceBehavior(){
  const navigate=useNavigate(),location=useLocation(),a=useApp();
  useEffect(()=>{document.documentElement.dataset.reduceMotion=a.snapshot?.profile.preferences.reduce_motion?'true':'false';},[a.snapshot?.profile.preferences.reduce_motion]);
  useEffect(()=>{window.scrollTo(0,0);},[location.pathname]);
  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let stopped=false;const handles:({remove:()=>Promise<void>})[]=[];
    async function receive(raw:string){
      const url=new URL(raw);
      if(url.protocol!=='com.jimmicha.bdocompanion:'||url.hostname!=='auth'||!['/callback','/reset'].includes(url.pathname))return;
      await Browser.close().catch(()=>undefined);
      navigate('/auth'+url.pathname+url.search,{replace:true});
    }
    (async()=>{
      const open=await NativeApp.addListener('appUrlOpen',e=>void receive(e.url));handles.push(open);
      const back=await NativeApp.addListener('backButton',()=>{
        const dialog=document.querySelector('dialog[open]');
        if(dialog){dialog.dispatchEvent(new Event('cancel',{cancelable:true}));return;}
        if(window.location.pathname!=='/'){if((window.history.state?.idx??0)>0)navigate(-1);else navigate('/',{replace:true});}else void NativeApp.minimizeApp();
      });handles.push(back);
      const state=await NativeApp.addListener('appStateChange',e=>{if(e.isActive)supabase.auth.startAutoRefresh();else supabase.auth.stopAutoRefresh();});handles.push(state);
      const launch=await NativeApp.getLaunchUrl();if(launch&&!stopped)await receive(launch.url);
      if(stopped)await Promise.all(handles.map(h=>h.remove()));
    })();
    return()=>{stopped=true;for(const h of handles)void h.remove();};
  },[navigate]);
  return null;
}
function UpdateAvailable(){
  const {needRefresh:[refresh],updateServiceWorker}=useRegisterSW();
  const a=useApp();
  return refresh?<div className="update-banner" role="status">A companion update is ready.<button className="button small" disabled={a.pending||a.hasRetry} onClick={()=>void updateServiceWorker(true)}>Update app</button></div>:null;
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><QueryClientProvider client={queryClient}><BrowserRouter><AppProvider><DeviceBehavior/><App/>{!Capacitor.isNativePlatform()&&<UpdateAvailable/>}</AppProvider></BrowserRouter></QueryClientProvider></ErrorBoundary>);
