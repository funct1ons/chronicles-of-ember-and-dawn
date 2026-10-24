// Real RAF measurements: adjacent draw calls for stable ids, never concatenate gaps.
import {chromium} from '@playwright/test';
import {existsSync,readdirSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const cache=join(process.env.LOCALAPPDATA??'','ms-playwright');
let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath&&existsSync(cache))for(const d of readdirSync(cache).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1])){const p=join(cache,d,'chrome-win64','chrome.exe');if(existsSync(p)){executablePath=p;break;}}
const url=process.env.GAME_URL??'http://127.0.0.1:4199/';
const browser=await chromium.launch({executablePath,headless:true});
const fingerprint=()=>Object.fromEntries(['src/render/BattleRenderer.ts','src/render/motion.ts','src/render/pixelViewport.ts','src/render/sprites.ts','src/render/units/pixelArt.ts','src/render/units/infantry.ts','src/render/units/mobile.ts','src/render/units/casters.ts','src/data/units.ts','src/ui/App.ts','src/style.css'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const report={generated:new Date().toISOString(),url,source:fingerprint(),kind:'real RAF presentation + viewport smoke; not human subjective review; deviceScaleFactor is not a physical Windows zoom test',viewports:[],errors:[]};
mkdirSync('docs/screenshots/v11',{recursive:true});mkdirSync('docs/metrics',{recursive:true});
try{
 for(const width of [1024,1440,1920])for(const dpr of [1,1.25,1.5]){
  const ctx=await browser.newContext({viewport:{width,height:width===1024?768:width===1440?1000:1080},deviceScaleFactor:dpr});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url);await page.locator('[data-action="classic"]').click();await page.locator('[data-action="launch"]').click();
  await page.waitForTimeout(7000);
  const metrics=await page.evaluate(async()=>{
   const api=window.__EMBER__,renderer=api.renderer;
   const originalRender=renderer.render,originalSoldier=renderer.soldier;
   let frame=-1;const points=[],times=[];let renderStart=0;
   renderer.render=function(...args){frame++;renderStart=performance.now();const r=originalRender.apply(this,args);times.push(performance.now()-renderStart);return r;};
   renderer.soldier=function(g,u,time,view,x,y,shake){if(u.side===0&&u.action==='walk')points.push({frame,id:u.id,x,y,simX:u.x,clock:performance.now(),deviceX:Math.round(view.x+x*.5*view.scale),scale:view.scale});return originalSoldier.call(this,g,u,time,view,x,y,shake);};
   await new Promise(resolve=>setTimeout(resolve,2500));renderer.render=originalRender;renderer.soldier=originalSoldier;
   let adjacent=0,renderChanges=0,deviceChanges=0,simChanges=0,missingGaps=0,maxDeviceStep=0,maxWorldStep=0;
   const last=new Map();
   for(const p of points){const old=last.get(p.id);last.set(p.id,p);if(!old)continue;if(p.frame!==old.frame+1){missingGaps++;continue;}adjacent++;if(Math.abs(p.x-old.x)>1e-6)renderChanges++;if(p.deviceX!==old.deviceX)deviceChanges++;if(Math.abs(p.simX-old.simX)>1e-6)simChanges++;maxDeviceStep=Math.max(maxDeviceStep,Math.abs(p.deviceX-old.deviceX));maxWorldStep=Math.max(maxWorldStep,Math.hypot(p.x-old.x,p.y-old.y));}
   times.sort((a,b)=>a-b);const c=document.querySelector('.battle-canvas'),r=c.getBoundingClientRect();
   return {backing:[c.width,c.height],css:[r.width,r.height],dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth,frames:times.length,adjacentSamples:adjacent,missingGapsRejected:missingGaps,renderChanges,devicePixelChanges:deviceChanges,simulationChanges:simChanges,interpolationChangeRatio:simChanges?renderChanges/simChanges:null,maxAdjacentDeviceStep:maxDeviceStep,maxAdjacentWorldStep:maxWorldStep,renderMedianMs:times[Math.floor(times.length*.5)],renderP95Ms:times[Math.floor(times.length*.95)]};
  });
  const file=`docs/screenshots/v11/motion-${width}-dpr${dpr}.png`;await page.screenshot({path:file,fullPage:true});
  report.viewports.push({width,dpr,...metrics,screenshot:file});
  if(metrics.overflow)throw new Error(`overflow ${width}/${dpr}`);
  if(metrics.frames<15||metrics.adjacentSamples<10||metrics.interpolationChangeRatio<1.2)throw new Error(`interpolation missing ${width}/${dpr}`);
  await ctx.close();
 }
}finally{await browser.close();writeFileSync('docs/metrics/v11-motion-browser.json',JSON.stringify(report,null,2)+'\n');}
console.table(report.viewports.map(({width,dpr,renderChanges,simulationChanges,interpolationChangeRatio,renderP95Ms})=>({width,dpr,renderChanges,simulationChanges,interpolationChangeRatio,renderP95Ms})));
if(report.errors.length)throw new Error(report.errors.join('\n'));
if(JSON.stringify(report.source)!==JSON.stringify(fingerprint()))throw new Error('Source changed during measurement; rerun against a stable build.');
