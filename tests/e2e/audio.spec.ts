import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('all local orchestral recordings actually play, crossfade, mute, and limit battle voices',async({page},info)=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto('/');await page.locator('[data-action="classic"]').click();
 await page.waitForFunction(()=>{const m=(window as any).__EMBER__.audio;return m.isUnlocked&&Array.from(m.elements.values()).every((el:any)=>el.readyState>=2&&el.duration>30);},{},{timeout:25000});
 const report=await page.evaluate(async()=>{
  const m=(window as any).__EMBER__.audio,ctx=m.ctx as AudioContext;
  const analyzer=ctx.createAnalyser();analyzer.fftSize=2048;const connected=new Set();
  const tracks=[];const scenes=['menu','campaign','prepare','battle','climax','victory','defeat'];
  for(const scene of scenes){
   m.setScene(scene);const el=m.current.el as HTMLAudioElement;
   if(!connected.has(el)){const source=ctx.createMediaElementSource(el);source.connect(analyzer);source.connect(ctx.destination);connected.add(el);}
   el.currentTime=15;await el.play();await new Promise(r=>setTimeout(r,300));
   const data=new Float32Array(analyzer.fftSize);analyzer.getFloatTimeDomainData(data);let sum=0;for(const n of data)sum+=n*n;
   tracks.push({scene,file:new URL(el.src).pathname,playing:!el.paused,time:el.currentTime,duration:el.duration,volume:el.volume,rms:Math.sqrt(sum/data.length),error:el.error?.message??null});
  }
  m.setVolumes(.2,.35,.1);const volumeBefore=m.current.el.volume;m.setMuted(true);const mutedVolume=m.current.el.volume;await new Promise(r=>setTimeout(r,250));const master=m.masterGain.gain.value;m.setMuted(false);
  const fx=ctx.createAnalyser();fx.fftSize=1024;m.sfxGain.connect(fx);const output=ctx.createAnalyser();output.fftSize=2048;m.masterGain.connect(output);
  for(let i=0;i<100;i++){m.cooldowns.clear();for(const name of ['sword','shield','pike','axe','bow','crossbow','magic','fire','heal','base'])m.play(name);}
  await new Promise(r=>setTimeout(r,100));const data=new Float32Array(fx.fftSize);fx.getFloatTimeDomainData(data);let peak=0;for(const n of data)peak=Math.max(peak,Math.abs(n));
  const out=new Float32Array(output.fftSize);output.getFloatTimeDomainData(out);let outputPeak=0;for(const n of out)outputPeak=Math.max(outputPeak,Math.abs(n));
  return {audioContext:ctx.state,tracks,volumeBefore,mutedVolume,master,voices:m.activeSfx.length,sfxPeak:peak,outputPeak};
 });
 await info.attach('audio-runtime.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/audio-runtime.json',JSON.stringify(report,null,2));
 expect(report.audioContext).toBe('running');expect(report.tracks).toHaveLength(7);for(const t of report.tracks){expect(t.playing,t.scene).toBeTruthy();expect(t.time,t.scene).toBeGreaterThan(15);expect(t.error,t.scene).toBeNull();expect(t.rms,t.scene).toBeGreaterThan(.000001);}
 expect(report.mutedVolume).toBe(0);expect(report.master).toBeLessThan(.0001);expect(report.voices).toBeLessThanOrEqual(20);expect(report.sfxPeak).toBeGreaterThan(0);expect(report.outputPeak).toBeLessThan(.99);expect(failures).toEqual([]);console.log('AUDIO RUNTIME',JSON.stringify(report));
});
