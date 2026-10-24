// Browser-only audit module. Not imported by the production application.
import {sprite} from '../src/render/sprites';
import {UNITS} from '../src/data/units';
import type {Fighter,Side} from '../src/core/types';
import {unitArtist,ARMY_PALETTES} from '../src/render/units/pixelArt';
import {drawInfantry} from '../src/render/units/infantry';
import {drawMobile} from '../src/render/units/mobile';
import {drawCasters} from '../src/render/units/casters';
const actions:Fighter['action'][]=['idle','walk','attack','hurt','dead'];
const problemPairs=[['levy','shield'],['shield','paladin'],['shield','guardian'],['guardian','paladin'],['runner','assassin'],['rider','knight'],['mage','healer'],['mage','firemage'],['healer','firemage']];
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function pixels(id:string,side:Side=0,action:Fighter['action']='idle',f=0){return sprite(id,side,action,f).getContext('2d')!.getImageData(0,0,48,48).data;}
function overlap(a:Uint8ClampedArray,b:Uint8ClampedArray){let union=0,intersection=0,equal=0;for(let i=0;i<a.length;i+=4){const aa=a[i+3]>=128,bb=b[i+3]>=128;if(aa||bb){union++;if(aa&&bb)intersection++;if(aa&&bb&&a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2]&&a[i+3]===b[i+3])equal++;}}return {iou:intersection/union,equalFraction:equal/union};}
export function auditUnitSprites(){
 const defects:string[]=[],frames:{id:string;side:Side;action:Fighter['action'];frame:number;opaque:number;partial:number;bounds:number[];checksum:number}[]=[];
 for(const u of UNITS)for(const side of [0,1] as Side[])for(const action of actions)for(let f=0;f<4;f++){
  const c=sprite(u.id,side,action,f),data=pixels(u.id,side,action,f);let opaque=0,partial=0;
  const bounds=[48,48,-1,-1];let checksum=2166136261;
  for(let i=0;i<data.length;i++){checksum=Math.imul(checksum^data[i],16777619)>>>0;if(i%4!==3||data[i]===0)continue;opaque++;if(data[i]!==255)partial++;const j=(i-3)/4,x=j%48,y=Math.floor(j/48);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
  if(c.width!==48||c.height!==48||opaque<60)defects.push(`${u.id}/${side}/${action}/${f}: invalid/empty frame`);
  if(partial)defects.push(`${u.id}/${side}/${action}/${f}: ${partial} antialiased pixels`);
  // Render the exact artist on an oversized scratch canvas. Pixels outside its
  // source-cell boundary expose clipping, rather than guessing from edge contact.
  const padded=canvas(112,112),g=padded.getContext('2d')!;g.translate(32,32);
  const artist=unitArtist(g,u.id,side,action,f);
  if(!drawInfantry(artist)&&!drawMobile(artist)&&!drawCasters(artist))defects.push(`${u.id}: no artist`);
  const wide=g.getImageData(0,0,112,112).data;let outside=0;
  for(let y=0;y<112;y++)for(let x=0;x<112;x++)if((x<32||x>=80||y<32||y>=80)&&wide[(y*112+x)*4+3])outside++;
  if(outside)defects.push(`${u.id}/${side}/${action}/${f}: ${outside} clipped pixels`);
  frames.push({id:u.id,side,action,frame:f,opaque,partial,bounds,checksum});
 }
 const factionInk=UNITS.map(u=>{
  const raw=pixels(u.id),ink=new Set([ARMY_PALETTES[0].cloth,ARMY_PALETTES[0].light,ARMY_PALETTES[0].gold].map(hex=>[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)).join(',')));let covered=0,total=0;
  for(let i=0;i<raw.length;i+=4)if(raw[i+3]){total++;if(ink.has(`${raw[i]},${raw[i+1]},${raw[i+2]}`))covered++;}
  for(const action of actions)for(let f=0;f<4;f++){const a=pixels(u.id,0,action,f),b=pixels(u.id,1,action,f);for(let i=3;i<a.length;i+=4)if(a[i]!==b[i]){defects.push(`${u.id}/${action}/${f}: factions differ in geometry`);break;}}
  return {id:u.id,idleClothLightGoldFraction:covered/total};
 });
 // Check all 120 pairs as well: fixing the original nine must not create a new
 // near-duplicate elsewhere. Read each pose once, outside the pairwise loop.
 const posePixels=new Map(UNITS.map(u=>[u.id,(['idle','walk','attack'] as Fighter['action'][]).flatMap(action=>[0,1,2,3].map(frame=>({action,frame,data:pixels(u.id,0,action,frame)})))]));
 const allPairs:{ids:string[];idleIoU:number;meanIoU:number;maxIoU:number;poses:{action:Fighter['action'];frame:number;iou:number;equalFraction:number}[]}[]=[];
 for(let i=0;i<UNITS.length;i++)for(let j=i+1;j<UNITS.length;j++){
  const a=UNITS[i].id,b=UNITS[j].id,ap=posePixels.get(a)!,bp=posePixels.get(b)!;
  const poses=ap.map((p,k)=>({action:p.action,frame:p.frame,...overlap(p.data,bp[k].data)}));
  allPairs.push({ids:[a,b],idleIoU:poses[0].iou,meanIoU:poses.reduce((sum,p)=>sum+p.iou,0)/poses.length,maxIoU:Math.max(...poses.map(p=>p.iou)),poses});
 }
 const pairs=problemPairs.map(([a,b])=>allPairs.find(p=>p.ids[0]===a&&p.ids[1]===b)!);
 const closestPairs=[...allPairs].sort((a,b)=>b.idleIoU-a.idleIoU).slice(0,12).map(({poses:_,...row})=>row);
 const animation=UNITS.map(u=>{const unique=(action:Fighter['action'])=>new Set(frames.filter(f=>f.id===u.id&&f.side===0&&f.action===action).map(f=>f.checksum)).size;return {id:u.id,walkUnique:unique('walk'),attackUnique:unique('attack'),idleUnique:unique('idle')};});
 for(const a of animation)if(a.walkUnique<3||a.attackUnique<3)defects.push(`${a.id}: too few distinct walking/attack poses`);
 const idleHashes=frames.filter(f=>f.side===0&&f.action==='idle'&&f.frame===0).map(f=>f.checksum);if(new Set(idleHashes).size!==16)defects.push('Duplicate complete unit art');
 return {method:'48x48 common anchor alpha>=128 mask IoU is geometry, NOT player recognition. All 640 source frames inspected; padded redraw detects clipping; raw alpha checks pixel edges. Headless animation hashes do not replace visual review.',unitCount:UNITS.length,frameCount:frames.length,defects,pairs,allPairCount:allPairs.length,closestPairs,animation,factionInk,frames};
}
export function unitContactSheet(){
 const sheet=canvas(1280,980),g=sheet.getContext('2d')!;g.imageSmoothingEnabled=false;g.fillStyle='#101b24';g.fillRect(0,0,1280,980);
 g.font='19px Microsoft YaHei';g.fillStyle='#dac89f';g.fillText('军团新军备 · 双阵营 2× / 实际源像素 1× / 单色轮廓',24,32);
 g.font='12px Microsoft YaHei';g.fillStyle='#96a8b4';g.fillText('按图鉴顺序。展示尺寸不等于所有 DPI 的战场投影；另验收真实战场与动画。',24,56);
 UNITS.forEach((u,i)=>{const x=(i%4)*320,y=76+Math.floor(i/4)*222;
  g.fillStyle='#192932';g.fillRect(x+8,y,304,210);g.font='16px Microsoft YaHei';g.fillStyle='#ded6bf';g.fillText(u.name,x+20,y+28);
  g.drawImage(sprite(u.id,0),x+14,y+40,96,96);g.drawImage(sprite(u.id,1),x+112,y+40,96,96);g.drawImage(sprite(u.id,0),x+226,y+77);
  const mask=canvas(48,48),m=mask.getContext('2d')!,img=m.createImageData(48,48),raw=pixels(u.id);
  for(let p=0;p<raw.length;p+=4)if(raw[p+3]>=128){img.data[p]=img.data[p+1]=img.data[p+2]=215;img.data[p+3]=255;}m.putImageData(img,0,0);g.drawImage(mask,x+226,y+140);
  g.fillStyle='#93a7ad';g.font='11px Microsoft YaHei';g.fillText(`${u.id} · ${u.role}`,x+20,y+166);g.fillText(u.title,x+20,y+190);
 });return sheet.toDataURL('image/png');
}
export function unitAnimationSheet(side:Side){const sheet=canvas(960,800),g=sheet.getContext('2d')!;g.fillStyle='#15232c';g.fillRect(0,0,960,800);g.imageSmoothingEnabled=false;g.font='12px Microsoft YaHei';g.fillStyle='#d4c7a8';['待机','行军','出手','受击','死亡（运行时另有倾倒）'].forEach((s,i)=>g.fillText(s,i*192+12,21));UNITS.forEach((u,row)=>actions.forEach((action,col)=>{for(let f=0;f<4;f++)g.drawImage(sprite(u.id,side,action,f),(col*4+f)*48,32+row*48);}));return sheet.toDataURL('image/png');}
