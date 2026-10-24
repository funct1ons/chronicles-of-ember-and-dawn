/**
 * Bounded read-only browser diagnosis; never starts/stops a web server.
 * node scripts/diagnose-cover-performance.mjs --url http://127.0.0.1:4184
 * Three predetermined cases, NOT retries of the release gate. Artifacts under .tmp;
 * only docs/metrics/cover-performance-diagnosis.json is a persistent report.
 * --analyze <run-directory> rebuilds a report from retained raw evidence, no browser.
 */
import {chromium, expect} from '@playwright/test';
import ts from 'typescript';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve, join, basename} from 'node:path';
import {cpus, freemem, totalmem} from 'node:os';
import config from '../playwright.config.ts';
import {sourceFingerprint} from './fingerprint.ts';

const arg = name => {const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const hash = value => createHash('sha256').update(value).digest('hex');
const out = 'docs/metrics/cover-performance-diagnosis.json';
const root = resolve(arg('--analyze') ?? `.tmp/cover-performance-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const jsonWrite = (path, data) => writeFile(path, JSON.stringify(data,null,2)+'\n');
const transpile = code => ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function nodeFor(source, predicate) {
 const file=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let found;
 function visit(n){if(!found&&predicate(n))found=n;else if(!found)ts.forEachChild(n,visit);}visit(file);
 if(!found)throw new Error('Source structure no longer matches the inspected fixture');return found;
}
async function browserTraceEnd(cdp,path){
 const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
 await cdp.send('Tracing.end');const {stream}=await completed;const chunks=[];
 try{while(true){const row=await cdp.send('IO.read',{handle:stream,size:1048576});chunks.push(row.base64Encoded?Buffer.from(row.data,'base64'):Buffer.from(row.data));if(row.eof)break;}}finally{await cdp.send('IO.close',{handle:stream});}
 await writeFile(path,Buffer.concat(chunks));
}
function eventsWithDuration(events){
 const stacks=new Map(),result=[];
 for(const e of events){const key=`${e.pid}/${e.tid}`;
  if(e.ph==='X')result.push(e);
  else if(e.ph==='B'){const stack=stacks.get(key)??[];stack.push(e);stacks.set(key,stack);}
  else if(e.ph==='E'){const b=stacks.get(key)?.pop();if(b)result.push({...b,ph:'X',dur:e.ts-b.ts,tdur:e.tts!==undefined&&b.tts!==undefined?e.tts-b.tts:undefined});}
 }return result;
}
function unionMs(rows,start,end){
 const spans=rows.map(e=>[Math.max(start,e.ts),Math.min(end,e.ts+e.dur)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
 let total=0,left=0,right=0;for(const [a,b] of spans){if(a>right){total+=right-left;left=a;right=b;}else right=Math.max(right,b);}return (total+right-left)/1000;
}
async function summarizeTrace(path, calls){
 const raw=JSON.parse(await readFile(path,'utf8')),events=raw.traceEvents,complete=eventsWithDuration(events);
 const threadNames=events.filter(e=>e.ph==='M'&&e.name==='thread_name').map(e=>({pid:e.pid,tid:e.tid,name:e.args?.name}));
 const processes=events.filter(e=>e.ph==='M'&&e.name==='process_name').map(e=>({pid:e.pid,name:e.args?.name}));
 const marks=events.filter(e=>/^diag-ai-\d+-(start|end)$/.test(e.name));
 const rows=[];
 for(const call of calls){
  const a=marks.find(e=>e.name===`diag-ai-${call.index}-start`),b=marks.find(e=>e.name===`diag-ai-${call.index}-end`);
  if(!a||!b){rows.push({...call,traceError:'missing performance marks'});continue;}
  const same=complete.filter(e=>e.pid===a.pid&&e.tid===a.tid&&e.ts<b.ts&&e.ts+e.dur>a.ts);
  const gc=same.filter(e=>/^(MinorGC|MajorGC|V8\.GC|Scavenge|MarkCompact)/.test(e.name));
  const jit=same.filter(e=>/compile|optimi|deopt|Maglev|TurboFan|Turbofan|Sparkplug/i.test(e.name)&&!/^V8\.GC/.test(e.name));
  const containing=same.filter(e=>e.ts<=a.ts&&e.ts+e.dur>=b.ts&&e.tdur!==undefined).sort((x,y)=>x.dur-y.dur);
  rows.push({...call,warmup:[0,11,17,23,29,35].includes(call.index),pid:a.pid,tid:a.tid,traceStartUs:a.ts,traceEndUs:b.ts,traceWallMs:(b.ts-a.ts)/1000,mainThreadCpuMs:a.tts!==undefined&&b.tts!==undefined?(b.tts-a.tts)/1000:null,gcMainThreadOverlapMs:unionMs(gc,a.ts,b.ts),jitMainThreadOverlapMs:unionMs(jit,a.ts,b.ts),
   gcEvents:gc.map(e=>({name:e.name,wallMs:e.dur/1000,threadMs:e.tdur===undefined?null:e.tdur/1000,args:e.args})),
   jitEvents:jit.map(e=>({name:e.name,wallMs:e.dur/1000,threadMs:e.tdur===undefined?null:e.tdur/1000,args:e.args})),
   containingThreadTimedEvent:containing[0]?{name:containing[0].name,wallMs:containing[0].dur/1000,threadMs:containing[0].tdur/1000}:null});
 }
 return {processes,threadNames,eventCount:events.length,mainThreadEventNames:[...new Set(complete.filter(e=>e.pid===rows[0]?.pid&&e.tid===rows[0]?.tid).map(e=>e.name))].sort(),calls:rows};
}
async function analyze(){
 const meta=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));const cases=[],incompleteCases=[];
 for(const name of meta.caseOrder){let data;try{data=JSON.parse(await readFile(join(root,name,'result.json'),'utf8'));}catch(error){if(error.code==='ENOENT'){incompleteCases.push({name,reason:'Outer shell 150-second bound expired during third prelude; no benchmark result/engine trace. Not rerun.'});continue;}throw error;}
  const trace=await summarizeTrace(join(root,name,'chromium-trace.json'),data.result.diagnosticCalls);
  const result={...data.result};delete result.diagnosticPressure;delete result.diagnosticRelevantPressure;delete result.diagnosticCalls;
  cases.push({...data,result,pressureSha256:hash(data.result.diagnosticPressure),relevantPressureSha256:hash(data.result.diagnosticRelevantPressure),trace});
 }
 let system=[];try{system=(await readFile(join(root,'system.jsonl'),'utf8')).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));}catch{}
 const report={generated:new Date().toISOString(),...meta,rawDirectory:root,method:{
  purpose:'Mechanism diagnosis only, not release acceptance and not retries until green.',
  benchmark:'AST-extracted actual tests/e2e/game.spec.ts page.evaluate callback; all fixture values, warm-ups, call order and counts retained. Wrapper adds UserTiming marks and chronological choice/RNG/heap data. Context Playwright tracing mirrors retain-on-failure capture. Browser CDP trace is additional instrumentation.',
  conditioning:'Six fresh contexts in one reused browser: actual first cover E2E and first five game E2Es, all current UI, same source callbacks; artifact writes redirected to owned .tmp. No audio/codex/combat/flow suite prefix; NOT the complete 14-test suite.',
  legacy:'Only benchmark page serves git HEAD header/home bodies and omits new home.css main import, via request routing. Other modules untouched; current and legacy use identical route/fetch paths.',
  limitations:['Three predetermined cases; UI comparison is not counterbalanced and gives no statistical upper-bound inference.','Instrumentation and isolated existing-server port override can perturb timings.','Per-process CPU deltas are coarse; absence of a sampled competing process does not prove absence of OS preemption.','V8 main-thread compilation/GC overlap supports attribution of observed diagnostic calls only, not historic failures without engine traces.','No forced GC, no extra AI warm-up, no altered gameplay, thresholds, retries, optimization flags or production sources.'],
 },cases,incompleteCases,systemSummary:{samples:system.length,maxMachineCpuPct:Math.max(0,...system.map(s=>s.machineCpuPct)),samplesData:system},conclusion:{status:'Analysis pending; inspect chronological calls and trace overlap before attributing.'}};
 report.method.limitations.push('Two completed current-UI cases only: the legacy case never reached benchmark. These data cannot establish zero UI effect.');
 report.method.limitations.push('Tracing.start introduced a variable pre-benchmark delay (about 1s fresh versus about 11s conditioned, inferred from the template actionTime); tier/heap preparation was not identical. Engine tracing itself may add significant overhead.');
 report.method.limitations.push('The initial exact-URL request routes did not match Vite timestamp query strings on templates in these current-UI cases. The retained current sources were loaded normally; legacy was never measured. Future route matchers have been corrected but not browser-validated.');
 report.systemSummary.validForAttribution=false;
 report.systemSummary.caveat='Sampler used Math.Max(0,double), which PowerShell resolved through an integer overload: process CPU deltas were rounded to whole seconds. Sampling also slowed to roughly 0.5-2s. The displayed aggregate CPU percentages cannot clear or convict system load. Sampler fixed for future use only; no remeasurement.';
 report.historicalEvidence=[];
 for(const path of ['docs/metrics/cover-browser-performance-first-failure.json','docs/metrics/cover-browser-performance-second-failure.json','docs/metrics/browser-performance.json','docs/metrics/v11-browser-performance-first-failure.json']){
  let bytes;try{bytes=await readFile(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}const previous=JSON.parse(bytes.toString());report.historicalEvidence.push({path,fileSha256:hash(bytes),generated:previous.generated,coreSourceSha256:previous.source?.sha256,hard:previous.aiByDifficulty?.find(r=>r.level===3)});
 }
 const relevantEqual=new Set(cases.map(c=>c.relevantPressureSha256)).size===1;
 report.findings={
  actualFixtureIsolation:'Installed Playwright 1.64.1 has worker-scoped browser, default non-reused context and new page per test. One worker/fullyParallel false. Thus prior save/DOM are not directly shared, but browser services/resources and the operating system are. This alone does not prove renderer-isolate reuse or heap leakage.',
  benchmarkSampling:'Master=one warm-up+10 samples, then levels 0,1,2,3 each one warm-up+5 samples on the same pressure state/RNG, then advantage one warm-up+5. All maxima are small-sample wall-time maxima, not steady-state or worst-case bounds. Normal/hard forecast work differs from master; fast master is not proof hard has budget.',
  pressureRelevantInputsEqual:relevantEqual,
  pressureComparison:'Canonical comparison includes config/team/RNG and forecast-relevant unit fields. Complete snapshot hashes differ only in inherited, forecast-unused actionTime; canonical hash equal. All observed AI choices and RNG sequences match between the two completed cases.',
  observed:'Under additional engine instrumentation a fresh browser also spikes (measured hard max 207.6ms); conditioned max 100.9ms. Conditioning warm-up (not counted in gate) was 122.5ms. This is not an uninstrumented full-suite/isolated A/B and must not replace original failures.',
  narrowExclusions:'Fresh call 32 spans 207.540ms, including 181.810ms main-thread CPU. Main-thread GC overlap is 9.442ms and JIT-labelled scope overlap 1.091ms. Therefore a 150ms stop-the-world GC or a 150ms directly recorded synchronous compilation pause does NOT explain this diagnostic spike. The wall-minus-thread-CPU gap is about 25.7ms, not the bulk of the spike.',
  unresolved:'Remaining CPU is not function-attributed. V8 tiering/deoptimization/slow-path execution is a lead, not a proven cause; tracing overhead, changes in executed work and CPU frequency remain possible. No function names/deoptimization reasons, CPU profile or ETW scheduling trace were collected. Historical 182.5/163.7ms spikes have no V8 traces.',
  uiImpact:'Unresolved: old-home benchmark never completed; untouched core hashes establish unchanged code only, not unchanged browser performance.',
 };
 report.conclusion={status:'Root cause unconfirmed; bounded diagnosis stopped without changes to gameplay/tests/thresholds.',
  confirmed:['Full-suite failures remain valid; isolated passes do not clear them.','Current traced fresh and conditioned cases both have spikes; no evidence that suite accumulation is a necessary cause.','Recorded GC and direct JIT scope durations are too short to explain most of the largest diagnostic spike.'],
  nextSeparateTask:'Dedicated performance task: fixed-count fresh/current versus HEAD-home paired runs, with equalized time since launch and explicit low-overhead function CPU profiles plus deoptimization reasons. Collect scheduling/frequency evidence only if thread-CPU gaps warrant it. Keep the 100ms gate and all gameplay rules unchanged; do not add warm-ups/retries as a workaround.',
  releaseScope:'Cover UX/unit/layout/production-offline acceptance is independent of the still-failed full E2E performance gate; this report is not release acceptance.'};
 // Raw traces preserve every event. Keep the durable report reviewable rather than dumping repeated nested scopes.
 for(const c of report.cases)for(const call of c.trace.calls){
  for(const field of ['gcEvents','jitEvents']){const grouped=new Map();for(const e of call[field]??[]){const item=grouped.get(e.name)??{name:e.name,count:0,inclusiveTotalMs:0,maxMs:0};item.count++;item.inclusiveTotalMs+=e.wallMs;item.maxMs=Math.max(item.maxMs,e.wallMs);grouped.set(e.name,item);}call[field+'Summary']=[...grouped.values()].map(e=>({...e,inclusiveTotalMs:+e.inclusiveTotalMs.toFixed(3)}));delete call[field];}
 }
 report.scripts={runnerSha256:hash(await readFile('scripts/diagnose-cover-performance.mjs')),samplerSha256:hash(await readFile('scripts/diagnose-cover-performance.ps1')),note:'Hashes describe final scripts. Offline-analysis handling, query-string route matching and future sampler precision were fixed after the bounded collection; instrumented-benchmark.js in rawDirectory is the exact executed browser callback.'};
 await jsonWrite(out,report);console.log(JSON.stringify({report:out,cases:cases.map(c=>({name:c.name,hard:c.result.aiByDifficulty.find(r=>r.level===3),slowest:c.trace.calls.filter(c=>c.level===3).map(c=>({i:c.index,ms:c.durationMs,cpu:c.mainThreadCpuMs,gc:c.gcMainThreadOverlapMs,jit:c.jitMainThreadOverlapMs}))})),incompleteCases,conclusion:report.conclusion},null,2));
}
if(arg('--analyze')){await analyze();process.exit(0);}
const url=arg('--url');if(!url)throw new Error('Pass explicit --url for an already-running Vite server; this script never manages servers.');
await mkdir(root,{recursive:true});
const gameSource=await readFile('tests/e2e/game.spec.ts','utf8');
const benchmark=nodeFor(gameSource,n=>ts.isVariableDeclaration(n)&&n.name.getText()==='result'&&n.initializer&&ts.isAwaitExpression(n.initializer)&&ts.isCallExpression(n.initializer.expression)&&n.initializer.expression.expression.getText()==='page.evaluate').initializer.expression.arguments[0].getText();
const wrapped=transpile(`const diagnosticBenchmark=${benchmark};`).replace(/^const diagnosticBenchmark\s*=\s*/,'').replace(/;\s*$/,'');
let instrumented=wrapped; // All transformations below assert exactly one match.
const replaceOnce=(source,oldText,newText)=>{if(source.split(oldText).length!==2)throw new Error('Nonunique fixture instrumentation: '+oldText);return source.replace(oldText,newText);};
instrumented=replaceOnce(instrumented,'{ chooseAI } = await import(aiPath)','{ chooseAI: nativeChooseAI } = await import(aiPath)');
instrumented=replaceOnce(instrumented,'const pressure = createBattle(',`const diagnosticCalls = [];
 const chooseAI = (state, side) => {
  const index=diagnosticCalls.length,level=state.config.difficulty,rngBefore=state.rng;
  const heapBefore=performance.memory?.usedJSHeapSize;
  performance.mark('diag-ai-'+index+'-start'); const started=performance.now();
  const choice=nativeChooseAI(state,side);const durationMs=performance.now()-started;
  performance.mark('diag-ai-'+index+'-end');
  diagnosticCalls.push({index,level,rngBefore,rngAfter:state.rng,choice,durationMs,heapBefore,heapAfter:performance.memory?.usedJSHeapSize,atMs:started});
  return choice;
 };
 const pressure = createBattle(`);
const firstChoose=instrumented.indexOf('chooseAI(pressure, 1);');if(firstChoose<0)throw new Error('Missing first AI warm-up');
instrumented=instrumented.slice(0,firstChoose)+`const diagnosticPressure=JSON.stringify(pressure);
 const diagnosticRelevantPressure=JSON.stringify({...pressure,units:pressure.units.map(({id,side,type,x,y,hp,cooldown,charge,born})=>({id,side,type,x,y,hp,cooldown,charge,born}))});
 const diagnosticTemplate={...template};
 `+instrumented.slice(firstChoose);
instrumented=replaceOnce(instrumented,'userAgent: navigator.userAgent','userAgent: navigator.userAgent, diagnosticCalls, diagnosticPressure, diagnosticRelevantPressure, diagnosticTemplate');
await writeFile(join(root,'instrumented-benchmark.js'),instrumented);
const templatePath='src/ui/templates.ts',currentTemplate=await readFile(templatePath,'utf8');
const legacyTemplate=execFileSync('git',['show','HEAD:'+templatePath],{encoding:'utf8'});
function functionText(source,name){return nodeFor(source,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText();}
const legacyBodies=Object.fromEntries(['header','home'].map(name=>[name,transpile(functionText(legacyTemplate,name)).trim()]));
const fixedCases=[{name:'01-current-fresh',ui:'current',conditioned:false},{name:'02-current-conditioned',ui:'current',conditioned:true},{name:'03-legacy-conditioned',ui:'legacy',conditioned:true}];
const sourceFiles=['playwright.config.ts','tests/e2e/game.spec.ts','tests/e2e/cover.spec.ts','src/main.ts',templatePath,'src/ui/home.css','src/style.css','src/ui/App.ts'];
const manifest={started:new Date().toISOString(),command:process.argv.join(' '),node:process.version,platform:process.platform,cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramBytes:totalmem(),freeMemoryBytes:freemem(),config,actualURL:url,serverOverrideReason:'Configured 4180 not listening; explicit existing same-repository Vite at supplied URL. No server started/stopped.',source:await sourceFingerprint(),sourceFiles:Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(p))]))),legacyHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),caseOrder:fixedCases.map(c=>c.name),browserVersion:null};
await jsonWrite(join(root,'manifest.json'),manifest);
const systemLog=createWriteStream(join(root,'system.jsonl'));
const sampler=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/diagnose-cover-performance.ps1'),'-DurationSeconds','120'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
sampler.stdout.pipe(systemLog);sampler.stderr.on('data',d=>process.stderr.write(d));
async function routedContext(browser,ui,artifacts){
 const context=await browser.newContext({baseURL:url,viewport:config.use.viewport});
 await context.route(/\/src\/main\.ts(?:\?|$)/,async route=>{
  const response=await route.fetch();let body=await response.text();
  if(ui==='legacy'){
   const file=ts.createSourceFile('main.js',body,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   const declaration=file.statements.find(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text.split('?')[0]==='/src/ui/home.css');
   if(!declaration)throw new Error('Expected actual Vite home.css import');body=body.slice(0,declaration.getStart(file))+body.slice(declaration.end);
  }
  await route.fulfill({response,body});
 });
 await context.route(/\/src\/ui\/templates\.ts(?:\?|$)/,async route=>{
  const response=await route.fetch();let body=await response.text();
  if(ui==='legacy')for(const name of ['header','home'])body=body.replace(functionText(body,name),legacyBodies[name]);
  await writeFile(join(artifacts,'served-templates.js'),body);await route.fulfill({response,body});
 });
 // Mirrors actual runner's retain-on-failure recording; saves only temporary files here.
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 return context;
}
async function callbacks(path){
 const text=await readFile(path,'utf8'),file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
 const withoutImports=file.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(file)).join('\n');
 const tests=[],test=(title,fn)=>tests.push({title,fn});test.setTimeout=()=>{};
 const redirect=path=>{const p=String(path).replaceAll('\\','/');if(!p.startsWith('docs/metrics'))throw new Error('Refusing unowned prelude write '+p);return join(root,'prelude-writes',p);};
 const names=['test','expect','mkdir','writeFile','readFile','createHash','sourceFingerprint'];
 const values=[test,expect,async(path,options)=>mkdir(redirect(path),options),async(path,data)=>{const p=redirect(path);await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p,data);},readFile,createHash,sourceFingerprint];
 const js=transpile(withoutImports).replace(/export \{\};?\s*$/,'');new Function(...names,js)(...values);return tests;
}
const coverCallbacks=await callbacks('tests/e2e/cover.spec.ts'),gameCallbacks=await callbacks('tests/e2e/game.spec.ts');
async function condition(browser,dir){
 const history=[];for(const [i,entry] of [coverCallbacks[0],...gameCallbacks.slice(0,5)].entries()){
  const artifacts=join(dir,'prelude-'+i);await mkdir(artifacts,{recursive:true});const context=await routedContext(browser,'current',artifacts);
  try{const page=await context.newPage();const start=Date.now();await entry.fn({page},{outputPath:name=>join(artifacts,name),attach:async()=>{}});history.push({title:entry.title,elapsedMs:Date.now()-start});}
  finally{await context.tracing.stop();await context.close();}
 }return history;
}
let failure;
try{
 // Existing-server health check, no fallback or server lifecycle management.
 const server=await fetch(new URL('/src/main.ts',url),{signal:AbortSignal.timeout(3000)});if(!server.ok||!(await server.text()).includes('/src/ui/home.css'))throw new Error('Supplied URL is not the current dev source');
 for(const item of fixedCases){
  console.log('DIAGNOSIS START',item.name,new Date().toISOString());const dir=join(root,item.name);await mkdir(dir,{recursive:true});
  const browser=await chromium.launch({...config.use.launchOptions,headless:config.use.headless});let context,browserCDP;
  try{
   manifest.browserVersion=browser.version();await jsonWrite(join(root,'manifest.json'),manifest);
   const history=item.conditioned?await condition(browser,dir):[];
   context=await routedContext(browser,item.ui,dir);const page=await context.newPage();
   await page.goto('/');await page.locator('h1').waitFor();await page.locator('[data-action="classic"]').first().click();await page.locator('[data-action="launch"]').first().click();await expect(page.locator('.battle-canvas')).toBeVisible();
   const pageCDP=await context.newCDPSession(page);await pageCDP.send('Performance.enable');const before=await pageCDP.send('Performance.getMetrics');
   browserCDP=await browser.newBrowserCDPSession();const processInfo=await browserCDP.send('SystemInfo.getProcessInfo');
   const categories=['toplevel','devtools.timeline','blink.user_timing','v8','v8.execute','disabled-by-default-v8.gc','disabled-by-default-v8.compile','disabled-by-default-devtools.timeline'];
   await browserCDP.send('Tracing.start',{categories:categories.join(','),transferMode:'ReturnAsStream',options:'record-as-much-as-possible'});
   const begin=new Date().toISOString();const result=await page.evaluate('('+instrumented+')()');const end=new Date().toISOString();
   const after=await pageCDP.send('Performance.getMetrics');await browserTraceEnd(browserCDP,join(dir,'chromium-trace.json'));
   await jsonWrite(join(dir,'result.json'),{...item,begin,end,history,processInfo,before,after,result});
   console.log('DIAGNOSIS RESULT',item.name,JSON.stringify(result.aiByDifficulty));
  }finally{if(context){await context.tracing.stop({path:join(dir,'playwright-trace.zip')});await context.close();}await browser.close();}
 }
}catch(error){failure=error;await jsonWrite(join(root,'error.json'),{message:String(error),stack:error.stack});}
finally{sampler.kill();await new Promise(resolve=>sampler.once('close',resolve));await new Promise(resolve=>systemLog.end(resolve));}
if(failure)throw failure;
manifest.finished=new Date().toISOString();await jsonWrite(join(root,'manifest.json'),manifest);await analyze();
