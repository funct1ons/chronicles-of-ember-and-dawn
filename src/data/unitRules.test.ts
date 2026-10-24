import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {UNITS} from './units';
const baseline=JSON.parse(readFileSync(new URL('../../tests/fixtures/unit-rules-v1.1.json',import.meta.url),'utf8')) as Record<string,string|number>[];
describe('visual redesign preserves public gameplay rules',()=>{
 it('retains every published unit id, role, armor and numeric attribute in order',()=>{
  expect(UNITS).toHaveLength(baseline.length);
  for(let i=0;i<baseline.length;i++)for(const [field,value] of Object.entries(baseline[i]))expect(UNITS[i][field as keyof typeof UNITS[number]],`${UNITS[i].id}.${field}`).toBe(value);
 });
});
