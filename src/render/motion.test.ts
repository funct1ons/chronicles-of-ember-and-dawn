import { describe, expect, it } from 'vitest';
import { createBattle } from '../core/simulation';
import type { Fighter } from '../core/types';
import { defaultConfig } from '../data/missions';
import { ImpactShake, MotionHistory } from './motion';

function fixture() {
 const state=createBattle({...defaultConfig(),seed:407});
 const unit:Fighter={id:1,side:0,type:'levy',x:100,y:350,hp:70,maxHp:70,cooldown:0,
  action:'walk',actionTime:0,target:null,born:0};
 state.units.push(unit);
 return {state,unit,history:new MotionHistory()};
}

describe('render-only fixed-step interpolation',()=>{
 it('copies positions before a mutable step and interpolates without touching simulation',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);
  unit.x=102;unit.y=354;state.time+=1/30;
  const unchanged=JSON.stringify(state);
  history.beginFrame(state,0);expect(history.position(unit)).toEqual({x:100,y:350});
  history.beginFrame(state,.5);expect(history.position(unit)).toEqual({x:101,y:352});
  history.beginFrame(state,1);expect(history.position(unit)).toEqual({x:102,y:354});
  expect(JSON.stringify(state)).toBe(unchanged);
 });
 it('retains only the LAST snapshot when multiple steps catch up in one render',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);unit.x=102;state.time+=1/30;
  history.captureBeforeStep(state);unit.x=104;state.time+=1/30;
  history.beginFrame(state,.25);expect(history.position(unit).x).toBe(102.5);
 });
 it('freezes a partial frame on pause and never rewinds if an accumulator resets',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);unit.x=104;state.time+=1/30;
  history.beginFrame(state,.75);expect(history.position(unit).x).toBe(103);
  for(let frame=0;frame<10;frame++){
   history.beginFrame(state,null);expect(history.position(unit).x).toBe(103);
  }
  history.beginFrame(state,0);expect(history.position(unit).x).toBe(103);
  history.captureBeforeStep(state);unit.x=108;state.time+=1/30;
  history.beginFrame(state,.25);expect(history.position(unit).x).toBe(105);
 });
 it('does not invent a starting position for recruits or ghosts for removed units',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);
  const recruit={...unit,id:2,x:150};state.units=[recruit];state.time+=1/30;
  history.beginFrame(state,0);expect(history.position(recruit).x).toBe(150);
  history.captureBeforeStep(state);expect(state.units).toEqual([recruit]);
 });
 it('discards stale history on clear, battle identity changes and time rewind',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);unit.x=104;history.clear();
  history.beginFrame(state,0);expect(history.position(unit).x).toBe(104);
  history.captureBeforeStep(state);unit.x=108;
  const other=structuredClone(state);history.beginFrame(other,0);
  expect(history.position(other.units[0]!).x).toBe(108);
  history.captureBeforeStep(state);unit.x=112;state.time=-1;
  history.beginFrame(state,0);expect(history.position(unit).x).toBe(112);
 });
 it('clamps fractions, including invalid inputs, without extrapolating',()=>{
  const {state,unit,history}=fixture();
  history.captureBeforeStep(state);unit.x=104;
  history.beginFrame(state,-5);expect(history.position(unit).x).toBe(100);
  history.beginFrame(state,5);expect(history.position(unit).x).toBe(104);
  history.captureBeforeStep(state);unit.x=108;
  history.beginFrame(state,NaN);expect(history.position(unit).x).toBe(108);
 });
});

describe('restrained device-pixel impact shake',()=>{
 it('uses a 4Hz sinusoid with an exponential envelope and a <=2px cap',()=>{
  const shake=new ImpactShake();shake.hit();
  for(let frame=1;frame<=120;frame++){
   const t=frame/120;
   const actual=shake.advance(1/120,false);
   expect(Math.abs(actual)).toBeLessThanOrEqual(2);
   expect(actual||0).toBe(Math.round(2*Math.exp(-6*t)*Math.sin(2*Math.PI*4*t))||0);
  }
  expect(shake.advance(1,false)).toBe(0);
 });
 it('does not move when the visual clock is frozen and clears for reduced motion',()=>{
  const shake=new ImpactShake();shake.hit();const frozen=shake.advance(.05,false);
  expect(shake.advance(0,false)).toBe(frozen);
  expect(shake.advance(0,true)).toBe(0);
  expect(shake.advance(0,false)).toBe(0);
  shake.hit();shake.clear();expect(shake.advance(.05,false)).toBe(0);
 });
 it('has the same decay regardless of display refresh rate',()=>{
  const slow=new ImpactShake(),fast=new ImpactShake();slow.hit();fast.hit();
  let a=0,b=0;
  for(let i=0;i<3;i++)a=slow.advance(1/30,false);
  for(let i=0;i<12;i++)b=fast.advance(1/120,false);
  expect(a).toBe(b);
 });
});
