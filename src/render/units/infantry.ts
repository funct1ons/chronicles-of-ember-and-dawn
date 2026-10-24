import type { UnitArt } from './pixelArt';

/* ------------------------------------------------------------------------- *
 * Infantry silhouettes: levy / shield / pike / axe / guardian / paladin.
 *
 * Only the shared tools, palette and pixel grid come from pixelArt.ts. Every
 * unit below owns its own anatomy, height, stance, headgear, shield
 * construction and weapon, so two allies never read as one body with
 * different paint.
 *
 * Canvas rules: 48x48 source pixels, feet near y=42, facing right, upper-left
 * key light, every painted pixel inside 0..47 on idle/walk/attack frames.
 * Only r/poly/line are used (source-pixel raster, alpha is always 255).
 * hurt/dead are left to the renderer's flash + tumble; we only recoil.
 * ------------------------------------------------------------------------- */

/** Dark silhouette plus a coloured core: shared outline for every limb/haft. */
function limb(a: UnitArt, x0: number, y0: number, x1: number, y1: number, w: number, color: string) {
  a.line([x0, y0, x1, y1], a.p.outline, w + 2);
  a.line([x0, y0, x1, y1], color, w);
}
/** Small gauntlet, drawn in front of whatever it grips. */
function fist(a: UnitArt, x: number, y: number, color: string) {
  a.r(x - 1, y - 1, 3, 3, a.p.outline);
  a.r(x - 1, y - 1, 2, 2, color);
}
function along(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  return [Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)];
}
/** Articulated leg: hip -> knee -> ankle, boot sole sitting on `sole`. */
function leg(a: UnitArt, hipX: number, hipY: number, footX: number, sole: number, bend: number,
             thigh: string, shin: string, boot: string, lit: string, tw = 5, sw = 4) {
  const kneeX = Math.round((hipX + footX) / 2) + bend;
  const kneeY = Math.round(hipY + (sole - 3 - hipY) * 0.56);
  a.line([hipX, hipY, kneeX, kneeY], a.p.outline, tw + 2);
  a.line([hipX, hipY, kneeX, kneeY], thigh, tw);
  a.line([kneeX, kneeY, footX, sole - 3], a.p.outline, sw + 2);
  a.line([kneeX, kneeY, footX, sole - 3], shin, sw);
  a.r(footX - 2, sole - 3, 6, 3, a.p.outline);
  a.r(footX - 1, sole - 3, 4, 2, boot);
  a.r(footX - 1, sole - 3, 3, 1, lit);
}
/** Straight blade: dark border, bright steel core, tapered point at (tx,ty). */
function blade(a: UnitArt, hx: number, hy: number, tx: number, ty: number, w: number) {
  const p = a.p;
  const len = Math.hypot(tx - hx, ty - hy) || 1;
  const ux = (tx - hx) / len, uy = (ty - hy) / len;
  a.line([hx, hy, tx, ty], p.outline, w + 2);
  a.line([hx, hy, tx, ty], p.metal, w);
  if (w > 2) a.line([hx, hy, tx, ty], p.shine, 1);
  // tapered point
  a.line([Math.round(tx - ux * 2.6), Math.round(ty - uy * 2.6), tx, ty], p.outline, 5);
  a.line([Math.round(tx - ux * 2.2), Math.round(ty - uy * 2.2), tx, ty], p.metal, 3);
  a.line([Math.round(tx - ux * 1.4), Math.round(ty - uy * 1.4), tx, ty], p.shine, 1);
}
/** Lever/axe haft in wood, with the shared dark border. */
function haft(a: UnitArt, x0: number, y0: number, x1: number, y1: number, w = 1) {
  a.line([x0, y0, x1, y1], a.p.outline, w + 2);
  a.line([x0, y0, x1, y1], a.p.wood, w);
}
/** Slim spear head: socket collar, leaf blade, drawn along the shaft. */
function spearHead(a: UnitArt, bx: number, by: number, tx: number, ty: number) {
  const p = a.p;
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const ux = (tx - bx) / len, uy = (ty - by) / len;
  // collar keeps the head visually seated on the shaft
  const cx = Math.round(tx - ux * 5), cy = Math.round(ty - uy * 5);
  a.line([Math.round(cx + uy * 1.6), Math.round(cy - ux * 1.6),
          Math.round(cx - uy * 1.6), Math.round(cy + ux * 1.6)], p.outline, 3);
  a.line([Math.round(cx + uy * 1.4), Math.round(cy - ux * 1.4),
          Math.round(cx - uy * 1.4), Math.round(cy + ux * 1.4)], p.metal, 1);
  // leaf blade tapering to the point
  a.line([Math.round(tx - ux * 7), Math.round(ty - uy * 7), tx, ty], p.outline, 4);
  a.line([Math.round(tx - ux * 6), Math.round(ty - uy * 6), tx, ty], p.metal, 2);
  a.line([Math.round(tx - ux * 4), Math.round(ty - uy * 4), tx, ty], p.shine, 1);
}

/* ========================================================================= *
 * LEVY - plain militia: soft cap with a hanging back flap, open face, patched
 * cloth gambeson, rope belt, small round plank shield and a short spear.
 * Poor kit is the silhouette: no gold, no plate, no crest.
 * ========================================================================= */
const LEVY_IDLE: number[][] = [[28, 41, 33, 14], [28, 41, 34, 12], [28, 41, 32, 15], [29, 41, 34, 13]];
const LEVY_WALK: number[][] = [[26, 41, 32, 17], [28, 41, 34, 13], [27, 41, 31, 18], [29, 41, 33, 14]];
const LEVY_THRUST: number[][] = [[21, 32, 33, 21], [24, 32, 39, 21], [27, 32, 44, 21], [22, 33, 36, 22]];

function levy(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  let frontX = 26, backX = 18;
  if (walk) { frontX = [28, 25, 19, 23][f]; backX = [17, 21, 29, 24][f]; }
  else if (atk) { frontX = [28, 30, 31, 27][f]; backX = [17, 16, 15, 18][f]; }
  else { frontX = 26 + [0, 1, 0, 2][f]; backX = 18 + [0, -1, 1, 0][f]; }

  // Shield arm sits behind the body, sleeve rolled at the elbow.
  limb(a, 21, 21 + bob, 16, 25 + bob, 4, p.cloth);
  limb(a, 21, 21 + bob, 18, 23 + bob, 3, p.light);
  fist(a, 16, 25 + bob, p.skin);

  // Bare knees and ankle wraps: cheap kit, light build.
  leg(a, 22, 27 + bob, backX, 42, -1, p.dark, '#4f4b40', '#3b3934', '#5c5849', 5, 4);
  leg(a, 25, 27 + bob, frontX, 42, 1, p.cloth, '#4f4b40', '#3b3934', '#5c5849', 5, 4);

  // Gambeson torso, narrow shoulders, no plate.
  a.poly([18, 19 + bob, 27, 18 + bob, 29, 23 + bob, 28, 29 + bob, 18, 30 + bob, 15, 25 + bob], p.outline);
  a.poly([19, 20 + bob, 26, 19 + bob, 27, 23 + bob, 27, 28 + bob, 19, 29 + bob, 16, 25 + bob], p.cloth);
  a.r(19, 21 + bob, 2, 6, p.light);
  a.line([26, 20 + bob, 27, 27 + bob], p.dark);
  a.poly([25, 19 + bob, 29, 21 + bob, 27, 24 + bob, 25, 22 + bob], p.dark); // rolled collar
  // Cheap leather cross strap and a knotted rope belt.
  a.line([20, 21 + bob, 26, 27 + bob], p.leather, 2);
  a.r(17, 28 + bob, 12, 2, '#494031');
  a.r(17, 28 + bob, 12, 1, '#6c5c46');
  a.r(22, 30 + bob, 2, 3, '#494031');
  // Ragged cloth skirt, hem a pixel higher on the left.
  a.poly([18, 30 + bob, 28, 30 + bob, 27, 33 + bob, 22, 32 + bob, 18, 34 + bob], p.outline);
  a.poly([19, 30 + bob, 27, 30 + bob, 26, 32 + bob, 22, 31 + bob, 19, 33 + bob], p.cloth);
  a.r(20, 31 + bob, 1, 2, p.light);

  // Head: open face, tired eye, soft cap with a hanging back flap.
  a.r(23, 17 + bob, 3, 2, p.outline);
  a.poly([19, 13 + bob, 21, 9 + bob, 26, 8 + bob, 29, 11 + bob, 27, 17 + bob, 22, 18 + bob, 19, 15 + bob], p.outline);
  a.poly([21, 12 + bob, 24, 11 + bob, 26, 13 + bob, 26, 16 + bob, 22, 17 + bob, 20, 14 + bob], p.skin);
  a.r(21, 12 + bob, 3, 1, '#e8cfb2');
  a.r(25, 13 + bob, 1, 1, '#e8cfb2');
  a.r(25, 14 + bob, 1, 2, '#262d33');
  a.r(26, 16 + bob, 1, 1, '#8a6f52');
  a.r(23, 17 + bob, 3, 1, '#6f5a44');
  a.poly([18, 13 + bob, 20, 8 + bob, 26, 7 + bob, 29, 10 + bob, 27, 12 + bob, 23, 11 + bob, 20, 13 + bob], p.cloth);
  a.poly([19, 11 + bob, 21, 9 + bob, 25, 8 + bob, 27, 10 + bob, 25, 10 + bob, 22, 12 + bob], p.light);
  a.line([17, 12 + bob, 24, 12 + bob], p.dark);
  a.poly([17, 11 + bob, 14, 14 + bob, 16, 17 + bob, 19, 15 + bob, 20, 12 + bob], p.cloth);
  a.line([15, 14 + bob, 16, 16 + bob], p.dark);

  // Small round plank shield with an iron rim and a plain boss.
  const cx = 15, cy = 26 + bob;
  a.poly([cx, cy - 6, cx + 4, cy - 3, cx + 5, cy, cx + 4, cy + 4, cx, cy + 6, cx - 4, cy + 4, cx - 5, cy, cx - 4, cy - 3], p.outline);
  a.poly([cx, cy - 5, cx + 3, cy - 2, cx + 4, cy, cx + 3, cy + 3, cx, cy + 5, cx - 3, cy + 3, cx - 4, cy, cx - 3, cy - 2], p.wood);
  a.r(cx - 2, cy - 4, 1, 8, '#7b6345');
  a.r(cx + 1, cy - 3, 1, 6, '#7b6345');
  a.r(cx - 4, cy - 3, 1, 6, p.metal);
  a.r(cx + 3, cy - 2, 1, 4, p.steelShadow);
  a.poly([cx - 1, cy - 2, cx + 2, cy - 1, cx + 2, cy + 2, cx - 1, cy + 3], p.metal);
  a.r(cx - 1, cy - 1, 1, 2, p.shine);
  a.r(cx - 4, cy - 2, 1, 1, p.shine);

  // Short spear: butts on the ground at rest, levelled for the thrust.
  let [bx, by, tx, ty] = LEVY_IDLE[f];
  if (walk) [bx, by, tx, ty] = LEVY_WALK[f];
  if (atk) [bx, by, tx, ty] = LEVY_THRUST[f];
  haft(a, bx, by, tx, ty, 1);
  spearHead(a, bx, by, tx, ty);
  const [hx, hy] = along(bx, by, tx, ty, 0.45);
  // Weapon arm reaches the shaft from the right shoulder, leather bracer at the elbow.
  limb(a, 26, 21 + bob, hx, hy, 4, p.cloth);
  a.r(Math.round((26 + hx) / 2) - 1, Math.round((21 + bob + hy) / 2) - 2, 3, 3, p.leather);
  fist(a, hx, hy, p.skin);
}

/* ========================================================================= *
 * SHIELD - wall trooper: sunken brimmed great helm, layered steel, faction
 * cloth tower shield (rectangle, steel rim, gold chevron, round boss) and a
 * short broadsword. Wide feet, short legs, low centre of gravity.
 * ========================================================================= */
const SHIELD_IDLE: number[][] = [[30, 28, 35, 36], [31, 27, 37, 34], [30, 29, 34, 37], [31, 28, 36, 35]];
const SHIELD_WALK: number[][] = [[30, 27, 36, 34], [32, 26, 38, 32], [29, 28, 34, 37], [31, 27, 37, 33]];
const SHIELD_CUT: number[][] = [[29, 24, 32, 13], [31, 20, 38, 10], [31, 27, 41, 33], [29, 28, 35, 35]];

function shield(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  const push = atk ? [0, 1, 2, 0][f] : 0;
  let frontX = 28, backX = 15;
  if (walk) { frontX = [30, 27, 21, 24][f]; backX = [13, 18, 27, 21][f]; }
  else if (atk) { frontX = [29, 31, 33, 29][f]; backX = [15, 14, 13, 16][f]; }
  else { frontX = 28 + [0, 1, 0, 1][f]; backX = 15 + [0, -1, 1, 0][f]; }

  // Shield arm behind the slab.
  limb(a, 20, 21 + bob, 15, 25 + bob, 5, p.metal);

  // Short, wide-set legs: greaves and sabatons, faction hose above the knee.
  leg(a, 22, 29 + bob, backX, 42, -1, p.cloth, p.metal, p.metal, p.shine, 6, 5);
  leg(a, 26, 29 + bob, frontX, 42, 1, p.cloth, p.metal, p.metal, p.shine, 6, 5);
  a.r(backX - 2, 33, 4, 2, p.gold);
  a.r(frontX - 2, 32, 4, 2, p.gold);

  // Plate torso, tabard through the middle, heavy belt.
  a.poly([14, 19 + bob, 29, 18 + bob, 32, 23 + bob, 31, 31 + bob, 14, 32 + bob, 11, 24 + bob], p.outline);
  a.poly([15, 20 + bob, 28, 19 + bob, 30, 23 + bob, 29, 30 + bob, 15, 31 + bob, 12, 24 + bob], p.metal);
  a.poly([19, 20 + bob, 26, 19 + bob, 28, 23 + bob, 27, 31 + bob, 18, 31 + bob, 17, 24 + bob], p.cloth);
  a.r(19, 21 + bob, 1, 8, p.light);
  a.r(22, 21 + bob, 1, 9, p.light);
  a.line([26, 20 + bob, 27, 29 + bob], p.dark);
  a.r(14, 22 + bob, 4, 6, p.steelShadow);
  a.r(15, 21 + bob, 3, 1, p.shine);
  a.r(13, 29 + bob, 17, 2, '#4a4139');
  a.r(18, 29 + bob, 3, 2, p.gold);
  // Pauldrons: big, layered, catching the key light on their upper-left.
  a.poly([10, 20 + bob, 16, 17 + bob, 20, 19 + bob, 18, 24 + bob, 12, 24 + bob], p.outline);
  a.poly([11, 20 + bob, 16, 18 + bob, 19, 20 + bob, 17, 23 + bob, 12, 23 + bob], p.metal);
  a.r(12, 19 + bob, 6, 1, p.shine);
  a.poly([27, 18 + bob, 33, 19 + bob, 35, 23 + bob, 30, 24 + bob, 28, 21 + bob], p.outline);
  a.poly([28, 19 + bob, 32, 20 + bob, 33, 22 + bob, 30, 23 + bob, 29, 21 + bob], p.metal);
  a.r(28, 19 + bob, 4, 1, p.shine);

  // Sunken great helm: dark brim, narrow visor, thick gorget. No crest.
  a.r(23, 19 + bob, 6, 3, p.steelShadow);
  a.poly([20, 15 + bob, 24, 12 + bob, 29, 12 + bob, 31, 15 + bob, 31, 20 + bob, 24, 21 + bob, 20, 18 + bob], p.outline);
  a.poly([21, 15 + bob, 24, 13 + bob, 29, 13 + bob, 30, 15 + bob, 30, 19 + bob, 24, 20 + bob, 21, 17 + bob], p.steelShadow);
  a.poly([21, 15 + bob, 24, 13 + bob, 27, 13 + bob, 26, 17 + bob, 21, 17 + bob], p.metal);
  a.r(22, 14 + bob, 4, 1, p.shine);
  a.r(21, 17 + bob, 9, 2, '#101c24');
  a.r(23, 17 + bob, 1, 1, p.shine);
  a.r(27, 17 + bob, 1, 1, p.shine);
  a.r(24, 19 + bob, 2, 1, p.steelShadow);
  a.poly([18, 16 + bob, 33, 15 + bob, 34, 17 + bob, 19, 18 + bob], p.metal);
  a.r(19, 16 + bob, 12, 1, p.shine);
  a.r(25, 16 + bob, 2, 2, p.steelShadow);

  // Tower shield: rectangle, steel rim, cloth field, round boss, gold chevron.
  const sx = 5 + push, sy = 15 + bob;
  a.poly([sx + 2, sy, sx + 14, sy + 1, sx + 15, sy + 4, sx + 15, sy + 23, sx + 12, sy + 26, sx + 1, sy + 26, sx, sy + 23], p.outline);
  a.poly([sx + 2, sy + 1, sx + 13, sy + 2, sx + 14, sy + 5, sx + 14, sy + 22, sx + 11, sy + 25, sx + 2, sy + 25, sx + 1, sy + 22], p.steelShadow);
  a.poly([sx + 3, sy + 4, sx + 12, sy + 4, sx + 12, sy + 21, sx + 10, sy + 23, sx + 3, sy + 23, sx + 2, sy + 21], p.cloth);
  a.r(sx + 3, sy + 5, 1, 16, p.light);
  a.r(sx + 7, sy + 4, 1, 19, p.dark);
  a.r(sx + 10, sy + 5, 1, 17, p.dark);
  a.r(sx + 2, sy + 2, 1, 2, p.shine);
  a.r(sx + 11, sy + 2, 1, 2, p.shine);
  a.poly([sx + 6, sy + 5, sx + 9, sy + 4, sx + 12, sy + 6, sx + 12, sy + 9, sx + 9, sy + 11, sx + 6, sy + 9], p.metal);
  a.poly([sx + 7, sy + 5, sx + 9, sy + 5, sx + 10, sy + 7, sx + 9, sy + 9, sx + 7, sy + 7], p.shine);
  a.r(sx + 8, sy + 6, 1, 2, p.light);
  a.poly([sx + 4, sy + 14, sx + 7, sy + 14, sx + 10, sy + 18, sx + 7, sy + 22, sx + 4, sy + 22, sx + 7, sy + 18], p.gold);
  a.r(sx + 2, sy + 23, 11, 1, p.gold);
  a.poly([sx + 5, sy + 15, sx + 7, sy + 15, sx + 9, sy + 18, sx + 7, sy + 21, sx + 5, sy + 21, sx + 7, sy + 18], p.light);
  a.r(sx + 2, sy + 22, 1, 1, p.shine);
  a.r(sx + 12, sy + 23, 1, 1, p.shine);
  a.r(sx + 2, sy + 2, 1, 2, p.shine);
  a.r(sx + 11, sy + 2, 1, 2, p.shine);

  // Short broadsword in the right hand, low guard.
  const [gx, gy, tx, ty] = atk ? SHIELD_CUT[f] : walk ? SHIELD_WALK[f] : SHIELD_IDLE[f];
  limb(a, 29, 22 + bob, gx, gy + bob, 4, p.metal);
  blade(a, gx, gy + bob, tx, ty + bob, 3);
  a.poly([gx - 3, gy + bob, gx, gy - 2 + bob, gx + 3, gy + bob, gx, gy + 2 + bob], p.gold);
  a.r(gx - 1, gy + 2 + bob, 2, 2, p.leather);
  fist(a, gx, gy + bob, p.skin);
}

/* ========================================================================= *
 * PIKE - long, lean formation soldier: brimmed pot helm with a nose guard,
 * long surcoat over mail and a two-handed pike that spans the whole frame.
 * Long stride, upright carriage, no shield at all.
 * ========================================================================= */
const PIKE_REST: number[][] = [[10, 41, 44, 7], [11, 41, 43, 7], [12, 41, 42, 8], [10, 41, 44, 8]];
const PIKE_MARCH: number[][] = [[13, 41, 38, 5], [14, 41, 40, 4], [12, 41, 37, 6], [14, 41, 39, 5]];
const PIKE_THRUST: number[][] = [[4, 24, 36, 18], [7, 24, 42, 20], [9, 25, 45, 21], [5, 25, 38, 19]];

function pike(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  let frontX = 26, backX = 19;
  if (walk) { frontX = [30, 27, 18, 22][f]; backX = [15, 19, 30, 26][f]; }
  else if (atk) { frontX = [29, 31, 33, 28][f]; backX = [17, 15, 13, 18][f]; }
  else { frontX = 26 + [0, 1, 0, 2][f]; backX = 19 + [0, -1, 1, 0][f]; }

  // Long legs, cloth-wrapped shins, narrow hips.
  leg(a, 22, 28 + bob, backX, 42, -1, p.cloth, p.dark, '#3a3936', '#5a5749', 4, 4);
  leg(a, 25, 28 + bob, frontX, 42, 1, p.cloth, p.dark, '#3a3936', '#5a5749', 4, 4);

  // Lean mail torso under a long cloth surcoat with light seams.
  a.poly([18, 17 + bob, 27, 16 + bob, 28, 21 + bob, 27, 33 + bob, 18, 33 + bob, 16, 22 + bob], p.outline);
  a.poly([19, 18 + bob, 26, 17 + bob, 26, 21 + bob, 26, 32 + bob, 19, 32 + bob, 17, 22 + bob], p.cloth);
  a.r(19, 18 + bob, 2, 13, p.light);
  a.r(23, 18 + bob, 1, 14, p.light);
  a.line([26, 18 + bob, 26, 31 + bob], p.dark);
  a.r(16, 20 + bob, 4, 3, p.metal);
  a.r(27, 19 + bob, 3, 3, p.metal);
  a.r(18, 26 + bob, 9, 2, p.leather);
  a.r(18, 26 + bob, 9, 1, '#87704f');
  a.r(22, 28 + bob, 3, 1, p.gold);
  // Surcoat skirt splits for the stride.
  a.poly([18, 32 + bob, 27, 32 + bob, 27, 36 + bob, 23, 35 + bob, 18, 37 + bob], p.dark);
  a.poly([19, 32 + bob, 26, 32 + bob, 26, 35 + bob, 22, 34 + bob, 19, 36 + bob], p.cloth);

  // Head: round pot helm with a brim and a nose guard, cloth hood below.
  a.poly([17, 16 + bob, 21, 14 + bob, 27, 14 + bob, 29, 17 + bob, 27, 19 + bob, 18, 19 + bob], p.cloth);
  a.r(24, 17 + bob, 2, 2, p.skin);
  a.r(22, 12 + bob, 5, 5, p.skin);
  a.r(22, 12 + bob, 4, 1, '#e6cdb0');
  a.r(26, 14 + bob, 1, 2, '#262d33');
  a.r(23, 17 + bob, 3, 1, '#7a6248');
  a.poly([19, 13 + bob, 21, 9 + bob, 26, 8 + bob, 29, 11 + bob, 28, 14 + bob, 20, 14 + bob], p.outline);
  a.poly([20, 12 + bob, 22, 9 + bob, 26, 9 + bob, 28, 11 + bob, 27, 13 + bob, 21, 13 + bob], p.metal);
  a.r(21, 10 + bob, 4, 1, p.shine);
  a.r(19, 11 + bob, 9, 2, p.steelShadow);
  a.poly([17, 13 + bob, 31, 12 + bob, 32, 14 + bob, 18, 15 + bob], p.metal);
  a.r(18, 13 + bob, 11, 1, p.shine);
  a.r(19, 14 + bob, 9, 1, p.steelShadow);
  a.r(20, 15 + bob, 2, 3, p.metal);
  a.r(27, 15 + bob, 1, 3, p.metal);
  a.r(25, 14 + bob, 1, 3, p.steelShadow);
  a.r(24, 6 + bob, 2, 3, p.metal);
  a.r(24, 6 + bob, 1, 2, p.shine);

  // Pike: drawn in front of the body, both hands planted on the shaft.
  let [bx, by, tx, ty] = PIKE_REST[f];
  if (walk) [bx, by, tx, ty] = PIKE_MARCH[f];
  if (atk) [bx, by, tx, ty] = PIKE_THRUST[f];
  haft(a, bx, by, tx, ty, 2);
  a.r(bx - 1, by - 1, 3, 2, p.outline);
  a.r(bx, by - 1, 2, 1, p.metal);
  spearHead(a, bx, by, tx, ty);
  const [rx, ry] = along(bx, by, tx, ty, 0.3);
  const [fx2, fy2] = along(bx, by, tx, ty, 0.62);
  limb(a, 20, 20 + bob, rx, ry, 3, p.cloth);
  limb(a, 25, 19 + bob, fx2, fy2, 3, p.cloth);
  a.r(fx2 - 1, fy2 - 1, 2, 2, p.leather);
  fist(a, rx, ry, p.skin);
  fist(a, fx2, fy2, p.skin);
}

/* ========================================================================= *
 * AXE - furnace brute: bare arms, cloth trousers and sash, cracked leather
 * harness, one iron pauldron, huge two-handed bearded axe whose head owns
 * the upper silhouette. Thickest arms, heaviest shoulders.
 * ========================================================================= */
const AXE_IDLE: number[][] = [[21, 38, 35, 12], [22, 38, 36, 11], [21, 39, 34, 14], [20, 38, 36, 13]];
const AXE_SWING: number[][] = [
  [26, 35, 19, 11],  // wind-up: head up-left behind the shoulder
  [20, 34, 35, 13],  // overhead: head high in front
  [18, 24, 38, 31],  // impact: head low in front
  [19, 26, 35, 17]   // recover: head rising back
];

function axe(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  const sway = walk ? [0, 1, 0, -1][f] : 0;
  let frontX = 30, backX = 15;
  if (walk) { frontX = [32, 29, 21, 25][f]; backX = [13, 18, 31, 25][f]; }
  else if (atk) { frontX = [31, 32, 33, 30][f]; backX = [15, 14, 13, 16][f]; }
  else { frontX = 30 + [0, 1, 0, 1][f]; backX = 15 + [0, -1, 1, 0][f]; }

  // Ragged back-cloth and thick planted legs: cloth trousers, iron shin guards.
  a.poly([15 + sway, 20 + bob, 11 + sway, 26 + bob, 10 + sway, 34 + bob, 13 + sway, 37 + bob, 17 + sway, 31 + bob], p.dark);
  a.poly([15 + sway, 21 + bob, 12 + sway, 27 + bob, 12 + sway, 33 + bob, 14 + sway, 35 + bob, 16 + sway, 30 + bob], p.cloth);
  a.r(12 + sway, 27 + bob, 1, 6, p.light);
  leg(a, 22, 29 + bob, backX, 42, -2, p.cloth, p.metal, p.leather, '#8a6e4e', 7, 5);
  leg(a, 26, 29 + bob, frontX, 42, 2, p.cloth, p.metal, p.leather, '#8a6e4e', 7, 5);
  a.r(backX - 2, 34, 4, 2, p.steelShadow);
  a.r(frontX - 2, 33, 4, 2, p.steelShadow);
  a.r(backX - 1, 35, 3, 1, p.light);
  a.r(frontX - 1, 34, 3, 1, p.light);

  // Bare arms with cloth wrist wraps, no plate on the weapon arm.

  // Broad barrel chest: cloth tabard under a leather harness, wide waist wrap.
  a.poly([13 + sway, 19 + bob, 29 + sway, 18 + bob, 32 + sway, 23 + bob, 30 + sway, 30 + bob, 14 + sway, 31 + bob, 11 + sway, 24 + bob], p.outline);
  a.poly([14 + sway, 20 + bob, 28 + sway, 19 + bob, 30 + sway, 23 + bob, 28 + sway, 29 + bob, 15 + sway, 30 + bob, 12 + sway, 24 + bob], p.cloth);
  a.r(14 + sway, 21 + bob, 2, 8, p.light);
  a.line([27 + sway, 20 + bob, 28 + sway, 28 + bob], p.dark);
  a.poly([17 + sway, 19 + bob, 24 + sway, 18 + bob, 23 + sway, 27 + bob, 18 + sway, 28 + bob], p.cloth);
  a.r(18 + sway, 20 + bob, 1, 7, p.light);
  a.r(20 + sway, 19 + bob, 2, 9, p.leather);
  a.r(26 + sway, 18 + bob, 2, 9, p.leather);
  a.r(24 + sway, 19 + bob, 1, 8, p.dark);
  a.r(20 + sway, 19 + bob, 1, 3, '#8d7150');
  a.line([17 + sway, 21 + bob, 25 + sway, 29 + bob], p.gold, 1);
  a.r(12 + sway, 27 + bob, 18, 4, p.cloth);
  a.r(12 + sway, 27 + bob, 18, 1, p.light);
  a.r(19 + sway, 30 + bob, 3, 3, p.leather);
  // Ragged tabard tail and a torn front rag.
  a.poly([16 + sway, 31 + bob, 27 + sway, 31 + bob, 26 + sway, 35 + bob, 21 + sway, 34 + bob, 16 + sway, 36 + bob], p.dark);
  a.poly([17 + sway, 31 + bob, 26 + sway, 31 + bob, 25 + sway, 34 + bob, 21 + sway, 33 + bob, 17 + sway, 35 + bob], p.cloth);
  a.poly([24 + sway, 30 + bob, 27 + sway, 30 + bob, 27 + sway, 37 + bob, 24 + sway, 35 + bob], p.cloth);
  a.r(25 + sway, 31 + bob, 1, 4, p.light);
  // One iron pauldron on the left; a ragged cloth pad over the bare right shoulder.
  a.poly([11 + sway, 19 + bob, 17 + sway, 16 + bob, 20 + sway, 19 + bob, 18 + sway, 23 + bob, 13 + sway, 23 + bob], p.outline);
  a.poly([12 + sway, 19 + bob, 17 + sway, 17 + bob, 19 + sway, 19 + bob, 17 + sway, 22 + bob, 13 + sway, 22 + bob], p.metal);
  a.r(13 + sway, 18 + bob, 5, 1, p.shine);
  a.r(16 + sway, 21 + bob, 3, 1, p.gold);
  a.poly([26 + sway, 17 + bob, 31 + sway, 18 + bob, 30 + sway, 22 + bob, 27 + sway, 21 + bob], p.cloth);
  a.r(27 + sway, 17 + bob, 4, 1, p.light);

  // Head: shaved scalp, heavy jaw, cloth headband, iron nose guard.
  a.r(23 + sway, 17 + bob, 3, 2, p.outline);
  a.poly([19 + sway, 13 + bob, 21 + sway, 8 + bob, 26 + sway, 7 + bob, 29 + sway, 10 + bob, 28 + sway, 15 + bob, 22 + sway, 17 + bob, 19 + sway, 15 + bob], p.outline);
  a.poly([21 + sway, 11 + bob, 25 + sway, 10 + bob, 27 + sway, 12 + bob, 27 + sway, 15 + bob, 22 + sway, 16 + bob, 20 + sway, 13 + bob], p.skin);
  a.r(21 + sway, 10 + bob, 4, 1, '#e4c9a8');
  a.r(26 + sway, 13 + bob, 1, 2, '#262d33');
  a.r(22 + sway, 15 + bob, 5, 2, '#6d5539');
  a.r(24 + sway, 16 + bob, 3, 1, '#4c3a28');
  a.poly([19 + sway, 12 + bob, 24 + sway, 10 + bob, 29 + sway, 11 + bob, 28 + sway, 13 + bob, 22 + sway, 12 + bob], p.cloth);
  a.r(24 + sway, 12 + bob, 4, 1, p.light);
  a.poly([25 + sway, 11 + bob, 28 + sway, 12 + bob, 27 + sway, 16 + bob, 25 + sway, 15 + bob], p.metal);
  a.r(26 + sway, 12 + bob, 1, 3, p.shine);

  // Two bare arms grip the haft; cloth wraps at the elbows keep the faction read.
  let [bx, by, nx, ny] = AXE_IDLE[f];
  if (atk) [bx, by, nx, ny] = AXE_SWING[f];
  haft(a, bx, by, nx, ny, 2);
  if (atk && f >= 2) axeHeadLow(a, nx, ny); else axeHeadHigh(a, nx, ny, atk && f === 0);
  const [h1x, h1y] = along(bx, by, nx, ny, 0.35);
  const [h2x, h2y] = along(bx, by, nx, ny, 0.62);
  limb(a, 17 + sway, 22 + bob, h1x, h1y, 4, p.skin);
  limb(a, 25 + sway, 22 + bob, h2x, h2y, 4, p.skin);
  const w1x = Math.round((17 + sway + h1x) / 2), w1y = Math.round((22 + bob + h1y) / 2);
  const w2x = Math.round((25 + sway + h2x) / 2), w2y = Math.round((22 + bob + h2y) / 2);
  a.r(w1x - 1, w1y - 1, 3, 3, p.cloth);
  a.r(w1x - 1, w1y - 1, 3, 1, p.light);
  a.r(w2x - 1, w2y - 1, 3, 3, p.cloth);
  a.r(w2x - 1, w2y - 1, 3, 1, p.light);
  a.r(h1x - 1, h1y - 1, 3, 3, p.leather);
  a.r(h2x - 1, h2y - 1, 3, 3, p.leather);
  fist(a, h1x, h1y, p.skin);
  fist(a, h2x, h2y, p.skin);
}

/** Axe head for an upright haft: bearded blade forward, pick behind, top horn. */
function axeHeadHigh(a: UnitArt, nx: number, ny: number, mirrored: boolean) {
  const p = a.p, m = mirrored ? -1 : 1, X = (d: number) => nx + d * m;
  // rear pick
  a.poly([X(-3), ny - 1, X(-8), ny - 4, X(-7), ny + 1, X(-3), ny + 2], p.outline);
  a.poly([X(-4), ny - 1, X(-7), ny - 3, X(-6), ny], p.metal);
  // top horn
  a.poly([X(1), ny - 4, X(3), ny - 9, X(6), ny - 4], p.outline);
  a.poly([X(2), ny - 4, X(3), ny - 7, X(5), ny - 4], p.metal);
  a.r(X(3), ny - 6, 1, 1, p.shine);
  // socket / eye
  a.poly([X(-3), ny - 4, X(3), ny - 3, X(3), ny + 3, X(-3), ny + 2], p.outline);
  a.r(mirrored ? X(-2) : X(-3), ny - 2, 3, 3, p.steelShadow);
  // bearded blade: straight top, curved cutting edge, hooked beard
  a.poly([X(2), ny - 4, X(7), ny - 5, X(10), ny - 2, X(11), ny + 4, X(8), ny + 11, X(4), ny + 8, X(2), ny + 3], p.outline);
  a.poly([X(3), ny - 3, X(7), ny - 4, X(9), ny - 1, X(9), ny + 4, X(7), ny + 9, X(5), ny + 7, X(3), ny + 2], p.steelShadow);
  a.poly([X(3), ny - 3, X(7), ny - 4, X(8), ny - 1, X(3), ny - 1], p.metal);
  a.poly([X(6), ny + 2, X(9), ny + 4, X(7), ny + 9, X(5), ny + 7], p.dark);
  a.line([X(9), ny - 1, X(9), ny + 4], p.shine, 1);
  a.r(X(4), ny + 1, 2, 1, p.steelShadow);
}

/** Axe head for a low follow-through: blade sweeping down and forward. */
function axeHeadLow(a: UnitArt, nx: number, ny: number) {
  const p = a.p;
  // socket
  a.poly([nx - 3, ny - 3, nx + 2, ny - 2, nx + 2, ny + 2, nx - 3, ny + 2], p.outline);
  a.r(nx - 2, ny - 1, 3, 2, p.steelShadow);
  // blade sweeping down-right, straight cutting edge on the lower right
  a.poly([nx + 1, ny - 3, nx + 6, ny - 1, nx + 9, ny + 3, nx + 8, ny + 8, nx + 4, ny + 10, nx + 1, ny + 6, nx - 1, ny + 1], p.outline);
  a.poly([nx + 2, ny - 2, nx + 5, ny, nx + 7, ny + 3, nx + 6, ny + 7, nx + 4, ny + 8, nx + 2, ny + 5, nx + 1, ny + 1], p.steelShadow);
  a.poly([nx + 2, ny - 2, nx + 5, ny, nx + 5, ny + 3, nx + 2, ny + 2], p.metal);
  a.poly([nx + 5, ny + 4, nx + 6, ny + 7, nx + 4, ny + 8, nx + 4, ny + 5], p.dark);
  a.line([nx + 7, ny + 3, nx + 6, ny + 7], p.shine, 1);
}

/* ========================================================================= *
 * GUARDIAN - obsidian wall: monolithic black plate with cold facet edges,
 * flat-topped full helm, huge faceted coffin shield with a pointed base,
 * faction cloth mantle with a gold hem. Widest body, lowest hips.
 * ========================================================================= */
const MACE: number[][] = [[34, 24], [36, 20], [38, 29], [34, 27]];

function guardian(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  const shove = atk ? [0, 1, 3, 1][f] : 0;
  const lean = atk ? [0, 0, 1, 0][f] : 0;
  let frontX = 31, backX = 13;
  if (walk) { frontX = [33, 30, 23, 26][f]; backX = [11, 17, 30, 23][f]; }
  else if (atk) { frontX = [32, 34, 36, 31][f]; backX = [13, 12, 11, 14][f]; }
  else { frontX = 31 + [0, 1, 0, 0][f]; backX = 13 + [0, -1, 1, 0][f]; }

  // Faction mantle: the main colour read on an otherwise black unit.
  a.poly([20, 17 + bob, 15, 19 + bob, 12, 26 + bob, 10, 35 + bob, 14, 38 + bob, 19, 33 + bob, 21, 25 + bob], p.dark);
  a.poly([19, 18 + bob, 15, 20 + bob, 13, 27 + bob, 13, 34 + bob, 16, 36 + bob, 19, 31 + bob, 20, 24 + bob], p.cloth);
  a.r(14, 25 + bob, 1, 9, p.light);
  a.r(16, 22 + bob, 1, 10, p.light);
  a.r(11, 34 + bob, 9, 1, p.gold);
  a.poly([20, 17 + bob, 28, 16 + bob, 30, 20 + bob, 21, 21 + bob], p.cloth);
  a.r(21, 17 + bob, 7, 1, p.light);

  // Very wide, very low stance. Plated legs, slab sabatons.
  leg(a, 21, 30 + bob, backX, 42, -2, p.dark, p.steelShadow, p.steelShadow, p.shine, 8, 6);
  leg(a, 27, 30 + bob, frontX, 42, 2, p.dark, p.steelShadow, p.steelShadow, p.shine, 8, 6);
  a.r(backX - 3, 35, 6, 3, p.outline);
  a.r(frontX - 3, 34, 6, 3, p.outline);
  a.r(backX - 2, 35, 4, 1, p.steelShadow);
  a.r(frontX - 2, 34, 4, 1, p.steelShadow);
  a.r(backX - 1, 36, 2, 1, p.shine);
  a.r(frontX - 1, 35, 2, 1, p.shine);

  // Monolithic torso: layered obsidian slabs with one cold highlight each.
  a.poly([11, 19 + bob, 31, 18 + bob, 34, 24 + bob, 31, 33 + bob, 30, 35 + bob, 12, 35 + bob, 10, 25 + bob], p.outline);
  a.poly([12, 20 + bob, 30, 19 + bob, 32, 24 + bob, 30, 32 + bob, 13, 33 + bob, 11, 25 + bob], p.dark);
  a.poly([13, 21 + bob, 22, 20 + bob, 21, 28 + bob, 13, 28 + bob], p.steelShadow);
  a.poly([13, 21 + bob, 18, 20 + bob, 17, 25 + bob, 13, 25 + bob], p.dark);
  a.r(13, 21 + bob, 8, 1, p.shine);
  a.r(22, 20 + bob, 1, 8, p.steelShadow);
  a.r(21, 24 + bob, 9, 2, p.outline);
  a.poly([23, 20 + bob, 30, 19 + bob, 32, 24 + bob, 29, 30 + bob, 23, 30 + bob], p.dark);
  a.r(24, 21 + bob, 6, 1, p.steelShadow);
  a.r(23, 30 + bob, 8, 2, p.outline);
  a.poly([18, 31 + bob, 27, 31 + bob, 27, 35 + bob, 23, 37 + bob, 18, 35 + bob], p.cloth);
  a.r(19, 32 + bob, 1, 3, p.light);
  a.r(18, 34 + bob, 9, 1, p.gold);
  a.r(14, 26 + bob, 18, 2, p.outline);
  a.r(20, 25 + bob, 4, 3, p.gold);
  // Angular pauldrons, wider than the hips.
  a.poly([7, 20 + bob, 15, 16 + bob, 20, 20 + bob, 17, 26 + bob, 9, 26 + bob], p.outline);
  a.poly([8, 20 + bob, 15, 17 + bob, 19, 20 + bob, 16, 25 + bob, 9, 25 + bob], p.dark);
  a.poly([9, 20 + bob, 15, 18 + bob, 15, 22 + bob, 9, 24 + bob], p.steelShadow);
  a.r(10, 19 + bob, 7, 1, p.shine);
  a.r(8, 24 + bob, 9, 1, p.gold);
  a.poly([27, 17 + bob, 35, 19 + bob, 37, 24 + bob, 30, 26 + bob, 27, 22 + bob], p.outline);
  a.poly([28, 18 + bob, 34, 20 + bob, 35, 23 + bob, 30, 25 + bob, 28, 21 + bob], p.dark);
  a.poly([29, 19 + bob, 33, 20 + bob, 33, 22 + bob, 30, 23 + bob], p.steelShadow);
  a.r(29, 18 + bob, 5, 1, p.shine);
  a.r(31, 24 + bob, 5, 1, p.gold);

  // Flat-topped full helm: overhanging metal top plate, slit visor, jaw guard.
  a.poly([20, 10 + bob, 32, 9 + bob, 33, 12 + bob, 20, 12 + bob], p.metal);
  a.r(21, 10 + bob, 10, 1, p.shine);
  a.r(20, 12 + bob, 13, 1, p.steelShadow);
  a.poly([20, 13 + bob, 31, 12 + bob, 33, 15 + bob, 32, 21 + bob, 24, 23 + bob, 20, 19 + bob], p.outline);
  a.poly([21, 14 + bob, 30, 13 + bob, 32, 16 + bob, 31, 20 + bob, 24, 22 + bob, 21, 18 + bob], p.dark);
  a.poly([21, 14 + bob, 26, 13 + bob, 26, 18 + bob, 21, 18 + bob], p.steelShadow);
  a.r(21, 14 + bob, 5, 1, p.shine);
  a.r(22, 16 + bob, 9, 2, '#0b1218');
  a.r(23, 16 + bob, 2, 1, p.shine);
  a.r(28, 16 + bob, 1, 1, p.shine);
  a.r(21, 19 + bob, 10, 1, p.steelShadow);
  a.poly([23, 19 + bob, 31, 19 + bob, 30, 22 + bob, 24, 23 + bob], p.dark);
  a.r(21, 20 + bob, 10, 1, p.gold);
  a.r(26, 17 + bob, 2, 1, p.steelShadow);

  // Cloth mantle draped over the breastplate: the faction read on black plate.
  a.poly([13, 20 + bob, 21, 19 + bob, 25, 26 + bob, 19, 27 + bob, 13, 23 + bob], p.cloth);
  a.poly([28, 19 + bob, 23, 20 + bob, 24, 26 + bob, 30, 24 + bob, 33, 22 + bob], p.cloth);
  a.r(14, 21 + bob, 1, 3, p.light);
  a.r(22, 21 + bob, 1, 5, p.light);
  a.r(15, 24 + bob, 7, 1, p.gold);
  a.r(26, 23 + bob, 5, 1, p.gold);

  // Coffin shield: flat slanted crown, straight flanks, pointed base, gold edge.
  const sx = 2 + shove, sy = 11 + bob;
  a.poly([sx + 2, sy, sx + 13, sy + 2, sx + 16, sy + 8, sx + 16, sy + 22, sx + 9, sy + 31, sx + 1, sy + 22, sx, sy + 8], p.outline);
  a.poly([sx + 3, sy + 2, sx + 12, sy + 4, sx + 14, sy + 9, sx + 14, sy + 21, sx + 9, sy + 28, sx + 3, sy + 21, sx + 2, sy + 9], p.gold);
  a.poly([sx + 4, sy + 3, sx + 11, sy + 5, sx + 13, sy + 9, sx + 13, sy + 21, sx + 9, sy + 26, sx + 4, sy + 21, sx + 3, sy + 9], p.dark);
  // cold obsidian facets: lit upper-left plane, dark right plane, ridge glint
  a.poly([sx + 4, sy + 4, sx + 8, sy + 5, sx + 8, sy + 18, sx + 4, sy + 16], p.steelShadow);
  a.poly([sx + 4, sy + 4, sx + 6, sy + 5, sx + 6, sy + 11, sx + 4, sy + 10], p.shine);
  a.poly([sx + 9, sy + 6, sx + 12, sy + 9, sx + 12, sy + 19, sx + 9, sy + 24], p.dark);
  a.r(sx + 8, sy + 6, 1, 13, p.shine);
  a.r(sx + 9, sy + 10, 1, 8, p.steelShadow);
  a.r(sx + 2, sy + 21, 6, 1, p.steelShadow);
  a.r(sx + 11, sy + 20, 3, 1, p.steelShadow);
  a.r(sx + 5, sy + 20, 4, 1, p.gold);
  a.r(sx + 9, sy + 13, 2, 3, p.gold);
  a.r(sx + 5, sy + 8, 1, 1, p.shine);

  // Shield arm braces into the slab from the left pauldron.
  limb(a, 16, 21 + bob, 12 + shove, 27 + bob, 5, p.dark);

  // Flanged mace in the right hand: short, because the shield is the weapon.
  const mx = atk ? MACE[f][0] : 34, my = (atk ? MACE[f][1] : 28) + bob;
  limb(a, 31, 22 + bob + lean, mx, my, 4, p.dark);
  a.line([mx, my, mx + 3, my - 10], p.outline, 3);
  a.line([mx, my, mx + 3, my - 10], p.steelShadow, 1);
  a.poly([mx + 1, my - 16, mx + 6, my - 14, mx + 8, my - 10, mx + 5, my - 6, mx + 1, my - 8, mx, my - 12], p.outline);
  a.poly([mx + 2, my - 15, mx + 5, my - 13, mx + 6, my - 10, mx + 4, my - 7, mx + 2, my - 9, mx + 1, my - 12], p.metal);
  a.r(mx + 2, my - 14, 3, 1, p.shine);
  a.r(mx + 3, my - 12, 2, 2, p.steelShadow);
  a.r(mx + 1, my - 10, 6, 1, p.gold);
  fist(a, mx, my, p.skin);
}

/* ========================================================================= *
 * PALADIN - dawn oathsworn: tall crested helm, silver-gilt plate, long
 * faction cape with a gold hem, a longsword and a small ceremonial heater.
 * Slim, upright, precise: everything the shield trooper is not.
 * ========================================================================= */
const PALADIN_IDLE: number[][] = [[30, 27, 37, 7], [30, 26, 38, 5], [30, 28, 36, 9], [30, 27, 37, 8]];
const PALADIN_SWING: number[][] = [[30, 23, 35, 3], [31, 24, 43, 13], [30, 26, 41, 34], [30, 25, 37, 16]];

function paladin(a: UnitArt) {
  const p = a.p, f = a.f, walk = a.walk, atk = a.attack;
  const bob = walk ? [0, -1, 0, -1][f] : atk ? [0, 0, 1, 0][f] : [0, -1, 0, 0][f];
  let frontX = 27, backX = 19;
  if (walk) { frontX = [30, 26, 18, 23][f]; backX = [15, 20, 29, 24][f]; }
  else if (atk) { frontX = [29, 31, 32, 28][f]; backX = [18, 16, 15, 18][f]; }
  else { frontX = 27 + [0, 1, 0, 1][f]; backX = 19 + [0, -1, 1, 0][f]; }

  // Long cape: four distinct sways, gold hem, lit inner fold.
  const sway = walk ? [2, 0, -2, 0][f] : atk ? [0, -1, 1, 0][f] : [0, -1, 0, 1][f];
  const hem = 40 + sway;
  a.poly([19, 18 + bob, 15, 20 + bob, 11 + sway, 27 + bob, 9 + sway, hem, 13 + sway, hem + 1, 18 + sway, hem - 3, 21 + bob, 26 + bob], p.outline);
  a.poly([19, 19 + bob, 16, 21 + bob, 13 + sway, 28 + bob, 11 + sway, hem - 1, 15 + sway, hem - 1, 18 + sway, hem - 4, 20 + bob, 25 + bob], p.cloth);
  a.r(13 + sway, 26 + bob, 1, 11, p.light);
  a.r(16 + sway, 30 + bob, 1, 7, p.light);
  a.r(11 + sway, hem - 1, 5, 1, p.gold);
  a.r(14 + sway, hem, 2, 1, p.gold);
  a.poly([19, 19 + bob, 20, 24 + bob, 17, 30 + bob, 15, 27 + bob], p.dark);

  // Tall slim legs, silver greaves, gold knee cops.
  leg(a, 22, 28 + bob, backX, 42, -1, p.cloth, p.metal, p.metal, p.shine, 4, 4);
  leg(a, 25, 28 + bob, frontX, 42, 1, p.metal, p.shine, p.metal, '#f1f4f2', 4, 4);
  a.r(backX - 2, 32, 3, 2, p.gold);
  a.r(frontX - 2, 31, 3, 2, p.gold);

  // Cuirass, gold gorget and belt, cloth tassets below.
  a.poly([18, 18 + bob, 27, 17 + bob, 29, 22 + bob, 27, 29 + bob, 18, 29 + bob, 16, 23 + bob], p.outline);
  a.poly([19, 19 + bob, 26, 18 + bob, 27, 22 + bob, 26, 28 + bob, 19, 28 + bob, 17, 23 + bob], p.metal);
  a.r(19, 19 + bob, 2, 7, p.shine);
  a.poly([20, 20 + bob, 24, 19 + bob, 25, 23 + bob, 21, 24 + bob], p.shine);
  a.line([26, 19 + bob, 27, 27 + bob], p.steelShadow);
  a.r(18, 17 + bob, 9, 2, p.gold);
  a.r(18, 26 + bob, 9, 2, p.gold);
  a.r(22, 26 + bob, 1, 2, '#f3e4b4');
  a.poly([19, 28 + bob, 26, 28 + bob, 27, 33 + bob, 22, 35 + bob, 18, 33 + bob], p.outline);
  a.poly([20, 28 + bob, 25, 28 + bob, 26, 32 + bob, 22, 33 + bob, 19, 32 + bob], p.cloth);
  a.r(20, 29 + bob, 1, 3, p.light);
  a.r(19, 32 + bob, 7, 1, p.gold);
  a.poly([18, 19 + bob, 20, 16 + bob, 23, 18 + bob, 21, 21 + bob], p.metal);
  a.r(19, 17 + bob, 3, 1, p.shine);

  // Crested helm: silver shell, gold comb, cloth plume, T-visor.
  a.poly([20, 10 + bob, 22, 6 + bob, 26, 5 + bob, 30, 8 + bob, 30, 15 + bob, 24, 17 + bob, 20, 14 + bob], p.outline);
  a.poly([21, 10 + bob, 23, 7 + bob, 26, 6 + bob, 29, 9 + bob, 29, 14 + bob, 24, 16 + bob, 21, 13 + bob], p.metal);
  a.r(22, 8 + bob, 5, 2, p.shine);
  a.r(21, 12 + bob, 7, 2, '#3c4a54');
  a.r(24, 12 + bob, 1, 3, p.outline);
  a.r(26, 12 + bob, 2, 1, p.shine);
  a.r(22, 14 + bob, 5, 1, p.steelShadow);
  a.poly([20, 13 + bob, 23, 15 + bob, 21, 19 + bob, 18, 17 + bob], p.metal);
  a.r(19, 15 + bob, 2, 1, p.shine);
  // gold comb crest with a lit leading edge + cloth plume trailing back
  a.poly([23, 7 + bob, 23, 2 + bob, 27, 3 + bob, 28, 7 + bob], p.gold);
  a.r(24, 3 + bob, 1, 3, '#f4e6b8');
  a.r(26, 4 + bob, 1, 2, p.light);
  a.poly([22, 7 + bob, 18, 9 + bob, 15, 15 + bob, 17, 17 + bob, 19, 12 + bob, 21, 10 + bob], p.cloth);
  a.r(18, 10 + bob, 1, 4, p.light);

  // Longsword: long bright blade, gold guard and pommel, always on the right arm.
  const [gx, gy, tx, ty] = atk ? PALADIN_SWING[f] : PALADIN_IDLE[f];
  const hy = gy + bob;
  limb(a, 28, 21 + bob, gx, hy, 4, p.metal);
  blade(a, gx, hy, tx, ty + bob, 3);
  a.poly([gx - 3, hy - 1, gx, hy - 3, gx + 3, hy - 1, gx, hy + 1], p.gold);
  a.r(gx - 1, hy + 2, 2, 2, p.gold);
  fist(a, gx, hy, p.skin);

  // Small ceremonial heater shield: much smaller than the tower, gold-rimmed.
  const sx = 8, sy = 20 + bob;
  a.poly([sx + 1, sy, sx + 8, sy + 1, sx + 9, sy + 4, sx + 7, sy + 10, sx + 4, sy + 13, sx + 1, sy + 9, sx, sy + 4], p.outline);
  a.poly([sx + 2, sy + 1, sx + 7, sy + 2, sx + 8, sy + 4, sx + 6, sy + 9, sx + 4, sy + 11, sx + 2, sy + 8, sx + 1, sy + 4], p.gold);
  a.poly([sx + 3, sy + 2, sx + 6, sy + 3, sx + 6, sy + 5, sx + 5, sy + 8, sx + 4, sy + 9, sx + 3, sy + 7, sx + 2, sy + 5], p.cloth);
  a.r(sx + 4, sy + 3, 1, 4, p.shine);
  a.r(sx + 4, sy + 4, 2, 1, p.gold);
  a.r(sx + 3, sy + 6, 3, 1, p.gold);
  limb(a, 19, 22 + bob, sx + 7, sy + 4, 4, p.metal);
}

/** Shift every draw call by an integer offset (hurt recoil) without touching ctx. */
function shifted(a: UnitArt, dx: number, dy: number): UnitArt {
  const move = (pts: number[]) => pts.map((v, i) => v + (i % 2 === 0 ? dx : dy));
  return {
    ...a,
    r: (x, y, w, h, color) => a.r(x + dx, y + dy, w, h, color),
    poly: (pts, color) => a.poly(move(pts), color),
    line: (pts, color, w = 1) => a.line(move(pts), color, w)
  };
}

/** Dispatcher: returns true when this module paints the unit. */
export function drawInfantry(a: UnitArt): boolean {
  const art = a.action === 'hurt' ? shifted(a, -1, 0) : a;
  switch (a.id) {
    case 'levy': levy(art); return true;
    case 'shield': shield(art); return true;
    case 'pike': pike(art); return true;
    case 'axe': axe(art); return true;
    case 'guardian': guardian(art); return true;
    case 'paladin': paladin(art); return true;
    default: return false;
  }
}
