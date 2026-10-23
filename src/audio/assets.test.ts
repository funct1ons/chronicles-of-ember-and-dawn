import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MUSIC_CREDITS} from './AudioManager';
const ledger=readFileSync(new URL('../../docs/ASSET_LICENSES_AUDIO.md',import.meta.url),'utf8');
describe('distributed orchestral assets and provenance',()=>{
 it('ships five distinct locally hosted CC0 recordings',()=>{expect(MUSIC_CREDITS).toHaveLength(5);expect(new Set(MUSIC_CREDITS.map(c=>c.file)).size).toBe(5);for(const c of MUSIC_CREDITS){expect(c.license).toBe('CC0 1.0');expect(c.source).toMatch(/^https:\/\/opengameart\.org\/content\//);}});
 it.each(MUSIC_CREDITS)('$title matches its documented original SHA-256',credit=>{
  const bytes=readFileSync(new URL('../../public/audio/'+credit.file,import.meta.url));
  const line=ledger.split('\n').find(l=>l.startsWith('| `'+credit.file+'`'));
  expect(line).toBeDefined();expect(line).toContain(credit.author);expect(line).toContain(credit.license);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(line?.match(/[a-f0-9]{64}/)?.[0]);
  expect(bytes.length).toBeGreaterThan(100000);expect(bytes.length).toBeLessThan(10000000);
  if(credit.file.endsWith('.ogg'))expect(bytes.subarray(0,4).toString()).toBe('OggS');
  if(credit.file.endsWith('.mp3'))expect(bytes.subarray(0,3).toString()).toBe('ID3');
  if(credit.file.endsWith('.wav')){expect(bytes.subarray(0,4).toString()).toBe('RIFF');expect(bytes.subarray(8,12).toString()).toBe('WAVE');}
 });
});
