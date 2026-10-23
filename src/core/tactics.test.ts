import {describe,it,expect} from 'vitest';
import {createBattle} from './simulation';
import {defaultConfig} from '../data/missions';
import {UNITS,UNIT_BY_ID} from '../data/units';
import {fastWaveScore,forecastWave,strategicWaveScore,useAdvantageForecast} from './tactics';
import {chooseAI} from './ai';
import {laneCenterY} from './math';
function battle(){return createBattle({...defaultConfig(),difficulty:4,startingGold:900,startingIncome:250,seed:302});}
function add(s:ReturnType<typeof battle>,side:0|1,id:string,count:number,x:number){const d=UNIT_BY_ID[id];const offset=s.units.filter(u=>u.side===side).length;for(let i=0;i<count;i++){const slot=offset+i;s.units.push({id:s.nextId++,side,type:id,x:x+Math.floor(slot/8)*16,y:laneCenterY(slot%8),hp:d.hp,maxHp:d.hp,cooldown:0,action:'idle',actionTime:0,target:null,born:0,charge:false});s.teams[side].supplyUsed+=d.supply;}}
describe('whole-wave tactical evaluation',()=>{
 it('uses actual clipped income, including zero-growth and the cap',()=>{const s=battle();s.config.growth=0;expect(fastWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(0);expect(forecastWave(s,0,UNIT_BY_ID.levy,UNITS,5).income).toBe(0);s.config.growth=1;s.teams[0].income=600;expect(fastWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(0);s.teams[0].income=598;expect(fastWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(2);});
 it('limits a forecast to a real whole-wave gold/population plan',()=>{const s=battle();s.teams[0].gold=130;s.teams[0].supplyUsed=76;const f=forecastWave(s,0,UNIT_BY_ID.mage,UNITS,5);expect(f.count).toBe(1);s.teams[0].supplyUsed=78;expect(forecastWave(s,0,UNIT_BY_ID.mage,UNITS,5).count).toBe(0);});
 it('forecast evaluation never mutates the real state or RNG',()=>{const s=battle();add(s,0,'shield',6,450);add(s,1,'pike',10,750);const before=JSON.stringify(s);for(const d of UNITS)forecastWave(s,0,d,UNITS,10);expect(JSON.stringify(s)).toBe(before);});
 it('master does not peek at the opponents unrevealed selection',()=>{const s=battle();add(s,0,'shield',6,450);add(s,1,'pike',10,750);s.round=10;const first=chooseAI(s,0);s.teams[1].selected='paladin';expect(chooseAI(s,0)).toBe(first);s.teams[1].selected='healer';expect(chooseAI(s,0)).toBe(first);});
 it('master is deterministic and leaves public resources untouched',()=>{const s=battle();add(s,1,'shield',8,700);const before=JSON.stringify(s);const choice=chooseAI(s,0);expect(chooseAI(s,0)).toBe(choice);expect(JSON.stringify(s)).toBe(before);});
 it('reserves population for a damage transition instead of renewing a tank lock',()=>{const s=battle();s.teams[0].income=600;add(s,0,'shield',39,650);add(s,1,'shield',20,700);const choice=chooseAI(s,0);expect(UNIT_BY_ID[choice].range).toBeGreaterThanOrEqual(120);expect(UNIT_BY_ID[choice].supply).toBeGreaterThan(2);});
 it.each([['guardian','pike',900,15,800],['ballista','axe',900,1,350],['healer','shield',230,1,350]] as const)('keeps %s reachable in the FULL catalogue', (expected,enemy,gold,round,x)=>{const s=battle();s.teams[0].gold=gold;s.teams[1].gold=gold;s.teams.forEach(t=>t.income=round===1?80:600);s.round=round;add(s,0,'guardian',6,300);add(s,0,'bow',6,300);add(s,1,enemy,4,x);expect(chooseAI(s,0)).toBe(expected);});
 it('does not value a healer-only wave as a functioning damage army',()=>{const s=battle();add(s,1,'pike',8,500);s.config.growth=0;const priest=forecastWave(s,0,UNIT_BY_ID.healer,UNITS,34);const bow=forecastWave(s,0,UNIT_BY_ID.bow,UNITS,34);expect(bow.score).toBeGreaterThan(priest.score);});
});

describe('strategic master regression',()=>{
 it('reinvests the opening budget instead of overfitting a single predicted encounter',()=>{
  const s=battle();s.round=1;s.teams.forEach(t=>{t.gold=230;t.income=80;});
  expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).score).toBeGreaterThan(strategicWaveScore(s,0,UNIT_BY_ID.pike).score);
  expect(chooseAI(s,0)).toBe('levy');
 });
 it('uses clipped income, the 18-body cap, supply, and the actual remaining reinvestment window',()=>{
  const s=battle();s.teams[0].gold=6000;expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).count).toBe(18);
  s.teams[0].supplyUsed=76;s.teams[0].gold=130;
  expect(strategicWaveScore(s,0,UNIT_BY_ID.mage).count).toBe(1);
  s.teams[0].supplyUsed=78;expect(strategicWaveScore(s,0,UNIT_BY_ID.mage).count).toBe(0);
  s.teams[0].supplyUsed=0;s.teams[0].gold=900;s.teams[0].income=598;
  expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(2);
  s.teams[0].income=600;expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(0);
  s.teams[0].income=250;s.round=80;const last=strategicWaveScore(s,0,UNIT_BY_ID.levy);
  s.config.growth=0;expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).income).toBe(0);
  expect(strategicWaveScore(s,0,UNIT_BY_ID.levy).score).toBe(last.score);
 });
 it('values complementary firepower above more crowded melee frontage',()=>{
  const s=battle();s.config.growth=0;s.teams[0].income=600;
  add(s,0,'levy',20,500);add(s,1,'levy',20,700);
  expect(strategicWaveScore(s,0,UNIT_BY_ID.bow).combat).toBeGreaterThan(strategicWaveScore(s,0,UNIT_BY_ID.levy).combat);
 });
 it('values healing only with a functioning frontline and has diminishing sustain returns',()=>{
  const s=battle();s.config.growth=0;s.teams[0].income=600;
  expect(strategicWaveScore(s,0,UNIT_BY_ID.healer).combat).toBe(0);
  add(s,0,'paladin',4,500);add(s,0,'bow',4,400);add(s,1,'paladin',4,700);add(s,1,'bow',4,800);
  const marginal=()=>{const withWave=strategicWaveScore(s,0,UNIT_BY_ID.healer).combat;
   const gold=s.teams[0].gold;s.teams[0].gold=0;const withoutWave=strategicWaveScore(s,0,UNIT_BY_ID.healer).combat;s.teams[0].gold=gold;
   return withWave-withoutWave;};
  const first=marginal();expect(first).toBeGreaterThan(0);
  add(s,0,'healer',4,450);expect(marginal()).toBeLessThan(first);
 });
 it('does not mutate state/RNG and is symmetric under public army mirroring',()=>{
  const s=battle();add(s,0,'shield',8,500);add(s,1,'pike',10,700);
  const before=JSON.stringify(s);for(const d of UNITS)strategicWaveScore(s,0,d);
  expect(JSON.stringify(s)).toBe(before);
  const mirrored=structuredClone(s);mirrored.teams=[mirrored.teams[1],mirrored.teams[0]];
  for(const u of mirrored.units){u.side=(1-u.side) as 0|1;u.x=1280-u.x;}
  expect(chooseAI(s,0)).toBe(chooseAI(mirrored,1));
 });
 it('bounds coarse search even for a large overwhelming army',()=>{
  const s=battle();add(s,0,'shield',28,500);add(s,0,'levy',10,450);add(s,1,'rider',5,700);
  expect(useAdvantageForecast(s,0)).toBe(false);
 });
 it('keeps the legal 150-body stress state on the strategic path, without changing resources',()=>{
  const s=battle();s.time=160;s.round=13;
  for(const side of [0,1] as const){add(s,side,'levy',75,0);s.teams[side].gold=600;s.teams[side].income=600;
   s.units.filter(u=>u.side===side).forEach((u,i)=>{u.x=side===0?100+Math.floor(i/8)*44:1180-Math.floor(i/8)*44;u.cooldown=.5;u.born=160-(i%8)*12;});}
  expect(s.teams.map(t=>t.supplyUsed)).toEqual([75,75]);expect(useAdvantageForecast(s,1)).toBe(false);
  const before=JSON.stringify(s),choice=chooseAI(s,1);
  expect(UNIT_BY_ID[choice].supply).toBeLessThanOrEqual(5);expect(chooseAI(s,1)).toBe(choice);
  expect(JSON.stringify(s)).toBe(before);
 });
 const screen=[...Array(6).fill('guardian'),...Array(6).fill('bow')] as string[];
 const cases:[string,string[],string,number,number,number,number][]=[
  ['paladin',[],'levy',4,230,1,350],['levy',[],'levy',4,230,1,800],
  ['axe',[],'levy',4,900,1,350],['shield',[],'levy',4,900,1,800],
  ['knight',[],'levy',4,900,15,350],['bow',Array(8).fill('shield'),'levy',4,230,1,350],
  ['firemage',Array(8).fill('shield'),'levy',4,900,15,800],['mage',Array(8).fill('shield'),'levy',4,2500,1,350],
  ['pike',Array(10).fill('bow'),'levy',4,900,1,800],['assassin',Array(10).fill('bow'),'levy',4,2500,1,350],
  ['rider',screen,'levy',4,230,1,350],['runner',[...Array(8).fill('pike'),...Array(6).fill('bow')],'levy',4,230,1,350],
  ['healer',Array(8).fill('shield'),'levy',12,230,1,350],['crossbow',screen,'levy',12,900,15,800],
  ['guardian',screen,'pike',4,900,15,800],['ballista',screen,'axe',4,900,1,350],
 ];
 it.each(cases)('can still choose %s against the full, unrestricted catalogue',(expected,own,enemy,count,gold,round,x)=>{
  const s=battle();s.round=round;s.teams.forEach(t=>{t.gold=gold;t.income=round===1?80:600;});
  for(const id of own)add(s,0,id,1,300);add(s,1,enemy,count,x);
  expect(s.teams.every(t=>t.supplyUsed<=s.config.supply)).toBe(true);
  expect(chooseAI(s,0)).toBe(expected);
 });
});
