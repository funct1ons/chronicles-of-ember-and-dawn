import type { MatchConfig, Mission, Biome, Difficulty } from '../core/types';
import { ALL_UNIT_IDS } from './units';
export const BIOMES: {id:Biome;name:string;subtitle:string}[] = [
  {id:'plains',name:'边境平原',subtitle:'THE BORDERLANDS'}, {id:'wastes',name:'暮色荒原',subtitle:'THE ASHEN MARCH'},
  {id:'snow',name:'雪山要塞',subtitle:'THE FROSTWARD'}, {id:'ruins',name:'星火遗迹',subtitle:'THE FORGOTTEN SANCTUM'}
];
export const DIFFICULTIES = ['新手','简单','普通','困难','大师'];
const early=['levy','runner','shield','pike','bow'];
const middle=[...early,'axe','crossbow','rider','mage','healer'];
export const MISSIONS: Mission[] = [
 {id:'c1',name:'边境的第一面旗',subtitle:'01 · 誓约',text:'星火之心破裂后，两军先锋在边境相遇。敌方只有民兵与斥候：先建立收入，再用盾兵与弓箭组织反攻。',biome:'plains',difficulty:0,allowedUnits:early,enemyAllowedUnits:['levy','runner'],supply:48},
 {id:'c2',name:'灰羽之路',subtitle:'02 · 箭雨',text:'敌方游侠封锁道路。用重盾吸收箭矢，让斥候和弓手推进。敌方只会征募民兵与弓手。',biome:'plains',difficulty:1,allowedUnits:[...early,'axe','crossbow'],enemyAllowedUnits:['levy','bow'],supply:60},
 {id:'c3',name:'铁蹄将至',subtitle:'03 · 拒马',text:'斥候发现敌军轻骑。长枪是你的回答。先守住战线，再以穿甲火力完成反攻。',biome:'wastes',difficulty:1,allowedUnits:middle,enemyAllowedUnits:['levy','rider','bow'],gold:200},
 {id:'c4',name:'荒原熔炉',subtitle:'04 · 裂甲',text:'敌军重甲步兵在荒原集结。弩手和战斧将成为你的利刃。敌军额外获得100起始金币。',biome:'wastes',difficulty:2,allowedUnits:middle,enemyAllowedUnits:['shield','axe','crossbow'],enemyGoldBonus:100},
 {id:'c5',name:'雪线守望',subtitle:'05 · 坚守',text:'补给线穿过暴雪，人口仅60。敌方重骑、盾卫与弓手没有魔法支援；以长枪和术士反制，让祭司维持你的阵线。',biome:'snow',difficulty:2,allowedUnits:[...middle,'knight','guardian'],enemyAllowedUnits:['shield','bow','knight'],supply:60},
 {id:'c6',name:'古老的光',subtitle:'06 · 星辉',text:'遗迹中的奥术力量苏醒。重甲无法抵挡魔法，以机动突击者切入敌阵。',biome:'ruins',difficulty:2,allowedUnits:ALL_UNIT_IDS,enemyAllowedUnits:['shield','mage','healer','bow']},
 {id:'c7',name:'白霜攻城战',subtitle:'07 · 破城',text:'雪山要塞的防线坚固。守护你的弩炮，在远方摧毁敌城。敌军多150起始金币。',biome:'snow',difficulty:3,allowedUnits:ALL_UNIT_IDS,enemyGoldBonus:150},
 {id:'c8',name:'灰烬中的军旗',subtitle:'08 · 逆风',text:'荒原上的敌军补给充沛，每回合额外20基础收入。投资经济，同时关注要塞防守。',biome:'wastes',difficulty:3,allowedUnits:ALL_UNIT_IDS,enemyIncomeBonus:20},
 {id:'c9',name:'最后的同盟',subtitle:'09 · 破晓',text:'两军主力会师，人口容量提高至100。掌握克制、支援与反制，打破漫长对峙。',biome:'plains',difficulty:4,allowedUnits:ALL_UNIT_IDS,supply:100},
 {id:'c10',name:'星火之心',subtitle:'10 · 黎明',text:'最后一战在星火遗迹展开。敌方多200金币与20基础收入；用你的选择终结分裂的时代。',biome:'ruins',difficulty:4,allowedUnits:ALL_UNIT_IDS,supply:90,enemyGoldBonus:200,enemyIncomeBonus:20}
];
export const CHALLENGES: Mission[] = [
 {id:'h1',name:'最后的箭袋',subtitle:'挑战 I · 无盾之战',text:'敌方仅有民兵、斥候、弓弩与夜幕行者。你还拥有无盾的裂甲战斧：用重甲承受弓箭，再以弓手反制敌方穿甲弩。双方资源相同，人口仅65。',biome:'plains',difficulty:3,allowedUnits:['levy','runner','axe','bow','crossbow','assassin'],enemyAllowedUnits:['levy','runner','bow','crossbow','assassin'],supply:65},
 {id:'h2',name:'没有补给的黎明',subtitle:'挑战 II · 有限战争',text:'双方起始金币1200、收入80。征兵不再增长收入，资源必须精打细算。',biome:'snow',difficulty:3,allowedUnits:ALL_UNIT_IDS,gold:1200,growth:0,supply:70},
 {id:'h3',name:'诸王的黄昏',subtitle:'挑战 III · 精英决战',text:'仅可招募精英与支援部队。起始金币900，最高难度，人口55。',biome:'ruins',difficulty:4,allowedUnits:['knight','mage','healer','guardian','firemage','paladin'],gold:900,supply:55}
];
export function defaultConfig(): MatchConfig {
 return {mode:'classic',biome:'plains',difficulty:2 as Difficulty,seed:Date.now()>>>0,startingGold:150,startingIncome:80,supply:80,growth:1,roundDuration:12,baseHp:2500,ai:true,playerSide:0,allowedUnits:ALL_UNIT_IDS,maxRounds:80};
}
export function missionConfig(m:Mission, challenge=false): MatchConfig {
 return {...defaultConfig(),mode:challenge?'challenge':'campaign',missionId:m.id,biome:m.biome,difficulty:m.difficulty,allowedUnits:m.allowedUnits,enemyAllowedUnits:m.enemyAllowedUnits,startingGold:m.gold??150,startingIncome:m.income??80,supply:m.supply??80,growth:m.growth??1,enemyGoldBonus:m.enemyGoldBonus,enemyIncomeBonus:m.enemyIncomeBonus};
}
