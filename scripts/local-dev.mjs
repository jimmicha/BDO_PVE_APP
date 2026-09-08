import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
const api=spawn(process.execPath,['scripts/local-api.mjs'],{stdio:'inherit',windowsHide:true});
let ready=false;
for(let i=0;i<60;i++){try{ready=(await fetch('http://127.0.0.1:54329/health')).ok;if(ready)break;}catch{}await setTimeout(500);}
if(!ready){api.kill();throw Error('Local API failed to start.');}
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'inherit',windowsHide:true,env:{...process.env,VITE_SUPABASE_URL:'http://127.0.0.1:54329',VITE_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VITE_LOCAL_TEST_SERVER:'true'}});
const stop=()=>{api.kill();vite.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);vite.on('exit',()=>{api.kill();});
