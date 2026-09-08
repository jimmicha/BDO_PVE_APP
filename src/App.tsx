import {Suspense} from 'react';
import {Navigate,NavLink,Outlet,Route,Routes,Link} from 'react-router-dom';
import {House,Swords,Route as RouteIcon,Package,Ellipsis,LogOut,ChevronDown,Check,CloudOff,RefreshCw,Plus,Compass} from 'lucide-react';
import {useApp} from './lib/AppContext';
import {isLocal} from './lib/client';
import {Auth,AuthCallback,ResetPassword} from './pages/Auth';
// Core routes must remain available if connectivity disappears before first navigation.
import {Home} from './pages/Home';
import {Gear} from './pages/Gear';
import {Resources} from './pages/Resources';
import {Roadmap} from './pages/Roadmap';
import {More,Privacy,DeleteAccount,Admin} from './pages/More';
import {Reference} from './pages/Reference';
import {Button,Empty,PageTitle} from './components/ui';

import {en} from './i18n/en';
const navigation=[['/','Overview',House],['/gear','Gear',Swords],['/roadmap','Roadmap',RouteIcon],['/resources','Resources',Package],['/more','More',Ellipsis]] as const;
function Shell(){
  const app=useApp(),s=app.snapshot;
  const family=s?.game_profiles.find(f=>f.id===app.familyId);
  if(!app.authReady)return <div className="loading-screen"><Compass className="spin"/><p>Opening your companion…</p></div>;
  if(!app.session)return <Auth/>;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><Link to="/" className="brand"><img src="/icon.svg" alt=""/><span>BDO <b>COMPANION</b></span></Link><p className="nav-caption">YOUR ADVENTURE</p>
      <nav aria-label="Main navigation">{navigation.map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/'}><Icon size={19}/><span>{label}</span><span className="nav-dot"/></NavLink>)}</nav>
      <div className="sidebar-guide"><span className="eyebrow">ONE STEP AT A TIME</span><Compass size={28}/><p>Great adventures<br/>start with a plan.</p><Link to="/roadmap">Find your next step <span>↗</span></Link></div>
      <div className="sidebar-bottom"><div className="profile-avatar">{s?.profile.display_name?.[0]??'A'}</div><div><strong>{s?.profile.display_name??'Adventurer'}</strong><small>Private beta · PC NA/EU</small></div><button className="icon-button" onClick={()=>void app.signOut()} aria-label="Sign out"><LogOut size={17}/></button></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Companion <span>/</span> <strong>{family?.family_name??'Your journey'}</strong></div>
      <div className="topbar-right"><span className={'sync-state '+(app.offline?'offline':'')} title={app.offline?'Cached data is read-only':'Changes are saved after server confirmation'}>{app.offline?<CloudOff size={14}/>:<span className="status-dot"/>}{app.offline?'Offline':app.pending?'Saving…':'Connected'}</span>
        {!!s?.game_profiles.length&&<label className="compact-select"><span className="sr-only">Active family</span><select value={app.familyId} onChange={e=>app.setFamilyId(e.target.value)}>{s.game_profiles.map(f=><option key={f.id} value={f.id}>{f.family_name} · {f.region}</option>)}</select><ChevronDown size={14}/></label>}
      </div></header>
      {isLocal&&<div className="environment-bar">{en.local}</div>}
      <main className="app-content" id="main-content" tabIndex={-1}>
        {app.error&&<div className="notice error" role="alert"><span>{app.error}</span><div className="actions">{app.hasRetry&&<Button className="small" onClick={()=>void app.retry()} loading={app.pending}>Retry same request</Button>}<Button className="small secondary" onClick={()=>void app.refresh()}><RefreshCw size={14}/>Reload</Button></div></div>}
        {app.offline&&<div className="notice"><CloudOff size={16}/>{en.offline}. Reconnect to save changes.</div>}
        {app.notice&&<div className="save-toast" role="status"><Check size={15}/>{app.notice}<button aria-label="Dismiss saved message" onClick={app.clearNotice}>×</button></div>}
        {app.loading&&!s?<div className="loading-screen"><Compass className="spin"/><p>Loading your journey…</p></div>:s?<Outlet/>:!app.error?<Empty title="Your data is unavailable">Reconnect and reload your account.</Empty>:null}
      </main><footer className="app-footer"><span>BDO Companion</span><span>Your adventure. Your pace.</span><Link to="/privacy">Privacy</Link></footer>
    </div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{navigation.map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/'}><Icon size={20}/><span>{label==='Overview'?'Home':label}</span></NavLink>)}</nav>
  </div>;
}
export default function App(){
  return <Suspense fallback={<div className="loading-screen"><Compass className="spin"/><p>Loading…</p></div>}><Routes><Route path="/auth/callback" element={<AuthCallback/>}/><Route path="/auth/reset" element={<ResetPassword/>}/><Route path="/privacy" element={<Privacy/>}/><Route path="/account-deletion" element={<DeleteAccount/>}/><Route element={<Shell/>}><Route index element={<Home/>}/><Route path="/gear" element={<Gear/>}/><Route path="/reference" element={<Reference/>}/><Route path="/roadmap" element={<Roadmap/>}/><Route path="/resources" element={<Resources/>}/><Route path="/more" element={<More/>}/><Route path="/admin" element={<Admin/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense>;
}
