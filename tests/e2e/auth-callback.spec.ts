import {test,expect} from '@playwright/test';

for(const separator of ['?','#']){
  test(`OAuth rejection remains visible and clears ${separator} callback parameters`,async({page})=>{
    const suffix=separator+'error=access_denied&error_description=This+beta+is+invitation-only.';
    await page.goto('/auth/callback'+suffix);
    await expect(page.getByRole('alert')).toHaveText('This beta is invitation-only.');
    await expect(page).toHaveURL(/\/auth\/callback$/);
  });
}

test('empty OAuth callback explains that sign-in is incomplete',async({page})=>{
  await page.goto('/auth/callback');
  await expect(page.getByRole('alert')).toContainText('Sign-in did not complete');
  await expect(page.getByRole('link',{name:'Return home'})).toBeVisible();
});
