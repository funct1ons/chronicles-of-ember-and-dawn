import {describe,it,expect} from 'vitest';
import {BattleIntensity} from './battleIntensity';
const advance=(d:BattleIntensity,seconds:number,fighting:number,danger=false)=>{let high=false;for(let i=0;i<Math.round(seconds*10);i++)high=d.update(.1,fighting,danger);return high;};
describe('battle intensity hysteresis',()=>{
 it('holds normal for 45 listening seconds even under constant contact',()=>{const d=new BattleIntensity();expect(advance(d,44,30)).toBe(false);expect(advance(d,1.1,30)).toBe(true);});
 it('requires sustained contact and resets short spikes',()=>{const d=new BattleIntensity();advance(d,46,0);expect(advance(d,2,24)).toBe(false);advance(d,.1,23);expect(advance(d,2.9,24)).toBe(false);expect(advance(d,.2,24)).toBe(true);});
 it('holds climax for 45 seconds and requires 6 seconds of quiet',()=>{const d=new BattleIntensity();advance(d,46,30);expect(advance(d,44,0)).toBe(true);expect(advance(d,1.1,0)).toBe(false);advance(d,46,30);advance(d,45,13);expect(advance(d,5.9,12)).toBe(true);expect(advance(d,.2,12)).toBe(false);});
 it('danger maintains intensity even without soldier contact',()=>{const d=new BattleIntensity();expect(advance(d,46,0,true)).toBe(true);expect(advance(d,60,0,true)).toBe(true);expect(advance(d,6.1,0,false)).toBe(false);});
 it('ignores invalid deltas and resets between matches',()=>{const d=new BattleIntensity();advance(d,46,30);d.reset();expect(d.update(NaN,30,false)).toBe(false);expect(d.update(-1,30,false)).toBe(false);expect(advance(d,3,30)).toBe(false);});
});
