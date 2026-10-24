import { describe, expect, it } from 'vitest';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../core/math';
import { devicePoint, MAX_RENDER_DPR, pixelViewport, spritePixels } from './pixelViewport';

describe('device-pixel viewport',()=>{
 it.each([1,1.25,1.5,2,3])('matches displayed dimensions at DPR=%s with a 2x cap',(dpr)=>{
  const view=pixelViewport(1280,540,dpr);
  expect(view.width).toBe(Math.round(1280*Math.min(MAX_RENDER_DPR,dpr)));
  expect(view.height).toBe(Math.round(540*Math.min(MAX_RENDER_DPR,dpr)));
  expect(view.x).toBe(0);expect(view.y).toBe(0);
 });
 it.each([[640,480],[1280,300],[1920,540],[1023.5,379.25]])('bottom-aligns the world without clipping castles at %sx%s',(width,height)=>{
  const view=pixelViewport(width!,height!,1.25);
  expect(view.x).toBeGreaterThanOrEqual(0);
  expect(view.y+102*view.scale).toBeGreaterThanOrEqual(0);
  expect(view.x+FIELD_WIDTH/2*view.scale).toBeLessThanOrEqual(view.width+1e-8);
  expect(view.y+FIELD_HEIGHT/2*view.scale).toBeLessThanOrEqual(view.height+1e-8);
  expect(view.height-(view.y+270*view.scale)).toBeLessThan(1);
  // scenery castle bounds after the renderer places them at x=37 and x=596.
  for(const [left,right] of [[1,80],[560,639]]){
   expect(view.x+left!*view.scale).toBeGreaterThanOrEqual(0);
   expect(view.x+right!*view.scale).toBeLessThan(view.width);
  }
 });
 it.each([1,1.25,2,3,4,5])('keeps the physical shake <=2 pixels even when capped at DPR=%s',dpr=>{
  const view=pixelViewport(1280,540,dpr);
  expect(view.maxShake*dpr/Math.min(MAX_RENDER_DPR,dpr)).toBeLessThanOrEqual(2);
  expect(Number.isInteger(view.maxShake)).toBe(true);
 });
 it('preserves the original bottom crop of excess sky at the common 1440x400 viewport',()=>{
  const view=pixelViewport(1440,400,1);
  expect(view.scale).toBe(2.25);expect(view.x).toBe(0);expect(view.y).toBe(-208);
  expect(view.y+102*view.scale).toBeGreaterThan(0);
 });
 it('snaps interpolated anchors in backing/device pixels, not the coarse scenery grid',()=>{
  const view=pixelViewport(1280,540,1);
  expect(devicePoint(view,100.6,350.6)).toEqual({x:101,y:351});
  expect(devicePoint(view,101.2,351.2)).toEqual({x:101,y:351});
  // Old round(world/2) then scale(2) could only land on even pixels.
  expect(Math.round(100.6/2)*2).toBe(100);
 });
 it.each([.8,1,1.25,1.5,2,2.5,3,4,5,6])('draws a 48px source at an integer magnification, without rounding size up (scale=%s)',scale=>{
  const art=spritePixels(scale);
  expect(art.size%48).toBe(0);expect(art.size).toBeGreaterThanOrEqual(48);
  if(36*scale>=48)expect(art.size).toBeLessThanOrEqual(36*scale+1e-8);
  expect(Number.isInteger(art.left)).toBe(true);expect(Number.isInteger(art.top)).toBe(true);
 });
 it('does not change simulation geometry',()=>{
  pixelViewport(1920,300,3);
  expect([FIELD_WIDTH,FIELD_HEIGHT]).toEqual([1280,540]);
 });
});
