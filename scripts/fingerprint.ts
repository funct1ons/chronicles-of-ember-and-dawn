import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
export async function sourceFingerprint(){
 const files:Record<string,string>={};const sum=createHash('sha256');
 for(const path of ['src/core/simulation.ts','src/core/math.ts','src/core/combat.ts','src/core/ai.ts','src/core/tactics.ts','src/data/units.ts','src/data/missions.ts']){const bytes=await readFile(path);files[path]=createHash('sha256').update(bytes).digest('hex');sum.update(path).update(bytes);}
 return{sha256:sum.digest('hex'),files};
}
