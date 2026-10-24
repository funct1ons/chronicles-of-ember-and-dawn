import{readdir,copyFile,mkdir}from'node:fs/promises';
import{dirname}from'node:path';
const names={'01-main-menu.png':'main-menu.png','02-snow-battle.png':'snow-battle.png','03-victory.png':'victory.png','04-campaign.png':'campaign.png','05-1024-layout.png':'desktop-1024.png','06-150-unit-stress.png':'stress-150.png','07-unit-codex.png':'unit-codex.png','environment-wastes.png':'wastes-battle.png','environment-ruins.png':'ruins-battle.png','10-natural-combat.png':'natural-combat.png','11-natural-victory.png':'natural-victory.png','codex-first-entry.png':'v11/codex-first-entry.png','codex-all-expanded.png':'v11/codex-all-expanded.png','codex-1024.png':'v11/codex-1024.png','battle-codex-detail.png':'v11/battle-codex-detail.png'};
for(const size of ['1024x768','1366x768','1440x1000','1920x1080','800x600','640x480'])names[`cover-${size}.png`]=`cover/cover-${size}.png`;
await mkdir('docs/screenshots',{recursive:true});
async function collect(path){for(const entry of await readdir(path,{withFileTypes:true})){const p=path+'/'+entry.name;if(entry.isDirectory())await collect(p);else if(names[entry.name]){await mkdir(dirname('docs/screenshots/'+names[entry.name]),{recursive:true});await copyFile(p,'docs/screenshots/'+names[entry.name]);console.log(names[entry.name]);}}}
await collect('test-results');
