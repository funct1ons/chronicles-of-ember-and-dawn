import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

/**
 * Audio direction regression: the battle theme must be one continuous recording.
 *  1. `battle` and `climax` share the same file and the same playhead (no restart).
 *  2. The loop point is covered by two streaming decks, so the mix is never silent
 *     (the old director feather-volumed the file edges to 0 for ~1.7s every loop).
 *  3. The climax percussion layer is synthesized on the music bus: the music slider
 *     governs it, mute silences it, and dispose tears every node and deck down.
 */
test('battle theme stays continuous across climax, loops without a silent seam, and every layer follows music volume',async({page},info)=>{
 test.setTimeout(60000);
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto('/');
 await page.locator('[data-action="classic"]').click();
 await page.waitForFunction(()=>{const m=(window as any).__EMBER__?.audio;return m&&m.isUnlocked&&Array.from(m.elements.values()).every((el:any)=>el.readyState>=2&&el.duration>30);},{},{timeout:25000});

 const report=await page.evaluate(async()=>{
  const m=(window as any).__EMBER__.audio,ctx=m.ctx as AudioContext;
  const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>r(null)));
  // The audible music level is the louder of the two decks; during the loop overlap
  // one deck ramps down while the other ramps up, so the maximum must never vanish.
  const level=()=>Math.max(m.current?m.current.el.volume:0,m.twin?m.twin.el.volume:0);
  const src=(el:HTMLAudioElement)=>new URL(el.src).pathname;
  const trackIds=Array.from(m.elements.keys());

  // 1. battle -> climax -> battle: same file, same deck, playhead only moves forward.
  m.setScene('battle');await wait(600);
  const battleEl=m.current.el as HTMLAudioElement;
  const battleSrc=src(battleEl);
  const battleStart=battleEl.currentTime;
  await wait(700);
  const battleAdvanced=battleEl.currentTime;
  m.setScene('climax');await wait(400);
  const climaxEl=m.current.el as HTMLAudioElement;
  const climaxSrc=src(climaxEl);
  const climaxTime=climaxEl.currentTime;
  await wait(700);
  const climaxAdvanced=climaxEl.currentTime;
  m.setScene('battle');await wait(400);
  const backEl=m.current.el as HTMLAudioElement;
  const backSrc=src(backEl);
  const backTime=backEl.currentTime;
  await wait(500);
  const backAdvanced=backEl.currentTime;

  // 2. climax layer: present at climax, gone again at normal intensity.
  // Cue fixture: sparse accents follow measured transients, not an arbitrary BPM.
  m.current.el.currentTime=6;
  const hitsBefore=m.layerHits;
  m.setScene('climax');await wait(3400);
  const climaxLayer={level:m.layerLevel,gain:(m.layerGain as GainNode).gain.value,hits:m.layerHits-hitsBefore,sources:m.layerSources.length,music:level()};
  const calmHitsBefore=m.layerHits;
  m.setScene('battle');await wait(1400);
  const calmLayer={level:m.layerLevel,gain:(m.layerGain as GainNode).gain.value,hits:m.layerHits-calmHitsBefore,sources:m.layerSources.length};

  // 3. the layer is governed by the music slider, not by the effects bus.
  m.setScene('climax');m.setVolumes(.2,.8,.5);await wait(1600);
  const lowSliderLayer=m.layerLevel;
  m.setVolumes(0,.8,.5);await wait(1200);
  const zeroSliderLayer=m.layerLevel;
  const zeroSliderMusic=level();
  m.setVolumes(.8,.8,.5);await wait(300);

  // 4. loop point: force the splice and sample both decks while it happens.
  m.setScene('battle');await wait(600);
  const loopEl=m.current.el as HTMLAudioElement;
  const duration=loopEl.duration;
  const crossfadesBefore=m.loopCrossfades;
  loopEl.currentTime=Math.max(0,duration-1.4);
  const levels:number[]=[];
  const t0=performance.now();
  while(performance.now()-t0<3200){levels.push(level());await frame();}
  const loop={
   duration,
   minLevel:Math.min(...levels),
   maxLevel:Math.max(...levels),
   samples:levels.length,
   crossfades:m.loopCrossfades-crossfadesBefore,
   swapped:m.current.el!==loopEl,
   newDeckPaused:m.current.el.paused as boolean,
   newDeckTime:m.current.el.currentTime as number,
   oldDeckPaused:loopEl.paused,
  };

  // 5. mute covers music and the percussion layer, and restores afterwards.
  m.setScene('climax');m.current.el.currentTime=10;await wait(1800);
  // Real waveform proof, not just "the element is playing": attach the QA taps.
  const monitorPath='/src/audio/audioMonitor.ts';
  const {attachAudioMonitor}=await import(monitorPath);
  const monitor=attachAudioMonitor(m);
  const bus={attached:!!monitor,musicRms:0,musicPeak:0,layerRms:0,combinedPeak:0,samples:0,firstTime:0,lastTime:0};
  if(monitor){
   for(let i=0;i<20;i+=1){
    const s=monitor.sample();
    bus.samples+=1;
    bus.musicRms=Math.max(bus.musicRms,s.musicRms);
    bus.musicPeak=Math.max(bus.musicPeak,s.musicPeak);
    bus.layerRms=Math.max(bus.layerRms,s.layerRms);
    bus.combinedPeak=Math.max(bus.combinedPeak,s.combinedPeak);
    const deck=s.decks[0];
    if(deck){if(!bus.firstTime)bus.firstTime=deck.currentTime;bus.lastTime=deck.currentTime;}
    await wait(80);
   }
  }
  m.setMuted(true);await wait(350);
  const mutedSample=monitor?monitor.sample():null;
  const muted={music:level(),layer:m.layerLevel,master:(m.masterGain as GainNode).gain.value,busRms:mutedSample?mutedSample.musicRms:-1,busLayer:mutedSample?mutedSample.layerRms:-1};
  m.setMuted(false);await wait(900);
  const liveSample=monitor?monitor.sample():null;
  const unmuted={music:level(),layer:m.layerLevel,busRms:liveSample?liveSample.musicRms:-1};
  monitor?.detach();

  // 6. effects still work and stay inside the headroom budget.
  const fx=ctx.createAnalyser();fx.fftSize=1024;m.sfxGain.connect(fx);
  const output=ctx.createAnalyser();output.fftSize=2048;m.masterGain.connect(output);
  for(let i=0;i<40;i++){m.cooldowns.clear();for(const name of ['sword','bow','pike','fire','base'])m.play(name);}
  await wait(120);
  const fxData=new Float32Array(fx.fftSize);fx.getFloatTimeDomainData(fxData);let sfxPeak=0;for(const n of fxData)sfxPeak=Math.max(sfxPeak,Math.abs(n));
  const outData=new Float32Array(output.fftSize);output.getFloatTimeDomainData(outData);let outputPeak=0;for(const n of outData)outputPeak=Math.max(outputPeak,Math.abs(n));
  const voices=m.activeSfx.length;

  // 7. dispose releases decks, layer nodes and the context.
  const decks=[...m.elements.values(),...m.twins.values()] as HTMLAudioElement[];
  const deckCount=decks.length;
  m.dispose();await wait(400);
  const disposed={
   deckCount,
   elements:m.elements.size,
   twins:m.twins.size,
   positions:m.positions.size,
   layerSources:m.layerSources.length,
   layerGain:m.layerGain,
   ctx: m.ctx,
   ctxState:ctx.state,
   decks:decks.map(el=>({paused:el.paused,src:el.getAttribute('src'),volume:el.volume})),
  };

  return {
   audioContext:ctx.state,
   tracks:trackIds,
   continuity:{battleSrc,climaxSrc,backSrc,sameDeck:climaxEl===battleEl&&backEl===battleEl,battleStart,battleAdvanced,climaxTime,climaxAdvanced,backTime,backAdvanced},
   climaxLayer,calmLayer,lowSliderLayer,zeroSliderLayer,zeroSliderMusic,
   loop,muted,unmuted,bus,voices,sfxPeak,outputPeak,disposed,
  };
 });

 await info.attach('audio-runtime.json',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/audio-runtime.json',JSON.stringify(report,null,2));
 console.log('AUDIO RUNTIME',JSON.stringify(report));

 // 1. same recording, never restarted.
 expect(report.continuity.battleSrc).toBe(report.continuity.climaxSrc);
 expect(report.continuity.climaxSrc).toBe(report.continuity.backSrc);
 expect(report.continuity.sameDeck).toBeTruthy();
 expect(report.continuity.battleAdvanced).toBeGreaterThan(report.continuity.battleStart+.4);
 expect(report.continuity.climaxTime).toBeGreaterThanOrEqual(report.continuity.battleAdvanced-.05);
 expect(report.continuity.climaxAdvanced).toBeGreaterThan(report.continuity.climaxTime+.4);
 expect(report.continuity.backTime).toBeGreaterThanOrEqual(report.continuity.climaxAdvanced-.05);
 expect(report.continuity.backAdvanced).toBeGreaterThan(report.continuity.backTime+.3);

 // 2. the climax is a layer on the same track, not another song.
 expect(report.climaxLayer.level).toBeGreaterThan(.01);
 expect(report.climaxLayer.hits).toBeGreaterThan(0);
 expect(report.calmLayer.level).toBeLessThan(.01);
 expect(report.calmLayer.hits).toBe(0);

 // 3. the layer follows the music slider (and dies with it).
 expect(report.lowSliderLayer).toBeGreaterThan(0);
 expect(report.lowSliderLayer).toBeLessThan(report.climaxLayer.level*.6);
 expect(report.zeroSliderLayer).toBeLessThan(report.lowSliderLayer*.25);
 expect(report.zeroSliderMusic).toBe(0);

 // 4. the loop splice is covered: no silent frame, and the deck hands over.
 expect(report.loop.crossfades).toBeGreaterThanOrEqual(1);
 expect(report.loop.swapped).toBeTruthy();
 expect(report.loop.minLevel).toBeGreaterThan(.02);
 expect(report.loop.newDeckPaused).toBeFalsy();
 expect(report.loop.newDeckTime).toBeGreaterThan(0);

 // 5. mute covers music and the layer; unmute restores both.
 expect(report.muted.music).toBe(0);
 expect(report.muted.layer).toBeLessThan(.002);
 expect(report.muted.master).toBeLessThan(.001);
 expect(report.unmuted.music).toBeGreaterThan(.05);
 expect(report.unmuted.layer).toBeGreaterThan(.005);

 // 5b. the measured music bus really carries audio, and the mixer keeps headroom.
 expect(report.bus.attached).toBeTruthy();
 expect(report.bus.samples).toBe(20);
 expect(report.bus.musicRms).toBeGreaterThan(.002);
 expect(report.bus.musicPeak).toBeGreaterThan(.01);
 expect(report.bus.layerRms).toBeGreaterThan(.0002);
 expect(report.bus.combinedPeak).toBeLessThan(.95);
 expect(report.bus.lastTime).toBeGreaterThan(report.bus.firstTime+.8);
 expect(report.muted.busRms).toBeLessThan(.001);
 expect(report.muted.busLayer).toBeLessThan(.0005);
 expect(report.unmuted.busRms).toBeGreaterThan(.002);

 // 6. effects unaffected, output inside headroom.
 expect(report.voices).toBeLessThanOrEqual(20);
 expect(report.sfxPeak).toBeGreaterThan(0);
 expect(report.outputPeak).toBeLessThan(.99);

 // 7. dispose tore everything down.
 expect(report.disposed.elements).toBe(0);
 expect(report.disposed.twins).toBe(0);
 expect(report.disposed.positions).toBe(0);
 expect(report.disposed.layerSources).toBe(0);
 expect(report.disposed.layerGain).toBeNull();
 expect(report.disposed.ctx).toBeNull();
 expect(report.disposed.ctxState).toBe('closed');
 expect(report.disposed.deckCount).toBeGreaterThanOrEqual(5);
 for(const deck of report.disposed.decks){expect(deck.paused).toBeTruthy();expect(deck.src).toBeNull();expect(deck.volume).toBe(0);}
 expect(failures).toEqual([]);
});
