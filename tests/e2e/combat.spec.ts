import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {BattleState,MatchConfig} from '../../src/core/types';
import {sourceFingerprint} from '../../scripts/fingerprint';
type TestAPI={state:()=>BattleState;launch:(config:MatchConfig)=>void;advance:(seconds:number)=>void};
test('a legal scripted army actually destroys the campaign fortress and records a natural victory',async({page},info)=>{
 test.setTimeout(60_000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-action="campaign"]').click();
 await page.evaluate(async()=>{const path='/src/data/missions.ts';const {MISSIONS,missionConfig}=await import(path);const api=(window as unknown as {__EMBER__:TestAPI}).__EMBER__;api.launch({...missionConfig(MISSIONS[0]),seed:407});});
 const advanceArmy=async(limit:number)=>page.evaluate(async maxRound=>{
  const path='/src/core/simulation.ts';const {selectUnit}=await import(path);const api=(window as unknown as {__EMBER__:TestAPI}).__EMBER__,s=api.state();
  while(s.winner===null&&s.round<maxRound){const id=s.teams[0].income<220?'levy':['shield','bow','pike'][s.round%3];if(!selectUnit(s,0,id))throw new Error('Illegal scripted recruitment');api.advance(s.countdown+.02);}
  return{winner:s.winner,seconds:Math.floor(s.time),rounds:s.round,kills:s.teams[0].kills,recruited:s.teams[0].recruited,base:s.teams.map(t=>t.baseHp)};
 },limit);
 await advanceArmy(8);await page.waitForTimeout(150);await page.screenshot({path:info.outputPath('10-natural-combat.png'),fullPage:true});
 const result=await advanceArmy(81);expect(result.winner).toBe(0);expect(result.base[1]).toBeLessThanOrEqual(0);expect(result.seconds).toBeGreaterThan(60);expect(result.kills).toBeGreaterThan(0);expect(result.recruited).toBeGreaterThan(0);
 await expect(page.locator('.result-modal')).toContainText('黎明属于你');await page.screenshot({path:info.outputPath('11-natural-victory.png'),fullPage:true});
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ember-dawn-save-v1')!));expect(save.completed).toContain('c1');expect(save.records.at(-1)).toMatchObject({result:'win',seconds:result.seconds,kills:result.kills,recruited:result.recruited});expect(errors).toEqual([]);
 await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/browser-natural-match.json',JSON.stringify({source:await sourceFingerprint(),note:'Production core, legal selections, fixed-step development fast-forward. No injected damage/resources, no altered HP. Scripted integration evidence, not real-time production play or human completion.',result,errors},null,2));console.log('NATURAL CAMPAIGN WIN',JSON.stringify(result));
});
