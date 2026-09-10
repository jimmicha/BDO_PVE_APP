import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowRight,Compass,ShieldCheck,Layers,Cloud,ExternalLink} from 'lucide-react';
import {Capacitor} from '@capacitor/core';
import {Browser} from '@capacitor/browser';
import {Button,Field,SubmitForm,str} from '../components/ui';
import {callbackUrl,configured,humanError,isLocal,supabase} from '../lib/client';
export function Auth(){
  const [mode,setMode]=useState<'signin'|'signup'|'recover'>('signin'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(d:FormData){
    setBusy(true);setError('');setMessage('');
    const email=str(d,'email'),password=str(d,'password');
    try{
      const response=mode==='signin'?await supabase.auth.signInWithPassword({email,password}):mode==='signup'?await supabase.auth.signUp({email,password,options:{emailRedirectTo:callbackUrl()}}):await supabase.auth.resetPasswordForEmail(email,{redirectTo:callbackUrl('reset')});
      if(response.error)throw response.error;
      if(mode==='signup')setMessage(isLocal?'Your local test account is ready.':'Check your email to verify your account, then return to sign in.');
      if(mode==='recover')setMessage(isLocal?'Open the local inbox to find your recovery link.':'If this account exists, a recovery email is on its way.');
    }catch(e){setError(humanError(e));}finally{setBusy(false);}
  }
  async function google(){
    if(isLocal){setMessage('Google sign-in will work after a Supabase project and Google OAuth client are connected. The local environment supports email test accounts.');return;}
    setBusy(true);setError('');
    const {data,error:err}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:callbackUrl(),skipBrowserRedirect:Capacitor.isNativePlatform()}});
    if(err)setError(humanError(err));else if(data.url&&Capacitor.isNativePlatform())await Browser.open({url:data.url});
    setBusy(false);
  }
  async function discord(){
    if(isLocal){setMessage('Discord sign-in will work after a Supabase project and Discord OAuth client are connected. The local environment supports email test accounts.');return;}
    setBusy(true);setError('');
    const {data,error:err}=await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:callbackUrl(),skipBrowserRedirect:Capacitor.isNativePlatform()}});
    if(err)setError(humanError(err));else if(data.url&&Capacitor.isNativePlatform())await Browser.open({url:data.url});
    setBusy(false);
  }
  return <main className="auth-layout">
    <section className="auth-story"><Link to="/" className="brand"><img src="/icon.svg" alt=""/><span>BDO <b>COMPANION</b></span></Link>
      <div className="story-copy"><p className="eyebrow">FOR YOUR NEXT CHAPTER</p><h1>Your journey.<br/><em>Remembered.</em></h1><p>From your first season to your next great upgrade. Keep your characters, materials, and ambitions in one place.</p>
      <div className="story-features"><span><Layers size={18}/> Every character, one home</span><span><Compass size={18}/> A clear path forward</span><span><Cloud size={18}/> Pick up where you left off</span></div></div>
      <p className="auth-foot">An independent companion for Black Desert Online · PC NA/EU</p><div className="astrolabe" aria-hidden="true"><i/><i/><i/><span>✧</span></div>
    </section>
    <section className="auth-form"><div className="auth-card"><Tagline/><h2>{mode==='signin'?'Welcome, adventurer.':mode==='signup'?'Begin your journey.':'Find your way back.'}</h2><p className="muted">{mode==='signin'?'Sign in to continue your story.':mode==='signup'?'Create your private companion account.':'We’ll send a link to reset your password.'}</p>
      {!configured?<div className="notice">The beta is being configured. Sign-in becomes available once the account service is connected.</div>:<>
      {mode!=='recover'&&<><Button className="secondary full" onClick={google} loading={busy}><span className="google-letter">G</span>Continue with Google</Button><Button className="secondary full" onClick={discord} loading={busy}><span className="discord-letter">D</span>Continue with Discord</Button><div className="divider"><span>or continue with email</span></div></>}
      <SubmitForm onSubmit={submit}><Field label="Email address"><input name="email" type="email" autoComplete="email" placeholder={isLocal?'explorer@local.test':'you@example.com'} required maxLength={254}/></Field>
        {mode!=='recover'&&<Field label="Password"><input name="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?10:1} placeholder="Your password" required maxLength={128}/></Field>}
        {mode==='signup'&&<label className="check-row"><input type="checkbox" required/><span>I have read the <Link to="/privacy">privacy information</Link>.</span></label>}
        {error&&<p className="inline-error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
        <Button className="full" loading={busy} type="submit">{mode==='signin'?'Sign in':mode==='signup'?'Create account':'Send recovery link'}<ArrowRight size={17}/></Button>
      </SubmitForm>
      <div className="auth-links">{mode==='signin'?<><button onClick={()=>{setMode('signup');setError('');setMessage('');}}>Create an account</button><button onClick={()=>{setMode('recover');setError('');setMessage('');}}>Forgot password?</button></>:<button onClick={()=>{setMode('signin');setError('');setMessage('');}}>Back to sign in</button>}</div>
      {isLocal&&<div className="local-help"><strong>Local test accounts</strong><p>explorer@local.test or ranger@local.test<br/>Password: <code>LocalExplorer123!</code></p><small>Use test credentials here. Google and email delivery need hosted setup.</small><a href="http://127.0.0.1:54329/local/inbox" target="_blank" rel="noreferrer">Open local inbox <ExternalLink size={12}/></a></div>}
      </>}<p className="privacy-note"><ShieldCheck size={15}/>Your game login is never requested.</p>
    </div></section>
  </main>;
}
function Tagline(){return <p className="eyebrow">YOUR ADVENTURE, ORGANIZED</p>;}
export function AuthCallback(){
  const navigate=useNavigate();const [error,setError]=useState('');
  useEffect(()=>{let active=true;(async()=>{
    const url=new URL(window.location.href),code=url.searchParams.get('code'),token=url.searchParams.get('token_hash');
    const result=token?await supabase.auth.verifyOtp({token_hash:token,type:'email'}):code?await supabase.auth.exchangeCodeForSession(code):await supabase.auth.getSession();
    if(!active)return;if(result.error)setError(humanError(result.error));else navigate('/',{replace:true});
  })();return()=>{active=false;};},[navigate]);
  return <main className="standalone"><h1>Completing sign-in</h1>{error?<p role="alert">{error}</p>:<p>Returning to your journey…</p>}<Link to="/">Return home</Link></main>;
}
export function ResetPassword(){
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{(async()=>{const url=new URL(window.location.href);const token=url.searchParams.get('token_hash'),code=url.searchParams.get('code');
    const result=token?await supabase.auth.verifyOtp({token_hash:token,type:'recovery'}):code?await supabase.auth.exchangeCodeForSession(code):await supabase.auth.getSession();
    if(result.error)setError(humanError(result.error));else {setReady(!!result.data.session);history.replaceState(null,'',url.pathname);}
  })();},[]);
  return <main className="standalone"><img className="standalone-logo" src="/icon.svg" alt="BDO Companion"/><h1>Reset your password</h1>{done?<><p>Your password has been updated.</p><Link to="/">Return to your account</Link></>:ready?<SubmitForm onSubmit={async d=>{setBusy(true);const {error:err}=await supabase.auth.updateUser({password:str(d,'password')});setBusy(false);if(err)setError(humanError(err));else setDone(true);}}><Field label="New password"><input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password"/></Field><Button type="submit" loading={busy}>Update password</Button></SubmitForm>:<p>Open the latest recovery link from your email.</p>}{error&&<p className="inline-error" role="alert">{error}</p>}<Link to="/">Back to sign in</Link></main>;
}
