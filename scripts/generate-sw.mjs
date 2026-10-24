import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {matchPrecached,rangeResponse} from './sw-cache.mjs';
async function files(path='dist'){const result=[];for(const f of await readdir(path,{withFileTypes:true})){const p=`${path}/${f.name}`;if(f.isDirectory())result.push(...await files(p));else if(f.name!=='sw.js')result.push(p);}return result;}
const paths=(await files()).sort();
const urls=paths.map(p=>'./'+p.slice(5));
const runtime=`const FILES=${JSON.stringify(urls)};
const URLS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
${matchPrecached.toString()}
${rangeResponse.toString()}
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ember-dawn-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 // The scope root is the sole directory alias. No query stripping, dynamic URLs,
 // other scopes, or runtime responses may enter the static release cache.
 const request=event.request.mode==='navigate'&&event.request.url===self.registration.scope?new Request(new URL('./index.html',self.registration.scope)):event.request;
 if(!URLS.has(request.url))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const response=await matchPrecached(cache,request,URLS);
  if(response)return rangeResponse(response,event.request.headers.get('range'));
  return fetch(event.request);
 })());
});
`;
// Include the emitted handler and file names, not just payload bytes: SW-only
// fixes must install into a fresh cache and retire the previous release cache.
const hash=createHash('sha256');hash.update(runtime);for(const p of paths)hash.update(p).update(await readFile(p));const revision=hash.digest('hex').slice(0,14);
const source=`// Generated from the complete local release, including music. No CDN dependencies.
const CACHE='ember-dawn-${revision}';
${runtime}`;
await writeFile('dist/sw.js',source);console.log(`Offline cache ${revision}: ${paths.length} files, music included.`);
