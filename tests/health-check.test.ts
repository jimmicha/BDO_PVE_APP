import {describe,it,expect} from 'vitest';
// @ts-expect-error Node operator utility intentionally uses plain JavaScript.
import {checkServices} from '../scripts/lib/health-check.mjs';
const auth={external:{email:true,google:true,discord:true},mailer_autoconfirm:false};
function run(status=401,code='42501',settings=auth){
  return checkServices({url:'https://example.invalid',key:'public-test-key',requireOAuth:true,fetchImpl:async (url:string)=>url.endsWith('/settings')?Response.json(settings):Response.json({code},{status})});
}
describe('release health checks',()=>{
  it('recognizes the actual permission denial',async()=>{expect((await run()).anonymousDenied).toBe(true);});
  it.each([[500,'XX000'],[404,'PGRST202'],[200,'42501'],[401,'invalid_api_key']])('rejects HTTP %s / %s rather than reporting healthy',async(status,code)=>{await expect(run(Number(status),String(code))).rejects.toThrow();});
  it('detects a disabled OAuth provider',async()=>{await expect(run(401,'42501',{...auth,external:{...auth.external,discord:false}})).rejects.toThrow('OAuth');});
});
