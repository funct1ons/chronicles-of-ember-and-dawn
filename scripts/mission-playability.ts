import{mkdir,writeFile}from'node:fs/promises';import{runMatch,type Policy}from'./harness';import{MISSIONS,CHALLENGES,missionConfig}from'../src/data/missions';
import{sourceFingerprint}from'./fingerprint';
const source=await sourceFingerprint();
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
const missions=[...MISSIONS,...CHALLENGES].filter(m=>!only||only.includes(m.id));
const recipes:Record<string,string[]>={'combined arms':['shield','bow','pike','crossbow','mage','healer'],'piercing screen':['shield','pike','pike','bow','crossbow'],'arcane column':['shield','mage','bow','healer','guardian'],'greedy transition':['paladin','mage','healer','bow'],'raiding screen':['levy','assassin','bow','runner']};
const rows:(ReturnType<typeof runMatch>&{missionId:string;recipe:string})[]=[];
for(const m of missions)for(const[recipe,units]of Object.entries(m.id==='h1'?{...recipes,'axe and arrows':['axe','bow']}:recipes))for(const seed of [407,811]){
 const ids=units.filter(id=>m.allowedUnits.includes(id));if(!ids.length)continue;
 const policy:Policy=(s,side)=>s.config.growth>0&&s.teams[side].income<(recipe==='greedy transition'?500:220)&&m.allowedUnits.includes('levy')?'levy':ids[s.round%ids.length];
 rows.push({...runMatch(m.id+' / '+recipe,policy,m.difficulty,seed,0,undefined,missionConfig(m,m.id[0]==='h')),missionId:m.id,recipe});
}
await mkdir('docs/metrics',{recursive:true});await writeFile(`docs/metrics/mission-playability${only?'-sample':''}.json`,JSON.stringify({generated:new Date().toISOString(),source,note:'Fixed legal player policies, production AI. Scripted completion evidence only; not human playtesting or guaranteed difficulty calibration.',rows},null,2));
console.table(missions.map(m=>{const r=rows.filter(x=>x.missionId===m.id),wins=r.filter(x=>x.result==='win');return{mission:m.id,matches:r.length,wins:wins.length,draws:r.filter(x=>x.result==='draw').length,bestRecipe:wins[0]?.recipe??'-',fastestWin:wins.length?Math.min(...wins.map(x=>x.seconds)):'-'};}));
