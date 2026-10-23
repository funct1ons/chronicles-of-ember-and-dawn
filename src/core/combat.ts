import type {UnitDef} from './types';
export const MIN_DAMAGE=2;
export interface DamageOptions {ranged?:boolean;splash?:boolean;charge?:boolean;}
/** The same effective damage model is used by actual combat and tactical evaluation. */
export function computeDamage(attacker:UnitDef,target:UnitDef,options:DamageOptions={}):number {
 let damage=target.armor==='heavy'?attacker.heavyDamage:attacker.lightDamage;
 if(attacker.role==='pike'&&(target.role==='cavalry'||target.role==='knight'))damage*=2;
 const backline=target.armor==='light'&&(target.range>=120||['mage','firemage','healer'].includes(target.role));
 if(attacker.role==='assassin'&&backline)damage*=1.6;
 if(options.charge)damage*=1.8;
 if(options.splash)damage*=.5;
 const magic=attacker.role==='mage'||attacker.role==='firemage';
 if(!magic){if((options.ranged??attacker.range>=120)&&['shield','guardian'].includes(target.role))damage*=.65;damage-=target.defense;}
 return Math.max(MIN_DAMAGE,Math.round(damage));
}
