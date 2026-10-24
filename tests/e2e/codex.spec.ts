import {test,expect} from '@playwright/test';
const action=(page:import('@playwright/test').Page,id:string)=>page.locator(`[data-action="${id}"]`).first();
test('codex searches, filters and sorts without losing focus; all stories expand',async({page},info)=>{
 await page.goto('/');await action(page,'codex').click();
 await expect(page.locator('[data-codex-entry]')).toHaveCount(16);
 for(const entry of await page.locator('[data-codex-entry]').all()){
  await entry.locator('summary').click();
  expect((await entry.locator('.codex-lore p').textContent())!.replace(/\s/g,'').length).toBeGreaterThanOrEqual(60);
 }
 await page.locator('[data-codex-entry]').first().screenshot({path:info.outputPath('codex-first-entry.png')});
 await page.screenshot({path:info.outputPath('codex-all-expanded.png'),fullPage:true});
 const search=page.locator('[data-codex-search]');
 await page.selectOption('[data-codex-group]','ranged');await expect(page.locator('[data-codex-entry]:visible')).toHaveCount(2);
 await page.selectOption('[data-codex-sort]','cost-desc');
 const ranked=await page.locator('[data-codex-entry]:visible').evaluateAll(cards=>cards.map(c=>({id:(c as HTMLElement).dataset.codexId,order:Number((c as HTMLElement).style.order)})).sort((a,b)=>a.order-b.order));
 expect(ranked.map(c=>c.id)).toEqual(['crossbow','bow']);
 await search.fill('钢弦');await expect(search).toBeFocused();await expect(page.locator('[data-codex-entry]:visible')).toHaveCount(1);await expect(page.locator('[data-codex-status]')).toContainText('1 / 16');
 await search.fill('不存在的星辰骑鲸军团');await expect(page.locator('[data-codex-empty]')).toBeVisible();await expect(page.locator('[data-codex-entry]:visible')).toHaveCount(0);
 await search.fill('');await page.selectOption('[data-codex-group]','all');await expect(page.locator('[data-codex-entry]:visible')).toHaveCount(16);
 await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('codex-1024.png'),fullPage:true});
});
test('B opens complete battlefield entry, pauses, paints portrait; U still selects fire mage',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await action(page,'classic').click();await action(page,'launch').click();
 await page.keyboard.press('u');await expect(page.locator('[data-unit="firemage"]')).toHaveAttribute('aria-pressed','true');await page.keyboard.press('b');
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').locator('h2')).toHaveText('烬火贤者');await expect(page.locator('.codex-lore')).toBeVisible();await expect(page.locator('.codex-hints')).toBeVisible();
 const portrait=await page.locator('.unit-detail canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,c.width,c.height).data).some(n=>n>0));expect(portrait).toBe(true);
 const before=await page.evaluate(()=>(window as any).__EMBER__.state().time);await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__EMBER__.state().time)).toBe(before);
 await page.screenshot({path:info.outputPath('battle-codex-detail.png'),fullPage:true});await action(page,'codex').click();await page.locator('[data-action="codex-unit-shield"]').click();await expect(page.getByRole('dialog').locator('h2')).toHaveText('铁壁卫士');await expect(page.locator('.codex-lore')).toBeVisible();await action(page,'close-modal').click();
 await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__EMBER__.state().time)).toBeGreaterThan(before);expect(errors).toEqual([]);
});
