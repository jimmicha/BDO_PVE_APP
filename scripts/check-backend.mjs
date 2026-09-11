// Read-only cutover checks. Use Node --env-file=.env.next-backend before changing .env.local.
import {checkServices} from './lib/health-check.mjs';
console.log(JSON.stringify(await checkServices({url:process.env.VITE_SUPABASE_URL,key:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,appUrl:process.env.HEALTH_APP_URL,requireOAuth:process.env.HEALTH_REQUIRE_OAUTH==='true'}),null,2));
