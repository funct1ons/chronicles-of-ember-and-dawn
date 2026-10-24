import {describe,it,expect} from 'vitest';
import {beatLength,collectPercussion,createPulseCursor,percussionPattern} from './percussion';
const BPM=84;
const BEAT=beatLength(BPM);
describe('climax percussion pattern',()=>{
 it('marks a sparse marching figure instead of a second melody',()=>{
  const pattern=Array.from({length:8},(_,i)=>percussionPattern(i));
  expect(pattern).toEqual(['timpani',null,'snare',null,'timpaniSoft',null,'snare','snareGhost']);
  expect(percussionPattern(8)).toBe('timpani');
  expect(percussionPattern(-1)).toBe('snareGhost');
 });
 it('uses a stable tempo derived from the requested bpm',()=>{
  expect(BEAT).toBeCloseTo(60/BPM,6);
  expect(beatLength(0)).toBe(60/84);
 });
});
describe('playhead-synchronised scheduling',()=>{
 it('only schedules hits inside the look-ahead window',()=>{
  let cursor=createPulseCursor();
  const first=collectPercussion({cursor,trackTime:0,bpm:BPM,lookahead:.3});
  expect(first.hits.map(h=>h.beat)).toEqual([0]);
  expect(first.hits[0].delay).toBeCloseTo(0,6);
  cursor=first.cursor;
  const second=collectPercussion({cursor,trackTime:0,bpm:BPM,lookahead:.3});
  expect(second.hits).toEqual([]);
  // one beat later the next accent becomes due
  const later=collectPercussion({cursor,trackTime:BEAT,bpm:BPM,lookahead:.3});
  expect(later.hits.every(h=>h.delay>=0&&h.delay<=.3)).toBe(true);
 });
 it('never repeats or skips a beat while time advances normally',()=>{
  let cursor=createPulseCursor();
  const seen:number[]=[];
  for(let t=0;t<20;t+=1/60){
   const step=collectPercussion({cursor,trackTime:t,bpm:BPM,lookahead:.3});
   cursor=step.cursor;
   for(const hit of step.hits) seen.push(hit.beat);
  }
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.length).toBeGreaterThan(15);
  expect(seen).toEqual([...seen].sort((a,b)=>a-b));
 });
 it('re-syncs instead of firing a burst when the recording loops',()=>{
  let cursor=createPulseCursor();
  const long=collectPercussion({cursor,trackTime:145,bpm:BPM,lookahead:.3});
  cursor=long.cursor;
  expect(cursor.nextBeat).toBeGreaterThan(180);
  const wrapped=collectPercussion({cursor,trackTime:.15,bpm:BPM,lookahead:.3});
  expect(wrapped.resynced).toBe(true);
  expect(wrapped.hits.length).toBeLessThanOrEqual(2);
  expect(wrapped.hits.every(h=>h.beat<10)).toBe(true);
 });
 it('drops catch-up bursts after a stalled frame',()=>{
  let cursor=createPulseCursor();
  const before=collectPercussion({cursor,trackTime:0,bpm:BPM,lookahead:.3});
  cursor=before.cursor;
  const stalled=collectPercussion({cursor,trackTime:30,bpm:BPM,lookahead:.3});
  expect(stalled.resynced).toBe(true);
  expect(stalled.hits.length).toBeLessThanOrEqual(1);
  expect(stalled.hits[0]?.beat ?? 0).toBeGreaterThan(30);
 });
 it('ignores invalid playheads',()=>{
  const cursor=createPulseCursor();
  expect(collectPercussion({cursor,trackTime:Number.NaN,bpm:BPM,lookahead:.3}).hits).toEqual([]);
  expect(collectPercussion({cursor,trackTime:-4,bpm:BPM,lookahead:.3}).hits).toEqual([]);
 });
});
