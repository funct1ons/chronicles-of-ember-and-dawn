// Controlled-reload diagnostic, extracted from the executed unit-release probe.
// A passing result proves warm reload + offline behavior, NOT cold-load audio reliability.
// Original cold, no-reload warm, and network failures remain separate evidence.
// No production dev APIs, state mutation, response mocking, or accelerated simulation.
// Requires the matching local dev UI on 4199 for raw portrait-pixel comparison.
import {chromium,expect} from '@playwright/test';
import {existsSync,readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const url=process.env.LIVE_GAME_URL??'https://funct1ons.github.io/chronicles-of-ember-and-dawn/';
const screenshotDir=process.env.LIVE_SCREENSHOT_DIR??'docs/screenshots/unit-redesign/live-controlled-reprobe';
const reportName=process.env.LIVE_REPORT_NAME??'unit-redesign-live-controlled-reprobe';
const cache=join(process.env.LOCALAPPDATA??'','ms-playwright');let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath&&existsSync(cache))for(const d of readdirSync(cache).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1])){const p=join(cache,d,'chrome-win64','chrome.exe');if(existsSync(p)){executablePath=p;break;}}
const browser=await chromium.launch({executablePath,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const mediaEvents=[]; const errors=[],badResponses=[],failedRequests=[],abortedRequests=[];let phase='online';
page.on('request',r=>{if(r.url().includes('/audio/'))mediaEvents.push({at:Date.now(),kind:'request',url:r.url(),range:r.headers()['range']});});
page.on('response',r=>{if(r.url().includes('/audio/'))mediaEvents.push({at:Date.now(),kind:'response',url:r.url(),status:r.status(),fromSW:r.fromServiceWorker()});});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>{const row={phase,url:r.url(),reason:r.failure()?.errorText};(row.reason==='net::ERR_ABORTED'?abortedRequests:failedRequests).push(row);});
const report={testedAt:new Date().toISOString(),url,localHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:JSON.parse(readFileSync('package.json','utf8')).version,errors,badResponses,failedRequests,abortedRequests,requestNote:'ERR_ABORTED records intentional media/navigation cancellation separately; all other failed requests are fatal.'};
mkdirSync(screenshotDir,{recursive:true});mkdirSync('docs/metrics',{recursive:true});
try{
 await page.addInitScript(()=>{const Native=window.Audio;window.__liveMusic=[];window.Audio=function(src){const el=new Native(src);window.__liveMusic.push(el);return el;};window.Audio.prototype=Native.prototype;});
 const response=await page.goto(url,{waitUntil:'load'});report.status=response.status();expect(report.status).toBe(200);
 await expect(page.locator('h1')).toBeVisible();
 const bootstrapStart=Date.now();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{}, {timeout:180000});
 report.bootstrap={mode:'Download actual public worker/resources, then reload under its control to discard media streams started before installation. This is a controlled warm reload, NOT a cold-start pass.',waitMs:Date.now()-bootstrapStart};
 await page.reload({waitUntil:'load'});await expect(page.locator('h1')).toBeVisible();


 if(process.env.LIVE_EXPECTED_TITLE)await expect(page.locator('h1')).toHaveText(process.env.LIVE_EXPECTED_TITLE);
 report.title=await page.locator('h1').textContent();expect(await page.evaluate(()=>typeof window.__EMBER__)).toBe('undefined');
 const script=await page.locator('script[type="module"]').getAttribute('src');const assetUrl=new URL(script,url).href;
 const asset=await context.request.get(assetUrl);expect(asset.status()).toBe(200);
 const bytes=await asset.body(),localPath='dist/'+new URL(assetUrl).pathname.split('/').slice(-2).join('/');
 report.productionAsset={url:assetUrl,sha256:createHash('sha256').update(bytes).digest('hex'),matchesLocal:existsSync(localPath)&&bytes.equals(readFileSync(localPath))};
 expect(report.productionAsset.matchesLocal).toBe(true);
 const worker=await context.request.get(new URL('sw.js',url).href);expect(worker.status()).toBe(200);const workerBytes=await worker.body();report.productionWorker={sha256:createHash('sha256').update(workerBytes).digest('hex'),matchesLocal:workerBytes.equals(readFileSync('dist/sw.js'))};expect(report.productionWorker.matchesLocal).toBe(true);
 await page.screenshot({path:`${screenshotDir}/live-pages-menu.png`,fullPage:true});
 await page.locator('[data-action="codex"]').click();await expect(page.locator('[data-codex-entry]')).toHaveCount(16);
 const portraitHashes=async p=>p.locator('[data-codex-entry] canvas[data-portrait]').evaluateAll(async nodes=>Promise.all(nodes.map(async c=>{const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data,hash=await crypto.subtle.digest('SHA-256',rgba);return {id:c.dataset.portrait,width:c.width,height:c.height,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};})));
 const actualPortraits=await portraitHashes(page);
 const local=await browser.newPage({viewport:{width:1440,height:1000}});await local.goto('http://127.0.0.1:4199/');await local.locator('[data-action="codex"]').click();const expectedPortraits=await portraitHashes(local);await local.close();
 expect(actualPortraits).toHaveLength(16);expect(actualPortraits).toEqual(expectedPortraits);report.unitPortraits={method:'Raw RGBA SHA-256 of all 16 actual deployed codex canvases vs independently opened current local dev UI. No production dev APIs or state mutation.',matchesLocal:true,portraits:actualPortraits};
 await page.screenshot({path:screenshotDir+'/live-all-unit-portraits.png',fullPage:true});
 await page.locator('[data-codex-search]').fill('钢弦');await expect(page.locator('[data-codex-entry]:visible')).toHaveCount(1);
 await expect(page.locator('[data-codex-search]')).toBeFocused();await page.locator('[data-codex-search]').fill('');
 await page.locator('[data-codex-entry]').first().locator('summary').click();
 await page.screenshot({path:`${screenshotDir}/live-pages-codex.png`,fullPage:true});report.codex={entries:16,search:true,focus:true,storyExpanded:true};
 await page.locator('[data-action="return"]').click();await page.locator('[data-action="classic"]').click();await page.selectOption('#opt-difficulty','0');await page.locator('[data-action="launch"]').click();
 await page.keyboard.press('u');await expect(page.locator('[data-unit="firemage"][data-side="0"]')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('b');await expect(page.locator('.modal')).toContainText('战史');const paused=await page.locator('#elapsed').textContent();await page.waitForTimeout(250);expect(await page.locator('#elapsed').textContent()).toBe(paused);
 await page.screenshot({path:`${screenshotDir}/live-pages-field-codex.png`,fullPage:true});await page.locator('[data-action="close-modal"]').first().click();await page.keyboard.press('1');report.shortcuts={BCompleteEntry:true,UFireMage:true,pauses:true};
 await page.waitForFunction(()=>window.__liveMusic.some(e=>e.src.includes('the_final_battle')&&!e.paused&&e.currentTime>1),{},{timeout:15000});
 const before=await page.evaluate(()=>window.__liveMusic.filter(e=>e.src.includes('the_final_battle')&&!e.paused).map(e=>({time:e.currentTime,volume:e.volume,src:e.src})));
 await page.waitForTimeout(12000);
 const after=await page.evaluate(()=>({elapsed:document.querySelector('#elapsed')?.textContent,round:document.querySelector('#round')?.textContent,population:document.querySelector('#supply-0')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,tracks:window.__liveMusic.filter(e=>e.src.includes('the_final_battle')&&!e.paused).map(e=>({time:e.currentTime,volume:e.volume,error:e.error?.message??null,src:e.src})),canvas:{width:document.querySelector('canvas.battle-canvas').width,height:document.querySelector('canvas.battle-canvas').height}}));
 report.battle=after;report.music={before,after:after.tracks,minimumAdvanceSeconds:11};expect(after.tracks[0].time-before[0].time).toBeGreaterThan(11);expect(after.tracks[0].volume).toBeGreaterThan(0);expect(after.overflow).toBe(false);
 await page.screenshot({path:`${screenshotDir}/live-pages-battle.png`,fullPage:true});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 report.serviceWorker=await page.evaluate(async()=>{const names=await caches.keys(),c=await caches.open(names.find(n=>n.startsWith('ember-dawn-')));const keys=await c.keys();return{controlled:!!navigator.serviceWorker.controller,names,files:keys.length,audioUrls:keys.map(r=>r.url).filter(u=>new URL(u).pathname.includes('/audio/'))};});
 const expectedCache=readFileSync('dist/sw.js','utf8').match(/const CACHE='([^']+)'/)[1];expect(report.serviceWorker.names).toContain(expectedCache);
 report.range=await page.evaluate(async()=>{const r=await fetch('./audio/eye_of_the_storm.mp3',{headers:{Range:'bytes=0-127'}});return{status:r.status,bytes:(await r.arrayBuffer()).byteLength,contentRange:r.headers.get('Content-Range')};});expect(report.range.status).toBe(206);expect(report.range.bytes).toBe(128);
 // Reload the actual deployed build offline, then start another real-clock battle.
 phase='offline-reload';await context.setOffline(true);await page.reload();await expect(page.locator('h1')).toBeVisible();await page.locator('[data-action="classic"]').click();await page.locator('[data-action="launch"]').click();await page.waitForTimeout(8500);
 report.offline=await page.evaluate(()=>({offline:!navigator.onLine,elapsed:document.querySelector('#elapsed')?.textContent,population:document.querySelector('#supply-0')?.textContent,playing:window.__liveMusic.some(e=>!e.paused&&e.currentTime>0&&e.volume>0),tracks:window.__liveMusic.map(e=>({src:e.src,paused:e.paused,time:e.currentTime,readyState:e.readyState,networkState:e.networkState,error:e.error?.message??null,volume:e.volume}))}));expect(report.offline.offline).toBe(true);expect(report.offline.playing).toBe(true);expect(Number(report.offline.population.split('/')[0])).toBeGreaterThan(0);
 report.offlineAssets=await page.evaluate(async urls=>Promise.all(urls.map(async url=>{const r=await fetch(url),bytes=await r.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);return{file:new URL(url).pathname.split('/').at(-1),status:r.status,bytes:bytes.byteLength,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};})),report.serviceWorker.audioUrls);
 expect(report.offlineAssets).toHaveLength(5);for(const asset of report.offlineAssets){expect(asset.status).toBe(200);const local=readFileSync('public/audio/'+asset.file);expect(asset.bytes).toBe(local.byteLength);expect(asset.sha256).toBe(createHash('sha256').update(local).digest('hex'));}
 await page.screenshot({path:`${screenshotDir}/live-pages-offline.png`,fullPage:true});
 expect(errors).toEqual([]);expect(badResponses).toEqual([]);expect(failedRequests).toEqual([]);report.passed=true;
}catch(error){report.failure={message:error.message};throw error;}finally{report.mediaEvents=mediaEvents;report.finalMediaState=await page.evaluate(()=>({elapsed:document.querySelector('#elapsed')?.textContent,tracks:window.__liveMusic?.map(e=>({src:e.src,time:e.currentTime,paused:e.paused,volume:e.volume,readyState:e.readyState,networkState:e.networkState,error:e.error?.message??null})),worker:navigator.serviceWorker.controller?.scriptURL})).catch(e=>({diagnosticError:e.message}));await browser.close();writeFileSync(`docs/metrics/${reportName}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
