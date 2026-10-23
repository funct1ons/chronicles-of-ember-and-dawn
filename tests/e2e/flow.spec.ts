import{test,expect}from'@playwright/test';
test('five-page tutorial launches practice; exit confirmation protects the running match',async({page})=>{
 await page.goto('/');await page.locator('[data-action="tutorial"]').click();for(let i=0;i<5;i++)await page.locator('[data-action="tutorial-next"]').click();await expect(page.locator('.battle-canvas')).toBeVisible();await expect(page.locator('.unit-card:not([disabled])')).toHaveCount(5);
 await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toContainText('战旗暂歇');await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.locator('[data-action="home"]').click();await expect(page.getByRole('dialog')).toContainText('撤离当前战场');await page.getByRole('button',{name:'继续战斗',exact:true}).click();await expect(page.locator('.battle-canvas')).toBeVisible();
 await page.locator('[data-action="home"]').click();await page.locator('[data-action="leave"]').click();await expect(page.locator('.home')).toBeVisible();
});
test('defeat, restart, and the two remaining environments render without errors',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 for(const biome of ['wastes','ruins']){
  await page.locator('[data-action="custom"]').click();await page.selectOption('#opt-biome',biome);await page.locator('[data-action="launch"]').click();await page.evaluate(()=>{(window as any).__EMBER__.advance(35);});
  await page.screenshot({path:info.outputPath(`environment-${biome}.png`),fullPage:true});
  await page.evaluate(()=>{const api=(window as any).__EMBER__;api.state().teams[0].baseHp=0;api.advance(.1);});await expect(page.locator('.result-modal .eyebrow')).toContainText('DEFEAT');await expect(page.getByRole('dialog')).toContainText('余烬尚未熄灭');
  await page.locator('[data-action="restart"]').click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#base-hp-0')).toContainText('2500 / 2500');
  await page.locator('[data-action="home"]').click();await page.locator('[data-action="leave"]').click();
 }
 expect(errors).toEqual([]);
});
