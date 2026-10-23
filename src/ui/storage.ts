export interface Settings { music:number; effects:number; ambience:number; muted:boolean; reducedMotion:boolean; healthBars:boolean; speed:number; }
export interface RecordEntry {date:string;mode:string;result:'win'|'loss'|'draw';seconds:number;rounds:number;kills:number;recruited:number;}
export interface SaveData {version:1;settings:Settings;completed:string[];records:RecordEntry[];tutorialSeen:boolean;}
export const SAVE_KEY='ember-dawn-save-v1';
export const defaults=():SaveData=>({version:1,settings:{music:.45,effects:.5,ambience:.25,muted:false,reducedMotion:false,healthBars:true,speed:1},completed:[],records:[],tutorialSeen:false});
const clamp=(v:unknown,fall:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fall;
export function loadSave():SaveData{
 const d=defaults();try{
  const raw=JSON.parse(localStorage.getItem(SAVE_KEY)??'null');if(!raw||raw.version!==1)return d;
  const s=raw.settings??{};
  d.settings={music:clamp(s.music,d.settings.music),effects:clamp(s.effects,d.settings.effects),ambience:clamp(s.ambience,d.settings.ambience),muted:s.muted===true,reducedMotion:s.reducedMotion===true,healthBars:s.healthBars!==false,speed:[1,1.5,2,3].includes(s.speed)?s.speed:1};
  d.completed=Array.isArray(raw.completed)?[...new Set<string>(raw.completed.filter((x:unknown)=>typeof x==='string'&&/^c([1-9]|10)$/.test(x)))]:[];
  d.records=Array.isArray(raw.records)?raw.records.filter((r:RecordEntry)=>r&&['win','loss','draw'].includes(r.result)&&Number.isFinite(r.seconds)&&r.seconds>=0&&Number.isFinite(r.kills)&&r.kills>=0&&Number.isFinite(r.rounds)&&r.rounds>=0&&Number.isFinite(r.recruited)&&r.recruited>=0&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))).slice(-50).map((r:RecordEntry)=>({date:new Date(r.date).toISOString(),mode:['classic','campaign','challenge','custom','local'].includes(r.mode)?r.mode:'classic',result:r.result,seconds:Math.floor(r.seconds),rounds:Math.floor(r.rounds),kills:Math.floor(r.kills),recruited:Math.floor(r.recruited)})):[];
  d.tutorialSeen=raw.tutorialSeen===true;
 }catch{/* Unavailable or corrupt local storage never prevents play. */}return d;
}
export function saveData(data:SaveData):boolean{try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));return true;}catch{return false;}}
export function downloadSave(data:SaveData){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ember-dawn-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
