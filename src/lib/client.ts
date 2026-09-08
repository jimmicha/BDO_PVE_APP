import {createClient} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';
const local=import.meta.env.VITE_LOCAL_TEST_SERVER==='true';
if(import.meta.env.PROD&&local)throw Error('A local test backend must never be bundled in a release.');
export const configured=!!import.meta.env.VITE_SUPABASE_URL&&!!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isLocal=local;
const nativeStorage={
  getItem:async(key:string)=>(await Preferences.get({key})).value,
  setItem:async(key:string,value:string)=>{await Preferences.set({key,value});},
  removeItem:async(key:string)=>{await Preferences.remove({key});}
};
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL||'https://unconfigured.invalid',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'unconfigured',{
  auth:{flowType:'pkce',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,...(Capacitor.isNativePlatform()?{storage:nativeStorage}:{})}
});
export const callbackUrl=(path='callback')=>Capacitor.isNativePlatform()?'com.jimmicha.bdocompanion://auth/'+path:window.location.origin+'/auth/'+path;
export function humanError(error:unknown):string{
  const message=(error as {message?:string})?.message||String(error);
  if(message.includes('duplicate key'))return 'That name or equipped slot is already in use. Edit the existing entry or choose another slot.';
  if(message.includes('check constraint')||message.includes('not-null')||message.includes('invalid input'))return 'Please check the fields and enter valid values.';
  if(message.includes('Failed to fetch')||message.includes('fetch failed'))return 'Could not reach the server. Your change has not been confirmed. Reconnect and retry.';
  return message.replace(/^[A-Z_]+:\s*/,'');
}
