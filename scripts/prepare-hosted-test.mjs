// Disposable Auth fixtures. Never use a real person's email or add these to a production seed.
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.local',{recursive:true});
const users=Array.from({length:2},()=>({id:randomUUID(),email:'bdo-smoke-'+randomUUID()+'@example.invalid',password:randomBytes(30).toString('base64url')}));
const sql=users.map(u=>[
  "insert into app_private.beta_members(email,role) values ('"+u.email+"','tester');",
  "insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token) values ('00000000-0000-0000-0000-000000000000','"+u.id+"','authenticated','authenticated','"+u.email+"',extensions.crypt('"+u.password+"',extensions.gen_salt('bf')),now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}','{}',now(),now(),'','','','','','');",
  "insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values ('"+u.id+"','"+u.id+"','"+JSON.stringify({sub:u.id,email:u.email,email_verified:true})+"','email',now(),now());"
].join('\n')).join('\n');
await writeFile('.local/hosted-test-accounts.json',JSON.stringify(users),{mode:0o600});
await writeFile('.local/hosted-test-setup.sql',sql,{mode:0o600});
console.log('Prepared two disposable fixtures under .local. Credentials were not printed.');
