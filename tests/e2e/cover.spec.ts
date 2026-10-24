import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

test('minimal cover fits desktop sizes with clear title and both navigation levels',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const cases=[{width:1024,height:768},{width:1366,height:768},{width:1440,height:1000},{width:1920,height:1080},{width:800,height:600},{width:640,height:480}];
 const rows=[];
 for(const viewport of cases){
  await page.setViewportSize(viewport);await page.goto('/');
  await expect(page.getByRole('heading',{name:'烬辉战纪',exact:true,level:1})).toBeVisible();
  await expect(page.locator('.cover-modes button')).toHaveCount(4);
  for(const action of ['campaign','classic','tutorial','challenges','custom','local','codex','mute','fullscreen','settings','credits'])await expect(page.locator(`[data-action="${action}"]`).first()).toBeVisible();
  await page.waitForTimeout(100);
  const geometry=await page.evaluate(()=>{
   const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth,verticalOverflow:document.documentElement.scrollHeight>innerHeight,title:box('.cover-title'),actions:box('.cover-actions'),modes:box('.cover-modes'),footer:box('.cover-footer'),text:document.querySelector('.home')!.textContent!.replace(/\s+/g,' ').trim()};
  });
  expect(geometry.horizontalOverflow).toBe(false);expect(geometry.verticalOverflow).toBe(false);
  expect(geometry.title.bottom).toBeLessThan(geometry.actions.y);
  expect(geometry.actions.bottom).toBeLessThan(geometry.modes.y);
  expect(geometry.modes.bottom+12).toBeLessThan(geometry.footer.y);
  await page.screenshot({path:info.outputPath(`cover-${viewport.width}x${viewport.height}.png`),fullPage:true});
  rows.push({viewport,...geometry});
 }
 expect(errors).toEqual([]);
 const files=['src/ui/templates.ts','src/ui/home.css','src/main.ts'];
 const source=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/cover-redesign.json',JSON.stringify({generated:new Date().toISOString(),kind:'local browser geometry and navigation assertions; screenshots separately reviewed',source,rows,errors},null,2)+'\n');
});

test('cover modes and settings still work, with keyboard focus and campaign progress',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('ember-dawn-save-v1',JSON.stringify({version:1,completed:['c1','c2'],records:[],settings:{}})));await page.reload();
 await expect(page.locator('[aria-label="战役进度"]')).toContainText('2 / 10');
 await page.locator('[data-action="campaign"]').click();await expect(page.locator('[data-mission="c3"]')).toBeEnabled();
 await page.locator('[data-action="home"]').first().click();await page.locator('[data-action="tutorial"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('[data-action="tutorial-skip"]').click();
 for(const action of ['classic','custom','local','challenges','codex']){
  await page.locator(`[data-action="${action}"]`).first().click();await expect(page.locator('main.page')).toBeVisible();await page.locator('[data-action="home"]').first().click();await expect(page.locator('.home.cover')).toBeVisible();
 }
 await page.locator('[data-action="settings"]').click();await expect(page.getByRole('dialog')).toContainText('指挥设置');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('[data-action="credits"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('.cover-actions [data-action="campaign"]').focus();await page.keyboard.press('Tab');await expect(page.locator('.cover-actions [data-action="classic"]')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('.setup-page')).toBeVisible();
});
