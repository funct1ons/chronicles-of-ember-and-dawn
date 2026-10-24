import {test,expect} from '@playwright/test';

test('16 distinct pixel-art identities: all source frames are opaque-grid, animated and unclipped',async({page},info)=>{
 await page.goto('/');
 const report=await page.evaluate(async()=>{const path='/scripts/unit-visual-browser.ts';const {auditUnitSprites}=await import(path);return auditUnitSprites();});
 await info.attach('unit-visual-audit.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 expect(report.unitCount).toBe(16);expect(report.frameCount).toBe(640);expect(report.defects).toEqual([]);
 for(const p of report.pairs){expect(p.idleIoU,p.ids.join('/')).toBeLessThan(.86);expect(p.meanIoU,p.ids.join('/')).toBeLessThan(.86);}
});

test('both armies retain the same silhouettes and cached frame API at real unit selection size',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-action="codex"]').first().click();await expect(page.locator('.unit-entry')).toHaveCount(16);
 const result=await page.evaluate(async()=>{
  const art='/src/render/sprites.ts',data='/src/data/units.ts';const {sprite}=await import(art),{UNITS}=await import(data);
  const bad=[];for(const u of UNITS){const a=sprite(u.id,0),b=sprite(u.id,1),ad=a.getContext('2d').getImageData(0,0,48,48).data,bd=b.getContext('2d').getImageData(0,0,48,48).data;
   let colors=0;for(let i=0;i<ad.length;i+=4){if(ad[i+3]!==bd[i+3])bad.push(u.id+':faction geometry');if(ad[i+3]&&ad[i]!==bd[i])colors++;}
   if(colors<20)bad.push(u.id+':faction colors');if(a!==sprite(u.id,0))bad.push(u.id+':uncached');if(sprite(u.id,0,'walk',0)!==sprite(u.id,0,'walk',4))bad.push(u.id+':frame key');
  }return {bad,overflow:document.documentElement.scrollWidth>innerWidth};
 });expect(result.bad).toEqual([]);expect(result.overflow).toBe(false);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('redesigned-codex.png'),fullPage:true});
});
