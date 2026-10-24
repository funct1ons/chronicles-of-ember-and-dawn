import {readFile,writeFile} from 'node:fs/promises';
import {sourceFingerprint} from './fingerprint';
import {createHash} from 'node:crypto';
interface Row{name:string;result:string;seconds:number;endReason:string;missionId?:string;recipe?:string;}
function summarize(rows:Row[],key:(r:Row)=>string){return [...new Set(rows.map(key))].map(name=>{const group=rows.filter(r=>key(r)===name),times=group.map(r=>r.seconds).sort((a,b)=>a-b);return{name,matches:group.length,playerWins:group.filter(r=>r.result==='win').length,draws:group.filter(r=>r.result==='draw').length,losses:group.filter(r=>r.result==='loss').length,medianSeconds:times[Math.floor(times.length/2)],baseDestroyed:group.filter(r=>r.endReason==='baseDestroyed').length};});}
const source=await sourceFingerprint();const result:Record<string,unknown>={generated:new Date().toISOString(),source};
for(const [name,file]of [['holdout','balance-holdout'],['strategy','strategy-suite'],['missions','mission-playability'],['fresh','fresh-validation']] as const){const data=JSON.parse(await readFile(`docs/metrics/${file}.json`,'utf8'));if(data.source.sha256!==source.sha256)throw new Error(`Stale metrics: ${file}.json does not match current gameplay source`);const table=summarize(data.rows,name==='missions'?r=>r.missionId!:r=>r.name);result[name]=table;if(name==='strategy')result.campaignBotSmoke=summarize(data.modes,r=>r.missionId!);console.log('\n'+name+' — wins refer to the named player policy (master in bot mirrors)');console.table(table);}
for(const file of ['ai-role-coverage','challenge-witness']){const data=JSON.parse(await readFile(`docs/metrics/${file}.json`,'utf8'));if(data.source.sha256!==source.sha256)throw new Error(`Stale metrics: ${file}.json does not match current gameplay source`);result[file]=file==='ai-role-coverage'?{total:data.total,selected:data.selected,unselected:data.unselected}:{recipe:data.witness,searchTrials:data.trials.length,verification:summarize(data.verification,(r:Row)=>r.name),mirrors:summarize(data.mirrors,(r:Row)=>r.name)};}
// Presentation/audio have separate source locks: gameplay SHA alone cannot validate them.
async function readPresentation(file:string){
 const data=JSON.parse(await readFile(`docs/metrics/${file}.json`,'utf8'));
 for(const [path,expected] of Object.entries(data.source as Record<string,string>)){
  const actual=createHash('sha256').update(await readFile(path)).digest('hex');
  if(actual!==expected)throw new Error(`Stale metrics: ${file}.json does not match ${path}`);
 }
 return data;
}
const audio=await readPresentation('v11-audio-continuity');
const motion=await readPresentation('v11-motion-browser');
const audit=JSON.parse(await readFile('docs/metrics/v11-motion-audit.json','utf8'));
if(audit.source.sha256!==source.sha256)throw new Error('Stale metrics: v11-motion-audit.json does not match current gameplay source');
const equivalence=JSON.parse(await readFile('docs/metrics/v11-regression-equivalence.json','utf8'));
if(!equivalence.equal||equivalence.files.length!==6||equivalence.files.some((f:{afterSource:string;equal:boolean})=>f.afterSource!==source.sha256||!f.equal))throw new Error('Stale/failed v11 regression equivalence report');
result.v11={
 regressionEquivalence:{file:'v11-regression-equivalence.json',equal:true,files:equivalence.files.length,method:equivalence.method},
 audio:{file:'v11-audio-continuity.json',durationSeconds:audio.durationSeconds,sampleCount:audio.sampleCount,longestSilentSeconds:audio.longestSilentSeconds,longestNotPlayingSeconds:audio.longestNotPlayingSeconds,loopCrossfades:audio.loopCrossfades,transitions:audio.transitions.length,maxCombinedPeak:audio.maxCombinedPeak},
 motion:{file:'v11-motion-browser.json',cases:motion.viewports.length,errors:motion.errors},
 motionAudit:{file:'v11-motion-audit.json',ticks:audit.ticks,samples:audit.samples,stepMax:audit.stepMax,anomalyCount:audit.anomalyCount},
};
await writeFile('docs/metrics/summary.json',JSON.stringify(result,null,2));
