import type {BattleState,Fighter,Side,UnitDef} from './types';
import {UNITS,UNIT_BY_ID} from '../data/units';
import {computeDamage} from './combat';
import {BASE_X,laneCenterY,laneOfY} from './math';

const index=new Map(UNITS.map((u,i)=>[u.id,i]));
const hits=UNITS.map(a=>UNITS.map(b=>computeDamage(a,b)));
const chargeHits=UNITS.map(a=>UNITS.map(b=>computeDamage(a,b,{charge:true})));
const ranged=(d:UnitDef)=>d.range>=120&&d.role!=='healer';
interface Troop {id:number;side:Side;def:UnitDef;kind:number;x:number;y:number;hp:number;cooldown:number;charge:boolean;}
export interface Forecast {score:number;count:number;income:number;combat:number;}
function living(s:BattleState,side:Side){return s.units.filter(u=>u.side===side&&u.hp>0&&u.action!=='dead');}
function unit(u:Fighter):Troop{return{id:u.id,side:u.side,def:UNIT_BY_ID[u.type],kind:index.get(u.type)??0,x:u.x,y:u.y,hp:u.hp,cooldown:Math.min(u.cooldown,1),charge:u.charge===true};}
function recruit(nodes:Troop[],side:Side,d:UnitDef,count:number,id:number){for(let i=0;i<count;i++)nodes.push({id:id+i,side,def:d,kind:index.get(d.id)!,x:BASE_X[side]+(side===0?1:-1)*(38+Math.floor(i/8)*15),y:laneCenterY(i%8),hp:d.hp,cooldown:0,charge:['cavalry','knight','elite'].includes(d.role)});}
function copies(s:BattleState,side:Side,d:UnitDef){return Math.max(0,Math.min(18,Math.floor(s.teams[side].gold/d.cost),Math.floor((s.config.supply-s.teams[side].supplyUsed)/d.supply)));}
function predictedEnemy(s:BattleState,side:Side,legal:UnitDef[]):UnitDef {
 // Estimate only from already visible soldiers. Never inspect the private next-wave selection.
 const observed=s.units.filter(u=>u.side===side);let latest=-1;for(const u of observed)latest=Math.max(latest,u.born);
 const counts=new Map<string,number>();for(const u of observed)if(u.born===latest)counts.set(u.type,(counts.get(u.type)??0)+1);
 return legal.slice().sort((a,b)=>(counts.get(b.id)??0)-(counts.get(a.id)??0)||a.cost-b.cost)[0];
}
/** Coarse, simultaneous-damage public-information forecast, not a second authoritative simulator.
 * It models range, armour, front shielding, charge, healing and splash; real movement stays in simulation.ts.
 */
export function forecastWave(s:BattleState,side:Side,d:UnitDef,enemyLegal:UnitDef[],horizon:number):Forecast {
 const n=copies(s,side,d);const enemy=(1-side) as Side;
 const growth=Number.isFinite(s.config.growth)?Math.max(0,s.config.growth):1;
 const income=Math.min(Math.max(0,600-s.teams[side].income),Math.round(n*d.income*growth));
 const nodes=s.units.filter(u=>u.hp>0&&u.action!=='dead').map(unit);
 recruit(nodes,side,d,n,100000);
 const predicted=predictedEnemy(s,enemy,enemyLegal);recruit(nodes,enemy,predicted,copies(s,enemy,predicted),200000);
 const baseDamage=[0,0];const dt=.65;
 const pending=new Float64Array(nodes.length);const healing=new Float64Array(nodes.length);const healingUsed=new Float64Array(nodes.length);
 for(let time=0;time<horizon;time+=dt){
  pending.fill(0);healing.fill(0);
  // Targets use nearest reachable body, then range advantage. All damage settles together.
  for(let i=0;i<nodes.length;i++){
   const a=nodes[i];if(a.hp<=0)continue;const dir=a.side===0?1:-1;const def=a.def;a.cooldown-=dt;
   if(def.role==='healer'){
    let best=-1,need=0;
    for(let j=0;j<nodes.length;j++){const b=nodes[j];if(b.side!==a.side||b.hp<=0||i===j)continue;const gap=Math.abs(b.x-a.x)+Math.abs(b.y-a.y)*.35;if(gap>def.range)continue;const missing=b.def.hp-b.hp-healing[j];if(missing>need){need=missing;best=j;}}
    if(best>=0&&a.cooldown<=0){const amount=Math.min(24,need);healing[best]+=amount;healingUsed[i]+=amount;a.cooldown=def.cooldown;}
    // Follow the nearby front, staying safely behind it.
    let front=a.x;for(const b of nodes)if(b.side===a.side&&b.hp>0&&b.def.range<120&&dir*(b.x-front)>0)front=b.x;
    const target=front-dir*60;if(dir*(target-a.x)>0)a.x+=dir*Math.min(def.speed*dt,Math.abs(target-a.x));continue;
   }
   let target=-1,best=Infinity,nearestSq=Infinity;const reach=def.range+7,reachSq=reach*reach;
   // Target ranking needs only radius comparisons. Avoid millions of duplicate hypot
   // calls in normal/hard's coarse searches; keep the same geometry and tie order.
   for(let j=0;j<nodes.length;j++){const b=nodes[j];if(b.hp<=0||b.side===a.side)continue;const dx=b.x-a.x,dy=b.y-a.y;const distance=Math.abs(dx)+Math.abs(dy)*.5,squared=dx*dx+dy*dy;nearestSq=Math.min(nearestSq,squared);const reachable=squared<=reachSq;
    const score=distance+(reachable?-220:0);if(score<best){best=score;target=j;}
   }
   const guard=Math.max(80,def.range+24);
   if(target<0||(Math.abs(BASE_X[1-a.side]-a.x)<=def.range+30&&nearestSq>guard*guard)){const gap=Math.abs(BASE_X[1-a.side]-a.x);if(gap>def.range+30)a.x+=dir*Math.min(def.speed*dt,gap-def.range-25);else if(a.cooldown<=0){baseDamage[1-a.side]+=def.heavyDamage*(def.role==='siege'?3:1);a.cooldown=def.cooldown;}continue;}
   const b=nodes[target];const dx=b.x-a.x,dy=b.y-a.y;const distance=Math.hypot(dx,dy);
   if(distance>def.range+7){
    let move=Math.min(def.speed*dt,Math.max(0,Math.abs(dx)-Math.max(14,def.range*.85)));
    // Frontline bodies screen the backline but let a melee advance past allied ranged troops.
    for(const other of nodes){if(other===a||other.hp<=0||Math.abs(other.y-a.y)>13)continue;const ahead=Math.sign(dx)*(other.x-a.x);if(ahead<=0)continue;if(other.side===a.side&&def.range<120&&other.def.range>=120)continue;move=Math.min(move,Math.max(0,ahead-13));}
    a.x+=Math.sign(dx)*move;a.y+=Math.sign(dy)*Math.min(Math.abs(dy),def.speed*.5*dt);
   }
   if(distance<=def.range+7&&a.cooldown<=0){
    pending[target]+=(a.charge?chargeHits:hits)[a.kind][b.kind];a.charge=false;a.cooldown=def.cooldown;
    if(def.role==='firemage')for(let j=0;j<nodes.length;j++){const c=nodes[j];if(j!==target&&c.side!==a.side&&c.hp>0&&Math.hypot(c.x-b.x,c.y-b.y)<48)pending[j]+=hits[a.kind][c.kind]*.5;}
   }
  }
  for(let i=0;i<nodes.length;i++){const a=nodes[i];if(a.hp>0)a.hp=Math.max(0,Math.min(a.def.hp,a.hp+healing[i]-pending[i]));}
  if(baseDamage[0]>=s.teams[0].baseHp||baseDamage[1]>=s.teams[1].baseHp)break;
 }
 const values=[0,0];const frontHp=[0,0],healers=[0,0];
 for(const a of nodes)if(a.hp>0){if(a.def.range<120)frontHp[a.side]+=a.hp;if(a.def.role==='healer')healers[a.side]++;}
 for(let i=0;i<nodes.length;i++){const a=nodes[i];if(a.hp<=0)continue;let utility=1;
  if(a.def.role==='healer')utility=.08+.5*Math.min(1,healingUsed[i]/Math.max(1,horizon*9));
  const territory=Math.max(0,Math.min(1,a.side===0?(a.x-80)/1120:(1200-a.x)/1120));
  values[a.side]+=a.def.cost*Math.pow(a.hp/a.def.hp,.8)*utility*(.85+.3*territory);
 }
 const remaining=Math.max(0,(s.config.maxRounds??80)-s.round);
 const pressure=living(s,enemy).some(u=>Math.abs(u.x-BASE_X[side])<330);
 const payoff=Math.min(remaining,pressure?1.4:s.teams[side].income<220?4.2:s.teams[side].income<420?2.8:1.3);
 const unspent=Math.max(0,s.teams[side].gold-n*d.cost);
 const terminal=(baseDamage[enemy]>=s.teams[enemy].baseHp?10000:0)-(baseDamage[side]>=s.teams[side].baseHp?10000:0);
 const combat=values[side]-values[enemy]+(Math.min(s.teams[enemy].baseHp,baseDamage[enemy])-Math.min(s.teams[side].baseHp,baseDamage[side]))*.65+terminal;
 // Gold is valuable, but not more valuable than a living army at the gates.
 const score=combat+unspent*.18+income*payoff;
 return {score,count:n,income,combat};
}

/** Strategic whole-roster utility, deliberately not an encounter outcome prediction.
 * Complementary front / firepower / sustain have diminishing returns. In particular, another
 * melee wave cannot all attack through the same eight lanes, and healers need a real screen.
 * Income gets a reinvestment window rather than the travel-time-sensitive survivor price in
 * forecastWave. This avoids chasing the opponent's last revealed wave in a contested battle.
 */
export function strategicWaveScore(s:BattleState,side:Side,d:UnitDef):Forecast {
 const team=s.teams[side],n=copies(s,side,d),enemies=living(s,(1-side) as Side);
 const foes=enemies.length?enemies.map(u=>UNIT_BY_ID[u.type]):[UNIT_BY_ID.levy];
 const attackers=foes.filter(e=>e.role!=='healer');
 const weight=foes.reduce((sum,e)=>sum+Math.sqrt(e.hp),0);
 // Reuse each of the at most 16 type matchups instead of repeating an enemy scan for
 // every body in the roster. Per candidate this is O(catalogue * enemies + allies).
 const outgoing=new Map<UnitDef,number>(),received=new Map<UnitDef,number>();
 const meanHit=(a:UnitDef)=>{
  if(!outgoing.has(a))outgoing.set(a,foes.reduce((sum,e)=>sum+computeDamage(a,e)*Math.sqrt(e.hp),0)/weight);
  return outgoing.get(a)!;
 };
 const incoming=(a:UnitDef)=>{
  if(!received.has(a))received.set(a,attackers.reduce((sum,e)=>sum+computeDamage(e,a)/e.cooldown,0)/Math.max(1,attackers.length));
  return received.get(a)!;
 };
 const roster=living(s,side).map(u=>({def:UNIT_BY_ID[u.type],hp:u.hp}));
 for(let i=0;i<n;i++)roster.push({def:d,hp:d.hp});
 let front=0,back=0,healing=0,frontHp=0,frontCount=0;
 for(const u of roster){
  const a=u.def,fraction=Math.pow(u.hp/a.hp,.7);let dps=meanHit(a)/a.cooldown;
  if(a.role==='healer'){healing+=16*fraction;continue;}
  if(a.range<120){
   front+=Math.sqrt(a.hp*12/Math.max(3,incoming(a))*dps)*fraction*(a.armor==='heavy'?1.15:1);
   frontHp+=u.hp;frontCount++;
  }else{
   if(a.role==='firemage')dps*=1+Math.min(2,enemies.length*.1);
   if(a.role==='siege'&&enemies.length<5)dps*=1.5;
   back+=dps*(a.range/180)*fraction;
  }
 }
 front*=Math.sqrt(Math.min(1,8/Math.max(1,frontCount)));
 const combat=500*Math.log1p(front/200)+500*Math.log1p(back/100)
  +500*Math.log1p(Math.min(healing,frontHp/12)/30)*Math.min(1,front/300);
 const growth=Number.isFinite(s.config.growth)?Math.max(0,s.config.growth):1;
 const income=Math.min(Math.max(0,600-team.income),Math.round(n*d.income*growth));
 const near=enemies.some(u=>Math.abs(u.x-BASE_X[side])<330);
 const remaining=Math.max(0,(s.config.maxRounds??80)-s.round);
 const payoff=Math.min(remaining,near?1:team.income<500?8:3);
 return {score:combat+income*payoff+Math.max(0,team.gold-n*d.cost)*.15,count:n,income,combat};
}

/** A coarse forecast is useful for exploiting an established advantage / finishing a base,
 * not as the primary economic or composition oracle in an even fight. Uses revealed HP only.
 */
export function useAdvantageForecast(s:BattleState,side:Side):boolean {
 const value=[0,0];let count=0;
 for(const u of s.units)if(u.hp>0&&u.action!=='dead'){
  const d=UNIT_BY_ID[u.type];value[u.side]+=d.cost*u.hp/d.hp;count++;
 }
 // Even after both possible 18-unit recruits, a forecast has at most 64 nodes. Large
 // armies use the linear strategic estimate, never 16 quadratic encounter searches.
 return count<=28&&value[1-side]>0&&value[side]>3*value[1-side];
}

/** Fast marginal roster estimate used by normal/hard, with an explicit whole-wave budget. */
export function fastWaveScore(s:BattleState,side:Side,d:UnitDef):Forecast {
 const n=copies(s,side,d),own=living(s,side),enemies=living(s,(1-side) as Side);
 const enemyDefs=enemies.length?enemies.map(u=>UNIT_BY_ID[u.type]):[UNIT_BY_ID.levy];
 const meanHit=(attacker:UnitDef)=>enemyDefs.reduce((sum,b)=>sum+computeDamage(attacker,b),0)/enemyDefs.length;
 let incoming=0;for(const e of enemyDefs)if(e.role!=='healer')incoming+=computeDamage(e,d)/e.cooldown;incoming/=Math.max(1,enemyDefs.filter(e=>e.role!=='healer').length);
 const dps=d.role==='healer'?0:meanHit(d)/d.cooldown;
 const hp=d.hp*(16/Math.max(3,incoming));
 const front=own.filter(u=>UNIT_BY_ID[u.type].range<120),back=own.filter(u=>ranged(UNIT_BY_ID[u.type]));
 const frontHp=front.reduce((sum,u)=>sum+u.hp,0),healers=own.filter(u=>UNIT_BY_ID[u.type].role==='healer').length;
 const ownDps=own.reduce((sum,u)=>sum+(UNIT_BY_ID[u.type].role==='healer'?0:meanHit(UNIT_BY_ID[u.type])/UNIT_BY_ID[u.type].cooldown),0);
 const isBack=ranged(d);const rangeBonus=isBack?1+Math.min(.75,(d.range-40)/200):1;
 let force=n*Math.sqrt(Math.max(1,hp)*Math.max(1,dps))*rangeBonus;
 if(d.role==='healer')force=Math.min(n,Math.max(0,frontHp/300-healers))*85+Math.min(n,1)*ownDps*.7;
 if(d.range<120){const capacity=Math.max(5,Math.min(16,enemies.length||8));const saturation=Math.min(1,capacity/Math.max(capacity,front.length+n));force*=.45+.55*saturation;force+=Math.min(n*d.hp,Math.max(0,back.length*140-frontHp))*.08;}
 if(isBack&&frontHp<200)force*=.72;
 if(d.role==='firemage'&&enemies.length>8)force*=1+Math.min(.8,enemies.length/30);
 if(d.role==='siege'&&enemies.length<5&&frontHp>500)force*=1.65;
 const growth=Number.isFinite(s.config.growth)?Math.max(0,s.config.growth):1;const income=Math.min(Math.max(0,600-s.teams[side].income),Math.round(n*d.income*growth));
 const near=enemies.some(u=>Math.abs(u.x-BASE_X[side])<330);const payoff=near?1:s.teams[side].income<220?3.2:1.4;
 return {score:force+income*payoff+(s.teams[side].gold-n*d.cost)*.12,count:n,income,combat:force};
}
