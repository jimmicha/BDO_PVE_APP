import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('administrator loads and saves the supplied ladder without fabricated review dates',async({page})=>{
  await page.goto('/');await page.getByLabel('Email address').fill('explorer@local.test');await page.getByLabel('Password',{exact:true}).fill('LocalExplorer123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('navigation',{name:/Main navigation|Mobile navigation/})).toBeAttached();await page.goto('/admin');
  await page.getByRole('button',{name:'Copy to new draft'}).first().click();await expect(page.getByRole('button',{name:'Edit draft'}).first()).toBeVisible();await page.getByRole('button',{name:'Edit draft'}).first().click();
  await page.getByRole('button',{name:'Load supplied 70-step ladder into this draft'}).click();
  await expect(page.getByLabel('Verified on')).toHaveValue('');await expect(page.getByLabel('Review expires')).toHaveValue('');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'PC NA/EU PvE gear ladder — season to Inner Edania'}).first()).toBeVisible();
});
test('public sign-in and privacy meet automated WCAG AA checks',async({page})=>{
  for(const route of ['/','/privacy','/account-deletion']){
    await page.goto(route);await expect(page.locator('h1')).toBeVisible();
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  }
});
