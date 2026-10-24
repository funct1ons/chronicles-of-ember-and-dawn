import {describe,it,expect} from 'vitest';
import {home,header} from './templates';
import {defaults} from './storage';
import {MISSIONS} from '../data/missions';

describe('restrained title screen',()=>{
 it('has one game title and one English subtitle, not duplicate story panels',()=>{
  const html=home(defaults());
  expect(html.match(/烬辉战纪/g)).toHaveLength(1);
  expect(html.match(/CHRONICLES OF EMBER AND DAWN/g)).toHaveLength(1);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain('aria-labelledby="cover-title"');
  for(const removed of ['THE SHATTERED KINGDOM AWAITS','THE AGE OF EMBERS','home-lore','hero-note','原创像素战争策略','v1.0'])expect(html).not.toContain(removed);
 });
 it('keeps all modes, utility controls, credits and saved campaign progress',()=>{
  const save=defaults();save.completed=['c1','c2','c3'];const html=home(save);
  for(const action of ['campaign','classic','tutorial','challenges','custom','local','codex','mute','fullscreen','settings','credits'])expect(html).toContain(`data-action="${action}"`);
  expect(html).toContain('战役 <b>3</b>');
  expect(html).toContain(` / ${MISSIONS.length}`);
  expect(save.completed).toEqual(['c1','c2','c3']);
 });
 it('limits the minimal header to the cover, preserving other screens',()=>{
  expect(header(false,true)).toContain('cover-topbar');
  expect(header(false,true)).not.toContain('top-caption');
  expect(header()).not.toContain('cover-topbar');
  expect(header()).toContain('EMBER & DAWN');
  expect(header(true)).toContain('埃瑟兰 · 军团指挥部');
  expect(header(true)).toContain('data-action="tutorial"');
 });
});
