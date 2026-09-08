import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public sign-in and privacy meet automated WCAG AA checks',async({page})=>{
  for(const route of ['/','/privacy','/account-deletion']){
    await page.goto(route);await expect(page.locator('h1')).toBeVisible();
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  }
});
