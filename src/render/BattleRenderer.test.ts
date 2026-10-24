import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle } from '../core/simulation';
import type { Fighter } from '../core/types';
import { defaultConfig } from '../data/missions';
import { BattleRenderer } from './BattleRenderer';
import { castle } from './scenery';

vi.mock('./sprites',()=>({sprite:vi.fn(()=>({width:48,height:48})),isRanged:()=>false}));
vi.mock('./scenery',()=>({
 scenery:()=>({width:640,height:270}),castle:vi.fn(),
 THEMES:{plains:{sky:['#000'],sun:'#fff'}},
}));

function setup(width=1280,height=540){
 let transform=[1,0,0,1,0,0];const stack:number[][]=[];
 const draws:{args:unknown[];transform:number[]}[]=[];
 const methods:Record<string,unknown>={
  save:()=>stack.push([...transform]),restore:()=>{transform=stack.pop()!;},
  setTransform:(...args:number[])=>{transform=args;},
  scale:(x:number,y:number)=>{transform[0]*=x;transform[1]*=x;transform[2]*=y;transform[3]*=y;},
  translate:(x:number,y:number)=>{transform[4]+=x*transform[0]+y*transform[2];transform[5]+=x*transform[1]+y*transform[3];},
  drawImage:(...args:unknown[])=>draws.push({args,transform:[...transform]}),
  createLinearGradient:()=>({addColorStop:()=>{}}),
 };
 const context=new Proxy(methods,{get:(target,key)=>key in target?target[key as string]:()=>{}});
 const bounds={width,height};let backingWidth=0,backingHeight=0,writes=0;
 const canvas={getBoundingClientRect:()=>bounds,getContext:()=>context,
  get width(){return backingWidth;},set width(value:number){backingWidth=value;writes++;context.imageSmoothingEnabled=true;},
  get height(){return backingHeight;},set height(value:number){backingHeight=value;writes++;context.imageSmoothingEnabled=true;},
 } as unknown as HTMLCanvasElement;
 const renderer=new BattleRenderer(canvas);
 const state=createBattle({...defaultConfig(),seed:407});
 const unit:Fighter={id:1,side:0,type:'levy',x:100,y:350,hp:70,maxHp:70,cooldown:0,
  action:'walk',actionTime:0,target:null,born:0};state.units.push(unit);
 const soldiers=()=>draws.filter(draw=>(draw.args[0] as {width:number}).width===48);
 return {renderer,state,unit,canvas,context,bounds,draws,soldiers,writes:()=>writes};
}
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});

describe('BattleRenderer integration contract',()=>{
 it('interpolates in device pixels, preserves pause position, resets, and leaves state untouched',()=>{
  vi.stubGlobal('devicePixelRatio',1);
  const {renderer,state,unit,soldiers}=setup();
  renderer.captureBeforeStep(state);unit.x=104;state.time+=1/30;
  const unchanged=JSON.stringify(state);
  renderer.render(state,'plains',1,.25);
  expect(soldiers().at(-1)!.transform).toEqual([1,0,0,1,101,350]);
  renderer.render(state,'plains',1,null);
  expect(soldiers().at(-1)!.transform[4]).toBe(101);
  renderer.render(state,'plains',1,0);
  expect(soldiers().at(-1)!.transform[4]).toBe(101);
  renderer.clear();renderer.render(state,'plains',1,0);
  expect(soldiers().at(-1)!.transform[4]).toBe(104);
  expect(JSON.stringify(state)).toBe(unchanged);
 });
 it('keeps the previous current-state API when alpha is omitted',()=>{
  const {renderer,state,unit,soldiers}=setup();
  renderer.captureBeforeStep(state);unit.x=104;state.time+=1/30;
  renderer.render(state,'plains',1);
  expect(soldiers().at(-1)!.transform[4]).toBe(104);
 });
 it('resizes only on display/DPR changes and restores nearest-neighbour drawing after resize',()=>{
  vi.stubGlobal('devicePixelRatio',1.5);
  const {renderer,state,canvas,context,bounds,soldiers,writes}=setup(1000,400);
  renderer.render(state,'plains',1);
  expect([canvas.width,canvas.height]).toEqual([1500,600]);
  expect(context.imageSmoothingEnabled).toBe(false);
  const count=writes();renderer.render(state,'plains',1);
  expect(writes()).toBe(count);
  bounds.width=1100;renderer.render(state,'plains',1);
  expect(canvas.width).toBe(1650);expect(writes()).toBe(count+1);
  vi.stubGlobal('devicePixelRatio',3);renderer.render(state,'plains',1);
  expect([canvas.width,canvas.height]).toEqual([2200,800]);
  for(const draw of soldiers()){
   const [source,left,top,width,height]=draw.args as [{width:number},number,number,number,number];
   expect(width%source.width).toBe(0);expect(height).toBe(width);
   expect(Number.isInteger(left)).toBe(true);expect(Number.isInteger(top)).toBe(true);
   expect(draw.transform[0]).toBe(1);expect(draw.transform[3]).toBe(1);
   expect(Number.isInteger(draw.transform[4])).toBe(true);expect(Number.isInteger(draw.transform[5])).toBe(true);
  }
 });
 it('keeps impact displacement in device pixels even at high DPR, and disables it with reduced motion',()=>{
  vi.stubGlobal('devicePixelRatio',2);
  const {renderer,state,soldiers}=setup();
  renderer.render(state,'plains',0);
  renderer.consume([{kind:'base',x:1200,y:385,side:0}]);
  renderer.render(state,'plains',.05);
  expect(Math.abs(soldiers().at(-1)!.transform[4]-200)).toBeLessThanOrEqual(2);
  renderer.reducedMotion=true;renderer.render(state,'plains',.1);
  expect(soldiers().at(-1)!.transform[4]).toBe(200);
  renderer.consume([{kind:'base',x:1200,y:385,side:0}]);
  renderer.reducedMotion=false;renderer.render(state,'plains',.15);
  expect(soldiers().at(-1)!.transform[4]).toBe(200);
 });
 it('places the complete right flag within the scenery instead of beyond x=640',()=>{
  const {renderer,state}=setup();renderer.render(state,'plains',0);
  expect(vi.mocked(castle).mock.calls.map(call=>[call[1],call[2]])).toEqual([[37,0],[596,1]]);
  expect(596+43).toBeLessThan(640);
 });
});
