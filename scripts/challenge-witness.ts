import {mkdir,writeFile} from 'node:fs/promises';
import {runMatch,type Policy,mixed} from './harness';
import {CHALLENGES,missionConfig} from '../src/data/missions';
import type {Side} from '../src/core/types';
import {sourceFingerprint} from './fingerprint';
const mission=CHALLENGES.find(m=>m.id==='h1')!,config=missionConfig(mission,true),source=await sourceFingerprint();
const cycles=[['bow'],['assassin'],['bow','assassin'],['levy','bow','bow'],['bow','bow','assassin','assassin'],['runner','bow','assassin','assassin'],['axe','bow'],['levy','axe','bow'],['axe']];
const trials=[];let witness:{farm:number;cycle:string[]}|undefined,bestSeconds=Infinity;
for(const farm of [0,160,320])for(const cycle of cycles){const policy:Policy=(s,side)=>s.teams[side].income<farm?'levy':cycle[s.round%cycle.length];const row={...runMatch(`h1 farm=${farm} ${cycle.join('/')}`,policy,mission.difficulty,101,0,undefined,config),farm,cycle};trials.push(row);if(row.result==='win'&&row.seconds<bestSeconds){witness={farm,cycle};bestSeconds=row.seconds;}}
const verification:ReturnType<typeof runMatch>[]=[];if(witness){const recipe=witness;const policy:Policy=(s,side)=>s.teams[side].income<recipe.farm?'levy':recipe.cycle[s.round%recipe.cycle.length];for(const seed of [101,203,307])for(const side of [0,1] as Side[])verification.push(runMatch('h1 selected recipe verification',policy,mission.difficulty,seed,side,undefined,config));}
// Same-rule public-information bot mirrors are a separate constructive check, not a human walkthrough.
const mirrors:ReturnType<typeof runMatch>[]=[];for(const seed of [101,203,307])for(const side of [0,1] as Side[])mirrors.push(runMatch('h1 hard mirror',mixed,3,seed,side,[3,3],config));
await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/challenge-witness.json',JSON.stringify({generated:new Date().toISOString(),source,config,note:'Explicit recipe search followed by paired-faction verification; not an unbiased win-rate sample. Public-information bot mirrors are separate, not human completion.',witness,trials,verification,mirrors},null,2));
console.log('Recipe',witness);console.table([...verification,...mirrors].map(r=>({name:r.name,seed:r.seed,side:r.playerSide,result:r.result,seconds:r.seconds})));
if(!witness||![0,1].every(side=>verification.some(r=>r.playerSide===side&&r.result==='win'&&r.endReason==='baseDestroyed')))throw new Error('No paired-faction h1 base-destruction witness found');
