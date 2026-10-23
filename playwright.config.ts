import {defineConfig} from '@playwright/test';
import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
// Prefer the installed Playwright browser. A cached nearby Chromium is a network-failure fallback.
let executablePath=process.env.CHROMIUM_PATH;
const cache=join(process.env.LOCALAPPDATA??'','ms-playwright');
if(!executablePath&&existsSync(cache)){
 const dirs=readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
 for(const dir of dirs){const p=join(cache,dir,'chrome-win64','chrome.exe');if(existsSync(p)){executablePath=p;break;}}
}
export default defineConfig({
 testDir:'./tests/e2e',timeout:45000,fullyParallel:false,workers:1,
 use:{baseURL:'http://127.0.0.1:4180',viewport:{width:1440,height:1000},headless:true,launchOptions:executablePath?{executablePath}:undefined,screenshot:'only-on-failure',trace:'retain-on-failure'},
 reporter:[['list'],['html',{open:'never'}]],
 webServer:{command:'npm run dev -- --port 4180 --strictPort',url:'http://127.0.0.1:4180',reuseExistingServer:!process.env.CI,timeout:60000}
});
