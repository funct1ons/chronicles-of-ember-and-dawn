import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {matchPrecached,rangeResponse} from '../scripts/sw-cache.mjs';

const url='https://example.test/game/audio/music.mp3',urls=new Set([url]);
const response=(vary='Accept-Encoding',status=200)=>new Response('complete static file',{status,headers:{Vary:vary}});
function cacheWithVariant(candidate:Response){
 return {match:vi.fn(async(_request:RequestInfo|URL,options?:CacheQueryOptions)=>options?.ignoreVary?candidate:undefined)};
}
describe('exact static cache encoding fallback',()=>{
 it('recovers only the complete encoding variant after a normal Vary miss',async()=>{
  const cached=response(),cache=cacheWithVariant(cached),request=new Request(url,{headers:{'Accept-Encoding':'identity;q=1, *;q=0',Range:'bytes=0-'}});
  expect(await matchPrecached(cache,request,urls)).toBe(cached);
  expect(cache.match.mock.calls).toEqual([[request],[url,{ignoreVary:true}]]);
 });
 it('uses an ordinary hit without bypassing Vary',async()=>{
  const cached=response('Origin'),cache={match:vi.fn(async()=>cached)};
  expect(await matchPrecached(cache,new Request(url),urls)).toBe(cached);
  expect(cache.match).toHaveBeenCalledTimes(1);
 });
 it.each(['Origin','Accept-Language','Cookie','Authorization','*','Accept-Encoding, Origin','Accept-Encoding, *',''])('does not bypass Vary: %s',async vary=>{
  expect(await matchPrecached(cacheWithVariant(response(vary)),new Request(url),urls)).toBeUndefined();
 });
 it.each([url+'?v=1',url+'/',url.replace('/game/','/other/'),url.replace('example.test','other.test')])('does not cache-match a nonmanifest URL: %s',async other=>{
  const cache=cacheWithVariant(response());
  expect(await matchPrecached(cache,new Request(other),urls)).toBeUndefined();
  expect(cache.match).not.toHaveBeenCalled();
 });
 it('never matches non-GET requests or partial/opaque responses via fallback',async()=>{
  const cache=cacheWithVariant(response());
  expect(await matchPrecached(cache,new Request(url,{method:'POST'}),urls)).toBeUndefined();expect(cache.match).not.toHaveBeenCalled();
  expect(await matchPrecached(cacheWithVariant(response('Accept-Encoding',206)),new Request(url),urls)).toBeUndefined();
  expect(await matchPrecached(cacheWithVariant({status:200,type:'opaque',headers:new Headers({Vary:'Accept-Encoding'})} as Response),new Request(url),urls)).toBeUndefined();
 });
});

describe('cached single byte ranges',()=>{
 const data=Uint8Array.from({length:10},(_,i)=>i);
 const full=()=>new Response(data,{headers:{'Content-Type':'audio/mpeg'}});
 it.each<[string,number,number]>([
  ['bytes=0-3',0,3],['bytes=4-',4,9],['bytes=-3',7,9],['bytes=8-999',8,9],['bytes=-999',0,9],['bytes=0-0',0,0],['bytes=9-9',9,9],
 ])('%s returns correct 206 bytes and headers',async(range,start,end)=>{
  const r=await rangeResponse(full(),range);
  expect(r.status).toBe(206);expect(r.headers.get('Content-Range')).toBe(`bytes ${start}-${end}/10`);
  expect(r.headers.get('Content-Length')).toBe(String(end-start+1));expect(r.headers.get('Content-Type')).toBe('audio/mpeg');expect(r.headers.get('Accept-Ranges')).toBe('bytes');
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(data.slice(start,end+1));
 });
 it.each(['bytes=10-','bytes=7-2','bytes=-0','bytes=999999999999999999999-'])('%s returns a bodyless 416',async range=>{
  const r=await rangeResponse(full(),range);expect(r.status).toBe(416);expect(r.headers.get('Content-Range')).toBe('bytes */10');expect((await r.arrayBuffer()).byteLength).toBe(0);
 });
 it('rejects ranges on an empty body',async()=>{const r=await rangeResponse(new Response(''),'bytes=0-');expect(r.status).toBe(416);expect(r.headers.get('Content-Range')).toBe('bytes */0');});
 it.each([null,'bytes=-','bytes=0-1,4-5','items=0-1','bytes=not-a-range'])('ignores unsupported or malformed range %s',async range=>{
  const original=full(),r=await rangeResponse(original,range);expect(r).toBe(original);expect(r.status).toBe(200);expect(new Uint8Array(await r.arrayBuffer())).toEqual(data);
 });
});

it('generated worker intercepts only exact release URLs; handler changes revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ember-sw-test-'));
 try{
  await mkdir(join(dir,'dist'));await mkdir(join(dir,'scripts'));
  for(const name of ['generate-sw.mjs','sw-cache.mjs'])await copyFile(new URL('../scripts/'+name,import.meta.url),join(dir,'scripts',name));
  await writeFile(join(dir,'dist','index.html'),'<h1>static</h1>');
  const generate=()=>execFileSync(process.execPath,[join(dir,'scripts','generate-sw.mjs')],{cwd:dir});
  generate();const first=await readFile(join(dir,'dist','sw.js'),'utf8');
  generate();expect(await readFile(join(dir,'dist','sw.js'),'utf8')).toBe(first);
  const handlers:Record<string,(event:any)=>void>={},scope='https://example.test/game/';
  const cache={match:vi.fn(async()=>new Response('static'))};const caches={open:vi.fn(async()=>cache)};
  runInNewContext(first,{URL,Request,Response,Set,caches,self:{registration:{scope},location:{origin:new URL(scope).origin},addEventListener:(name:string,handler:(event:any)=>void)=>{handlers[name]=handler;}}});
  for(const [url,method,mode]of [[scope+'index.html','GET','cors'],[scope,'GET','navigate']]){
   let promise:Promise<Response>|undefined;handlers.fetch({request:{url,method,mode,headers:new Headers()},respondWith:(p:Promise<Response>)=>{promise=p;}});expect(promise).toBeDefined();expect((await promise!).status).toBe(200);
  }
  for(const [url,method,mode]of [[scope+'index.html?q=1','GET','cors'],[scope+'missing','GET','navigate'],[scope+'index.html','POST','cors'],['https://other.test/game/index.html','GET','cors'],['https://example.test/other/','GET','navigate']]){
   const respondWith=vi.fn();handlers.fetch({request:{url,method,mode},respondWith});expect(respondWith).not.toHaveBeenCalled();
  }
  const helper=await readFile(join(dir,'scripts','sw-cache.mjs'),'utf8');await writeFile(join(dir,'scripts','sw-cache.mjs'),helper.replace("const parts=/^bytes=",'/* handler revision probe */ const parts=/^bytes='));
  generate();const changed=await readFile(join(dir,'dist','sw.js'),'utf8');
  expect(changed.match(/const CACHE='([^']+)'/)![1]).not.toBe(first.match(/const CACHE='([^']+)'/)![1]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
