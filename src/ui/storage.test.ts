import {describe,it,expect,beforeEach,vi} from 'vitest';
import {defaults,loadSave,saveData,SAVE_KEY} from './storage';
let values:Record<string,string>={};
beforeEach(()=>{values={};vi.stubGlobal('localStorage',{getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value;}});});
describe('versioned local progress',()=>{
 it('loads defaults without a save',()=>expect(loadSave()).toEqual(defaults()));
 it('survives malformed JSON',()=>{values[SAVE_KEY]='{broken';expect(loadSave().completed).toEqual([]);});
 it('rejects incompatible versions',()=>{values[SAVE_KEY]='{"version":2,"completed":["c10"]}';expect(loadSave().completed).toEqual([]);});
 it('sanitizes progress and clamps volume',()=>{values[SAVE_KEY]=JSON.stringify({version:1,settings:{music:7,effects:-2,speed:30},completed:['c1','c10','<img>',12],records:[]});const s=loadSave();expect(s.completed).toEqual(['c1','c10']);expect(s.settings.music).toBe(1);expect(s.settings.effects).toBe(0);expect(s.settings.speed).toBe(1);});
 it('rejects injected record fields in imported progress',()=>{values[SAVE_KEY]=JSON.stringify({version:1,completed:['c1','c1'],settings:{},records:[{date:'2026-10-22',mode:'classic',result:'win',seconds:10,kills:1,rounds:'<img onerror=alert(1)>',recruited:10}]});expect(loadSave().records).toEqual([]);expect(loadSave().completed).toEqual(['c1']);});
 it('roundtrips settings and progress',()=>{const s=defaults();s.completed=['c1','c2'];s.settings.muted=true;expect(saveData(s)).toBe(true);expect(loadSave()).toEqual(s);});
 it('raises the default music level without rewriting a saved choice',()=>{
  expect(defaults().settings.music).toBe(.8);
  values[SAVE_KEY]=JSON.stringify({version:1,settings:{music:.45,effects:.5,ambience:.25},completed:[],records:[]});
  expect(loadSave().settings.music).toBe(.45);
  values[SAVE_KEY]=JSON.stringify({version:1,settings:{effects:.5},completed:[],records:[]});
  expect(loadSave().settings.music).toBe(.8);
 });
 it('returns false when browser storage is blocked',()=>{vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('quota');},getItem:()=>{throw new Error('blocked');}});expect(saveData(defaults())).toBe(false);expect(loadSave().version).toBe(1);});
});
