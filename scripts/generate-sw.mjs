import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function files(path='dist'){const result=[];for(const f of await readdir(path,{withFileTypes:true})){const p=`${path}/${f.name}`;if(f.isDirectory())result.push(...await files(p));else if(f.name!=='sw.js')result.push(p);}return result;}
const paths=await files();const hash=createHash('sha256');for(const p of paths.sort())hash.update(await readFile(p));const revision=hash.digest('hex').slice(0,14);
const urls=paths.map(p=>'./'+p.slice(5));
const source=`// Generated from the complete local release, including music. No CDN dependencies.
const CACHE='ember-dawn-${revision}';
const FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ember-dawn-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const response=await cache.match(event.request,{ignoreSearch:true});
  if(response){
   const range=event.request.headers.get('range');
   if(range&&/^bytes=\\d*-\\d*$/.test(range)){
    const data=await response.arrayBuffer();const parts=range.slice(6).split('-');const start=parts[0]?Number(parts[0]):Math.max(0,data.byteLength-Number(parts[1]));const end=parts[0]&&parts[1]?Math.min(Number(parts[1]),data.byteLength-1):data.byteLength-1;
    if(start>data.byteLength-1||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+data.byteLength}});
    return new Response(data.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'audio/mpeg','Content-Range':'bytes '+start+'-'+end+'/'+data.byteLength,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
   }
   return response;
  }
  try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
 })());
});
`;
await writeFile('dist/sw.js',source);console.log(`Offline cache ${revision}: ${paths.length} files, music included.`);
