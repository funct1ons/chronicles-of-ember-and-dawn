import{readdir,copyFile,mkdir}from'node:fs/promises';
const names={'01-main-menu.png':'main-menu.png','02-snow-battle.png':'snow-battle.png','03-victory.png':'victory.png','04-campaign.png':'campaign.png','05-1024-layout.png':'desktop-1024.png','06-150-unit-stress.png':'stress-150.png','07-unit-codex.png':'unit-codex.png','environment-wastes.png':'wastes-battle.png','environment-ruins.png':'ruins-battle.png','10-natural-combat.png':'natural-combat.png','11-natural-victory.png':'natural-victory.png'};
await mkdir('docs/screenshots',{recursive:true});
async function collect(path){for(const entry of await readdir(path,{withFileTypes:true})){const p=path+'/'+entry.name;if(entry.isDirectory())await collect(p);else if(names[entry.name]){await copyFile(p,'docs/screenshots/'+names[entry.name]);console.log(names[entry.name]);}}}
await collect('test-results');
