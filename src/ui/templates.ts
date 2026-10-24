import { icon } from './icons';
import { BIOMES, DIFFICULTIES, MISSIONS, CHALLENGES } from '../data/missions';
import { UNITS, UNIT_BY_ID } from '../data/units';
import type { UnitDef, MatchConfig, Side } from '../core/types';
import type { SaveData } from './storage';
import {
  CODEX_GROUPS,
  CODEX_SORTS,
  codexEconomy,
  codexGroupLabelsOf,
  codexGroupsOf,
  codexHints,
  codexStatusLabel,
  runCodexQuery,
  type CodexHint,
} from './codex';
export const HOTKEYS=['1','2','3','4','5','6','7','8','Q','W','E','R','T','Y','U','I'];
export const btn=(action:string,label:string,cls='',ico='')=>`<button type="button" class="btn ${cls}" data-action="${action}" aria-label="${label}">${ico?icon(ico):''}<span>${label}</span></button>`;
export function header(inBattle=false,cover=false):string{return `<header class="topbar${cover?' cover-topbar':''}"><button class="brand" data-action="home" aria-label="返回主菜单">${icon('crest')}${cover?'':'<span>烬辉战纪<small>EMBER & DAWN</small></span>'}</button>${cover?'':`<div class="top-caption">${inBattle?'埃瑟兰 · 军团指挥部':'CHRONICLES OF EMBER AND DAWN'}</div>`}<nav aria-label="全局导航">${!inBattle?btn('codex','兵种图鉴','quiet','book'):btn('tutorial','战场指南','quiet','help')}${btn('mute','声音','icon-btn','volume')}${btn('fullscreen','全屏','icon-btn','expand')}${btn('settings','设置','icon-btn','gear')}</nav></header>`;}
export function home(save:SaveData):string{
 return `${header(false,true)}
 <main class="home cover" aria-labelledby="cover-title">
  <section class="cover-content">
   <h1 id="cover-title" class="cover-title">烬辉战纪</h1>
   <p class="cover-english" lang="en">CHRONICLES OF EMBER AND DAWN</p>
   <p class="cover-motto">余烬未息<span aria-hidden="true"> · </span>黎明将至</p>
   <nav class="cover-actions" aria-label="开始游戏">
    ${btn('campaign','战役征途','primary large')}
    ${btn('classic','经典对战','large')}
   </nav>
   <nav class="cover-modes" aria-label="更多模式">
    <button type="button" data-action="tutorial">新手教学</button>
    <button type="button" data-action="challenges">战争试炼</button>
    <button type="button" data-action="custom">自定义</button>
    <button type="button" data-action="local">本地双人</button>
   </nav>
  </section>
  <footer class="cover-footer">
   <button type="button" data-action="credits">制作与鸣谢</button>
   <span aria-label="战役进度">战役 <b>${save.completed.length}</b><span class="cover-progress-total"> / ${MISSIONS.length}</span></span>
  </footer>
 </main>`;
}
export function setup(mode:string,config:MatchConfig,speed=1):string{
 const custom=mode==='custom';const local=mode==='local';const factionTag=local?'article':'button';
 return `${header()}<main class="page setup-page"><div class="page-heading">${btn('home','返回','quiet','back')}<div class="eyebrow">MUSTER YOUR LEGION</div><h1>${custom?'自定义战场':local?'双旗对决':'经典对战'}</h1><p>${local?'两位统帅，共享一片战场。左方使用 1–8 / Q–I，右方使用方向键与 Enter。':'选择你的战旗。每次征募都是对未来收入与当前战线的权衡。'}</p></div><div class="setup-columns"><section class="panel"><div class="section-label">01 <span>${local?'双方军旗':'选择阵营'}</span></div><div class="factions"><${factionTag} class="faction azure ${local||config.playerSide===0?'selected':''}" ${local?'':'data-faction="0"'}>${icon('crest')}<h2>苍曜同盟</h2><span>AZURE ALLIANCE</span><p>钢铁为誓，星辉为引。<br>让黎明重返埃瑟兰。</p><small>${local?'统帅 I · 1–8 / Q–I':'蓝金军旗 · 左侧要塞'}</small></${factionTag}><${factionTag} class="faction crimson ${local||config.playerSide===1?'selected':''}" ${local?'':'data-faction="1"'}>${icon('crest')}<h2>赤烬军团</h2><span>CRIMSON LEGION</span><p>灰烬为证，秩序长存。<br>于烈火中铸就新王国。</p><small>${local?'统帅 II · 方向键 / Enter':'赤铜军旗 · 右侧要塞'}</small></${factionTag}></div><p class="muted small">阵营拥有相同兵种和数值，不同的是你赋予军团的战术。</p></section><section class="panel battle-options"><div class="section-label">02 <span>战场指令</span></div><label>战场<select id="opt-biome">${BIOMES.map(b=>`<option value="${b.id}" ${config.biome===b.id?'selected':''}>${b.name} · ${b.subtitle}</option>`).join('')}</select></label>${!local?`<label>敌军难度<select id="opt-difficulty">${DIFFICULTIES.map((d,i)=>`<option value="${i}" ${i===config.difficulty?'selected':''}>${d}${i===4?' · 最佳反制决策':''}</option>`).join('')}</select></label>`:''}${custom?`<div class="option-grid"><label>初始金币<select id="opt-gold"><option value="150" ${config.startingGold===150?'selected':''}>150 · 标准</option><option value="500" ${config.startingGold===500?'selected':''}>500 · 充裕</option><option value="1200" ${config.startingGold===1200?'selected':''}>1200 · 富饶</option></select></label><label>人口上限<select id="opt-supply"><option value="80" ${config.supply===80?'selected':''}>80 · 标准</option><option value="50" ${config.supply===50?'selected':''}>50 · 精兵</option><option value="120" ${config.supply===120?'selected':''}>120 · 军团</option><option value="160" ${config.supply===160?'selected':''}>160 · 压力战</option></select></label><label>征募收入增长<select id="opt-growth"><option value="1" ${config.growth===1?'selected':''}>×1 · 标准</option><option value="0" ${config.growth===0?'selected':''}>×0 · 固定收入</option><option value="1.5" ${config.growth===1.5?'selected':''}>×1.5 · 繁荣</option></select></label><label>战斗速度<select id="opt-speed"><option value="1" ${speed===1?'selected':''}>×1</option><option value="1.5" ${speed===1.5?'selected':''}>×1.5</option><option value="2" ${speed===2?'selected':''}>×2</option><option value="3" ${speed===3?'selected':''}>×3</option></select></label></div>`:''}<div class="rule-note">${icon('clock')}每 12 秒自动征募一波<br>${icon('coin')}先结算收入，再按金币与人口招募<br>${icon('flag')}摧毁敌方要塞，即获胜利</div>${btn('launch','军团，出征','primary large wide','swords')}</section></div></main>`;
}
export function campaign(save:SaveData):string{
 return `${header()}<main class="page campaign-page"><div class="page-heading">${btn('home','返回','quiet','back')}<div class="eyebrow">THE CAMPAIGN OF AETHERLAN</div><h1>重燃星火</h1><p>十面战旗，一条通向黎明的征途。胜利解锁下一章，无需养成与付费。</p></div><div class="campaign-map">${MISSIONS.map((m,i)=>{const done=save.completed.includes(m.id),locked=i>0&&!save.completed.includes(MISSIONS[i-1].id);return `<button class="mission-node ${done?'complete':''} ${locked?'locked':''}" data-mission="${m.id}" ${locked?'disabled':''}><span class="node-ring">${icon(locked?'lock':done?'check':'flag')}</span><span class="node-order">${String(i+1).padStart(2,'0')} / ${BIOMES.find(b=>b.id===m.biome)?.name}</span><strong>${m.name}</strong><small>${locked?'前章胜利后解锁':done?'已完成 · 可重玩':DIFFICULTIES[m.difficulty]+' · 点击查看战报'}</small></button>`;}).join('')}</div><div class="campaign-bottom"><span>已收复 <strong>${save.completed.length}</strong> / 10 处据点</span>${btn('records','查看战史','quiet','book')}</div></main>`;
}
export function challenges():string{return `${header()}<main class="page"><div class="page-heading">${btn('home','返回','quiet','back')}<div class="eyebrow">TRIALS OF THE COMMANDER</div><h1>战争试炼</h1><p>不同的资源，不同的答案。每一场试炼都是一次战术重构。</p></div><div class="challenge-grid">${CHALLENGES.map((m,i)=>`<button class="challenge-card panel" data-challenge="${m.id}"><span class="challenge-index">0${i+1}</span>${icon(i===0?'swords':i===1?'coin':'crown')}<div class="eyebrow">${m.subtitle}</div><h2>${m.name}</h2><p>${m.text}</p><span class="difficulty">${DIFFICULTIES[m.difficulty]} · ${BIOMES.find(b=>b.id===m.biome)?.name}</span><span class="text-link">查看战场简报 ${icon('arrow')}</span></button>`).join('')}</div></main>`;}
export function unitStats(u:UnitDef):string{return `<div class="stat-grid"><span>生命<b>${u.hp}</b></span><span>装甲<b>${u.armor==='heavy'?'重甲':'轻甲'} / ${u.defense}</b></span><span>对轻甲伤害<b>${u.lightDamage}</b></span><span>对重甲伤害<b>${u.heavyDamage}</b></span><span>攻击间隔<b>${u.cooldown}s</b></span><span>射程<b>${u.range}</b></span><span>移动速度<b>${u.speed}</b></span><span>人口<b>${u.supply}</b></span></div>`;}
const firstSentence = (text: string): string => {
  const match = text.match(/^[^。！？]*[。！？]/);
  if (match) return match[0];
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
};

function economyRows(unit: UnitDef): string {
  const economy = codexEconomy(unit);
  return `<div class="codex-economy" aria-label="经济效率"><span>每百金币收入<b>${economy.incomePerHundred.toFixed(1)}</b></span><span>每百金币生命<b>${economy.hpPerHundred.toFixed(0)}</b></span><span>每人口生命<b>${economy.hpPerSupply.toFixed(0)}</b></span><span>理论回本<b>${economy.payoffWaves} 波</b></span></div><p class="codex-note">回本按增长 ×1、收入未封顶、无复投计算；自定义规则与实战结果可能不同。</p>`;
}

const renderHint = (hint: CodexHint): string => `<div class="codex-hint ${hint.kind}"><span class="codex-hint-label">${hint.label}</span><p>${hint.detail}</p></div>`;

function hintBlock(unit: UnitDef): string {
  const hints = codexHints(unit);
  const strengths = hints.filter(hint => hint.kind === 'strength');
  const cautions = hints.filter(hint => hint.kind === 'caution');
  return `<section class="codex-hints" aria-label="克制提示"><div class="codex-hint-group"><h3>数值优势</h3>${strengths.map(renderHint).join('') || '<p class="codex-note">该兵种不以单兵数值取胜，主要靠编队与数量发挥作用。</p>'}</div><div class="codex-hint-group"><h3>谨慎提示</h3>${cautions.map(renderHint).join('')}</div><p class="codex-note">以上由 computeDamage 的实际伤害与攻击间隔推导，未计走位、射程维持与治疗；请结合战况判断。</p></section>`;
}

export type UnitDetailVariant = 'full' | 'card';

/**
 * Complete codex entry, shared by the codex cards and the in-battle modal.
 * `full` renders every block expanded (modal), `card` keeps the summary and
 * hides lore/stats behind `<details>` (browse page). Unknown ids return ''.
 */
export function unitDetail(unitOrId: UnitDef | string, variant: UnitDetailVariant = 'full'): string {
  const unit = typeof unitOrId === 'string' ? UNIT_BY_ID[unitOrId] : unitOrId;
  if (!unit) return '';
  const groups = codexGroupLabelsOf(unit).join(' · ');
  const head = `<header class="unit-detail-head"><canvas data-portrait="${unit.id}" aria-hidden="true"></canvas><div><span class="eyebrow">${unit.title}${groups ? ` · ${groups}` : ''}</span><h2>${unit.name}</h2><p class="unit-detail-price"><b class="gold">${unit.cost}</b> 金币 <span>收入 +${unit.income} / 波 · 人口 ${unit.supply}</span></p><p class="unit-detail-doctrine">${unit.doctrine}</p></div></header>`;
  const ability = `<div class="ability">${icon('spark')}${unit.ability}</div>`;
  const body = `<div class="codex-lore"><h3>战史</h3><p>${unit.lore}</p></div>${unitStats(unit)}${economyRows(unit)}${hintBlock(unit)}`;
  if (variant === 'card') {
    return `<div class="unit-detail codex-card-body">${head}<p class="codex-lore-lead">${firstSentence(unit.lore)}</p><details class="codex-details"><summary><span>战史与完整数值</span><i aria-hidden="true"></i></summary><div class="codex-details-body">${body}${ability}</div></details></div>`;
  }
  return `<div class="unit-detail">${head}${ability}${body}</div>`;
}

/** One codex card: summary by default, full entry inside `<details>`. */
export function codexUnitCard(unit: UnitDef, index: number): string {
  const groups = codexGroupsOf(unit).join(' ');
  return `<article class="unit-entry panel codex-card" data-codex-entry data-codex-id="${unit.id}" data-codex-groups="${groups}" style="order:${index}">${unitDetail(unit, 'card')}</article>`;
}

export function codex(): string {
  const initial = runCodexQuery({});
  const toolbar = `<div class="codex-toolbar" role="search" aria-label="图鉴检索"><label class="codex-field codex-field-search"><span class="codex-field-label">检索</span><input type="search" data-codex-search placeholder="名称 / 信条 / 战史 / 定位" aria-label="按名称、信条或战史检索" autocomplete="off" spellcheck="false"></label><label class="codex-field"><span class="codex-field-label">定位</span><select data-codex-group aria-label="按定位筛选">${CODEX_GROUPS.map(group => `<option value="${group.id}"${group.id === 'all' ? ' selected' : ''}>${group.label} · ${group.hint}</option>`).join('')}</select></label><label class="codex-field"><span class="codex-field-label">排序</span><select data-codex-sort aria-label="排序方式">${CODEX_SORTS.map(sort => `<option value="${sort.id}">${sort.label}</option>`).join('')}</select></label><p class="codex-status" data-codex-status aria-live="polite">${codexStatusLabel(initial)}</p></div>`;
  return `${header()}<main class="page codex-page"><div class="page-heading">${btn('return', '返回', 'quiet', 'back')}<div class="eyebrow">THE FIELD MANUAL</div><h1>军团名录</h1><p>检索、筛选与对照十六条战史。所有伤害与收入为本作原创设计，克制提示由实际伤害公式推导。</p></div>${toolbar}<div class="codex-grid" data-codex-grid>${UNITS.map((unit, index) => codexUnitCard(unit, index)).join('')}</div><p class="codex-empty" data-codex-empty hidden>没有符合条件的名录条目，请调整检索词或定位筛选。</p></main>`;
}
export function roster(allowed:string[],side:Side=0,local=false):string{return `<div class="roster ${local?'local-roster':''}" data-roster-side="${side}">${UNITS.map((u,i)=>`<button class="unit-card ${!allowed.includes(u.id)?'unavailable':''}" data-unit="${u.id}" data-side="${side}" ${!allowed.includes(u.id)?'disabled':''} aria-label="${u.name}，${u.cost}金币，${u.supply}人口" aria-pressed="false"><span class="unit-key">${local&&side===1?String(i+1):HOTKEYS[i]}</span><canvas data-portrait="${u.id}" data-portrait-side="${side}"></canvas><strong>${u.name}</strong><span class="unit-cost">${u.cost}<small>+${u.income}</small></span></button>`).join('')}</div>`;}
export function battle(config:MatchConfig):string{
 const local=config.mode==='local';return `${header(true)}<main class="battle-page"><div class="war-hud"><section class="team-hud azure" data-team="0"><div class="team-label">${icon('crest')}<strong>苍曜同盟</strong><span>${local?'统帅 I':config.playerSide===0?'你的军团':'敌军'}</span></div><div class="resources"><span>${icon('coin')}<b id="gold-0">150</b><small>金币</small></span><span class="income">+<b id="income-0">80</b><small>每波收入</small></span><span>${icon('people')}<b id="supply-0">0/80</b><small>人口</small></span></div><div class="base-track"><i id="base-bar-0"></i></div><div class="base-label"><span>苍曜要塞</span><b id="base-hp-0">2500 / 2500</b></div></section><section class="wave-hud"><span class="eyebrow" id="wave-label">征募倒计时</span><strong id="countdown">06</strong><div><span id="round">第 1 波</span><i>·</i><span id="elapsed">00:00</span></div><div class="wave-controls">${btn('speed','×1','quiet small-btn')}${btn('pause','暂停','quiet small-btn','pause')}</div></section><section class="team-hud crimson" data-team="1"><div class="team-label">${icon('crest')}<strong>赤烬军团</strong><span>${local?'统帅 II':config.playerSide===1?'你的军团':'敌军'}</span></div><div class="resources"><span>${icon('coin')}<b id="gold-1">150</b><small>金币</small></span><span class="income">+<b id="income-1">80</b><small>每波收入</small></span><span>${icon('people')}<b id="supply-1">0/80</b><small>人口</small></span></div><div class="base-track"><i id="base-bar-1"></i></div><div class="base-label"><span>赤烬要塞</span><b id="base-hp-1">2500 / 2500</b></div></section></div><div class="battlefield-wrap"><div class="battlefield-caption"><span>${BIOMES.find(b=>b.id===config.biome)?.name}</span><span id="battle-message">军旗已升起。选择兵种，为第一波征募做好准备。</span><span>${local?'本地双人':DIFFICULTIES[config.difficulty]+' · AI'}</span></div><div id="field-mount"></div><div class="field-bottom"><span class="field-team azure">${icon('flag')}苍曜防线</span><span>自动行军 / 自动战斗</span><span class="field-team crimson">赤烬防线${icon('flag')}</span></div></div><section class="command-deck ${local?'two-player':''}">${local?`<div class="local-army"><div class="deck-label azure">统帅 I <span>1–8 / Q–I</span><b id="wave-preview-0"></b></div>${roster(config.allowedUnits,0,true)}</div><div class="local-army"><div class="deck-label crimson">统帅 II <span>← → ↑ ↓ / Enter</span><b id="wave-preview-1"></b></div>${roster(config.allowedUnits,1,true)}</div>`:`<aside class="unit-inspector" id="unit-inspector"></aside><div class="army-panel"><div class="deck-label">军团征募 <span>选择将于下一波自动招募的兵种</span><b id="wave-preview-${config.playerSide}"></b></div>${roster(config.allowedUnits,config.playerSide)}</div>`}</section><div class="battle-footer"><span>${local?'统帅 II：方向键浏览，Enter确认。':'1–8 / Q–I 选择兵种'} <i>·</i> 空格 暂停 <i>·</i> +/- 变速 <i>·</i> M 静音 <i>·</i> B 图鉴 <i>·</i> F 全屏</span><span id="fps-label">30Hz 模拟</span></div></main>`;
}
export function inspector(id:string,preview=false):string{const u=UNIT_BY_ID[id];return `<div class="inspector-title"><span class="eyebrow">${preview?'预览 · ':''}${u.title}</span><h2>${u.name}</h2></div><p>${u.description}</p><div class="inspector-economy"><span>${icon('coin')}<b>${u.cost}</b> / 收入 +${u.income}</span><span>${icon('people')}${u.supply}</span></div><div class="inspector-compact"><span>生命 <b>${u.hp}</b></span><span>${u.armor==='heavy'?'重甲':'轻甲'} <b>${u.defense}</b></span><span>轻伤 <b>${u.lightDamage}</b></span><span>重伤 <b>${u.heavyDamage}</b></span><span>间隔 <b>${u.cooldown}s</b></span><span>射程 <b>${u.range}</b></span></div><div class="ability">${icon('spark')}${u.ability}</div>`;}
