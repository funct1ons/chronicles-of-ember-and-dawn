import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {unitArtist,ARMY_PALETTES} from './pixelArt';
function paper(){const pixels=new Set<string>();const calls:number[][]=[];
 const ctx={fillStyle:'',fillRect:(x:number,y:number,w:number,h:number)=>{calls.push([x,y,w,h]);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.add(`${xx},${yy}`);}} as unknown as CanvasRenderingContext2D;
 return {a:unitArtist(ctx,'levy',0,'idle',0),pixels,calls};
}
describe('source-pixel art primitives',()=>{
 it('keeps artist sources valid UTF-8 even when edited from Windows PowerShell',()=>{for(const file of ['pixelArt.ts','infantry.ts','mobile.ts','casters.ts','../sprites.ts','../../data/units.ts']){const bytes=readFileSync(new URL(file,import.meta.url));expect(()=>new TextDecoder('utf-8',{fatal:true}).decode(bytes),file).not.toThrow();}});
 it('rasterises polygons on integer source pixels without Canvas edge antialiasing',()=>{const {a,pixels,calls}=paper();a.poly([2,2,8,2,8,6,2,6],'#fff');expect(pixels.size).toBe(24);expect(pixels.has('2,2')).toBe(true);expect(pixels.has('7,5')).toBe(true);expect(pixels.has('8,5')).toBe(false);expect(calls.flat().every(Number.isInteger)).toBe(true);});
 it('draws connected diagonal and vertical weapon segments including endpoints',()=>{const {a,pixels}=paper();a.line([1,1,5,5,5,8],'#fff');for(let x=1;x<=5;x++)expect(pixels.has(`${x},${x}`)).toBe(true);expect(pixels.has('5,8')).toBe(true);expect(pixels.has('4,7')).toBe(false);});
 it('keeps segment thickness integral and normalises frame indexes',()=>{const {a,calls}=paper();a.line([8,8,8,12],'#fff',2);expect(calls.every(c=>c[2]===2&&c[3]===2)).toBe(true);const c=unitArtist(a.ctx,'mage',1,'walk',-1);expect(c.f).toBe(3);expect(c.walk).toBe(true);expect(c.attack).toBe(false);expect(c.p).toBe(ARMY_PALETTES[1]);expect(c.p.cloth).not.toBe(a.p.cloth);});
});
