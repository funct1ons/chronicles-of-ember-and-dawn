import {UNIT_BY_ID} from '../data/units';
import type {Side,Fighter,Role} from '../core/types';
import {unitArtist} from './units/pixelArt';
import {drawInfantry} from './units/infantry';
import {drawMobile} from './units/mobile';
import {drawCasters} from './units/casters';

const cache=new Map<string,HTMLCanvasElement>();
/** Original 48x48 source art. Families share materials, never a generic body.
 * Cache canonical four-frame keys so repeated animation cycles do not allocate.
 */
export function sprite(id:string,side:Side,action:Fighter['action']='idle',frame=0):HTMLCanvasElement {
 if(!Object.hasOwn(UNIT_BY_ID,id))throw new Error(`Unknown unit art: ${id}`);
 const f=Number.isFinite(frame)?((Math.floor(frame)%4)+4)%4:0;
 const key=`${id}:${side}:${action}:${f}`,cached=cache.get(key);if(cached)return cached;
 const c=document.createElement('canvas');c.width=c.height=48;
 const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 const artist=unitArtist(ctx,id,side,action,f);
 if(!drawInfantry(artist)&&!drawMobile(artist)&&!drawCasters(artist))throw new Error(`Missing unit artist: ${id}`);
 cache.set(key,c);return c;
}

export function paintPortrait(canvas:HTMLCanvasElement,id:string,side:Side=0):void {
 // The former 96x80 crop cut tall headgear at y<6. Keep the entire source cell
 // and contain its square aspect inside existing UI boxes, never crop a crest.
 canvas.width=canvas.height=96;canvas.style.objectFit='contain';
 const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
 const gradient=c.createRadialGradient(48,48,3,48,48,60);gradient.addColorStop(0,side===0?'#314452':'#513639');gradient.addColorStop(1,'#111a20');c.fillStyle=gradient;c.fillRect(0,0,96,96);
 c.fillStyle='#0005';c.beginPath();c.ellipse(48,85,24,5,0,0,Math.PI*2);c.fill();
 c.drawImage(sprite(id,side),0,0,96,96);
}
export function isRanged(role:Role):boolean{return ['archer','crossbow','mage','healer','firemage','siege'].includes(role);}
