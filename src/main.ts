import './style.css';
import './ui/home.css';
import { App } from './ui/App';
const app=new App(document.querySelector<HTMLElement>('#app')!);
if(import.meta.env.DEV){
 (window as unknown as {__EMBER__:unknown}).__EMBER__={state:()=>app.state,launch:app.launch.bind(app),advance:app.advance.bind(app),renderer:app.renderer,audio:app.audio};
}else if('serviceWorker' in navigator){
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(reg=>{
   if(reg.active) return;
   const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='activated')app.toast('所有战场资源已备妥，可离线游玩。');});
  }).catch(()=>app.toast('离线缓存暂不可用；仍可正常游玩，本地可使用 npm run dev。'));
 });
}
