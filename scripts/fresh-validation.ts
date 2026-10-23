import {mkdir,writeFile} from 'node:fs/promises';
import {runMatch,mixed,type Policy} from './harness';
import {UNITS} from '../src/data/units';
import type {Side,Difficulty} from '../src/core/types';
import {sourceFingerprint} from './fingerprint';
const source=await sourceFingerprint();
const greedy:Policy=(s,side)=>s.teams[side].income<500?'levy':['paladin','mage','healer','bow'][s.round%4];
const rows:ReturnType<typeof runMatch>[]=[];
// First used after the AI policy was frozen. Later reruns only check arithmetic
// optimization / h1 content edits; these seeds were never used to tune AI weights.
for(const seed of [8093,12547,19181])for(const side of [0,1] as Side[]){
 for(const difficulty of [0,1,2,3,4] as Difficulty[])rows.push(runMatch(`mixed vs difficulty ${difficulty}`,mixed,difficulty,seed,side));
 rows.push(runMatch('greedy elite transition vs master',greedy,4,seed,side));
 rows.push(runMatch('master vs normal',mixed,4,seed,side,side===0?[4,2]:[2,4]));
}
for(const unit of UNITS)for(const side of [0,1] as Side[])rows.push(runMatch(`single ${unit.id} vs master`,()=>unit.id,4,8093,side));
await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/fresh-validation.json',JSON.stringify({generated:new Date().toISOString(),source,note:'74 post-freeze matches with previously unused seeds, symmetric resources and paired factions. Wins refer to the named player policy, or master in the bot mirror. Limited evidence, not an optimal-strategy proof.',rows},null,2));
console.table([...new Set(rows.map(r=>r.name))].map(name=>{const group=rows.filter(r=>r.name===name);return{name,matches:group.length,playerWins:group.filter(r=>r.result==='win').length,draws:group.filter(r=>r.result==='draw').length,losses:group.filter(r=>r.result==='loss').length};}));
