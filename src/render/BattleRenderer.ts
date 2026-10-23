import type { BattleState, BattleEvent, Biome, Fighter, Side } from '../core/types';
import { UNIT_BY_ID } from '../data/units';
import { sprite, isRanged } from './sprites';
import { scenery, castle, THEMES } from './scenery';
interface Particle {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;kind:'spark'|'arrow'|'magic'|'smoke'|'heal';tx?:number;ty?:number;}
export class BattleRenderer {
 private ctx:CanvasRenderingContext2D;
 private particles:Particle[]=[];
 private shake=0;
 private previousTime=0;
 public reducedMotion=false;
 public showHealth=true;
 public lastFrameMs=0;
 constructor(public canvas:HTMLCanvasElement){canvas.width=1280;canvas.height=540;this.ctx=canvas.getContext('2d',{alpha:false})!;this.ctx.imageSmoothingEnabled=false;}
 consume(events:BattleEvent[]){
  for(const e of events){
   const x=e.x/2,y=e.y/2-12;
   if(e.kind==='shot'){
    const magical=['mage','firemage','healer'].includes(UNIT_BY_ID[e.type??'']?.role);
    this.add({x,y,vx:0,vy:0,life:.32,max:.32,color:magical?(e.type==='firemage'?'#edb17b':'#b4d8ee'):'#dac59b',size:magical?3:1,kind:magical?'magic':'arrow',tx:(e.targetX??e.x)/2,ty:(e.targetY??e.y)/2-10});
   }
   if(e.kind==='hit'||e.kind==='death'||e.kind==='base'){
    const n=e.kind==='death'?5:e.kind==='base'?8:3;
    for(let i=0;i<n;i++)this.add({x,y,vx:(Math.random()-.5)*35,vy:-8-Math.random()*18,life:.2+Math.random()*.3,max:.5,color:i%2?'#d2bb8d':'#9a7860',size:1,kind:'spark'});
    if(e.kind==='base')this.shake=2;
   }
   if(e.kind==='heal')for(let i=0;i<3;i++)this.add({x:x+(Math.random()-.5)*14,y:y+Math.random()*15,vx:0,vy:-13,life:.65,max:.65,color:'#e6dfb6',size:1,kind:'heal'});
   if(e.kind==='spawn')for(let i=0;i<2;i++)this.add({x:x+(Math.random()-.5)*12,y:y+13,vx:Math.random()*6,vy:-5,life:.5,max:.5,color:'#a6a18b',size:2,kind:'smoke'});
  }
 }
 private add(p:Particle){if(this.particles.length<220)this.particles.push(p);}
 clear(){this.particles=[];this.shake=0;}
 render(state:BattleState|null,biome:Biome='plains',clock=performance.now()/1000){
  const start=performance.now();const g=this.ctx;const dt=Math.min(.05,Math.max(0,clock-this.previousTime));this.previousTime=clock;
  const time=this.reducedMotion?0:clock;
  g.save();g.scale(2,2);g.imageSmoothingEnabled=false;
  const shake=this.reducedMotion?0:this.shake;this.shake=Math.max(0,this.shake-dt*9);
  g.translate(Math.round(Math.sin(clock*61)*shake),0);
  g.drawImage(scenery(biome),0,0);
  this.atmosphere(g,biome,time);
  castle(g,37,0,time,state?state.teams[0].baseHp/state.config.baseHp:1,biome);
  castle(g,601,1,time,state?state.teams[1].baseHp/state.config.baseHp:1,biome);
  // Strategic middle-ground glow, then soldiers sorted by feet for stable depth.
  if(state){
   const units=[...state.units].sort((a,b)=>a.y-b.y||a.id-b.id);
   for(const u of units)this.soldier(g,u,time);
   this.projectiles(g,dt);
   if(this.showHealth){for(const side of [0,1] as Side[]){const x=side===0?12:575;g.fillStyle='#0a121be0';g.fillRect(x,223,52,4);g.fillStyle=side===0?'#6d9cb3':'#c47768';g.fillRect(x+1,224,50*Math.max(0,state.teams[side].baseHp/state.config.baseHp),2);}}
  }else{
   for(const side of [0,1] as Side[]){
    for(let i=0;i<18;i++){
     const row=Math.floor(i/6);const x=side===0?155+(i%6)*16+row*6:1125-(i%6)*16-row*6;
     const types=['shield','pike','bow','knight','levy','paladin'];
     this.soldier(g,{id:i,side,type:types[i%6],x,y:370+row*30,hp:100,maxHp:100,cooldown:0,action:'idle',actionTime:0,target:null,born:0},time);
    }
   }
  }
  // Foreground grasses give the army a ground plane instead of a floating UI stage.
  for(let i=0;i<48;i++){const x=(i*97)%640,y=258+(i*3)%12;g.fillStyle=biome==='snow'?'#253e4c':'#18282b';g.fillRect(x,y-3,1,6);g.fillRect(x+2,y-1,1,4);g.fillRect(x-2,y-2,1,4);}
  const fade=g.createLinearGradient(0,248,0,270);fade.addColorStop(0,'#0a121800');fade.addColorStop(1,'#0a1218aa');g.fillStyle=fade;g.fillRect(0,248,640,22);
  g.restore();this.lastFrameMs=performance.now()-start;
 }
 private soldier(g:CanvasRenderingContext2D,u:Fighter,time:number){
  const x=Math.round(u.x/2),y=Math.round(u.y/2);const dead=u.action==='dead';
  const opacity=dead?Math.max(0,1-(u.actionTime/.65)):1;
  g.globalAlpha=opacity;
  g.fillStyle='#07111850';g.beginPath();g.ellipse(x,y-1,UNIT_BY_ID[u.type]?.role==='knight'?13:8,2,0,0,Math.PI*2);g.fill();
  const elapsed=Math.max(0,UNIT_BY_ID[u.type].cooldown-u.cooldown);
  // Movement can resume during an attack cooldown; finish the weapon's four-frame swing anyway.
  const swinging=!dead&&u.cooldown>0&&elapsed<.29&&!(u.action==='hurt'&&u.actionTime<.12);
  const visualAction=swinging?'attack':u.action;
  const frame=swinging?Math.min(3,Math.floor(elapsed*13)):Math.floor(time*(u.action==='walk'?7:2)+u.id*.7)%4;
  const s=sprite(u.type,u.side,visualAction,frame);
  g.save();g.translate(x,y);if(u.side===1)g.scale(-1,1);
  if(dead){g.translate(0,-5);g.rotate(-Math.min(1.5,u.actionTime*5));}
  if(u.action==='hurt'&&Math.floor(time*20)%2===0)g.globalAlpha=.65;
  g.drawImage(s,-18,-34,36,36);
  // Fine attack streak only appears on contact frames, does not obscure silhouettes.
  if(swinging&&frame===2&&!isRanged(UNIT_BY_ID[u.type].role)){
   g.strokeStyle='#e4d3ad8f';g.lineWidth=1;g.beginPath();g.moveTo(13,-24);g.lineTo(21,-16);g.lineTo(18,-9);g.stroke();
  }
  g.restore();g.globalAlpha=1;
  if(this.showHealth&&!dead&&u.hp<u.maxHp){g.fillStyle='#091018bf';g.fillRect(x-7,y-35,14,2);g.fillStyle=u.side===0?'#82b7ca':'#cc8274';g.fillRect(x-7,y-35,14*Math.max(0,u.hp/u.maxHp),1);}
 }
 private atmosphere(g:CanvasRenderingContext2D,biome:Biome,time:number){
  const theme=THEMES[biome];
  // Angled, very restrained shafts of light.
  g.fillStyle=theme.sun+'07';g.beginPath();g.moveTo(420,50);g.lineTo(460,50);g.lineTo(355,220);g.lineTo(250,220);g.fill();
  if(biome==='snow'){
   for(let i=0;i<80;i++){const x=(i*79+time*(5+i%6))%650-5,y=(i*43+time*(7+i%8))%265;g.fillStyle=i%3?'#e1e9dc75':'#e1e9dcba';g.fillRect(Math.floor(x),Math.floor(y),1,i%4?1:2);}
  }else{
   for(let i=0;i<26;i++){const x=(i*83+time*(2+i%3))%640,y=155+(i*37-time*(1+i%4))%100;g.globalAlpha=.2+Math.sin(time+i)*.12;g.fillStyle=biome==='wastes'?'#f7ba7a':biome==='ruins'?'#a2c3ed':'#d5c49d';g.fillRect(Math.round(x),Math.round(y),1,1);}g.globalAlpha=1;
  }
  // Tiny birds in the far sky.
  g.strokeStyle='#182e3d80';g.lineWidth=1;
  for(let i=0;i<4;i++){const x=(time*3+i*19)%680-20,y=42+i*7+Math.sin(time+i)*2;g.beginPath();g.moveTo(x-2,y);g.lineTo(x,y+1);g.lineTo(x+2,y);g.stroke();}
 }
 private projectiles(g:CanvasRenderingContext2D,dt:number){
  for(const p of this.particles){p.life-=dt;if(p.life<=0)continue;g.globalAlpha=Math.min(1,p.life/p.max*1.8);g.fillStyle=p.color;
   if(p.kind==='arrow'||p.kind==='magic'){
    const q=1-p.life/p.max;const x=p.x+((p.tx??p.x)-p.x)*q;const y=p.y+((p.ty??p.y)-p.y)*q-Math.sin(q*Math.PI)*(p.kind==='arrow'?13:3);
    if(p.kind==='arrow'){const dx=(p.tx??p.x)>p.x?1:-1;g.strokeStyle=p.color;g.beginPath();g.moveTo(x-dx*7,y+1);g.lineTo(x,y);g.stroke();g.fillRect(x,y-1,2,2);}
    else{g.globalAlpha*=.3;g.fillRect(x-4,y-4,8,8);g.globalAlpha*=3;g.fillRect(x-1,y-1,3,3);g.fillStyle='#f2e5cf';g.fillRect(x,y,1,1);}
   }else{p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.kind==='spark')p.vy+=55*dt;g.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}
  }
  g.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
 }
}
