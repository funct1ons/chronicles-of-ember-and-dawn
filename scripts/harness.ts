import {performance} from 'node:perf_hooks';
import {createBattle,stepBattle,selectUnit} from '../src/core/simulation';
import {chooseAI} from '../src/core/ai';
import {defaultConfig} from '../src/data/missions';
import type {BattleState,Side,Difficulty,MatchConfig} from '../src/core/types';
export type Policy=(s:BattleState,side:Side)=>string;
export const mixed:Policy=(s,side)=>s.teams[side].income<200?'levy':['shield','bow','pike','crossbow','mage','healer'][s.round%6];
export const heuristic=(difficulty:Difficulty):Policy=>(s,side)=>{const prior=s.config.difficulty;s.config.difficulty=difficulty;const choice=chooseAI(s,side);s.config.difficulty=prior;return choice;};
export function runMatch(name:string,player:Policy,difficulty:Difficulty,seed:number,side:Side=0,bots?:[Difficulty,Difficulty],config:Partial<MatchConfig>={}){
 const s=createBattle({...defaultConfig(),...config,seed,difficulty,ai:!bots,playerSide:side});let peak=0,steps=0;const choices:Record<string,number>={};const start=performance.now();
 const hook=bots?(state:BattleState,which:Side)=>heuristic(bots[which])(state,which):undefined;
 while(s.winner===null&&s.time<1000){
  // Human-style policies select before the boundary; the built-in AI selects after income
  // through production runWave. Bot mirrors share its post-income pre-spawn decision hook.
  if(!bots&&s.countdown<=1/30+1e-8)selectUnit(s,side,player(s,side));
  stepBattle(s,1/30,hook);
  for(const e of s.events)if(e.kind==='spawn'&&e.side!==side)choices[e.type!]=(choices[e.type!]??0)+1;
  peak=Math.max(peak,s.units.filter(u=>u.hp>0).length);steps++;
 }
 const atLimit=s.round>=(s.config.maxRounds??80);
 return {name,seed,playerSide:side,winner:s.winner,result:s.winner==='draw'?'draw':s.winner===side?'win':'loss',seconds:Math.round(s.time),rounds:s.round,peakUnits:peak,base:s.teams.map(t=>Math.max(0,Math.round(t.baseHp))),income:s.teams.map(t=>Math.round(t.income)),spent:s.teams.map(t=>Math.round(t.spent)),kills:s.teams.map(t=>t.kills),aiRecruits:choices,cpuMs:Math.round(performance.now()-start),steps,atLimit,endReason:s.teams.some(t=>t.baseHp<=0)?'baseDestroyed':atLimit?'roundLimit':'timeBudget'};
}
