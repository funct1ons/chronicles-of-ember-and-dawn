import {describe,it,expect} from 'vitest';
import {UNITS,ALL_UNIT_IDS,UNIT_BY_ID} from './units';
import {MISSIONS,CHALLENGES,defaultConfig,missionConfig} from './missions';
describe('release content',()=>{
 it('has 16 unique, complete tactical profiles',()=>{expect(UNITS).toHaveLength(16);expect(new Set(ALL_UNIT_IDS).size).toBe(16);expect(new Set(UNITS.map(u=>u.role)).size).toBe(16);for(const u of UNITS){expect(u.cost).toBeGreaterThan(0);expect(u.income).toBeGreaterThan(0);expect(u.hp).toBeGreaterThan(0);expect(u.supply).toBeGreaterThan(0);expect(u.ability.length).toBeGreaterThan(0);expect(u.cooldown).toBeGreaterThan(0);}});
 it('provides 10 progressing missions across four maps',()=>{expect(MISSIONS).toHaveLength(10);expect(new Set(MISSIONS.map(m=>m.biome)).size).toBe(4);for(let i=1;i<MISSIONS.length;i++)expect(MISSIONS[i].difficulty).toBeGreaterThanOrEqual(MISSIONS[i-1].difficulty);});
 it('all mission unit references resolve and initial choices fit supply',()=>{for(const m of [...MISSIONS,...CHALLENGES]){for(const id of [...m.allowedUnits,...(m.enemyAllowedUnits??[])])expect(ALL_UNIT_IDS).toContain(id);expect(m.allowedUnits.length).toBeGreaterThan(0);expect(missionConfig(m).supply).toBeGreaterThanOrEqual(7);}});
 it('does not silently resource-cheat at high difficulty',()=>{const c=defaultConfig();expect(c.enemyGoldBonus).toBeUndefined();expect(c.enemyIncomeBonus).toBeUndefined();expect(c.ai).toBe(true);});
 it('unshielded challenge exposes an armored axe counter without resource gifts',()=>{const m=CHALLENGES[0],c=missionConfig(m,true);expect(m.allowedUnits).toContain('axe');expect(m.enemyAllowedUnits).toEqual(['levy','runner','bow','crossbow','assassin']);for(const id of ['shield','guardian','knight'])expect(m.allowedUnits).not.toContain(id);expect(c.startingGold).toBe(defaultConfig().startingGold);expect(c.startingIncome).toBe(defaultConfig().startingIncome);expect(c.enemyGoldBonus??0).toBe(0);expect(c.enemyIncomeBonus??0).toBe(0);expect(c.supply).toBe(65);});
 it('finite economy challenge does not grow income',()=>{expect(missionConfig(CHALLENGES[1],true).growth).toBe(0);});
 it('levy economy efficiency exceeds elite and counters are not universally dominated',()=>{expect(UNITS[0].income/UNITS[0].cost).toBeGreaterThan(UNITS[15].income/UNITS[15].cost);expect(UNITS.find(u=>u.id==='pike')!.cost).toBeLessThan(UNITS.find(u=>u.id==='knight')!.cost);expect(UNITS.find(u=>u.id==='crossbow')!.heavyDamage).toBeGreaterThan(UNITS.find(u=>u.id==='bow')!.heavyDamage);});
 it('gives every unit a 60–110 character original field story',()=>{
  const cjk=(text:string)=>[...text].filter(char=>/[\u4e00-\u9fff]/.test(char)).length;
  for(const u of UNITS){
   expect(u.lore.length).toBeGreaterThan(0);
   expect(cjk(u.lore)).toBeGreaterThanOrEqual(60);
   expect(cjk(u.lore)).toBeLessThanOrEqual(110);
   expect(u.lore.length).toBeLessThanOrEqual(110);
   expect(u.lore).not.toMatch(/[A-Za-z]/);
   expect(u.lore).not.toMatch(/TODO|待补|placeholder|lorem/i);
  }
 });
 it('keeps all 16 stories and doctrines unique',()=>{
  expect(new Set(UNITS.map(u=>u.lore)).size).toBe(16);
  expect(new Set(UNITS.map(u=>u.doctrine)).size).toBe(16);
  for(const u of UNITS){
   expect(u.doctrine.length).toBeGreaterThan(8);
   expect(u.doctrine.length).toBeLessThanOrEqual(26);
   expect(u.doctrine).not.toMatch(/[A-Za-z]/);
  }
 });
 it('anchors the stories on the shattered starfire and both banners',()=>{
  const joined=UNITS.map(u=>u.lore).join('');
  for(const anchor of ['星火','苍曜','赤烬'])expect(joined).toContain(anchor);
  expect(joined).not.toMatch(/惧穿甲|穿甲武器/);
 });
 it('never lets prose promise a skill or a recruiter the game does not have',()=>{
  for(const u of UNITS){
   // Both banners field every role: no story may read as single-side recruitment.
   expect(u.lore).toMatch(/苍曜|赤烬|两军|各为其主|各留数人/);
   // Cosmetics only: prose must not imply stealth, summons, flight, teleports or
   // collision bypass, because the simulation implements none of them.
   expect(u.lore).not.toMatch(/隐形|传送|穿墙|召唤|飞行|绕过碰撞|无视碰撞/);
  }
 });
 it('keeps each story on its redesigned silhouette',()=>{
  const markers:Record<string,RegExp>={
   levy:/圆木盾|软帽/, runner:/短披|前倾/, shield:/塔盾/, pike:/细长/, axe:/双臂裸露/,
   bow:/长弓/, crossbow:/横弩|绞盘/, rider:/不披甲|轻快马具/, knight:/旗缨/, mage:/星环/,
   healer:/白金兜帽/, ballista:/弓臂|巨轮/, assassin:/斜披|短刃/, guardian:/页锤|棱面巨盾/,
   firemage:/秃首|火盆/, paladin:/冠盔|长披/,
  };
  for(const [id,marker] of Object.entries(markers))expect(UNIT_BY_ID[id].lore).toMatch(marker);
  // The new militia artist explicitly uses spearHead: unlike the old sword,
  // the redraw now matches the original short-spear/wood-shield equipment.
  expect(UNIT_BY_ID['levy'].lore).toContain('短矛');
  expect(UNIT_BY_ID['shield'].description).not.toContain('穿甲');
 });
 it('does not hide a lore-only balance change behind the codex fields',()=>{
  expect(UNITS.find(u=>u.id==='axe')!.heavyDamage).toBe(53);
  expect(UNITS.find(u=>u.id==='guardian')!.defense).toBe(10);
  expect(UNITS.find(u=>u.id==='levy')!.income).toBe(6);
 });
});
