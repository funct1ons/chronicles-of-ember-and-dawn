// Real-time 5-minute BGM bus measurement. No seeking, no time acceleration.
import {chromium} from '@playwright/test';
import {existsSync,readdirSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const cache=join(process.env.LOCALAPPDATA??'','ms-playwright');let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath&&existsSync(cache))for(const d of readdirSync(cache).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1])){const p=join(cache,d,'chrome-win64','chrome.exe');if(existsSync(p)){executablePath=p;break;}}
const duration=Number(process.env.AUDIO_TEST_SECONDS??305);
const fingerprint=()=>Object.fromEntries(['src/audio/AudioManager.ts','src/audio/musicMix.ts','src/audio/percussion.ts','src/audio/battleAccentCues.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const source=fingerprint(),browser=await chromium.launch({executablePath,headless:true});
const report={generated:new Date().toISOString(),durationSeconds:duration,source,kind:'digital waveform continuity; not human listening',errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 // Isolate the audio director from Vite's App/template HMR reloads during parallel work.
 // This is the exact production AudioManager, driven by an ordinary real RAF clock.
 await page.route('**/__audio-audit',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><button id="unlock">Start audio audit</button><script type="module">import {AudioManager} from "/src/audio/AudioManager.ts";const audio=new AudioManager();window.__EMBER__={audio};document.querySelector("button").onclick=()=>audio.unlock();let last=performance.now();function frame(now){audio.update((now-last)/1000);last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);</script>'}));
 await page.goto(new URL('__audio-audit',process.env.GAME_URL??'http://127.0.0.1:4199/').href);await page.locator('#unlock').click();
 await page.waitForFunction(()=>window.__EMBER__.audio.isUnlocked);
 await page.evaluate(()=>{window.__EMBER__.audio.setScene('battle');});await page.waitForTimeout(5000);
 await page.evaluate(async()=>{
  const {attachAudioMonitor}=await import('/src/audio/audioMonitor.ts'),a=window.__EMBER__.audio,m=attachAudioMonitor(a);if(!m)throw new Error('no analyser');
  const samples=[],transitions=[],began=performance.now();let phase=0;
  window.__LONG_AUDIO__={samples,transitions,monitor:m,timer:setInterval(()=>{
   const elapsed=(performance.now()-began)/1000,p=Math.floor(elapsed/60);
   if(p!==phase){const before=a.current?.el.currentTime;a.setScene(p%2?'climax':'battle');transitions.push({elapsed,fromTime:before,toTime:a.current?.el.currentTime,scene:a.scene});phase=p;}
   const s=m.sample();samples.push({elapsed,musicRms:s.musicRms,musicPeak:s.musicPeak,combinedPeak:s.combinedPeak,layerRms:s.layerRms,scene:s.scene,track:s.track,loops:s.loopCrossfades,playheads:s.decks.map(d=>d.currentTime),playing:s.decks.some(d=>!d.paused&&d.volume>0)});
  },80)};
 });
 await page.waitForTimeout(duration*1000);
 const measured=await page.evaluate(()=>{const t=window.__LONG_AUDIO__;clearInterval(t.timer);return {samples:t.samples,transitions:t.transitions};});
 let longestSilentSeconds=0,start=null,longestNotPlayingSeconds=0,notPlaying=null;const silentSegments=[];
 for(const s of measured.samples){
  if(s.musicRms<.00001){if(start===null)start=s.elapsed;}else if(start!==null){const length=s.elapsed-start;silentSegments.push({start,end:s.elapsed,length});longestSilentSeconds=Math.max(longestSilentSeconds,length);start=null;}
  if(!s.playing){if(notPlaying===null)notPlaying=s.elapsed;}else if(notPlaying!==null){longestNotPlayingSeconds=Math.max(longestNotPlayingSeconds,s.elapsed-notPlaying);notPlaying=null;}
 }
 const last=measured.samples.at(-1);if(start!==null)longestSilentSeconds=Math.max(longestSilentSeconds,last.elapsed-start);if(notPlaying!==null)longestNotPlayingSeconds=Math.max(longestNotPlayingSeconds,last.elapsed-notPlaying);
 Object.assign(report,{sampleCount:measured.samples.length,longestSilentSeconds,longestNotPlayingSeconds,silentSegments,maxCombinedPeak:Math.max(...measured.samples.map(s=>s.combinedPeak)),minMusicRms:Math.min(...measured.samples.map(s=>s.musicRms)),loopCrossfades:last.loops,transitions:measured.transitions,samples:measured.samples});
}finally{await browser.close();mkdirSync('docs/metrics',{recursive:true});writeFileSync('docs/metrics/v11-audio-continuity.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({...report,samples:undefined},null,2));
if(report.errors.length||report.longestSilentSeconds>.5||report.longestNotPlayingSeconds>.2||report.maxCombinedPeak>=.99||report.transitions.some(t=>Math.abs(t.toTime-t.fromTime)>.05)||report.loopCrossfades<Math.floor(duration/147))throw new Error('Audio continuity criteria failed; inspect report.');
if(JSON.stringify(source)!==JSON.stringify(fingerprint()))throw new Error('Audio sources changed during measurement.');
