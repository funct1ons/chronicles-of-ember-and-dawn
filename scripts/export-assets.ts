import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserPath} from './browser';
const server=await createServer({server:{host:'127.0.0.1',port:4182,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:browserPath(),headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4182');
 const result=await page.evaluate(async()=>{
  const modulePath='/src/render/sprites.ts',dataPath='/src/data/units.ts',scenePath='/src/render/scenery.ts';
  const {sprite}=await import(modulePath),{UNITS}=await import(dataPath),{scenery}=await import(scenePath);
  const images:Record<string,string>={};
  for(const side of [0,1]){const c=document.createElement('canvas');c.width=960;c.height=768;const g=c.getContext('2d')!;
   const actions=['idle','walk','attack','hurt','dead'];
   UNITS.forEach((u:any,row:number)=>actions.forEach((action,col)=>{for(let f=0;f<4;f++)g.drawImage(sprite(u.id,side,action,f),(col*4+f)*48,row*48);}));
   images[`unit-atlas-${side===0?'azure':'crimson'}.png`]=c.toDataURL('image/png').split(',')[1];
  }
  for(const biome of ['plains','wastes','snow','ruins'])images[`battlefield-${biome}.png`]=scenery(biome).toDataURL('image/png').split(',')[1];
  return images;
 });
 await mkdir('public/art',{recursive:true});
 for(const [name,b64]of Object.entries(result))await writeFile('public/art/'+name,Buffer.from(b64,'base64'));
 await writeFile('public/art/README.txt','Original Ember & Dawn pixel art. Source: src/render/sprites.ts and scenery.ts.\nAtlas: 48x48 cells, rows in src/data/units.ts order. Columns: idle(4), walk(4), attack(4), hurt(4), dead(4).\nHurt/death finishing transformations and team direction happen at runtime in BattleRenderer.\nBackgrounds: 640x270. Copyright (c) 2026 Ember & Dawn contributors; MIT.\n');
 console.log('Exported two character atlases and four battlefield PNGs to public/art.');
}finally{await browser.close();await server.close();}
