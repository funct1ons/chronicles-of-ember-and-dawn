import {mkdir,writeFile} from 'node:fs/promises';
import {runMatch,type Policy,mixed} from './harness';
import {UNIT_BY_ID} from '../src/data/units';
import {MISSIONS,CHALLENGES,missionConfig} from '../src/data/missions';
import type {Side} from '../src/core/types';
import {sourceFingerprint} from './fingerprint';
const source=await sourceFingerprint();
const cycle=(target:number,ids:string[]):Policy=>(s,side)=>s.teams[side].income<target?'levy':ids[s.round%ids.length];
const policies:Record<string,Policy>={
 'mixed':mixed,
 'healing phalanx':cycle(240,['guardian','bow','healer','pike','mage']),
 'siege column':cycle(240,['shield','mage','ballista','healer','bow']),
 'mobile breakthrough':cycle(200,['rider','assassin','bow','knight','firemage']),
 'greedy elite transition':cycle(500,['paladin','mage','healer','bow']),
 'reactive counters':(s,side)=>{
  if(s.teams[side].income<240)return 'levy';const foes=s.units.filter(u=>u.side!==side&&u.hp>0);const total=Math.max(1,foes.length);
  const heavy=foes.filter(u=>UNIT_BY_ID[u.type].armor==='heavy').length/total;
  const mounted=foes.filter(u=>['cavalry','knight'].includes(UNIT_BY_ID[u.type].role)).length/total;
  if(s.round%5===0)return 'healer';if(s.round%3===0)return 'shield';if(mounted>.25)return 'pike';return heavy>.45?'mage':'bow';
 }
};
const rows:ReturnType<typeof runMatch>[]=[];
for(const [name,policy] of Object.entries(policies))for(const seed of [311,613,1093,1553,1999])for(const side of [0,1] as Side[])rows.push(runMatch(`${name} vs master`,policy,4,seed,side));
const modes:(ReturnType<typeof runMatch>&{missionId:string})[]=[];
for(const m of [...MISSIONS,...CHALLENGES])for(const seed of [101,203,307])modes.push({...runMatch(m.id,mixed,m.difficulty,seed,0,[4,m.difficulty],missionConfig(m,m.id.startsWith('h'))),missionId:m.id});
await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/strategy-suite.json',JSON.stringify({generated:new Date().toISOString(),source,note:'Unseen canned strategies and public-information player-bot campaign/challenge smoke tests. Player-bot results are not human completion or an optimal-play proof.',rows,modes},null,2));
console.table(Object.keys(policies).map(name=>{const r=rows.filter(x=>x.name===`${name} vs master`);return {strategy:name,matches:r.length,playerWins:r.filter(x=>x.result==='win').length,draws:r.filter(x=>x.result==='draw').length,limits:r.filter(x=>x.atLimit).length};}));
console.table([...MISSIONS,...CHALLENGES].map(m=>{const r=modes.filter(x=>x.missionId===m.id);return {mission:m.id,matches:r.length,playerBotWins:r.filter(x=>x.result==='win').length,draws:r.filter(x=>x.result==='draw').length};}));
console.log('Saved docs/metrics/strategy-suite.json');
