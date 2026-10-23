import type {BattleState,Difficulty,MatchConfig,Side,UnitDef} from './types';
import {ALL_UNIT_IDS,UNIT_BY_ID} from '../data/units';
import {clamp,nextRandom} from './math';
import {fastWaveScore,forecastWave,strategicWaveScore,useAdvantageForecast} from './tactics';
import {computeDamage} from './combat';
export function otherSide(side:Side):Side{return side===0?1:0;}
export function allowedUnitsFor(config:MatchConfig,side:Side):string[]{
 const raw=side===otherSide(config.playerSide)&&config.enemyAllowedUnits?.length?config.enemyAllowedUnits:config.allowedUnits;
 const ids=[...new Set((raw??[]).filter(id=>UNIT_BY_ID[id]))];return ids.length?ids:[ALL_UNIT_IDS[0]];
}
export function cheapestAllowed(config:MatchConfig,side:Side):string{return allowedUnitsFor(config,side).map(id=>UNIT_BY_ID[id]).sort((a,b)=>a.cost-b.cost||a.supply-b.supply)[0].id;}
/** Pick after income settlement, before either side recruits. Only public revealed armies are read.
 * Master balances the whole roster and reinvestment; coarse forecasts are only a small-army
 * finishing tool. Normal/hard retain bounded encounter estimates.
 * A legal unaffordable choice may deliberately reserve population for a necessary role transition.
 */
export function chooseAI(state:BattleState,side:Side):string {
 const level=clamp(Math.round(state.config.difficulty),0,4) as Difficulty;
 const legal=allowedUnitsFor(state.config,side).map(id=>UNIT_BY_ID[id]);const team=state.teams[side];
 const free=Math.max(0,state.config.supply-team.supplyUsed);
 const affordable=legal.filter(d=>d.cost<=team.gold&&d.supply<=free);
 if(!affordable.length)return cheapestAllowed(state.config,side);
 const chaos=[.42,.2,.04,0,0][level];
 if(chaos&&nextRandom(state)<chaos)return affordable[Math.floor(nextRandom(state)*affordable.length)].id;
 const noise=[.48,.27,.13,.025,0][level];
 const rank=()=>affordable.map(def=>({def,score:fastWaveScore(state,side,def).score*(1+noise*(nextRandomForLevel(state,level)*2-1))})).sort((a,b)=>b.score-a.score||a.def.cost-b.def.cost);
 // Master needs the old shortlist ranking only if it actually enters a small forecast.
 const ranked=level===4?[]:rank();
 if(level<=1)return ranked[0].def.id;
 const own=state.units.filter(u=>u.side===side&&u.hp>0&&u.action!=='dead');
 const enemy=state.units.filter(u=>u.side!==side&&u.hp>0&&u.action!=='dead');
 // Do not fill the last two slots with another shield forever while an army needs damage.
 const frontSupply=own.reduce((n,u)=>n+(UNIT_BY_ID[u.type].range<120?UNIT_BY_ID[u.type].supply:0),0);
 const backSupply=own.reduce((n,u)=>n+(UNIT_BY_ID[u.type].range>=120&&UNIT_BY_ID[u.type].role!=='healer'?UNIT_BY_ID[u.type].supply:0),0);
 if(level>=3&&team.income>=300&&free<4&&frontSupply>state.config.supply*.62&&backSupply<state.config.supply*.18&&enemy.length){
  const firepower=legal.filter(d=>d.range>=120&&d.role!=='healer'&&d.cost<=team.gold&&d.supply<=6).map(def=>({def,rate:enemy.reduce((sum,u)=>sum+computeDamage(def,UNIT_BY_ID[u.type]),0)/enemy.length/def.cooldown/def.supply})).sort((a,b)=>b.rate-a.rate);
  if(firepower.length&&firepower[0].def.supply>free)return firepower[0].def.id;
 }
 // Do not let a noisy single-wave survivor estimate override economics and complementary
 // roles in a contested fight. This path is linear in army size, including cap-sized battles.
 if(level===4&&!useAdvantageForecast(state,side)){
  return affordable.map(def=>({def,score:strategicWaveScore(state,side,def).score})).sort((a,b)=>b.score-a.score||a.def.cost-b.def.cost)[0].def.id;
 }
 const enemyLegal=allowedUnitsFor(state.config,otherSide(side)).map(id=>UNIT_BY_ID[id]);
 // Master considers the entire 16-unit catalogue; hard uses a bounded shortlist.
 const candidates=level===4?rank():ranked.slice(0,level===3?6:3);
 let best=candidates[0].def;let score=-Infinity;
 for(const c of candidates){const forecast=forecastWave(state,side,c.def,enemyLegal,level===4?34:level===3?22:16);let value=forecast.score;
  if(level<4)value*=1+(level===3?.025:.12)*(nextRandom(state)*2-1);
  if(value>score){score=value;best=c.def;}
 }
 return best.id;
}
function nextRandomForLevel(state:BattleState,level:Difficulty){return level===4?.5:nextRandom(state);}
