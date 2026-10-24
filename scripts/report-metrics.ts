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
// Keep previous-release evidence immutable. Select only a complete comparison
// whose AFTER fingerprint is this exact gameplay source, never merely the newest file.
const expectedFiles=['balance-holdout.json','strategy-suite.json','mission-playability.json','fresh-validation.json','ai-role-coverage.json','challenge-witness.json'];
let equivalence:any,equivalenceFile='';
for(const file of ['unit-visual-gameplay-equivalence.json','v11-regression-equivalence.json']){
 let candidate;try{candidate=JSON.parse(await readFile(`docs/metrics/${file}`,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
 if(candidate.equal===true&&candidate.files?.length===6&&new Set(candidate.files.map((f:any)=>f.file)).size===6&&candidate.files.every((f:any)=>expectedFiles.includes(f.file)&&f.afterSource===source.sha256&&f.equal===true&&f.beforeDataSha256===f.afterDataSha256)){equivalence=candidate;equivalenceFile=file;break;}
}
if(!equivalence)throw new Error('No complete regression equivalence report matches the current gameplay source');
const visual=await readPresentation('unit-visual-redesign');
if(visual.unitCount!==16||visual.frameCount!==640||visual.errors.length||visual.defects.length||visual.pairs.length!==9||visual.pairs.some((p:any)=>p.idleIoU>=.86||p.meanIoU>=.86))throw new Error('Failed unit visual audit');
for(const path of ['src/render/sprites.ts','src/render/units/pixelArt.ts','src/render/units/infantry.ts','src/render/units/mobile.ts','src/render/units/casters.ts','src/data/units.ts'])if(!motion.source[path])throw new Error(`Legacy motion report lacks visual source lock: ${path}`);
result.unitVisuals={file:'unit-visual-redesign.json',unitCount:visual.unitCount,frameCount:visual.frameCount,defects:visual.defects.length,regressionEquivalence:{file:equivalenceFile,equal:true,files:equivalence.files.length,method:equivalence.method},pairs:visual.pairs.map((p:any)=>({ids:p.ids,idleIoU:p.idleIoU,meanIoU:p.meanIoU,maxIoU:p.maxIoU}))};
result.v11={
 regressionEquivalence:{file:equivalenceFile,equal:true,files:equivalence.files.length,method:equivalence.method},
 audio:{file:'v11-audio-continuity.json',durationSeconds:audio.durationSeconds,sampleCount:audio.sampleCount,longestSilentSeconds:audio.longestSilentSeconds,longestNotPlayingSeconds:audio.longestNotPlayingSeconds,loopCrossfades:audio.loopCrossfades,transitions:audio.transitions.length,maxCombinedPeak:audio.maxCombinedPeak},
 motion:{file:'v11-motion-browser.json',cases:motion.viewports.length,errors:motion.errors},
 motionAudit:{file:'v11-motion-audit.json',ticks:audit.ticks,samples:audit.samples,stepMax:audit.stepMax,anomalyCount:audit.anomalyCount},
};
await writeFile('docs/metrics/summary.json',JSON.stringify(result,null,2));
