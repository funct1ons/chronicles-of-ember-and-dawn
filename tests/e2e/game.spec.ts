import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {sourceFingerprint} from '../../scripts/fingerprint';
const act=(page:Page,a:string)=>page.locator(`[data-action="${a}"]`).first();
async function boot(page:Page){await page.goto('/');await expect(page.getByRole('heading',{name:'烬辉战纪',exact:true,level:1})).toBeVisible();}
async function launch(page:Page,mode='classic'){await boot(page);await act(page,mode).click();await act(page,'launch').click();await expect(page.locator('.battle-canvas')).toBeVisible();}
test('main menu, full codex and no runtime errors',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await page.screenshot({path:info.outputPath('01-main-menu.png'),fullPage:true});
 await act(page,'fullscreen').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await act(page,'fullscreen').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 await act(page,'codex').click();await expect(page.locator('.unit-entry')).toHaveCount(16);await expect(page.locator('.unit-entry canvas').first()).toBeVisible();await page.screenshot({path:info.outputPath('07-unit-codex.png'),fullPage:true});await act(page,'return').click();expect(errors).toEqual([]);
});
test('custom settings, faction, wave selection, pause, speed and sound persistence',async({page},info)=>{
 await boot(page);await act(page,'custom').click();await page.locator('[data-faction="1"]').click();await page.selectOption('#opt-biome','snow');await page.selectOption('#opt-difficulty','4');await page.selectOption('#opt-supply','120');await page.selectOption('#opt-growth','1.5');await page.selectOption('#opt-speed','2');await act(page,'codex').click();await act(page,'return').click();await expect(page.locator('#opt-supply')).toHaveValue('120');await expect(page.locator('#opt-growth')).toHaveValue('1.5');await expect(page.locator('#opt-speed')).toHaveValue('2');await expect(page.locator('[data-faction="1"]')).toHaveClass(/selected/);await act(page,'launch').click();
 await expect(page.locator('.crimson .team-label')).toContainText('你的军团');await page.keyboard.press('6');await expect(page.locator('[data-unit="bow"][data-side="1"]')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>{(window as any).__EMBER__.advance(7);});await expect(page.locator('#round')).toContainText('2');
 await act(page,'pause').click();const before=await page.locator('#elapsed').textContent();await page.waitForTimeout(350);expect(await page.locator('#elapsed').textContent()).toBe(before);await act(page,'resume').click();
 await page.screenshot({path:info.outputPath('02-snow-battle.png'),fullPage:true});await act(page,'settings').click();await page.locator('[data-setting="music"]').fill('0.21');await page.locator('[data-setting="muted"]').check();await act(page,'close-modal').click();await page.reload();await act(page,'settings').click();await expect(page.locator('[data-setting="music"]')).toHaveValue('0.21');await expect(page.locator('[data-setting="muted"]')).toBeChecked();
});
test('campaign locking, briefing, victory, progress and next mission',async({page},info)=>{
 await boot(page);await act(page,'campaign').click();await expect(page.locator('[data-mission]')).toHaveCount(10);await expect(page.locator('[data-mission="c2"]')).toBeDisabled();await page.locator('[data-mission="c1"]').click();await act(page,'launch-mission').click();
 await page.evaluate(()=>{const api=(window as any).__EMBER__;api.state().teams[1].baseHp=0;api.advance(.1);});await expect(page.locator('.result-modal')).toContainText('黎明属于你');await page.screenshot({path:info.outputPath('03-victory.png'),fullPage:true});await act(page,'next-mission').click();await expect(page.locator('.modal')).toContainText('灰羽之路');await act(page,'close-modal').click();await expect(page.locator('.result-modal')).toBeVisible();await act(page,'leave').click();await act(page,'campaign').click();await expect(page.locator('[data-mission="c2"]')).toBeEnabled();await page.screenshot({path:info.outputPath('04-campaign.png'),fullPage:true});
});
test('local players use separate keys and can form different armies',async({page})=>{
 await launch(page,'local');await page.keyboard.press('4');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('[data-unit="pike"][data-side="0"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-unit="runner"][data-side="1"]')).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>{(window as any).__EMBER__.advance(7);});const state=await page.evaluate(()=>{const s=(window as any).__EMBER__.state();return s.units.map((u:any)=>[u.side,u.type]);});expect(state.some((u:any)=>u[0]===0&&u[1]==='pike')).toBeTruthy();expect(state.some((u:any)=>u[0]===1&&u[1]==='runner')).toBeTruthy();await page.evaluate(()=>{const api=(window as any).__EMBER__;api.state().teams[0].baseHp=0;api.advance(.1);});await expect(page.locator('.result-modal')).toContainText('赤烬军团胜利');await expect(page.locator('.result-modal .eyebrow')).toContainText('VICTORY');
});
test('tutorial can be skipped, challenges launch, narrow desktop layout fits',async({page},info)=>{
 await boot(page);await act(page,'tutorial').click();await act(page,'tutorial-next').click();await expect(page.locator('.modal')).toContainText('以征募铸造经济');await act(page,'tutorial-skip').click();await act(page,'challenges').click();await expect(page.locator('.challenge-card')).toHaveCount(3);await page.locator('[data-challenge="h2"]').click();await act(page,'launch-mission').click();await page.setViewportSize({width:1024,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('05-1024-layout.png'),fullPage:true});
});
test('150-unit rendering and simulation benchmark',async({page},info)=>{
 const source=await sourceFingerprint();await launch(page);
 const result=await page.evaluate(async()=>{
  const api=(window as any).__EMBER__,s=api.state();s.config.supply=160;s.config.ai=false;s.teams.forEach((t:any)=>{t.gold=6000;t.income=600;});api.advance(7);const template=s.units[0];s.units=[];
  const ids=['levy','shield','pike','bow','crossbow','knight','mage','firemage','axe','rider','guardian','paladin','healer'];
  for(let i=0;i<150;i++){const side=i%2;const type=ids[i%ids.length];s.units.push({...template,id:1000+i,side,type,x:side===0?180+(i%37)*10:1100-(i%37)*10,y:320+Math.floor(i/19)*17,hp:10000,maxHp:10000,action:'walk',cooldown:1,target:null});}s.teams.forEach((t:any)=>t.supplyUsed=75);
  const samples=[];for(let i=0;i<120;i++){const start=performance.now();api.renderer.render(s,'ruins',i/60+100);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
  const start=performance.now();api.advance(3);const simulation3sMs=performance.now()-start;
  // Sustain a synthetic 150-body fixture through real RAF + production fixed-step updates.
  // High HP is solely a load-test fixture, not a balance scenario.
  for(const u of s.units){u.hp=10000;u.maxHp=10000;u.action='walk';}
  let frameCount=0;const intervals:number[]=[];let last=0,first=0;
  await new Promise<void>(resolve=>{const tick=(now:number)=>{if(!first){first=now;last=now;}else{intervals.push(now-last);last=now;frameCount++;}if(now-first<3000)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
  intervals.sort((a,b)=>a-b);
  // Separate legal 75+75 levy snapshot: unlike the visual high-HP fixture, this
  // respects normal HP and 80 supply per side, and measures the actual AI budget.
  const aiPath='/src/core/ai.ts',simPath='/src/core/simulation.ts',dataPath='/src/data/missions.ts',mathPath='/src/core/math.ts';
  const {chooseAI}=await import(aiPath),{createBattle}=await import(simPath),{defaultConfig}=await import(dataPath),{laneCenterY}=await import(mathPath);
  const pressure=createBattle({...defaultConfig(),difficulty:4,seed:919});pressure.time=160;pressure.round=13;
  pressure.teams.forEach((t:any)=>{t.gold=600;t.income=600;t.supplyUsed=75;});
  for(let side=0;side<2;side++)for(let i=0;i<75;i++)pressure.units.push({...template,id:3000+side*100+i,side,type:'levy',x:side===0?100+Math.floor(i/8)*44:1180-Math.floor(i/8)*44,y:laneCenterY(i%8),hp:70,maxHp:70,action:'walk',cooldown:.5,target:null,born:160-(i%8)*12});
  chooseAI(pressure,1);const aiSamples=[];for(let i=0;i<10;i++){const at=performance.now();chooseAI(pressure,1);aiSamples.push(performance.now()-at);}aiSamples.sort((a,b)=>a-b);
  const aiByDifficulty=[];for(let level=0;level<4;level++){pressure.config.difficulty=level;chooseAI(pressure,1);const times=[];for(let i=0;i<5;i++){const at=performance.now();chooseAI(pressure,1);times.push(performance.now()-at);}times.sort((a,b)=>a-b);aiByDifficulty.push({level,medianMs:times[2],maxMs:times[4]});}aiByDifficulty.push({level:4,medianMs:aiSamples[5],maxMs:aiSamples[9]});
  const advantage=createBattle({...defaultConfig(),difficulty:4,seed:921});advantage.time=160;advantage.round=13;advantage.units=pressure.units.filter((u:any)=>u.side===0?u.id<3004:u.id<3124).map((u:any)=>({...u}));advantage.teams.forEach((t:any,side:number)=>{t.gold=600;t.income=600;t.supplyUsed=side===0?4:24;});chooseAI(advantage,1);let advantageForecastMaxMs=0;for(let i=0;i<5;i++){const at=performance.now();chooseAI(advantage,1);advantageForecastMaxMs=Math.max(advantageForecastMaxMs,performance.now()-at);}
  return {units:150,frames:120,renderMedianMs:samples[60],renderP95Ms:samples[114],simulation3sMs,steadyFrames:frameCount,steadyFps:frameCount*1000/(last-first),frameP95Ms:intervals[Math.floor(intervals.length*.95)],remainingUnits:s.units.filter((u:any)=>u.hp>0).length,ai150MedianMs:aiSamples[5],ai150MaxMs:aiSamples[9],aiByDifficulty,advantageForecastMaxMs,userAgent:navigator.userAgent};
 });
 await info.attach('benchmark.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});await mkdir('docs/metrics',{recursive:true});await writeFile('docs/metrics/browser-performance.json',JSON.stringify({...result,generated:new Date().toISOString(),source},null,2));await page.screenshot({path:info.outputPath('06-150-unit-stress.png'),fullPage:true});console.log('150-UNIT BENCHMARK',JSON.stringify(result));expect(result.renderMedianMs).toBeLessThan(50);expect(result.simulation3sMs).toBeLessThan(2500);expect(result.steadyFps).toBeGreaterThan(25);expect(result.ai150MaxMs).toBeLessThan(100);for(const row of result.aiByDifficulty)expect(row.maxMs,`AI difficulty ${row.level}`).toBeLessThan(100);expect(result.advantageForecastMaxMs).toBeLessThan(100);
});
