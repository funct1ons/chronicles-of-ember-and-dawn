import {afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('./units/infantry',()=>({drawInfantry:vi.fn((a:{id:string})=>a.id==='levy')}));
vi.mock('./units/mobile',()=>({drawMobile:vi.fn((a:{id:string})=>a.id==='rider')}));
vi.mock('./units/casters',()=>({drawCasters:vi.fn((a:{id:string})=>a.id==='mage')}));
import {sprite,isRanged,paintPortrait} from './sprites';
import {drawInfantry} from './units/infantry';
import {drawMobile} from './units/mobile';
import {drawCasters} from './units/casters';
afterEach(()=>vi.unstubAllGlobals());
function fakeCanvas(){vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({imageSmoothingEnabled:true})})});}
describe('unit sprite dispatcher and cache',()=>{
 it('reuses four canonical frame keys across repeated animation cycles',()=>{fakeCanvas();const c=sprite('levy',0,'walk',0);expect([c.width,c.height]).toEqual([48,48]);expect(sprite('levy',0,'walk',4)).toBe(c);expect(sprite('levy',0,'walk',-4)).toBe(c);expect(sprite('levy',0,'walk',1)).not.toBe(c);expect(sprite('levy',1,'walk',0)).not.toBe(c);expect(sprite('levy',0,'idle',0)).not.toBe(c);});
 it('dispatches each visual family without a generic-body fallback',()=>{fakeCanvas();sprite('rider',0);sprite('mage',0);expect(drawMobile).toHaveBeenCalledWith(expect.objectContaining({id:'rider'}));expect(drawCasters).toHaveBeenCalledWith(expect.objectContaining({id:'mage'}));expect(drawInfantry).toHaveBeenCalled();expect(()=>sprite('axe',0)).toThrow(/artist|art|画|绘/i);});
 it('rejects unknown unit ids instead of caching an invisible unit',()=>{fakeCanvas();for(const id of ['not-a-unit','toString','constructor','__proto__'])expect(()=>sprite(id,0),id).toThrow(/unit|兵种/i);});
 it('contains the full source cell in portraits instead of cutting tall headgear',()=>{fakeCanvas();const drawImage=vi.fn();const ctx={imageSmoothingEnabled:true,createRadialGradient:()=>({addColorStop:()=>{}}),fillRect:()=>{},beginPath:()=>{},ellipse:()=>{},fill:()=>{},drawImage};const canvas={width:0,height:0,style:{objectFit:''},getContext:()=>ctx} as unknown as HTMLCanvasElement;paintPortrait(canvas,'levy');expect([canvas.width,canvas.height]).toEqual([96,96]);expect(canvas.style.objectFit).toBe('contain');expect(drawImage).toHaveBeenCalledWith(sprite('levy',0),0,0,96,96);expect(ctx.imageSmoothingEnabled).toBe(false);});
 it('keeps ranged combat categorisation independent from visual families',()=>{for(const role of ['archer','crossbow','mage','healer','firemage','siege'] as const)expect(isRanged(role)).toBe(true);for(const role of ['infantry','elite','knight','assassin'] as const)expect(isRanged(role)).toBe(false);});
});
