// Compare frozen before/after deterministic regression artifacts; all actual match seeds retained.
// Old challenge reports contained Date.now() in an unused config template. harness.runMatch
// explicitly overrides it with each row's seed. Normalize ONLY that template to the first search seed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const [beforeDir,afterDir='docs/metrics',output='docs/metrics/v11-regression-equivalence.json']=process.argv.slice(2);
if(!beforeDir)throw new Error('Usage: node scripts/compare-regressions.mjs BEFORE_DIR [AFTER_DIR] [OUTPUT]');
const omitted=new Set(['generated','source','cpuMs']);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!omitted.has(k)).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
const names=['balance-holdout','strategy-suite','mission-playability','fresh-validation','ai-role-coverage','challenge-witness'];
const files=[];
function reportData(value,name){
 if(name==='challenge-witness'){
  if(!Number.isInteger(value.trials?.[0]?.seed))throw new Error('Missing explicit challenge search seed');
  return {...value,config:{...value.config,seed:value.trials[0].seed}};
 }
 return value;
}
for(const name of names){
 const before=JSON.parse(readFileSync(join(beforeDir,name+'.json'),'utf8')),after=JSON.parse(readFileSync(join(afterDir,name+'.json'),'utf8'));
 const b=JSON.stringify(canonical(reportData(before,name))),a=JSON.stringify(canonical(reportData(after,name)));
 const digest=text=>createHash('sha256').update(text).digest('hex');
 files.push({file:name+'.json',beforeSource:before.source?.sha256,afterSource:after.source?.sha256,...(name==='challenge-witness'?{unusedTemplateSeed:{before:before.config.seed,after:after.config.seed,normalizedTo:before.trials[0].seed,reason:'runMatch overrides template seed with every explicit per-match seed; per-match seeds remain compared'}}:{}),equal:b===a,beforeDataSha256:digest(b),afterDataSha256:digest(a)});
}
const report={generated:new Date().toISOString(),method:'Deep canonical comparison; omit generated/source/cpuMs; normalize only unused challenge config template seed to first search seed (explicit per-match seeds all retained). Array order and every gameplay/RNG-derived result retained. Replays are not new independent samples.',files,equal:files.every(f=>f.equal)};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.table(files.map(({file,equal,beforeDataSha256})=>({file,equal,dataSha256:beforeDataSha256})));
if(!report.equal)throw new Error('Deterministic gameplay report changed: '+files.filter(f=>!f.equal).map(f=>f.file).join(', '));
