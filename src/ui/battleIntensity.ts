/** Listening-time hysteresis: independent of x1/x3 simulation speed. */
export class BattleIntensity {
 private clock=0;
 private lastSwitch=0;
 private highFor=0;
 private lowFor=0;
 private high=false;
 reset():void {this.clock=0;this.lastSwitch=0;this.highFor=0;this.lowFor=0;this.high=false;}
 update(dt:number,fighting:number,danger:boolean):boolean {
  const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(dt,.25)):0;
  this.clock+=elapsed;
  this.highFor=danger||fighting>=24?this.highFor+elapsed:0;
  this.lowFor=!danger&&fighting<=12?this.lowFor+elapsed:0;
  if(this.clock-this.lastSwitch>=45){
   const next=this.high?this.lowFor<6:this.highFor>=3;
   if(next!==this.high){this.high=next;this.lastSwitch=this.clock;}
  }
  return this.high;
 }
}
