import {chromium} from '@playwright/test';
import {browserPath} from './browser';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const paths=['src/render/sprites.ts','src/render/units/pixelArt.ts','src/render/units/infantry.ts','src/render/units/mobile.ts','src/render/units/casters.ts','src/data/units.ts','src/render/BattleRenderer.ts','scripts/unit-visual-browser.ts','scripts/verify-unit-visuals.ts'];
async function fingerprint(){return Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));}
const source=await fingerprint(),browser=await chromium.launch({executablePath:browserPath(),headless:true});
const url=process.env.GAME_URL??'http://127.0.0.1:4199/';
const errors:string[]=[];await mkdir('docs/screenshots/unit-redesign',{recursive:true});await mkdir('docs/metrics',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const result=await page.evaluate(async()=>{const path='/scripts/unit-visual-browser.ts';const m=await import(path);return {audit:m.auditUnitSprites(),contact:m.unitContactSheet(),azure:m.unitAnimationSheet(0),crimson:m.unitAnimationSheet(1)};});
 for(const [name,data] of Object.entries({contact:result.contact,'animation-azure':result.azure,'animation-crimson':result.crimson}))await writeFile(`docs/screenshots/unit-redesign/${name}.png`,Buffer.from((data as string).split(',')[1],'base64'));
 const screenshots:string[]=[];
 for(const biome of ['plains','wastes','snow','ruins']){
  await page.evaluate(async(biome)=>{const sim='/src/core/simulation.ts',data='/src/data/missions.ts';const {defaultConfig}=await import(data);const api=(window as any).__EMBER__;api.launch({...defaultConfig(),biome,seed:407});api.advance(38);},biome);
  await page.waitForTimeout(200);const file=`docs/screenshots/unit-redesign/battle-${biome}.png`;await page.screenshot({path:file,fullPage:true});screenshots.push(file);
 }
 // These snapshots intentionally use arranged, non-gameplay army fixtures.
 // They establish visual overlap, silhouette and rendering behavior, NOT legal
 // population use, balance, AI quality or human unit-recognition accuracy.
 for(const dpr of [1,1.5]){
  const context=await browser.newContext({viewport:{width:dpr===1?1024:1440,height:dpr===1?768:1000},deviceScaleFactor:dpr});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('[data-action="classic"]').click();await p.locator('[data-action="launch"]').click();
  await p.evaluate(async()=>{const api=(window as any).__EMBER__,path='/src/data/units.ts';const {UNITS}=await import(path);const s=structuredClone(api.state());s.units=[];
   for(let side=0;side<2;side++)for(let i=0;i<75;i++){const u=UNITS[i%16];s.units.push({id:1000+side*100+i,side,type:u.id,x:side===0?355+(i%8)*30:925-(i%8)*30,y:326+Math.floor(i/8)*14,hp:u.hp,maxHp:u.hp,cooldown:0,action:i%3===0?'attack':'walk',actionTime:0,target:null,born:0});}
   const renderer=api.renderer,original=renderer.render.bind(renderer);renderer.render=()=>original(s,'ruins',performance.now()/1000,1);
  });await p.waitForTimeout(500);const file=`docs/screenshots/unit-redesign/150-visual-fixture-dpr${dpr}.png`;await p.screenshot({path:file,fullPage:true});screenshots.push(file);await context.close();
 }
 if(JSON.stringify(source)!==JSON.stringify(await fingerprint()))throw new Error('Art source changed during audit: rerun after edits settle');
 const report={generated:new Date().toISOString(),url,source,...result.audit,errors,screenshots,fixtureNote:'150-body arranged screenshots are purely visual fixtures; four battle shots use default rules + dev fast-forward (not human play).'};
 await writeFile('docs/metrics/unit-visual-redesign.json',JSON.stringify(report,null,2)+'\n');console.table(report.pairs.map((p:any)=>({pair:p.ids.join('/'),idle:p.idleIoU,mean:p.meanIoU,max:p.maxIoU})));console.log('Frames:',report.frameCount,'defects:',report.defects.length);
 if(errors.length||report.defects.length)throw new Error([...errors,...report.defects].join('\n'));
 for(const pair of report.pairs)if(pair.idleIoU>=.86||pair.meanIoU>=.86)throw new Error(`Insufficient geometric differentiation: ${pair.ids.join('/')} (not a player recognition score)`);
}finally{await browser.close();}
