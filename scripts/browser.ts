import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export function browserPath():string|undefined {
 if(process.env.CHROMIUM_PATH)return process.env.CHROMIUM_PATH;
 const cache=join(process.env.LOCALAPPDATA??'','ms-playwright');if(!existsSync(cache))return;
 for(const dir of readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))){const p=join(cache,dir,'chrome-win64','chrome.exe');if(existsSync(p))return p;}
}
