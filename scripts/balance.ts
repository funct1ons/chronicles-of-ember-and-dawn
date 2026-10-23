import {mkdir,writeFile} from 'node:fs/promises';
import {UNITS} from '../src/data/units';
import type {Side,Difficulty} from '../src/core/types';
import {runMatch as run,mixed} from './harness';
import {sourceFingerprint} from './fingerprint';
const source=await sourceFingerprint();
const quick=process.argv.includes('--quick');const holdout=process.argv.includes('--holdout');const humanOnly=process.argv.includes('--human-only');
const seeds=quick?[17]:holdout?[301,509,997,1201,2027]:[17,103,806,73,204];const rows=[];
for(const seed of seeds)for(const side of (quick?[0]:[0,1]) as Side[]){
 for(const d of (quick?[2,4]:[0,1,2,3,4]) as Difficulty[])rows.push(run(`mixed vs difficulty ${d}`,mixed,d,seed,side));
 for(const unit of (quick?UNITS.filter(u=>['levy','pike','shield','axe'].includes(u.id)):UNITS))rows.push(run(`single ${unit.id} vs master`,()=>unit.id,4,seed,side));
 if(!quick&&!humanOnly)rows.push(run('master vs normal',mixed,4,seed,side,side===0?[4,2]:[2,4]));
}
await mkdir('docs/metrics',{recursive:true});const path=`docs/metrics/balance${quick?'-quick':holdout?'-holdout':humanOnly?'-training':''}.json`;
await writeFile(path,JSON.stringify({generated:new Date().toISOString(),source,note:'Production 80-round rules. Human policies select before countdown; built-in AI selects after both incomes settle. Bot mirrors use the same post-income decision hook. No hidden bonuses; paired sides and deterministic seeds. Limited samples, not a universal balance proof.',rows},null,2));
console.table(rows.map(({name,playerSide,result,seconds,peakUnits,income,cpuMs})=>({name,playerSide,result,seconds,peakUnits,income:income.join('/'),cpuMs})));console.log(`Saved ${path}`);
