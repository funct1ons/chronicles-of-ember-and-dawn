/**
 * Read-only, EVERY-tick motion audit (world pixels, not render pixels).
 * Includes wave arrivals, newly spawned units, death ticks and legal mixed-role
 * contact queues. A >6px step is a lead, NOT proof of a bad correction: inspect
 * the before/after geometry before changing collision or yielding logic.
 * Run: npx tsx scripts/diagnose-jitter.ts [--quick]
 */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { sourceFingerprint } from './fingerprint';
import { createBattle, stepBattle, type WaveDecision } from '../src/core/simulation';
import { chooseAI } from '../src/core/ai';
import { laneCenterY } from '../src/core/math';
import { defaultConfig } from '../src/data/missions';
import { ALL_UNIT_IDS, UNIT_BY_ID } from '../src/data/units';
import type { BattleState, Fighter, Side } from '../src/core/types';

const DT = 1 / 30;
const quick = process.argv.includes('--quick');
const seeds = quick ? [407] : [407, 8093, 12547, 19181];
interface Point { x: number; y: number; action: string; target: number | null }
interface Sample {
  tick: number; time: number; id: number; type: string; side: Side;
  dx: number; dy: number; dist: number; speedBudget: number; wave: boolean;
  spawned: boolean; before: Point; after: Point;
}
const point = (u: Fighter): Point => ({ x: u.x, y: u.y, action: u.action, target: u.target });
const rounded = (n: number) => +n.toFixed(6);
function add(s: BattleState, side: Side, type: string, x: number, y: number) {
  const def = UNIT_BY_ID[type]!;
  s.units.push({ id: s.nextId++, side, type, x, y, hp: def.hp, maxHp: def.hp,
    cooldown: 1e6, action: 'idle', actionTime: 0, target: null, born: 0, charge: false });
  s.teams[side].supplyUsed += def.supply;
}
function audit(name: string, s: BattleState, seconds: number, hook?: WaveDecision) {
  let ticks = 0, samples = 0, moving = 0, waveSamples = 0, spawnSamples = 0;
  let deathSamples = 0, anomalyCount = 0, overSpeedBudget = 0, waveTicks = 0;
  let lastWave = -Infinity;
  const worst: Sample[] = [];
  const worstExisting: Sample[] = [];
  let existingMax = 0, existingAnomalyCount = 0;
  // Millipixel histogram avoids storing/sorting millions of individual steps.
  const histogram = new Map<number, number>();
  let stepMax = 0, waveMax = 0, spawnMax = 0, deathMax = 0;
  while (s.winner === null && s.time < seconds) {
    const before = new Map(s.units.filter(u => u.hp > 0).map(u => [u.id, point(u)]));
    stepBattle(s, DT, hook);
    ticks++;
    if (s.events.some(e => e.kind === 'wave')) { lastWave = s.time; waveTicks++; }
    const spawnEvents = s.events.filter(e => e.kind === 'spawn');
    const newUnits = s.units.filter(u => !before.has(u.id) && u.born === s.time);
    // Spawn events and fresh units have the same append order, even when several
    // recruits share a position. No nearest-neighbour pairing can hide a jump.
    const spawned = new Map<number, Point>(newUnits.map((u, i) => {
      const event = spawnEvents[i]!;
      return [u.id, { x: event.x, y: event.y, action: 'spawn', target: null }];
    }));
    for (const u of s.units) {
      const fresh = !before.has(u.id) && u.born === s.time;
      // Spawn positions are emitted before updateUnits; do not count recruitment
      // as travel from (0,0), but do audit the new unit's very first real step.
      const start = before.get(u.id) ?? spawned.get(u.id);
      if (!start) continue;
      const dx = u.x - start.x, dy = u.y - start.y, dist = Math.hypot(dx, dy);
      const wave = s.time - lastWave < 0.2;
      const speedBudget = UNIT_BY_ID[u.type]!.speed * Math.hypot(1, 0.9) * DT;
      samples++;
      if (dist > 0.01) {
        moving++;
        const bin = Math.round(dist * 1000);
        histogram.set(bin, (histogram.get(bin) ?? 0) + 1);
      }
      stepMax = Math.max(stepMax, dist);
      if (wave) { waveSamples++; waveMax = Math.max(waveMax, dist); }
      if (fresh) { spawnSamples++; spawnMax = Math.max(spawnMax, dist); }
      if (u.hp <= 0) { deathSamples++; deathMax = Math.max(deathMax, dist); }
      if (dist > 6) anomalyCount++;
      if (!fresh) { existingMax = Math.max(existingMax, dist); if (dist > 6) existingAnomalyCount++; }
      if (dist > speedBudget + 1e-5) overSpeedBudget++;
      for (const top of fresh ? [worst] : [worst, worstExisting]) {
        if (top.length < 3 || dist > top[top.length - 1]!.dist) {
          top.push({ tick: ticks, time: rounded(s.time), id: u.id, type: u.type, side: u.side,
            dx, dy, dist, speedBudget, wave, spawned: fresh, before: start, after: point(u) });
          top.sort((a, b) => b.dist - a.dist);
          top.length = Math.min(top.length, 3);
        }
      }
    }
  }
  const bins = [...histogram].sort((a, b) => a[0] - b[0]);
  function percentile(p: number) {
    const target = Math.floor(Math.max(0, moving - 1) * p);
    let count = 0;
    for (const [bin, n] of bins) { count += n; if (count > target) return bin / 1000; }
    return 0;
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({
    time: s.time, round: s.round, rng: s.rng, teams: s.teams, units: s.units, winner: s.winner,
  })).digest('hex').slice(0, 16);
  return { name, ticks, samples, waveTicks, waveSamples, spawnSamples, deathSamples,
    movingPct: rounded(moving / Math.max(1, samples) * 100), stepMedian: percentile(.5),
    stepP95: percentile(.95), stepP99: percentile(.99), stepMax: rounded(stepMax),
    waveMax: rounded(waveMax), spawnMax: rounded(spawnMax), deathMax: rounded(deathMax),
    anomalyCount, existingMax: rounded(existingMax), existingAnomalyCount, overSpeedBudget, fingerprint,
    worst: worst.map(sample => JSON.parse(JSON.stringify(sample, (_key, value) =>
      typeof value === 'number' ? rounded(value) : value))),
    worstExisting: worstExisting.map(sample => JSON.parse(JSON.stringify(sample, (_key, value) =>
      typeof value === 'number' ? rounded(value) : value))),
  };
}
const results = [];
for (const seed of seeds) {
  const cfg = { ...defaultConfig(), seed, difficulty: 3 as const };
  results.push(audit(`ai-${seed}`, createBattle(cfg), quick ? 90 : 240, chooseAI));
  results.push(audit(`mixed-waves-${seed}`, createBattle({ ...cfg, startingGold: 6000,
    startingIncome: 600, supply: 100, roundDuration: 3 }), quick ? 60 : 120,
    (s, side) => ALL_UNIT_IDS[(s.round - 1 + side * 5) % ALL_UNIT_IDS.length]));
}
for (const side of [0, 1] as const) {
  const s = createBattle({ ...defaultConfig(), seed: 1, ai: false, startingGold: 0, startingIncome: 0 });
  s.countdown = 1e9;
  const x = (value: number) => side === 0 ? value : 1280 - value;
  for (let lane = 0; lane < 8; lane++) {
    add(s, side === 0 ? 1 : 0, 'guardian', x(720), laneCenterY(lane));
    add(s, side, 'bow', x(575), laneCenterY(lane));
    for (let row = 0; row < 2; row++) add(s, side, 'axe', x(500 - row * 15), laneCenterY(lane));
  }
  results.push(audit(`legal-support-queue-${side}`, s, 20));
}
const dense = createBattle({ ...defaultConfig(), seed: 1, ai: false, startingGold: 0, startingIncome: 0 });
dense.countdown = 1e9;
for (let row = 0; row < 4; row++) for (let lane = 0; lane < 8; lane++) {
  add(dense, 0, 'levy', 600 - row * 15, laneCenterY(lane));
  add(dense, 1, 'levy', 650 + row * 15, laneCenterY(lane));
}
results.push(audit('legal-dense-boundary-contacts', dense, 12));
const report = { generated: new Date().toISOString(), source: await sourceFingerprint(), sampling: 'every tick, including spawn/death ticks', dt: DT,
  samples: results.reduce((n, r) => n + r.samples, 0),
  ticks: results.reduce((n, r) => n + r.ticks, 0),
  stepMax: Math.max(...results.map(r => r.stepMax)),
  anomalyCount: results.reduce((n, r) => n + r.anomalyCount, 0), results };
const json=JSON.stringify(report,null,2)+'\n';
const output=process.argv.indexOf('--output');
if(output>=0){if(!process.argv[output+1])throw new Error('--output requires a path');await writeFile(process.argv[output+1],json,'utf8');}
console.log(json);
if(report.anomalyCount>0)throw new Error('Motion audit found >6 world-pixel steps; inspect before/after geometry.');
