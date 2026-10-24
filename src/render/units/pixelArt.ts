import type { Fighter, Side } from '../../core/types';

export interface ArmyPalette {
 outline:string;dark:string;cloth:string;light:string;gold:string;
 metal:string;shine:string;steelShadow:string;skin:string;leather:string;wood:string;
}
export const ARMY_PALETTES:readonly ArmyPalette[]=[
 {outline:'#101b25',dark:'#182a3b',cloth:'#315c89',light:'#709dbd',gold:'#cfb778',metal:'#8b9da9',shine:'#d5dce0',steelShadow:'#455b6b',skin:'#c7ad8e',leather:'#665541',wood:'#9d825c'},
 {outline:'#20171f',dark:'#321e24',cloth:'#8b3e43',light:'#c77968',gold:'#bd9160',metal:'#807e86',shine:'#c4c0bd',steelShadow:'#51464e',skin:'#c4a189',leather:'#6b4d3d',wood:'#a28358'}
];
/** Shared tools/palette only: each unit supplies its own anatomy and silhouette.
 * 48x48 source pixels, feet near y=42, facing right, upper-left key light.
 * Keep meaningful pixels inside 0..47, including all four attack poses.
 */
export interface UnitArt {
 id:string;side:Side;action:Fighter['action'];f:number;
 walk:boolean;attack:boolean;ctx:CanvasRenderingContext2D;p:ArmyPalette;
 r:(x:number,y:number,w:number,h:number,color:string)=>void;
 poly:(points:number[],color:string)=>void;
 line:(points:number[],color:string,width?:number)=>void;
}
export function unitArtist(ctx:CanvasRenderingContext2D,id:string,side:Side,action:Fighter['action'],frame:number):UnitArt {
 const r:UnitArt['r']=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 // Rasterise at source resolution: Canvas diagonal paths otherwise introduce
 // semi-transparent edge colours even with imageSmoothingEnabled=false.
 const poly:UnitArt['poly']=(pts,color)=>{
  ctx.fillStyle=color;const ys=pts.filter((_,i)=>i%2===1);
  for(let y=Math.floor(Math.min(...ys));y<Math.ceil(Math.max(...ys));y++){
   const intersections:number[]=[];const scan=y+.5;
   for(let i=0,j=pts.length-2;i<pts.length;j=i,i+=2){
    const ax=pts[j],ay=pts[j+1],bx=pts[i],by=pts[i+1];
    if((ay<=scan&&by>scan)||(by<=scan&&ay>scan))intersections.push(ax+(scan-ay)*(bx-ax)/(by-ay));
   }
   intersections.sort((a,b)=>a-b);
   for(let i=0;i+1<intersections.length;i+=2){const left=Math.ceil(intersections[i]-.5),right=Math.ceil(intersections[i+1]-.5);if(right>left)ctx.fillRect(left,y,right-left,1);}
  }
 };
 const line:UnitArt['line']=(pts,color,width=1)=>{
  ctx.fillStyle=color;const size=Math.max(1,Math.round(width)),offset=Math.floor(size/2);
  for(let i=0;i+3<pts.length;i+=2){
   let x=Math.round(pts[i]),y=Math.round(pts[i+1]);const endX=Math.round(pts[i+2]),endY=Math.round(pts[i+3]);
   const dx=Math.abs(endX-x),dy=-Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;let error=dx+dy;
   for(;;){ctx.fillRect(x-offset,y-offset,size,size);if(x===endX&&y===endY)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
  }
 };
 return {ctx,id,side,action,f:((frame%4)+4)%4,walk:action==='walk',attack:action==='attack',p:ARMY_PALETTES[side],r,poly,line};
}
