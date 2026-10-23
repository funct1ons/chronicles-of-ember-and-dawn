import { UNIT_BY_ID } from '../data/units';
import type { Side, Fighter, Role } from '../core/types';

const cache = new Map<string, HTMLCanvasElement>();
const palettes = [
 {dark:'#182a3b',cloth:'#315c89',light:'#709dbd',gold:'#cfb778',metal:'#8b9da9',shine:'#d5dce0',skin:'#c7ad8e'},
 {dark:'#321e24',cloth:'#8b3e43',light:'#c77968',gold:'#bd9160',metal:'#807e86',shine:'#c4c0bd',skin:'#c4a189'}
];
/** Hand-composed original pixel art. Every cached frame shares a 48×48 grid and upper-left key light. */
export function sprite(id:string, side:Side, action:Fighter['action']='idle', frame=0): HTMLCanvasElement {
 const key=`${id}:${side}:${action}:${frame}`;
 if(cache.has(key)) return cache.get(key)!;
 const c=document.createElement('canvas'); c.width=c.height=48;
 const ctx=c.getContext('2d')!; ctx.imageSmoothingEnabled=false;
 const p=palettes[side]; const def=UNIT_BY_ID[id]; const role=def.role;
 const mounted=role==='cavalry'||role==='knight';
 const isMage=['mage','firemage','healer'].includes(role);
 const f=frame%4; const walk=action==='walk'; const attack=action==='attack';
 const bob=walk?(f%2):(action==='idle'&&f===2?-1:0); const stride=walk?[-2,0,2,0][f]:0;
 const r=(x:number,y:number,w:number,h:number,col:string)=>{ctx.fillStyle=col;ctx.fillRect(x,y,w,h);};
 const poly=(pts:number[],col:string)=>{ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.closePath();ctx.fill();};
 const line=(pts:number[],col:string,w=1)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.stroke();};
 if(role==='siege'){
  ctx.save();ctx.translate(attack?[0,-2,1,0][f]:0,walk?f%2:0);
  poly([9,33,12,22,31,22,38,32,33,37,14,37],'#151b21');
  poly([13,29,16,24,30,24,33,30],'#775e45');r(15,25,17,2,'#b49a69');r(23,20,3,15,p.metal);
  line([11,18,17,15,29,15,38,20],'#1a2025',3);line([12,17,20,18,36,18],'#b6a075',2);line([12,18,24,23,37,19],'#d4c19c');
  r(19,21,21,2,p.shine);r(36,20,5,4,p.metal);r(15,31,3,9,'#4c3a2b');r(30,31,3,9,'#4c3a2b');
  for(const x of [12,32]){poly([x-5,35,x-3,31,x+2,31,x+5,35,x+4,41,x,44,x-4,41],'#19222a');poly([x-3,35,x-1,33,x+2,35,x+3,39,x,41,x-2,39],'#8a7757');r(x-1,35,2,6,'#c2ac7c');r(x-3,37,6,2,'#c2ac7c');}
  r(20,27,9,4,p.cloth);r(20,27,9,1,p.light);
  if(attack&&f===1)line([12,18,20,22,37,19],'#e4d4ac');
  if(walk&&f%2)for(const x of [12,32]){line([x-2,34,x+2,40],'#c2ac7c');line([x-3,40,x+2,34],'#c2ac7c');}
  ctx.restore();return store();
 }
 if(mounted){
  poly([5,29,8,25,28,25,30,17,34,14,39,17,43,26,40,28,34,26,31,33,15,35,8,33],'#171e26');
  poly([8,28,12,26,29,27,33,18,36,17,39,21,39,25,33,24,29,32,13,33],'#7c7268');
  poly([9,28,19,27,28,28,27,31,13,31],'#a0927b');r(33,19,3,3,'#b7ab93');r(38,21,2,2,'#141c22');
  line([10,31,9+stride,40,6+stride,43],'#201f24',3);line([18,33,20-stride,42,23-stride,43],'#43414a',3);
  line([27,31,29+stride,39,27+stride,43],'#222129',3);line([31,30,34-stride,40,37-stride,42],'#43414a',3);
  line([8,27,4,31,3,36],'#22212a',3);line([30,18,32,14,35,15],'#25222b',3);
  poly([13,24,26,24,29,31,12,31],p.dark);poly([14,25,25,25,27,30,14,30],p.cloth);r(15,28,11,1,p.gold);
  if(role==='knight'){poly([31,18,36,17,40,23,38,26,33,24],p.metal);r(33,18,3,2,p.shine);r(12,27,14,2,p.metal);}
 }
 ctx.save();ctx.translate(mounted?-3:0,mounted?-10+bob:bob);
 const h=role==='guardian'?2:0; const heavy=['shield','brute','knight','guardian','elite'].includes(role);
 // Back cape, deliberately jagged hem and lit fold.
 poly([18,18,28,17,32+h,35,29,34,25,37,22,35,16,36,14,33],p.dark);
 poly([18,19,25,19,28,33,24,34,21,32,17,34],p.cloth);line([20,22,18,32],p.light);
 // Articulated greaves and boots.
 if(!mounted){
  poly([19,29,24,29,24+stride,39,20+stride,41,17+stride,40,19+stride,37],'#17212a');
  poly([24,29,29,29,29-stride,38,33-stride,40,33-stride,42,26-stride,42,24-stride,37],'#15212b');
  r(20+stride,33,3,5,heavy?p.metal:'#716c62');r(26-stride,32,3,6,heavy?'#667c8a':'#595c59');
  r(17+stride,40,7,2,'#393b3d');r(26-stride,40,7,2,'#393b3d');
 }
 // Torso / tunic, shaded mail and belt.
 poly([19-h,18,27+h,18,31+h,23,29+h,30,18-h,30,16-h,24],'#15212b');
 poly([19-h,19,27+h,19,29+h,23,27+h,29,19-h,29,17-h,24],heavy?p.metal:p.cloth);
 r(19-h,19,8+h,2,heavy?p.shine:p.light);r(21,22,3,6,heavy?'#b0bcc2':p.light);r(25,22,3,7,heavy?'#617786':p.dark);
 r(18-h,29,11+h*2,2,'#4b423b');r(23,29,3,2,p.gold);
 if(heavy){r(16-h,20,5,3,p.shine);r(16-h,23,4,2,p.metal);r(27,20,5+h,4,p.metal);r(28,20,3+h,1,p.shine);}
 if(isMage){poly([18,26,28,26,32,39,28,41,17,41,15,38],p.dark);poly([20,27,26,27,29,39,18,39],p.cloth);r(22,28,2,11,p.gold);r(17,39,13,2,p.gold);}
 // Head, neck, helmet visor; every face is tucked into a characteristic silhouette.
 r(21,14,6,6,'#1a252d');r(22,15,4,5,p.skin);r(22,15,4,1,'#e7ccb0');
 if(isMage){
  const robe=role==='firemage'?'#814b46':role==='healer'?'#c0b68f':'#66577e';
  poly([17,15,20,9,24,7,28,11,30,17,26,18,26,13,23,12,21,17],p.dark);poly([19,14,22,9,25,9,28,15,26,15,24,12,22,14],robe);r(25,15,3,2,p.skin);r(25,17,2,3,'#d0c6ad');
 }else if(['archer','assassin','skirmisher'].includes(role)){
  poly([18,16,19,10,25,8,29,11,29,17,26,17,26,13,22,13,21,17],p.dark);poly([19,14,21,10,25,10,28,12,26,13,22,12,21,15],def.color);r(26,14,2,1,'#f1d5ad');r(24,17,5,2,p.dark);
 }else{
  poly([18,15,18,11,21,8,26,8,29,11,29,17,26,20,20,18],p.dark);
  poly([19,12,21,9,26,9,28,12,28,16,25,18,20,16],p.metal);r(20,10,5,2,p.shine);r(19,13,9,2,'#354550');r(23,12,2,6,p.shine);r(25,15,3,1,'#131c24');r(19,16,3,2,'#5e7382');
  if(['elite','knight','guardian'].includes(role)){poly([20,9,20,6,24,5,27,6,27,10],p.dark);poly([21,8,22,5,27,5,29,8,26,10],p.cloth);r(22,5,4,1,p.light);r(20,11,8,1,p.gold);}
 }
 // Weapon arm: animation is cached in four distinct poses.
 const swing=attack?f:0;
 const handX=attack?[31,34,35,31][swing]:31;
 const handY=attack?[21,17,25,27][swing]:26;
 line([28,22,30,25,handX,handY],p.dark,4);line([28,22,30,24,handX,handY],heavy?p.metal:p.cloth,2);r(handX-1,handY-1,3,3,p.skin);
 if(role==='archer'){
  line([34,13,38,16,40,24,38,31,34,34],'#1b252c',3);line([34,14,38,18,39,24,37,30,34,33],'#bc9c63');line([34,14,attack?30:35,24,34,33],'#b7b5a5');line([27,24,43,24],p.shine);r(41,23,3,3,p.metal);
 }else if(role==='crossbow'){
  line([30,25,41,21],'#ab8e62',3);line([33,19,37,21,39,27],p.metal,2);line([33,19,34,24,39,27],'#d4c69d');r(39,20,5,1,p.shine);
 }else if(isMage){
  line([33,39,35,12],'#2b252b',3);line([33,38,35,12],'#b8a177');r(33,10,5,5,p.gold);const gem=role==='firemage'?'#f8a066':role==='healer'?'#e9dfa3':'#b6d7ed';poly([35,7,38,11,35,15,32,11],gem);r(34,9,2,3,'#f1f5e1');
  if(attack){r(38,13,2,2,gem);r(31,8,1,2,gem);r(37,6,2,1,gem);}
 }else if(role==='pike'){
  const py=attack?handY-3:handY-9;line([11,35,44,py],'#141d26',3);line([12,35,43,py],'#ba9a61');poly([41,py-2,47,py-3,45,py+2],p.shine);line([15,33,31,py+6],'#d0b886');
 }else if(role==='brute'){
  line([handX-5,handY+7,handX+5,handY-10],'#141f29',4);line([handX-5,handY+7,handX+5,handY-10],'#a18a65',2);
  poly([handX,handY-12,handX+8,handY-13,handX+12,handY-7,handX+9,handY-2,handX+4,handY-5,handX,handY-5],p.dark);poly([handX+2,handY-11,handX+7,handY-11,handX+10,handY-7,handX+8,handY-4,handX+4,handY-7],p.metal);line([handX+7,handY-11,handX+10,handY-7,handX+8,handY-4],p.shine);
 }else{
  const tipX=attack?[35,39,44,39][swing]:36;const tipY=attack?[7,11,24,30][swing]:12;
  line([handX,handY+3,tipX,tipY],p.dark,4);line([handX,handY,tipX,tipY],p.metal,2);line([handX,handY-2,tipX,tipY],'#e0e4dc');line([handX-3,handY-1,handX+3,handY+1],p.gold,2);
 }
 if(['shield','guardian','elite','knight','infantry'].includes(role)){
  const sx=role==='guardian'?14:16; const sh=role==='guardian'?17:13;
  poly([sx-5,23,sx+5,21,sx+7,26,sx+5,23+sh-2,sx,23+sh,sx-5,23+sh-4],p.dark);
  poly([sx-4,24,sx+4,23,sx+5,27,sx+3,23+sh-3,sx,23+sh-1,sx-3,23+sh-4],p.gold);
  poly([sx-2,25,sx+3,24,sx+3,30,sx,23+sh-3,sx-2,23+sh-5],p.cloth);r(sx,26,1,sh-4,p.light);r(sx-1,28,3,1,p.gold);
 }
 if(role==='assassin'){line([17,26,10,22],p.shine,2);r(11,23,4,2,p.gold);}
 ctx.restore();
 return store();
 function store(){cache.set(key,c);return c;}
}

export function paintPortrait(canvas:HTMLCanvasElement,id:string,side:Side=0):void {
 canvas.width=96;canvas.height=80;const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
 const gradient=c.createRadialGradient(48,40,3,48,40,54);gradient.addColorStop(0,side===0?'#314452':'#513639');gradient.addColorStop(1,'#111a20');c.fillStyle=gradient;c.fillRect(0,0,96,80);
 c.fillStyle='#0005';c.beginPath();c.ellipse(48,69,24,5,0,0,Math.PI*2);c.fill();
 c.drawImage(sprite(id,side),0,-11,96,96);
}
export function isRanged(role:Role):boolean {return ['archer','crossbow','mage','healer','firemage','siege'].includes(role);}
