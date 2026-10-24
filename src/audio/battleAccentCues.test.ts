import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {BATTLE_ACCENT_CUES as cues,BATTLE_ACCENT_SOURCE_SHA256} from './battleAccentCues';
import {collectAccentPercussion,createPulseCursor} from './percussion';
describe('recording-aligned climax cues',()=>{
 it('is tied to the exact local CC0 recording and uses sparse ordered onsets',()=>{
  expect(createHash('sha256').update(readFileSync('public/audio/the_final_battle.ogg')).digest('hex')).toBe(BATTLE_ACCENT_SOURCE_SHA256);
  expect(cues).toHaveLength(32);for(let i=1;i<cues.length;i++)expect(cues[i]!-cues[i-1]!).toBeGreaterThanOrEqual(2.4);
 });
 it('schedules each actual cue once, with no invented metronome between cues',()=>{
  let cursor=createPulseCursor();const hits=[];
  for(let time=0;time<145;time+=.02){const row=collectAccentPercussion({cursor,trackTime:time,lookahead:.3,cues});cursor=row.cursor;hits.push(...row.hits);}
  expect(hits.map(h=>h.beat)).toEqual(cues.map((_,i)=>i));
 });
 it('resynchronizes loop wraps, forward seeks and stalls without a catch-up burst',()=>{
  const start=collectAccentPercussion({cursor:createPulseCursor(),trackTime:65.8,lookahead:.3,cues});expect(start.hits.map(h=>h.beat)).toEqual([15]);
  const wrapped=collectAccentPercussion({cursor:start.cursor,trackTime:8.8,lookahead:.3,cues});expect(wrapped.resynced).toBe(true);expect(wrapped.hits.map(h=>h.beat)).toEqual([0]);
  const skipped=collectAccentPercussion({cursor:wrapped.cursor,trackTime:140.9,lookahead:.3,cues});expect(skipped.hits.map(h=>h.beat)).toEqual([31]);
 });
});
