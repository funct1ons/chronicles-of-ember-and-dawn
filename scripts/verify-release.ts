import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {sourceFingerprint} from './fingerprint';
import {resolve,extname,sep} from 'node:path';
import {chromium,type Browser,type BrowserContext} from '@playwright/test';
import {browserPath} from './browser';
async function artifactFingerprint(){
 const paths=['index.html','sw.js',...(await readdir('dist/assets')).filter(p=>/\.(js|css)$/.test(p)).sort().map(p=>'assets/'+p)];
 return Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile('dist/'+path)).digest('hex')])));
}
const source=await sourceFingerprint(),artifacts=await artifactFingerprint();
const root=resolve('dist');const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url??'/','http://localhost');if(!url.pathname.startsWith('/game/')){res.writeHead(404).end();return;}const relative=decodeURIComponent(url.pathname.slice(6))||'index.html';const path=resolve(root,relative);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const data=await readFile(path);const type=mime[extname(path)]??'application/octet-stream';const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
 const headers:Record<string,string|number>={'Content-Type':type,'Cache-Control':'max-age=600','Vary':'Accept-Encoding','Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes'};
 if(range&&(range[1]||range[2])){const start=range[1]?Number(range[1]):Math.max(0,data.length-Number(range[2]));const end=range[1]&&range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;
  if(start>=data.length||start>end){res.writeHead(416,{...headers,'Content-Range':'bytes */'+data.length,'Content-Length':0}).end();return;}
  res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1}).end(data.subarray(start,end+1));return;}
 const gzip=/^(text\/|image\/svg)/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']??'');const body=gzip?gzipSync(data):data;
 // GitHub Pages varies even uncompressed media on Accept-Encoding. Browser audio
 // supplies identity here, unlike cache.addAll and a scripted fetch with Range.
 res.writeHead(200,{...headers,'Content-Length':body.length,...(gzip?{'Content-Encoding':'gzip'}:{})});res.end(body);}catch{res.writeHead(404).end();}});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
const address=server.address();const url=`http://127.0.0.1:${typeof address==='object'&&address?address.port:0}/game/`;
let browser:Browser|undefined,context:BrowserContext|undefined;
try{
 browser=await chromium.launch({executablePath:browserPath(),headless:true});context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 const errors:string[]=[];const badResponses:string[]=[];const failedRequests:{url:string,reason:string|undefined}[]=[];const abortedRequests:typeof failedRequests=[];const mediaResponses:{url:string,status:number,fromServiceWorker:boolean,offline:boolean}[]=[];let offline=false;
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push(`${r.status()} ${r.url()}`);if(r.request().resourceType()==='media')mediaResponses.push({url:r.url(),status:r.status(),fromServiceWorker:r.fromServiceWorker(),offline});});
 page.on('requestfailed',r=>{(r.failure()?.errorText==='net::ERR_ABORTED'?abortedRequests:failedRequests).push({url:r.url(),reason:r.failure()?.errorText});});
 await page.addInitScript(()=>{const Native=window.Audio;(window as any).__music=[];(window as any).Audio=function(src?:string){const el=new Native(src);(window as any).__music.push(el);return el;};(window as any).Audio.prototype=Native.prototype;});
 await page.goto(url);await page.locator('h1').waitFor();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const cacheInfo=await page.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith('ember-dawn-'))!);const keys=await cache.keys();return {names,files:keys.map(r=>new URL(r.url).pathname),media:await Promise.all(keys.filter(r=>new URL(r.url).pathname.includes('/audio/')).map(async r=>({url:r.url,keyHeaders:[...r.headers],responseHeaders:[...(await cache.match(r))!.headers]})))};});
 const musicFiles=(await readdir('dist/audio')).filter(f=>/\.(mp3|ogg|wav)$/.test(f)).sort();
 if(musicFiles.length!==5||cacheInfo.media.length!==5||cacheInfo.media.some(m=>!m.responseHeaders.some(([key,value])=>key==='vary'&&value.toLowerCase()==='accept-encoding')))throw new Error('Expected all five music files precached with the Pages Vary header');
 const worker=context.serviceWorkers()[0];
 await worker.evaluate(()=>{(self as any).__releaseMediaRequests=[];self.addEventListener('fetch',(event:any)=>{const r=event.request as Request;if(r.destination==='audio')(self as any).__releaseMediaRequests.push({url:r.url,mode:r.mode,headers:[...r.headers]});});});
 offline=true;await context.setOffline(true);await page.reload();await page.locator('h1').waitFor();
 if(await page.evaluate(()=>typeof (window as any).__EMBER__)!=='undefined')throw new Error('Dev cheat interface leaked into production');
 await page.locator('[data-action="classic"]').click();await page.selectOption('#opt-difficulty','0');await page.locator('[data-action="launch"]').click();
 await page.locator('[data-action="speed"]').click();await page.locator('[data-action="speed"]').click();await page.locator('[data-action="speed"]').click();
 // Real requestAnimationFrame battle: no test-only advance/cheats in the production build.
 for(const [key,ms]of [['1',8000],['3',4000],['6',4000],['4',4000],['7',4000],['0',3000]] as const){if(key!=='0')await page.keyboard.press(key);await page.waitForTimeout(ms);}
 await mkdir('docs/screenshots',{recursive:true});await page.screenshot({path:'docs/screenshots/offline-production-battle.png',fullPage:true});
 const runtime=await page.evaluate(()=>({offline:!navigator.onLine,elapsed:document.querySelector('#elapsed')?.textContent,round:document.querySelector('#round')?.textContent,gold:document.querySelector('#gold-0')?.textContent,population:document.querySelector('#supply-0')?.textContent,fps:document.querySelector('#fps-label')?.textContent,tracks:(window as any).__music.map((e:HTMLAudioElement)=>({src:new URL(e.src).pathname,paused:e.paused,currentTime:e.currentTime,duration:e.duration,error:e.error?.message??null,volume:e.volume})),overflow:document.documentElement.scrollWidth>innerWidth}));
 const range=await page.evaluate(async()=>{const r=await fetch('./audio/eye_of_the_storm.mp3',{headers:{Range:'bytes=0-127'}});const data=await r.arrayBuffer();const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');return {status:r.status,bytes:data.byteLength,contentRange:r.headers.get('Content-Range'),sha256};});
 const offlineFiles=await page.evaluate(async files=>Promise.all(files.map(async file=>{const r=await fetch('./audio/'+file);const data=await r.arrayBuffer();return{file,status:r.status,bytes:data.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('')};})),musicFiles);
 const expectedMusic=await Promise.all(musicFiles.map(async file=>{const data=await readFile('dist/audio/'+file);return{file,status:200,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}));
 const mediaRequests=await worker.evaluate(()=>(self as any).__releaseMediaRequests);
 const expectedRangeHash=createHash('sha256').update((await readFile('dist/audio/eye_of_the_storm.mp3')).subarray(0,128)).digest('hex');
 if(JSON.stringify(artifacts)!==JSON.stringify(await artifactFingerprint()))throw new Error('Production artifacts changed during release verification');
 const result={testedAt:new Date().toISOString(),source,artifacts,url,cacheInfo,runtime,range,offlineFiles,mediaRequests,mediaResponses,failedRequests,abortedRequests,errors,badResponses};
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/release.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(errors.length||badResponses.length||failedRequests.length||runtime.overflow||range.status!==206||range.bytes!==128||range.sha256!==expectedRangeHash)throw new Error('Release runtime check failed');
 const [minutes,seconds]=(runtime.elapsed??'0:0').split(':').map(Number);const played=minutes*60+seconds;
 if(!runtime.offline||played<30||Number(runtime.round?.match(/\d+/)?.[0]??0)<3||Number(runtime.population?.split('/')[0]??0)<1)throw new Error('Offline battle did not actually advance and recruit soldiers');
 if(!runtime.tracks.some((e:any)=>!e.paused&&e.currentTime>0&&!e.error&&e.volume>0))throw new Error('Offline music did not actually play');
 if(JSON.stringify(offlineFiles)!==JSON.stringify(expectedMusic))throw new Error('Offline music bytes differ from the release');
 for(const file of musicFiles){
  if(!runtime.tracks.some((e:any)=>e.src.endsWith('/'+file)&&!e.error&&e.duration>0)||!mediaResponses.some(r=>r.offline&&r.fromServiceWorker&&r.status===206&&r.url.endsWith('/'+file)))throw new Error('Offline browser media did not load through the SW: '+file);
 }
}finally{try{await context?.close();await browser?.close();}finally{await new Promise<void>(r=>server.close(()=>r()));}}
