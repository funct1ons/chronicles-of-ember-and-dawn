import type { Biome, Side } from '../core/types';
const scenes=new Map<Biome,HTMLCanvasElement>();
export const THEMES:Record<Biome,{sky:string[]; mountain:string[]; ground:string[]; haze:string;sun:string}>= {
 plains:{sky:['#172b3c','#687876','#b5a38a'],mountain:['#4f6567','#3b5358','#2b424b'],ground:['#505b4b','#363e35','#252e29'],haze:'#c9c7a1',sun:'#f4deae'},
 wastes:{sky:['#211f33','#79545a','#c39071'],mountain:['#745b62','#51474f','#373943'],ground:['#615047','#453c36','#2c2929'],haze:'#d1a787',sun:'#ffd6a2'},
 snow:{sky:['#15283b','#526d83','#b0c4c7'],mountain:['#738e9d','#4d697e','#304a61'],ground:['#9baeb1','#6d858f','#344d5d'],haze:'#d6e9ed',sun:'#e8f2ef'},
 ruins:{sky:['#171c33','#45445f','#8f8589'],mountain:['#57526b','#3b3e56','#272f44'],ground:['#4e5554','#393c41','#262d36'],haze:'#b3a1b8',sun:'#e6bfaa'}
};
function random(seed:number){let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
export function scenery(biome:Biome):HTMLCanvasElement {
 if(scenes.has(biome))return scenes.get(biome)!;
 const c=document.createElement('canvas');c.width=640;c.height=270;const g=c.getContext('2d')!;const t=THEMES[biome];const rnd=random(477);
 const rect=(x:number,y:number,w:number,h:number,col:string)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),w,h);};
 const poly=(pts:number[],col:string)=>{g.fillStyle=col;g.beginPath();g.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i],pts[i+1]);g.closePath();g.fill();};
 const sky=g.createLinearGradient(0,0,0,171);sky.addColorStop(0,t.sky[0]);sky.addColorStop(.65,t.sky[1]);sky.addColorStop(1,t.sky[2]);g.fillStyle=sky;g.fillRect(0,0,640,270);
 // Discrete cloud banks and warm horizon.
 for(let i=0;i<40;i++){const x=rnd()*660-20,y=rnd()*90+15;rect(x,y,25+rnd()*80,1+rnd()*3|0,'#d5c5b20a');rect(x+8,y+3,15+rnd()*50,1,'#e7d6b00a');}
 const sx=biome==='wastes'?465:biome==='ruins'?180:420;const sy=64;
 const halo=g.createRadialGradient(sx,sy,2,sx,sy,100);halo.addColorStop(0,t.sun+'68');halo.addColorStop(.2,t.sun+'20');halo.addColorStop(1,t.sun+'00');g.fillStyle=halo;g.fillRect(sx-100,0,200,170);
 g.fillStyle=t.sun+'a0';g.beginPath();g.arc(sx,sy,biome==='ruins'?14:10,0,Math.PI*2);g.fill();
 if(biome==='ruins'){g.fillStyle=t.sky[1];g.beginPath();g.arc(sx+7,sy-4,12,0,Math.PI*2);g.fill();}
 // Three silhouettes, each with its own silhouette frequency.
 for(let layer=0;layer<3;layer++){
  const pts=[0,180];let x=-20;while(x<680){pts.push(x,100+layer*21-rnd()*(55-layer*14));x+=18+rnd()*34;}pts.push(680,186);
  poly(pts,t.mountain[layer]);
  if(biome==='snow'&&layer<2){for(let i=2;i<pts.length-4;i+=2){const px=pts[i],py=pts[i+1];if(py<105)poly([px-12,py+17,px,py,px+15,py+20,px+5,py+15,px,py+18,px-4,py+13],'#c4d3cf'+(layer===0?'90':'60'));}}
 }
 // Forest and distant fortifications.
 for(let i=0;i<75;i++){const x=rnd()*640,y=145+rnd()*13,s=3+rnd()*6;poly([x-s,y,x,y-s*3,x+s,y],biome==='snow'?'#263d4d':'#263b3e');rect(x-1,y,2,5,'#293a3d');}
 if(biome==='ruins'){
  for(const x of [154,198,430,466]){const y=x===198?105:117;rect(x,y,9,50,'#2a3343');rect(x-2,y-3,13,5,'#55606a');rect(x+2,y+4,2,30,'#5c6467');for(let i=0;i<3;i++)rect(x-3,y+32+i*6,15,2,'#444c58');}
  rect(147,104,62,5,'#535969');poly([147,104,160,95,180,94,192,98,210,103],'#464b5b');
  poly([432,117,442,108,467,110,478,117],'#4b5360');
 }
 if(biome==='wastes'){
  for(const x of [130,190,485]){rect(x,140,3,26,'#2b3035');poly([x,146,x-10,138,x-12,134,x-10,143,x,153],'#2b3035');poly([x+1,149,x+13,142,x+18,131,x+12,138],'#2b3035');}
 }
 const mist=g.createLinearGradient(0,125,0,177);mist.addColorStop(0,t.haze+'00');mist.addColorStop(.7,t.haze+'22');mist.addColorStop(1,t.haze+'00');g.fillStyle=mist;g.fillRect(0,125,640,53);
 const ground=g.createLinearGradient(0,156,0,270);ground.addColorStop(0,t.ground[0]);ground.addColorStop(.65,t.ground[1]);ground.addColorStop(1,t.ground[2]);g.fillStyle=ground;g.fillRect(0,164,640,106);
 // Winding trampled road; little stone and grass texture, all on the same pixel grid.
 poly([0,192,110,186,225,180,375,183,510,191,640,189,640,228,470,223,360,216,230,221,100,228,0,222],biome==='snow'?'#b1bcb760':'#9b8d6440');
 for(let i=0;i<2400;i++){
  const x=rnd()*640,y=163+rnd()*107;const bright=rnd()>.6;
  rect(x,y,1+Math.floor(rnd()*3),1,biome==='snow'?(bright?'#e0e6d335':'#263e4d20'):(bright?'#c7b38923':'#101c202a'));
  if(i%7===0){rect(x,y-2,1,3,biome==='snow'?'#738d8e70':'#88926750');rect(x+2,y-1,1,2,biome==='wastes'?'#a5846440':'#7a896250');}
 }
 for(let i=0;i<35;i++){const x=rnd()*640,y=166+rnd()*85;poly([x-2,y,x,y-2,x+3,y-1,x+4,y+1,x-2,y+1],biome==='snow'?'#cfdbd3':'#77766a');rect(x,y-2,2,1,biome==='snow'?'#e0e7db':'#9b9781');}
 // Broken fences and abandoned swords.
 for(const x of [112,520]){rect(x,164,2,14,'#3c3a32');rect(x+18,167,2,13,'#3c3a32');rect(x,169,20,2,'#64604c');poly([x+1,175,x+1,177,x+19,171,x+19,169],'#4d4e3d');}
 for(const [x,y] of [[173,238],[446,235]]){poly([x,y,x+5,y-15,x+7,y-15,x+2,y], '#7d8c8d');rect(x+2,y-10,7,2,'#9e8b66');rect(x+6,y-15,2,4,'#40392f');}
 const vignette=g.createRadialGradient(320,155,90,320,155,375);vignette.addColorStop(0,'#060c1200');vignette.addColorStop(1,'#060c126d');g.fillStyle=vignette;g.fillRect(0,0,640,270);
 scenes.set(biome,c);return c;
}
export function castle(g:CanvasRenderingContext2D,x:number,side:Side,time:number,health=1,biome:Biome='plains') {
 const r=(a:number,b:number,w:number,h:number,c:string)=>{g.fillStyle=c;g.fillRect(Math.round(x+a),b,w,h);};
 const p=(pts:number[],c:string)=>{g.fillStyle=c;g.beginPath();g.moveTo(x+pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)g.lineTo(x+pts[i],pts[i+1]);g.closePath();g.fill();};
 const stone=side===0?['#34434d','#55636b','#7c8585']:['#38373d','#57545a','#817675'];
 const cloth=side===0?'#355a83':'#873e45';const shine=side===0?'#819faf':'#bc7b6a';
 // Dark silhouette then layered stone courses.
 r(-28,149,58,66,'#18252d');r(-25,153,51,60,stone[0]);r(-27,154,55,3,stone[2]);
 for(let row=0;row<9;row++)for(let col=0;col<6;col++){const xx=-25+col*9+(row%2?4:0);if(xx>25)continue;r(xx,159+row*6,Math.min(8,26-xx),5,row%3===0?stone[1]:stone[0]);r(xx,159+row*6,Math.min(8,26-xx),1,'#ffffff0c');}
 for(const dx of [-30,21]){
  r(dx,132,13,80,'#18232b');r(dx+1,134,11,76,stone[1]);r(dx+2,138,3,70,stone[2]);r(dx+8,138,3,70,stone[0]);
  r(dx-1,131,15,5,stone[2]);for(let i=0;i<3;i++)r(dx-1+i*6,126,3,7,stone[1]);
  for(let y=142;y<205;y+=9)r(dx+1,y,11,1,'#16232a80');r(dx+5,147,3,8,'#121e25');r(dx+5,166,3,8,'#121e25');
 }
 r(-17,143,38,8,stone[0]);r(-18,142,39,3,stone[2]);for(let i=0;i<6;i++)r(-18+i*7,137,4,8,stone[1]);
 // Main arched iron gate.
 p([-9,213,-9,187,-6,180,0,177,7,180,10,187,10,213],'#172127');p([-7,213,-7,187,-4,182,1,180,6,183,8,187,8,213],'#483c31');
 for(let i=0;i<4;i++){r(-6+i*4,185,1,28,'#857154');r(-6+i*4,185,1,1,'#c5a975');}r(-7,193,16,2,'#262c2d');r(-7,205,16,2,'#262c2d');
 // Banner and emblem.
 r(-5,151,12,23,cloth);p([-5,174,7,174,1,179],cloth);r(-5,151,2,21,shine);r(0,155,2,14,'#ceb581');r(-3,159,8,2,'#ceb581');
 // Flags move, never deform the towers.
 r(-24,102,1,30,'#baaa84');const wave=Math.round(Math.sin(time*2.8+side)*2);p([-23,103,-6,105+wave,-9,114+wave,-23,112],cloth);r(-23,104,11,1,shine);
 r(27,109,1,24,'#baaa84');p([28,109,43,111-wave,40,119-wave,28,117],cloth);
 // Fire sconces and stone steps.
 for(const dx of [-13,14]){r(dx,193,2,8,'#271f1d');r(dx-1,190,4,4,'#ba763b');r(dx,187+(Math.sin(time*12+dx)>0?0:1),2,5,'#e5b86d');r(dx,190,1,2,'#fff0ac');}
 r(-32,212,68,4,stone[1]);r(-36,216,75,3,stone[0]);
 if(biome==='snow'){r(-30,130,15,2,'#c7d3cf');r(20,130,15,2,'#c7d3cf');r(-18,141,39,2,'#c7d3cf');r(-33,213,71,1,'#c7d3cf');}
 if(health<.55){for(let i=0;i<4;i++){const y=130-(time*12+i*9)%55;g.globalAlpha=.25*(1-(130-y)/70);r(-10+i*5+Math.sin(time+i)*3,y,8+i*2,7+i*2,'#2b242c');}g.globalAlpha=1;r(12,166,3,18,'#1b232a');r(15,178,2,18,'#1b232a');}
}
