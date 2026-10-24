import type { BattleState, MatchConfig, Side, Difficulty, Biome, Mission } from '../core/types';
import { createBattle, stepBattle, selectUnit, previewWave } from '../core/simulation';
import { UNIT_BY_ID, UNITS } from '../data/units';
import { defaultConfig, missionConfig, MISSIONS, CHALLENGES, DIFFICULTIES } from '../data/missions';
import { BattleRenderer } from '../render/BattleRenderer';
import { paintPortrait } from '../render/sprites';
import { AudioManager, MUSIC_CREDITS } from '../audio/AudioManager';
import { loadSave, saveData, downloadSave, type SaveData } from './storage';
import { icon } from './icons';
import * as T from './templates';
import { BattleIntensity } from './battleIntensity';
import { applyCodexPage, runCodexQuery } from './codex';

type Page='home'|'classic'|'custom'|'local'|'campaign'|'challenges'|'codex'|'battle';
const timeText=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export class App {
 public state:BattleState|null=null;
 public save:SaveData=loadSave();
 public renderer:BattleRenderer;
 public audio=new AudioManager();
 private page:Page='home';
 private returnPage:Page='home';
 private draft:MatchConfig=defaultConfig();
 private paused=false;
 private modalPause=false;
 private modalName='';
 private tutorialStep=0;
 private localCursor=0;
 private inspected='levy';
 private last=0;
 private accumulator=0;
 private uiClock=0;
 private visualClock=0;
 private frameHandle=0;
 private countedSecond=-1;
 private intensity=new BattleIntensity();
 private footstepClock=0;
 private warningClock=0;
 private resultRecorded=false;
 private lastResultHtml='';
 private toastTimer:ReturnType<typeof setTimeout>|undefined;
 private fpsWindow:number[]=[];
 private screen:HTMLElement;
 private modalRoot:HTMLElement;
 private ambient:HTMLElement;
 private toastEl:HTMLElement;
 private focusReturn:HTMLElement|null=null;
 constructor(private root:HTMLElement){
  root.innerHTML='<div id="ambient" aria-hidden="true"></div><div id="screen"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div>';
  this.ambient=root.querySelector('#ambient')!;this.screen=root.querySelector('#screen')!;this.modalRoot=root.querySelector('#modal-root')!;this.toastEl=root.querySelector('#toast')!;
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','埃瑟兰像素战场');this.ambient.append(canvas);this.renderer=new BattleRenderer(canvas);
  this.applySettings();
  root.addEventListener('click',e=>this.click(e));root.addEventListener('change',e=>this.change(e));root.addEventListener('input',e=>this.input(e));
  root.addEventListener('pointerover',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-unit]');if(b&&this.state&&!this.state.config.mode.includes('local'))this.inspect(b.dataset.unit!);});
  root.addEventListener('pointerout',e=>{const card=(e.target as HTMLElement).closest<HTMLElement>('[data-unit]');const next=(e.relatedTarget as HTMLElement|null)?.closest?.('[data-unit]');if(card&&next!==card&&this.state)this.inspect(this.state.teams[this.state.config.playerSide].selected);});
  root.addEventListener('focusin',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-unit]');if(b)this.inspect(b.dataset.unit!);});
  window.addEventListener('keydown',e=>{if(!this.audio.isUnlocked)void this.audio.unlock();this.key(e);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state&&this.state.winner===null&&!this.paused){this.pause();this.toast('页面已失焦，战斗自动暂停。');}});
  this.navigate('home');this.frameHandle=requestAnimationFrame(t=>this.frame(t));
 }
 private persist(){if(!saveData(this.save))this.toast('浏览器无法保存进度；仍可游玩，建议导出存档。');}
 private applySettings(){const s=this.save.settings;this.audio.setVolumes(s.music,s.effects,s.ambience);this.audio.setMuted(s.muted);this.renderer&&(this.renderer.reducedMotion=s.reducedMotion,this.renderer.showHealth=s.healthBars);document.documentElement.classList.toggle('reduced-motion',s.reducedMotion);}
 private navigate(page:Page){
  this.closeModal(false);this.page=page;
  if(page!=='battle'){this.state=null;this.paused=false;this.ambient.append(this.renderer.canvas);this.ambient.hidden=false;this.renderer.canvas.className='ambient-canvas';}
  this.screen.innerHTML=page==='home'?T.home(this.save):page==='campaign'?T.campaign(this.save):page==='challenges'?T.challenges():page==='codex'?T.codex():T.setup(page,this.draft,this.save.settings.speed);
  this.paintPortraits();if(page==='codex')this.wireCodex();this.updateMuteButton();window.scrollTo(0,0);
  this.audio.setScene(page==='campaign'||page==='challenges'?'campaign':'menu');
 }
 private wireCodex(){
  const search=this.screen.querySelector<HTMLInputElement>('[data-codex-search]'),group=this.screen.querySelector<HTMLSelectElement>('[data-codex-group]'),sort=this.screen.querySelector<HTMLSelectElement>('[data-codex-sort]');
  if(!search||!group||!sort)return;
  const update=()=>applyCodexPage(this.screen,runCodexQuery({search:search.value,group:group.value,sort:sort.value}));
  search.addEventListener('input',update);search.addEventListener('search',update);group.addEventListener('change',update);sort.addEventListener('change',update);update();
 }
 private showUnitDetail(id:string){
  const detail=T.unitDetail(id);if(!detail)return;
  this.openModal('unit-info',`${detail}<div class="modal-actions">${T.btn('codex','兵种速览','','book')}${T.btn('close-modal','返回战场','primary')}</div>`);this.paintPortraits();
 }
 private paintPortraits(){this.screen.querySelectorAll<HTMLCanvasElement>('[data-portrait]').forEach(c=>paintPortrait(c,c.dataset.portrait!,Number(c.dataset.portraitSide??0) as Side));this.modalRoot.querySelectorAll<HTMLCanvasElement>('[data-portrait]').forEach(c=>paintPortrait(c,c.dataset.portrait!,0));}
 private async click(e:MouseEvent){
  const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el||el.hasAttribute('disabled'))return;
  void this.audio.unlock().catch(()=>this.toast('音频未能启动，请检查浏览器声音权限。'));
  this.audio.play('click');
  if(el.dataset.unit){if(this.state){const side=Number(el.dataset.side) as Side;if(selectUnit(this.state,side,el.dataset.unit)){this.inspect(el.dataset.unit);this.audio.play('select');this.updateHud();}}return;}
  if(el.dataset.faction){this.captureOptions();this.draft.playerSide=Number(el.dataset.faction) as Side;this.screen.querySelectorAll('[data-faction]').forEach(n=>n.classList.toggle('selected',(n as HTMLElement).dataset.faction===el.dataset.faction));return;}
  if(el.dataset.mission){this.briefing(MISSIONS.find(m=>m.id===el.dataset.mission)!);return;}
  if(el.dataset.challenge){this.briefing(CHALLENGES.find(m=>m.id===el.dataset.challenge)!,true);return;}
  const a=el.dataset.action;
  switch(a){
   case 'home':if(this.state&&this.state.winner===null)this.confirmLeave();else this.navigate('home');break;
   case 'classic':case 'custom':case 'local':this.draft={...defaultConfig(),mode:a,ai:a!=='local'};this.navigate(a);break;
   case 'campaign':case 'challenges':this.navigate(a);break;
   case 'codex':if(this.state){this.openModal('field-codex',`<div class="eyebrow">FIELD MANUAL</div><h2>战场兵种速览</h2><div class="compact-codex">${UNITS.map(u=>`<button data-action="codex-unit-${u.id}"><strong>${u.name}</strong><span>${u.title}</span></button>`).join('')}</div>`);}else{this.captureOptions();this.returnPage=this.page;this.navigate('codex');}break;
   case 'return':this.navigate(this.returnPage);break;
   case 'launch':this.captureOptions();this.launch(this.draft);break;
   case 'launch-mission':this.launch(this.draft);break;
   case 'pause':this.pause();break;
   case 'resume':this.closeModal();break;
   case 'settings':this.settings();break;
   case 'close-modal':this.closeModal();break;
   case 'speed':this.cycleSpeed();break;
   case 'mute':this.save.settings.muted=!this.save.settings.muted;this.applySettings();this.persist();this.updateMuteButton();break;
   case 'fullscreen':await this.fullscreen();break;
   case 'tutorial':this.tutorialStep=0;this.tutorial();break;
   case 'tutorial-next':this.tutorialStep++;if(this.tutorialStep>=5){this.save.tutorialSeen=true;this.persist();if(this.state)this.closeModal();else this.launch({...defaultConfig(),difficulty:0,supply:48,allowedUnits:['levy','shield','pike','bow','runner'],enemyAllowedUnits:['levy','runner']});}else this.tutorial();break;
   case 'tutorial-skip':this.save.tutorialSeen=true;this.persist();this.closeModal();break;
   case 'restart':if(this.state)this.launch({...this.state.config,seed:Date.now()>>>0});break;
   case 'leave':this.navigate('home');break;
   case 'next-mission':{const current=MISSIONS.findIndex(m=>m.id===this.state?.config.missionId);if(current>=0&&current<MISSIONS.length-1){this.draft=missionConfig(MISSIONS[current+1]);this.briefing(MISSIONS[current+1]);}else this.navigate('campaign');break;}
   case 'records':this.records();break;
   case 'credits':this.credits();break;
   case 'export':downloadSave(this.save);this.toast('进度已导出为 JSON 文件。');break;
   case 'reset-progress':this.openModal('reset','<h2>重置战役进度？</h2><p>已解锁关卡和战史将被清除。音量设置保留。此操作无法撤销。</p><div class="modal-actions">'+T.btn('close-modal','保留进度')+T.btn('reset-confirm','确认重置','danger')+'</div>');break;
   case 'reset-confirm':this.save.completed=[];this.save.records=[];this.persist();this.navigate('home');this.toast('战役进度已重置。');break;
   case 'import':this.modalRoot.querySelector<HTMLInputElement>('#import-file')?.click();break;
   default:if(a?.startsWith('codex-unit-'))this.showUnitDetail(a.slice(11));break;
  }
 }
 private captureOptions(){
  const value=(id:string)=>this.screen.querySelector<HTMLSelectElement>('#opt-'+id)?.value;
  if(value('biome'))this.draft.biome=value('biome') as Biome;
  if(value('difficulty'))this.draft.difficulty=Number(value('difficulty')) as Difficulty;
  if(value('gold'))this.draft.startingGold=Number(value('gold'));
  if(value('supply'))this.draft.supply=Number(value('supply'));
  if(value('growth'))this.draft.growth=Number(value('growth'));
  if(value('speed')){this.save.settings.speed=Number(value('speed'));this.persist();}
 }
 public launch(config:MatchConfig){
  this.closeModal(false);this.draft={...config};this.state=createBattle(config);this.page='battle';this.paused=false;this.resultRecorded=false;this.lastResultHtml='';this.accumulator=0;this.countedSecond=-1;this.intensity.reset();this.footstepClock=0;this.warningClock=0;this.localCursor=0;this.renderer.clear();
  this.screen.innerHTML=T.battle(config);this.ambient.hidden=true;this.renderer.canvas.className='battle-canvas';this.screen.querySelector('#field-mount')!.append(this.renderer.canvas);
  this.paintPortraits();this.inspect(this.state.teams[config.playerSide].selected);this.updateHud();this.updateMuteButton();this.audio.setScene('prepare');this.audio.play('horn');window.scrollTo(0,0);
 }
 private briefing(m:Mission,challenge=false){
  this.draft=missionConfig(m,challenge);
  this.openModal('briefing',`<div class="eyebrow">${m.subtitle}</div><h2>${m.name}</h2><p class="briefing-text">${m.text}</p><div class="briefing-stats"><span>难度 <b>${DIFFICULTIES[m.difficulty]}</b></span><span>人口 <b>${this.draft.supply}</b></span><span>起始金币 <b>${this.draft.startingGold}</b></span><span>敌军补给 <b>${m.enemyGoldBonus||m.enemyIncomeBonus?'+'+(m.enemyGoldBonus??0)+'金币 / +'+(m.enemyIncomeBonus??0)+'收入':'对称'}</b></span></div><p class="small muted">可用兵种：${m.allowedUnits.map(id=>UNIT_BY_ID[id].name).join('、')}</p><div class="modal-actions">${T.btn('close-modal','返回')}${T.btn('launch-mission','升起军旗','primary','flag')}</div>`);
 }
 private inspect(id:string){if(!UNIT_BY_ID[id])return;this.inspected=id;const el=this.screen.querySelector('#unit-inspector');if(el)el.innerHTML=T.inspector(id,!!this.state&&id!==this.state.teams[this.state.config.playerSide].selected);}
 private updateHud(){
  const s=this.state;if(!s)return;
  const text=(id:string,value:string)=>{const el=this.screen.querySelector('#'+id);if(el&&el.textContent!==value)el.textContent=value;};
  for(const side of [0,1] as Side[]){const t=s.teams[side];text('gold-'+side,String(Math.floor(t.gold)));text('income-'+side,String(Math.floor(t.income)));text('supply-'+side,`${t.supplyUsed}/${s.config.supply}`);text('base-hp-'+side,`${Math.max(0,Math.ceil(t.baseHp))} / ${s.config.baseHp}`);
   const bar=this.screen.querySelector<HTMLElement>('#base-bar-'+side);if(bar)bar.style.width=`${Math.max(0,t.baseHp/s.config.baseHp*100)}%`;
   const p=previewWave(s,side);text('wave-preview-'+side,`预计 ${p.count} 名 / 收入 +${Math.round(p.income)}`);
  }
  text('countdown',String(Math.ceil(s.countdown)).padStart(2,'0'));text('round',s.round>=(s.config.maxRounds??80)?'最后一波':`第 ${s.round+1} 波`);text('wave-label',s.round>=(s.config.maxRounds??80)?'最终交战':'征募倒计时');text('elapsed',timeText(s.time));
  this.screen.querySelectorAll<HTMLElement>('[data-unit]').forEach(el=>{const side=Number(el.dataset.side) as Side;const selected=s.teams[side].selected===el.dataset.unit;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));const u=UNIT_BY_ID[el.dataset.unit!];el.classList.toggle('unaffordable',s.teams[side].gold+s.teams[side].income<u.cost);el.classList.toggle('cursor',side===1&&s.config.mode==='local'&&UNITS[this.localCursor].id===el.dataset.unit);});
  this.screen.querySelectorAll<HTMLElement>('[data-action="speed"] span').forEach(el=>el.textContent=`×${this.save.settings.speed}`);
  const own=s.teams[s.config.playerSide];const selected=UNIT_BY_ID[own.selected];
  let msg=`已选 ${selected.name} · 金币与人口允许时，将于下一波批量招募。`;
  if(own.supplyUsed+selected.supply>s.config.supply)msg='人口已满：现有士兵阵亡后释放人口。可切换低人口兵种。';
  else if(own.gold+own.income<selected.cost)msg='下波资源不足，金币会结转。可选择低费用单位建立收入。';
  else if(own.income>=600)msg='收入已达上限：把经济优势转化为战场优势。';
  if(own.baseHp<s.config.baseHp*.3)msg='要塞危急！优先反制眼前敌军，守住最后一道防线。';
  if(s.round>=(s.config.maxRounds??80))msg='最后一波已出发。倒计时结束后，将按要塞剩余生命判定胜负。';
  text('battle-message',msg);
 }
 private frame(now:number){
  const dt=this.last?Math.min(.2,(now-this.last)/1000):0;this.last=now;this.uiClock+=dt;
  if(!this.paused)this.visualClock+=dt;
  if(this.state&&!this.paused&&this.state.winner===null){
   this.accumulator+=dt*this.save.settings.speed;
   while(this.accumulator>=1/30&&this.state.winner===null){this.renderer.captureBeforeStep(this.state);stepBattle(this.state,1/30);this.renderer.consume(this.state.events);this.sounds();this.accumulator-=1/30;}
   const sec=Math.ceil(this.state.countdown);if(sec!==this.countedSecond){this.countedSecond=sec;if(sec>0&&sec<=3)this.audio.play('countdown');}
   if(this.state.winner!==null)this.finish();
   else this.updateBattleAudio(dt);
  }
  this.renderer.render(this.state,this.state?.config.biome??(this.page==='campaign'?'ruins':this.page==='challenges'?'wastes':this.draft.biome),this.visualClock,this.paused||(this.state!==null&&this.state.winner!==null)?null:this.accumulator/(1/30));
  this.audio.update(dt);
  this.fpsWindow.push(dt>0?dt:1/60);if(this.fpsWindow.length>90)this.fpsWindow.shift();
  if(this.uiClock>.1){this.uiClock=0;this.updateHud();const fps=this.screen.querySelector('#fps-label');if(fps)fps.textContent=`${Math.round(this.fpsWindow.length/this.fpsWindow.reduce((a,b)=>a+b,0))} FPS · ${this.state?.units.filter(u=>u.hp>0).length??0} 单位 · 30Hz` ;}
  this.frameHandle=requestAnimationFrame(t=>this.frame(t));
 }
 private updateBattleAudio(dt:number){
  const s=this.state!;if(s.round===0){this.audio.setScene('prepare');return;}
  const targets=new Map(s.units.map(u=>[u.id,u]));
  // Attack actions only last one fixed tick; measure actual firing/contact range instead.
  const fighting=s.units.filter(u=>{const target=targets.get(u.target??-1);return u.hp>0&&target&&target.hp>0&&target.side!==u.side&&Math.hypot(u.x-target.x,u.y-target.y)<=UNIT_BY_ID[u.type].range+24;}).length;
  const danger=s.teams.some(t=>t.baseHp<s.config.baseHp*.3);
  const high=this.intensity.update(dt,fighting,danger);
  this.audio.setScene(high?'climax':'battle');
  this.footstepClock+=dt;this.warningClock+=dt;
  if(this.footstepClock>.38){this.footstepClock=0;const walker=s.units.find(u=>u.hp>0&&u.action==='walk');if(walker)this.audio.play('step',.2,walker.x/640-1);}
  if(danger&&this.warningClock>10){this.warningClock=0;this.audio.play('warning');}
 }
 private sounds(){if(!this.state)return;for(const e of this.state.events){const role=UNIT_BY_ID[e.type??'']?.role;const name=e.kind==='wave'?'coin':e.kind==='spawn'?'spawn':e.kind==='base'?'base':e.kind==='heal'?'heal':e.kind==='shot'?(role==='archer'?'bow':role==='crossbow'||role==='siege'?'crossbow':role==='firemage'?'fire':'magic'):e.kind==='hit'?(role==='pike'?'pike':role==='brute'?'axe':role==='shield'||role==='guardian'?'shield':'sword'):null;if(name)this.audio.play(name,1,e.x/640-1);}}
 private pause(){if(!this.state||this.state.winner!==null)return;if(this.modalName==='pause'){this.closeModal();return;}this.openModal('pause',`<div class="eyebrow">THE BATTLE AWAITS YOUR COMMAND</div><h2>战旗暂歇</h2><p>前线已暂停。你的下一项决定，将改变战局。</p><div class="pause-actions">${T.btn('resume','继续战斗','primary','play')}${T.btn('settings','指挥设置','','gear')}${T.btn('codex','兵种速览','','book')}${T.btn('restart','重新开战','','swords')}${T.btn('home','返回主菜单','quiet','back')}</div>`);}
 private confirmLeave(){this.openModal('leave',`<h2>撤离当前战场？</h2><p>本场战斗不会保存，战役已取得的胜利不受影响。</p><div class="modal-actions">${T.btn('close-modal','继续战斗')}${T.btn('leave','确认撤离','danger')}</div>`);}
 private openModal(name:string,html:string){
  if(!this.modalName){this.modalPause=this.paused;this.focusReturn=document.activeElement as HTMLElement;}
  this.modalName=name;this.paused=!!this.state;
  const dismiss=name!=='result';
  this.modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${name==='settings'?'settings-modal':''} ${name==='result'?'result-modal':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${dismiss?`<button class="modal-close" data-action="close-modal" aria-label="关闭">${icon('close')}</button>`:''}${html}</section></div>`;
  const title=this.modalRoot.querySelector('h2');if(title)title.id='dialog-title';
  const first=this.modalRoot.querySelector<HTMLElement>('button,input,select');first?.focus({preventScroll:true});
 }
 private closeModal(resume=true){if(!this.modalName)return;if(resume&&this.modalName==='briefing'&&this.state&&this.state.winner!==null&&this.lastResultHtml){this.openModal('result',this.lastResultHtml);return;}this.modalRoot.innerHTML='';this.modalName='';if(resume)this.paused=this.modalPause;this.focusReturn?.focus({preventScroll:true});this.focusReturn=null;}
 private settings(){const s=this.save.settings;
  this.openModal('settings',`<div class="eyebrow">COMMAND PREFERENCES</div><h2>指挥设置</h2><p>音乐、战场与环境，彼此独立的声音层次。</p><div class="settings-sliders">${[['music','交响配乐'],['effects','战斗与界面'],['ambience','战场环境']].map(([id,label])=>`<label>${label}<output id="out-${id}">${Math.round(s[id as 'music']*100)}%</output><input type="range" min="0" max="1" step="0.01" value="${s[id as 'music']}" data-setting="${id}" aria-label="${label}" /></label>`).join('')}</div><label class="switch"><input type="checkbox" data-setting="muted" ${s.muted?'checked':''}/>全部静音 <kbd>M</kbd></label><label class="switch"><input type="checkbox" data-setting="healthBars" ${s.healthBars?'checked':''}/>显示受伤单位血条</label><label class="switch"><input type="checkbox" data-setting="reducedMotion" ${s.reducedMotion?'checked':''}/>减少动态效果与屏幕震动</label><div class="settings-save"><span>进度保存在本机浏览器中</span><div>${T.btn('export','导出进度','quiet')}${T.btn('import','导入进度','quiet')}<input id="import-file" type="file" accept="application/json" hidden /></div></div><div class="modal-actions">${T.btn('reset-progress','重置战役','quiet')}${T.btn('close-modal','返回','primary')}</div>`);
 }
 private input(e:Event){const el=e.target as HTMLInputElement;const key=el.dataset.setting;if(key&&['music','effects','ambience'].includes(key)){this.save.settings[key as 'music']=Number(el.value);this.applySettings();const out=this.modalRoot.querySelector('#out-'+key);if(out)out.textContent=Math.round(Number(el.value)*100)+'%';this.persist();}}
 private async change(e:Event){const el=e.target as HTMLInputElement;const key=el.dataset.setting;if(key&&['muted','healthBars','reducedMotion'].includes(key)){this.save.settings[key as 'muted']=el.checked;this.applySettings();this.persist();this.updateMuteButton();}if(el.id==='import-file'&&el.files?.[0]){try{if(el.files[0].size>150000)throw new Error();const data=JSON.parse(await el.files[0].text());if(data.version!==1||!Array.isArray(data.completed)||!data.settings)throw new Error();const previous=this.save;try{localStorage.setItem('ember-dawn-save-v1',JSON.stringify(data));this.save=loadSave();this.persist();this.applySettings();this.closeModal();if(!this.state)this.navigate(this.page);this.toast('进度已导入。');}catch{this.save=previous;throw new Error();}}catch{this.toast('无法导入：请选择有效的本作 JSON 存档。');}}}
 private tutorial(){
  const steps=[
   ['统帅，而非士兵','埃瑟兰因星火之心的破裂陷入战争。你将统领苍曜同盟或赤烬军团。士兵自动行军、交战；你的任务是选择每波出战的兵种。','flag'],
   ['以征募铸造经济','倒计时归零：先领取当前收入，再按所选兵种、金币和剩余人口批量征募。每位新兵会永久提高后续每波收入。低阶单位经济回报更高。','coin'],
   ['没有万能的军团','盾卫抵挡弓箭，战斧与弩手破重甲，长枪阻拦骑兵。先出前排、下一波再补后排，可以组成混编阵线。别忘了观察敌军。','swords'],
   ['守住最后一道防线','单位死亡会释放人口，已有士兵不会在新波消失。收入上限600、人口通常80。敌军逼近时，可能需要放弃发育，立即反制。','crest'],
   ['向黎明进军','摧毁敌方要塞即可获胜。空格暂停思考，+/-加速。点击兵种或使用1–8、Q–I。现在以5种基础部队对抗只有民兵与斥候的新手先锋，或直接关闭指南。','crown']
  ];const [title,body,ico]=steps[this.tutorialStep];
  this.openModal('tutorial',`<div class="tutorial-symbol">${icon(ico)}</div><div class="eyebrow">COMMANDER'S ACADEMY · ${this.tutorialStep+1} / 5</div><h2>${title}</h2><p class="tutorial-copy">${body}</p><div class="tutorial-dots">${steps.map((_,i)=>`<i class="${i===this.tutorialStep?'active':''}"></i>`).join('')}</div><div class="modal-actions">${T.btn('tutorial-skip','跳过 / 关闭','quiet')}${T.btn('tutorial-next',this.tutorialStep===4?(this.state?'返回战场':'开始练习'):'下一页','primary','arrow')}</div>`);
 }
 private finish(){
  const s=this.state;if(!s||this.resultRecorded)return;this.resultRecorded=true;
  const local=s.config.mode==='local';const result=s.winner==='draw'?'draw':local||s.winner===s.config.playerSide?'win':'loss';const own=s.teams[local&&s.winner!=='draw'&&s.winner!==null?s.winner:s.config.playerSide];
  if(result==='win'&&s.config.mode==='campaign'&&s.config.missionId&&!this.save.completed.includes(s.config.missionId))this.save.completed.push(s.config.missionId);
  this.save.records.push({date:new Date().toISOString(),mode:s.config.mode,result,seconds:Math.floor(s.time),rounds:s.round,kills:own.kills,recruited:own.recruited});this.save.records=this.save.records.slice(-50);this.persist();
  this.audio.setScene(result==='loss'?'defeat':'victory');this.audio.play(result==='loss'?'defeat':'victory');this.audio.play('collapse');
  const title=s.winner==='draw'?'战旗并立':local?(s.winner===0?'苍曜同盟胜利':'赤烬军团胜利'):result==='win'?'黎明属于你':'余烬尚未熄灭';
  const subtitle=result==='draw'?'STALEMATE':result==='win'?'VICTORY':'DEFEAT';
  const next=result==='win'&&s.config.mode==='campaign'&&s.config.missionId!=='c10';
  this.lastResultHtml=`<div class="result-crest ${result}">${icon(result==='loss'?'flag':'trophy')}</div><div class="eyebrow">${subtitle}</div><h2>${title}</h2><p>${s.winner==='draw'?(s.teams.every(t=>t.baseHp>0)?'战争时限已至，双方要塞仍旗鼓相当。':'两方要塞同时陷落，胜负留待下一次交锋。'):s.round>=(s.config.maxRounds??80)&&s.teams.every(t=>t.baseHp>0)?'战争时限已至，以要塞剩余生命判定胜负。':result==='win'?'敌方要塞陷落，你的军旗在破晓之中飘扬。':'防线已被突破。重整军团，下一次的抉择将会不同。'}</p><div class="result-stats"><span>战斗时长<b>${timeText(s.time)}</b></span><span>征募波次<b>${s.round}</b></span><span>歼敌数量<b>${own.kills}</b></span><span>征募总数<b>${own.recruited}</b></span><span>经济投入<b>${Math.floor(own.spent)}</b></span><span>最终收入<b>${Math.floor(own.income)}</b></span></div><div class="modal-actions">${T.btn('leave','返回主菜单')}${T.btn('restart','再次交锋',next?'':'primary','swords')}${next?T.btn('next-mission','下一章','primary','arrow'):''}</div>`;this.openModal('result',this.lastResultHtml);
 }
 private records(){this.openModal('records',`<div class="eyebrow">CHRONICLES OF WAR</div><h2>军团战史</h2><div class="record-list">${this.save.records.length?this.save.records.slice().reverse().slice(0,12).map(r=>`<div><span class="${r.result==='win'?'gold':'muted'}">${r.result==='win'?'胜利':r.result==='draw'?'平局':'战败'}</span><span>${new Date(r.date).toLocaleDateString('zh-CN')}</span><span>${timeText(r.seconds)} / ${r.rounds} 波</span><span>歼敌 ${r.kills}</span></div>`).join(''):'<p>历史尚未书写。第一场战争等待你的军团。</p>'}</div>`);}
 private credits(){this.openModal('credits',`<div class="eyebrow">CRAFTED FOR THE BROWSER</div><h2>烬辉战纪</h2><p>Chronicles of Ember and Dawn</p><p>一款受经典《米拉奇战记》启发的原创自动战争策略游戏。世界观、兵种设计、像素图集、场景与界面为本项目原创。</p><p class="small muted">交响配乐：以下作品均为 CC0 1.0，作者与原始授权记录见 docs/ASSET_LICENSES_AUDIO.md。武器与环境音效由本地 Web Audio 系统产生。</p><div class="music-credits">${MUSIC_CREDITS.map(c=>`<p class="small"><a href="${c.source}" target="_blank" rel="noopener noreferrer">${c.title}</a><br><span class="muted">${c.author} · CC0 1.0</span></p>`).join('')}</div><p class="small muted">技术：TypeScript / Canvas 2D / Web Audio / Vite。无需账号、无在线API、无付费养成。完整授权与测试记录随项目提供。</p>`);}
 private cycleSpeed(direction=1){const speeds=[1,1.5,2,3];const i=speeds.indexOf(this.save.settings.speed);this.save.settings.speed=speeds[(i+direction+speeds.length)%speeds.length];this.persist();this.updateHud();this.toast(`战斗速度 ×${this.save.settings.speed}`);}
 private updateMuteButton(){this.screen.querySelectorAll<HTMLButtonElement>('[data-action="mute"]').forEach(b=>{b.innerHTML=icon(this.save.settings.muted?'mute':'volume');b.setAttribute('aria-label',this.save.settings.muted?'取消静音':'全部静音');b.title=this.save.settings.muted?'取消静音 (M)':'静音 (M)';});}
 private async fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{this.toast('当前浏览器不允许全屏，可使用 F11。');}}
 private key(e:KeyboardEvent){
  const tag=(e.target as HTMLElement).tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;
  if(e.key==='Tab'&&this.modalName){const nodes=Array.from(this.modalRoot.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([hidden]),select,a[href]'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(e.key==='Escape'){e.preventDefault();if(this.modalName&&this.modalName!=='result')this.closeModal();else if(this.state&&this.state.winner===null)this.pause();return;}
  if(e.code==='Space'&&this.state&&(!this.modalName||this.modalName==='pause')){e.preventDefault();if(!e.repeat)this.pause();return;}
  const k=e.key.toUpperCase();
  if(k==='B'&&this.state&&this.state.winner===null&&(!this.modalName||this.modalName==='pause'||this.modalName==='field-codex')){e.preventDefault();if(!e.repeat)this.showUnitDetail(this.inspected);return;}
  if(this.modalName)return;
  if(k==='M'){e.preventDefault();this.save.settings.muted=!this.save.settings.muted;this.applySettings();this.persist();this.updateMuteButton();return;}
  if(k==='F'){e.preventDefault();void this.fullscreen();return;}
  if(!this.state||this.state.winner!==null)return;
  if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();if(!e.repeat)this.cycleSpeed(e.key==='-'?-1:1);return;}
  if(this.state.config.mode==='local'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key)){
   e.preventDefault();if(e.key==='Enter'){const u=UNITS[this.localCursor];if(selectUnit(this.state,1,u.id))this.audio.play('select');}else{const delta=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-8:8;this.localCursor=(this.localCursor+delta+16)%16;}this.updateHud();return;
  }
  const idx=T.HOTKEYS.indexOf(k);if(idx>=0){e.preventDefault();const side=this.state.config.mode==='local'?0:this.state.config.playerSide;const u=UNITS[idx];if(selectUnit(this.state,side,u.id)){this.inspect(u.id);this.audio.play('select');this.updateHud();}}
 }
 public toast(text:string){this.toastEl.textContent=text;this.toastEl.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toastEl.classList.remove('visible'),4000);}
 public advance(seconds:number){if(!import.meta.env.DEV||!this.state)return;for(let i=0;i<seconds*30&&this.state.winner===null;i++){this.renderer.captureBeforeStep(this.state);stepBattle(this.state,1/30);this.renderer.consume(this.state.events);}this.renderer.render(this.state,this.state.config.biome,this.visualClock,1);this.updateHud();if(this.state.winner!==null)this.finish();}
 public dispose(){cancelAnimationFrame(this.frameHandle);this.audio.dispose();}
}
