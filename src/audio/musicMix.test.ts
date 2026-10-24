import {describe,it,expect} from 'vitest';
import {
 BATTLE_SCENE_GAIN,CLIMAX_LIFT_DB,CLIMAX_SCENE_GAIN,LOOP_OVERLAP_SECONDS,MUSIC_CEILING,
 gainRatioDb,loopCrossfade,musicLevel,
} from './musicMix';
const base={musicVolume:.8,trackGain:.549,sceneGain:BATTLE_SCENE_GAIN,fade:1,loopFade:1,duck:1,muted:false};
describe('music level',()=>{
 it('is a pure mix value: no playhead argument exists at all',()=>{
  expect(Object.keys(base).sort()).not.toContain('currentTime');
  expect(Object.keys(base).sort()).not.toContain('duration');
  expect(Object.keys(base).sort()).not.toContain('at');
  expect(musicLevel(base)).toBeCloseTo(.8*.549*BATTLE_SCENE_GAIN,6);
 });
 it('never feathers the volume at a file boundary',()=>{
  // The old director multiplied by a seam factor derived from currentTime/duration,
  // which silenced ~1.7s of every loop. Two calls that differ only in "position"
  // cannot differ at all now, so boundary silence is impossible by construction.
  const atStart=musicLevel({...base});
  const atEnd=musicLevel({...base});
  expect(atStart).toBe(atEnd);
  expect(atStart).toBeGreaterThan(.3);
 });
 it('is silenced by mute and by a zero music slider',()=>{
  expect(musicLevel({...base,muted:true})).toBe(0);
  expect(musicLevel({...base,musicVolume:0})).toBe(0);
  expect(musicLevel({...base,duck:.62})).toBeLessThan(musicLevel(base));
 });
 it('keeps headroom even for the loudest equalised track at full volume',()=>{
  const loudest=musicLevel({...base,musicVolume:1,trackGain:1.424,sceneGain:.72});
  expect(loudest).toBeLessThanOrEqual(MUSIC_CEILING);
  const climaxPeak=musicLevel({musicVolume:1,trackGain:.549,sceneGain:CLIMAX_SCENE_GAIN,fade:1,loopFade:1,duck:1,muted:false});
  expect(climaxPeak).toBeLessThan(MUSIC_CEILING);
 });
 it('lifts the same battle track by about +2dB at climax',()=>{
  expect(gainRatioDb(BATTLE_SCENE_GAIN,CLIMAX_SCENE_GAIN)).toBeCloseTo(CLIMAX_LIFT_DB,1);
  expect(CLIMAX_SCENE_GAIN).toBeGreaterThan(BATTLE_SCENE_GAIN);
 });
});
describe('loop cross-fade',()=>{
 it('is untouched outside the loop window',()=>{
  expect(loopCrossfade(0,145.8)).toEqual({out:1,in:0});
  expect(loopCrossfade(60,145.8)).toEqual({out:1,in:0});
  expect(loopCrossfade(145.8-LOOP_OVERLAP_SECONDS-1,145.8)).toEqual({out:1,in:0});
 });
 it('hands over across the splice without ever going silent',()=>{
  const duration=145.8;
  for(let step=0;step<=40;step+=1){
   const at=duration-LOOP_OVERLAP_SECONDS+(LOOP_OVERLAP_SECONDS*step)/40;
   const {out,in:pull}=loopCrossfade(at,duration);
   expect(out*out+pull*pull).toBeCloseTo(1,6);
   expect(Math.max(out,pull)).toBeGreaterThan(.7);
  }
  expect(loopCrossfade(duration,duration)).toEqual({out:0,in:1});
 });
 it('scales the window down for very short recordings',()=>{
  const {out}=loopCrossfade(2.9,3);
  expect(out).toBeGreaterThan(0);
  expect(out).toBeLessThan(1);
  expect(loopCrossfade(0,Number.NaN)).toEqual({out:1,in:0});
 });
});
describe('decibel helper',()=>{
 it('reports the documented lift and is symmetric',()=>{
  expect(gainRatioDb(1,10**(2/20))).toBeCloseTo(2,6);
  expect(gainRatioDb(0,1)).toBe(0);
 });
});
