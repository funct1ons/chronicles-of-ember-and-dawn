import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from '@playwright/test';
import {browserPath} from './browser';
const root=resolve('dist');const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url??'/','http://localhost');if(!url.pathname.startsWith('/game/')){res.writeHead(404).end();return;}const relative=decodeURIComponent(url.pathname.slice(6))||'index.html';const path=resolve(root,relative);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404).end();}});
await new Promise<void>(r=>server.listen(4190,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:browserPath(),headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const errors:string[]=[];const badResponses:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);});
try{
 await page.addInitScript(()=>{const Native=window.Audio;(window as any).__music=[];(window as any).Audio=function(src?:string){const el=new Native(src);(window as any).__music.push(el);return el;};(window as any).Audio.prototype=Native.prototype;});
 await page.goto('http://127.0.0.1:4190/game/');await page.locator('h1').waitFor();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const cacheInfo=await page.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith('ember-dawn-'))!);return {names,files:(await cache.keys()).map(r=>new URL(r.url).pathname)};});
 if(!cacheInfo.files.some(x=>x.endsWith('eye_of_the_storm.mp3')))throw new Error('Music was not precached');
 await context.setOffline(true);await page.reload();await page.locator('h1').waitFor();
 if(await page.evaluate(()=>typeof (window as any).__EMBER__)!=='undefined')throw new Error('Dev cheat interface leaked into production');
 await page.locator('[data-action="classic"]').click();await page.selectOption('#opt-difficulty','0');await page.locator('[data-action="launch"]').click();
 await page.locator('[data-action="speed"]').click();await page.locator('[data-action="speed"]').click();await page.locator('[data-action="speed"]').click();
 // Real requestAnimationFrame battle: no test-only advance/cheats in the production build.
 for(const [key,ms]of [['1',8000],['3',4000],['6',4000],['4',4000],['7',4000],['0',3000]] as const){if(key!=='0')await page.keyboard.press(key);await page.waitForTimeout(ms);}
 await mkdir('docs/screenshots',{recursive:true});await page.screenshot({path:'docs/screenshots/offline-production-battle.png',fullPage:true});
 const runtime=await page.evaluate(()=>({offline:!navigator.onLine,elapsed:document.querySelector('#elapsed')?.textContent,round:document.querySelector('#round')?.textContent,gold:document.querySelector('#gold-0')?.textContent,population:document.querySelector('#supply-0')?.textContent,fps:document.querySelector('#fps-label')?.textContent,tracks:(window as any).__music.map((e:HTMLAudioElement)=>({src:new URL(e.src).pathname,paused:e.paused,currentTime:e.currentTime,duration:e.duration,error:e.error?.message??null,volume:e.volume})),overflow:document.documentElement.scrollWidth>innerWidth}));
 const range=await page.evaluate(async()=>{const r=await fetch('./audio/eye_of_the_storm.mp3',{headers:{Range:'bytes=0-127'}});return {status:r.status,bytes:(await r.arrayBuffer()).byteLength,contentRange:r.headers.get('Content-Range')};});
 const result={testedAt:new Date().toISOString(),url:'http://127.0.0.1:4190/game/',cacheInfo,runtime,range,errors,badResponses};
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/release.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(errors.length||badResponses.length||runtime.overflow||range.status!==206||range.bytes!==128)throw new Error('Release runtime check failed');
 const [minutes,seconds]=(runtime.elapsed??'0:0').split(':').map(Number);const played=minutes*60+seconds;
 if(!runtime.offline||played<30||Number(runtime.round?.match(/\d+/)?.[0]??0)<3||Number(runtime.population?.split('/')[0]??0)<1)throw new Error('Offline battle did not actually advance and recruit soldiers');
 if(!runtime.tracks.some((e:any)=>!e.paused&&e.currentTime>0&&!e.error&&e.volume>0))throw new Error('Offline music did not actually play');
}finally{await context.close();await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
