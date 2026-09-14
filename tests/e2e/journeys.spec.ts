import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const password='JourneyTest123!';
test('equipment upgrade previews deductions and preserves the owned item',async({page})=>{
  await signup(page,'upgrade-'+randomUUID()+'@local.test');await onboard(page);
  await navigate(page,'Resources');await page.getByRole('button',{name:'Update balance'}).click();await page.getByLabel('Owned quantity',{exact:false}).fill('100');await page.getByRole('button',{name:'Save balance',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page,'Gear');await page.getByRole('button',{name:/Helmet.*Empty slot/}).click();await page.getByLabel('Item name',{exact:false}).fill('Test helmet');await page.getByRole('button',{name:'Save equipment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:/Helmet.*Test helmet/}).click();await page.getByRole('combobox',{name:'Enhancement',exact:true}).selectOption('21');await page.getByText('Record upgrade costs',{exact:true}).click();await page.getByLabel('Spend Silver',{exact:true}).fill('10');await page.getByRole('button',{name:'Save equipment',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('100 owned − 10 spent = 90 remaining');
  await page.getByRole('button',{name:'Confirm upgrade and deduct resources'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Helmet.*Test helmet/})).toContainText('HEX');
  await navigate(page,'Resources');await expect(page.locator('.silver-panel')).toContainText('90');
  await navigate(page,'More');await expect(page.locator('.journal-list')).toContainText('Recorded equipment upgrade');
  await page.reload();await expect(page.locator('.journal-list')).toContainText('Recorded equipment upgrade');
});
test('imported reference preserves unknowns, compares enhancements and opens the full guide offline',async({page},info)=>{
  await signup(page,'reference-'+randomUUID()+'@local.test');await onboard(page);await navigate(page,'Gear');
  await page.getByRole('link',{name:/Browse gear stats/}).click();
  await expect(page.getByRole('heading',{name:'Plan beyond your next upgrade.'})).toBeVisible();
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  await page.getByLabel('Search equipment').fill('Apeiron Necklace');
  await expect(page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sheet DP',exact:true})})).toContainText('0');
  await expect(page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Extra AP against monsters',exact:true})})).toContainText('Unknown');
  await page.getByLabel('Compare enhancement').selectOption('PRI (I)');
  await expect(page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sheet AP',exact:true})})).toContainText('10');
  await page.context().setOffline(true);await page.getByRole('button',{name:'PvE progression guide',exact:true}).click();
  await page.locator('summary').filter({hasText:'10. PRACTICAL UPGRADE ORDER'}).click();
  await expect(page.getByRole('cell',{name:'Kabua Artifacts x2',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('reference-guide.png'),fullPage:true});await page.context().setOffline(false);
});
async function signup(page:Page,email:string){
  await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('button',{name:'Create family',exact:true})).toBeVisible();
}
async function signin(page:Page,email:string,pass=password){
  await page.goto('/');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(pass);await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
async function navigate(page:Page,name:string){
  const nav=page.getByRole('navigation',{name:(page.viewportSize()?.width??1280)>700?'Main navigation':'Mobile navigation'});
  await expect(nav).toBeVisible();await nav.getByRole('link',{name,exact:true}).click();
}
async function onboard(page:Page){
  await page.getByRole('button',{name:'Create family',exact:true}).click();await page.getByLabel('Family name').fill('Dawnward');await page.getByRole('button',{name:'Save family',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Add first character',exact:true}).click();await page.getByLabel('Character name').fill('Aster');await page.getByLabel('Class',{exact:true}).fill('Scholar');await page.getByRole('button',{name:'Save character',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back, Adventurer.'})).toBeVisible();
}
async function resource(page:Page,name:string,amount:string){
  await page.getByRole('button',{name:'Edit '+name,exact:true}).click();await page.getByLabel('Owned quantity',{exact:false}).fill(amount);await page.getByRole('button',{name:'Save balance',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('onboarding, gear persistence, guided reward, journal, export and deletion',async({page,browser},info)=>{
  const email='journey-'+randomUUID()+'@local.test',errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await signup(page,email);await onboard(page);
  await navigate(page,'Gear');await page.getByRole('button',{name:/Helmet.*Empty slot/}).click();
  await page.getByLabel('Item name',{exact:false}).fill('My PEN helmet');await expect(page.getByLabel('Equipment slot')).toHaveValue('helmet');await page.getByRole('button',{name:'Save equipment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Helmet.*My PEN helmet/})).toBeVisible();
  const other=await browser.newContext(),second=await other.newPage();await signin(second,email);await navigate(second,'Gear');await expect(second.getByRole('button',{name:/Helmet.*My PEN helmet/})).toBeVisible();await other.close();
  await page.reload();await expect(page.getByRole('button',{name:/Helmet.*My PEN helmet/})).toBeVisible();
  await navigate(page,'Roadmap');await page.getByRole('button',{name:'New roadmap',exact:true}).click();await page.getByRole('button',{name:'Create roadmap',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.milestone').first().getByRole('button',{name:'Review & complete'}).click();await page.getByRole('button',{name:'Confirm prior completion'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await navigate(page,'Resources');await resource(page,'Essence of Dawn','20');await resource(page,'Sharp Black Crystal Shard','100');
  await navigate(page,'Roadmap');const necklace=page.locator('.milestone').filter({has:page.getByRole('heading',{name:/PEN.*Necklace/})});await necklace.getByRole('button',{name:'Review & complete'}).click();
  await expect(page.getByRole('dialog')).toContainText('− 10');await expect(page.getByRole('dialog')).toContainText('− 50');await page.getByRole('button',{name:'Confirm inventory transaction'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(necklace).toContainText('Complete');await navigate(page,'Gear');await expect(page.getByText('Kharazad Necklace',{exact:true})).toBeVisible();
  await navigate(page,'Resources');await expect(page.locator('.resource-table-row').filter({hasText:'Essence of Dawn'})).toContainText('10');await expect(page.locator('.resource-table-row').filter({hasText:'Sharp Black Crystal Shard'})).toContainText('50');
  await navigate(page,'More');await expect(page.locator('.journal-list')).toContainText('Completed:');await page.getByRole('button',{name:'Settings',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export all my data'}).click();const download=await downloadEvent;const stream=await download.createReadStream();let text='';for await(const chunk of stream!)text+=chunk;const exported=JSON.parse(text);
  expect(exported.characters[0].name).toBe('Aster');expect(exported.family_claims).toHaveLength(1);expect(exported.equipment_instances).toHaveLength(2);expect(exported.progress_events.length).toBeGreaterThan(5);
  await page.screenshot({path:info.outputPath('settings.png'),fullPage:true});
  await page.getByRole('link',{name:'Delete my account',exact:true}).click();await page.getByLabel('Type DELETE to confirm').fill('DELETE');await page.getByRole('button',{name:'Permanently delete my account'}).click();await expect(page.getByRole('heading',{name:'Your account was deleted.'})).toBeVisible();expect(errors).toEqual([]);
});
test('stale sessions show a conflict, offline mode is read-only, sign-out clears private cache',async({page,browser})=>{
  const email='conflict-'+randomUUID()+'@local.test';await signup(page,email);await onboard(page);await navigate(page,'Resources');
  const other=await browser.newContext(),second=await other.newPage();await signin(second,email);await navigate(second,'Resources');
  await page.getByRole('button',{name:'Update balance'}).click();await page.getByLabel('Owned quantity',{exact:false}).fill('100');
  await second.getByRole('button',{name:'Update balance'}).click();await second.getByLabel('Owned quantity',{exact:false}).fill('200');await second.getByRole('button',{name:'Save balance',exact:true}).click();await expect(second.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Save balance',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Newer changes');await page.getByRole('dialog').getByRole('button',{name:'Reload latest data'}).click();
  await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.locator('.silver-panel')).toContainText('200');await other.close();
  await page.context().setOffline(true);await expect(page.getByRole('button',{name:'Add resource',exact:true})).toBeDisabled();
  await expect(page.locator('.silver-panel')).toContainText('200');await navigate(page,'More');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Sign out of this device'}).click();
  await expect(page.getByRole('heading',{name:'Welcome back, adventurer.'})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('bdo-cache-v1:')))).toEqual([]);
  await page.context().setOffline(false);
});
