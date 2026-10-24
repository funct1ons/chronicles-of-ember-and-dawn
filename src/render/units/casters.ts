import { UNIT_BY_ID } from '../../data/units';
import type { UnitArt } from './pixelArt';

/**
 * Caster silhouettes for the three spell-casting roles (mage / healer / firemage).
 *
 * The old atlas drew all three from one robed skeleton and only recoloured the
 * robe and staff head, so the trio read as "same unit, three tints". These
 * three share the 48x48 grid, the feet-near-y=42 stance, the right-facing
 * profile and the upper-left key light, but deliberately differ in head shape,
 * shoulder width, body height, prop, posture and casting language:
 *
 *  - mage     tall + narrow, spiked arcane circlet (no hood), high stand collar,
 *             hollow star ring on a forked staff, hands converge on the focus.
 *  - healer   broad + low, platinum hood over a wide cloth mantle, short
 *             square half-cape, filled sun-disc on a short cross-staff, one
 *             open hand raised in blessing (no weapon swing: the class never
 *             attacks, so nothing here implies a melee strike).
 *  - firemage hunched + forward-leaning, bald head with a heavy beard (the only
 *             bare crown in the roster), torn scorched hem, thick crooked staff
 *             with a wide brazier bowl, fire thrown from an open palm.
 *
 * Faction cloth (blue/red) stays the largest single colour block on every
 * unit, so both armies remain readable; profession accents are trim, hood,
 * prop metal and sparks only. Nothing implies an unimplemented skill (no
 * summons, flight, stealth or teleport); all poses are in-place gestures.
 *
 * Every frame keeps meaningful pixels inside 0..47, connects the prop to the
 * gripping hand, and gives idle/walk/attack four different states. `hurt` and
 * `dead` feedback (flash/fade/topple) stays owned by BattleRenderer.
 */

const OCTAGON_DIR = 0.72;

/** Closed octagon path, used for the mage's hollow ring and the healer's disc. */
function octagon(cx: number, cy: number, radius: number): number[] {
  const d = Math.round(radius * OCTAGON_DIR);
  return [
    cx + radius, cy,
    cx + d, cy + d,
    cx, cy + radius,
    cx - d, cy + d,
    cx - radius, cy,
    cx - d, cy - d,
    cx, cy - radius,
    cx + d, cy - d,
    cx + radius, cy,
  ];
}

/**
 * Fill a polygon with a one-pixel contour *inside* the same footprint.
 *
 * `poly` alone gives a flat mass that disappears against a same-value
 * neighbour; growing the polygon by one pixel instead fattens the unit and
 * blurs the silhouette. Redrawing each scanline span with dark ends gives the
 * classic pixel-art contour without changing the unit's size, using only `r`.
 */
function mass(a: UnitArt, points: number[], fill: string, edge: string): void {
  const ys: number[] = [];
  for (let i = 1; i < points.length; i += 2) ys.push(points[i]);
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y < y1; y++) {
    const scan = y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      const ax = points[j], ay = points[j + 1], bx = points[i], by = points[i + 1];
      if ((ay <= scan && by > scan) || (by <= scan && ay > scan))
        xs.push(ax + ((scan - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = Math.ceil(xs[i] - 0.5);
      const right = Math.ceil(xs[i + 1] - 0.5);
      if (right - left < 1) continue;
      a.r(left, y, right - left, 1, fill);
      a.r(left, y, 1, 1, edge);
      if (right - left > 3) a.r(right - 1, y, 1, 1, edge);
    }
  }
}

/** Limb with contour: dark stroke first, sleeve on top, both centred on the line. */
function limb(a: UnitArt, points: number[], sleeve: string, edge: string, width = 2): void {
  a.line(points, edge, width + 2);
  a.line(points, sleeve, width);
}

/** Small hand with a readable dark rim (1px details vanish without it). */
function hand(a: UnitArt, x: number, y: number, skin: string, edge: string): void {
  a.r(x - 1, y - 1, 4, 4, edge);
  a.r(x, y, 3, 2, skin);
}

/** Draw the caster slate for this unit; returns false when another role owns it. */
export function drawCasters(a: UnitArt): boolean {
  const role = UNIT_BY_ID[a.id]?.role;
  if (role === 'mage') { drawMage(a); return true; }
  if (role === 'healer') { drawHealer(a); return true; }
  if (role === 'firemage') { drawFiremage(a); return true; }
  return false;
}

// ---------------------------------------------------------------- astral mage
function drawMage(a: UnitArt) {
  const { p, ctx, f } = a;
  const step = a.walk ? [2, 0, -2, 0][f] : 0;
  const bob = a.walk ? (f % 2 ? 1 : 0) : !a.attack && f === 2 ? -1 : 0;
  const lean = a.attack ? [-1, 0, 2, 0][f] : 0;
  const violet = '#5d4e7d';
  const violetLit = '#b9a7d6';
  const star = '#e8f2fb';

  ctx.save();
  ctx.translate(0, bob);

  // Narrow boots below a short hem: the slimmest, most vertical caster.
  for (const [x, c] of [[19 + step, p.steelShadow], [27 - step, p.steelShadow]] as const) {
    a.r(x, 36, 6, 4, p.outline);
    a.r(x + 1, 36, 4, 3, c);
    a.r(x + 3, 36, 1, 3, p.dark);
    a.r(x + 1, 39, 5, 1, '#0c141a');
  }

  ctx.save();
  ctx.translate(lean, 0);

  // Slim A-line robe with one trailing back point (no cape: he stays tall).
  mass(a, [21, 17, 29, 17, 32, 37, 30, 38, 19, 38, 16, 34, 20, 24], p.cloth, p.outline);
  a.poly([29, 17, 32, 37, 30, 38, 27, 24], p.dark);
  a.r(20, 25, 1, 11, p.light);
  a.line([19, 37, 30, 37], p.gold, 1);
  a.poly([15, 34, 19, 30, 19, 38, 16, 37], p.dark);

  // Narrow chest with a high stand collar - a scholar's collar, explicitly not
  // a priestly hood or halo.
  mass(a, [21, 16, 29, 16, 29, 23, 21, 23], p.cloth, p.outline);
  a.poly([27, 17, 29, 22, 25, 22], p.dark);
  a.r(22, 17, 1, 5, p.light);
  a.poly([20, 15, 24, 14, 24, 20, 20, 19], violet);
  a.r(21, 16, 1, 3, violetLit);
  a.poly([23, 16, 28, 16, 25, 20], violet);
  a.r(24, 17, 1, 2, violetLit);
  a.r(21, 22, 8, 2, '#463a4a'); a.r(24, 22, 2, 2, p.gold);

  // Hollow star ring on a forked branch staff: the hole stays open, so this
  // reads as a focus ring rather than a mace head.
  const topX = a.attack ? [33, 35, 37, 34][f] : a.walk ? [35, 36, 35, 36][f] : [35, 35, 36, 35][f];
  const ringY = a.attack ? [11, 10, 12, 11][f] : 11;
  a.line([33, 41, topX, 14], '#191420', 4);
  a.line([33, 41, topX, 14], '#6f5b46', 2);
  a.r(33, 34, 1, 6, '#967f5e');
  a.line([topX - 2, 16, topX - 3, 19], '#6f5b46', 2);
  a.line([topX + 1, 20, topX + 1, 15], '#967f5e', 1);
  a.line(octagon(topX, ringY, 4), p.gold, 2);
  a.line(octagon(topX, ringY, 4), '#f3e8c6', 1);
  a.line(octagon(topX, ringY, 3), violet, 1);
  a.r(topX - 1, ringY - 1, 1, 1, star);

  // Front arm follows the robe's right edge (so it reads as a limb, not a sash),
  // with the hand solved onto the tilted shaft so the prop stays connected.
  const gripY = 25;
  const gripX = Math.round(33 + ((41 - gripY) / (41 - 14)) * (topX - 33));
  limb(a, [29, 17, 32, 21, gripX, gripY], p.cloth, p.outline, 2);
  hand(a, gripX - 1, gripY - 1, p.skin, p.outline);

  // Free hand: gathers the spell inward, then releases it forward - never a swing.
  const gh = a.attack
    ? [[26, 20], [28, 14], [32, 17], [27, 21]][f]
    : a.walk
      ? [[23, 21], [24, 19], [26, 21], [24, 22]][f]
      : [[24, 20], [25, 18], [27, 17], [24, 20]][f];
  limb(a, [21, 18, gh[0], gh[1] + 1], violet, p.outline, 1);
  hand(a, gh[0] - 1, gh[1] - 1, p.skin, p.outline);

  if (a.attack) {
    if (f === 0) a.r(gh[0] + 2, gh[1] - 1, 1, 1, violetLit);
    if (f === 1) {
      a.r(gh[0] + 2, gh[1] - 3, 1, 2, star);
      a.r(gh[0] + 5, gh[1] - 1, 1, 1, violetLit);
      a.r(topX - 2, ringY + 5, 1, 1, star);
    }
    if (f === 2) {
      a.r(gh[0] + 4, gh[1] - 1, 2, 2, star);
      a.r(gh[0] + 7, gh[1] - 3, 1, 1, violetLit);
      a.r(gh[0] + 3, gh[1] + 2, 1, 1, violetLit);
      a.r(topX + 3, ringY + 2, 1, 1, violetLit);
    }
    if (f === 3) a.r(gh[0] + 2, gh[1] - 2, 1, 1, violetLit);
  } else if (f % 2 === 1) {
    a.r(topX + 5, ringY - 4, 1, 1, star);
  }

  // Head: bare face under a three-point arcane circlet with a star gem.
  a.r(23, 16, 3, 2, p.dark);
  mass(a, [22, 9, 30, 9, 30, 16, 27, 18, 22, 16], p.skin, p.outline);
  a.r(24, 10, 5, 1, '#e6cdb0');
  a.r(27, 12, 1, 1, '#1a2430'); a.r(27, 13, 2, 1, '#1a2430');
  a.r(30, 12, 1, 3, '#b08f74');
  a.r(22, 10, 2, 6, p.dark);
  a.r(21, 8, 9, 1, p.gold);
  a.r(22, 9, 7, 1, '#6b5836');
  a.poly([22, 8, 24, 8, 23, 4], violetLit);
  a.poly([25, 8, 27, 8, 26, 2], violetLit);
  a.poly([28, 8, 30, 8, 29, 5], violet);
  a.r(24, 8, 2, 1, star);

  ctx.restore();
  ctx.restore();
}

// -------------------------------------------------------------------- healer
function drawHealer(a: UnitArt) {
  const { p, ctx, f } = a;
  const step = a.walk ? [2, 0, -2, 0][f] : 0;
  const bob = a.walk ? (f % 2 ? 1 : 0) : !a.attack && f === 2 ? -1 : 0;
  const lean = a.attack ? [0, -1, 1, 0][f] : 0;
  const platinum = '#ded4b6';
  const platinumLit = '#f4eed6';
  const platinumSh = '#a89d7e';
  const platinumEdge = '#4e4835';
  const hallow = '#fffbe8';

  ctx.save();
  ctx.translate(0, bob);

  // Flat sandalled stance: the broadest footprint of the three casters.
  for (const [x] of [[18 + step], [28 - step]] as const) {
    a.r(x, 38, 6, 3, p.outline);
    a.r(x + 1, 38, 4, 2, p.leather);
    a.r(x, 40, 6, 1, '#221a14');
  }

  ctx.save();
  ctx.translate(lean, 0);

  // Straight wide under-vest in faction cloth: the largest colour block stays
  // blue or red, so the two armies never merge at battlefield scale.
  mass(a, [19, 22, 31, 22, 33, 38, 16, 39], p.cloth, p.outline);
  a.poly([31, 22, 33, 38, 27, 39], p.dark);
  a.r(20, 24, 1, 11, p.light);
  a.r(24, 29, 1, 8, '#4a6a86');
  a.r(28, 28, 1, 9, '#243a4e');
  a.line([17, 38, 32, 38], p.gold, 1);

  // Wide cloth mantle over the shoulders (horizontal emphasis, widest outline
  // on the caster slate) with a platinum shoulder band and hem trim.
  mass(a, [13, 18, 24, 15, 35, 18, 34, 24, 24, 26, 14, 24], p.cloth, p.outline);
  a.poly([34, 18, 34, 24, 26, 26, 30, 20], p.dark);
  a.r(14, 17, 20, 2, platinumLit);
  a.r(13, 18, 22, 1, platinumSh);
  a.line([15, 24, 24, 26, 33, 24], platinum, 1);
  // Short square half-cape at the back: ends at the waist, no long train.
  mass(a, [17, 19, 21, 19, 19, 31, 11, 32, 12, 25], p.dark, p.outline);
  a.line([13, 25, 17, 30], p.light, 1);
  a.r(12, 31, 7, 1, p.light);
  // Dawn cross on the chest, on the platinum band so it stays legible.
  a.r(24, 18, 1, 6, p.gold); a.r(23, 19, 4, 1, hallow); a.r(24, 19, 1, 5, hallow);

  // Platinum hood: a rounded cowl with a dark opening rim - deliberately not
  // long hair, and with the shadow kept on the back/right so the face reads.
  mass(a, [17, 17, 17, 9, 23, 4, 29, 4, 32, 9, 32, 16, 19, 16], platinum, platinumEdge);
  a.poly([30, 5, 32, 9, 32, 16, 29, 16, 30, 10, 28, 6], platinumSh);
  a.line([19, 15, 18, 9, 24, 5], platinumLit, 1);
  a.r(21, 9, 10, 1, platinumSh);
  mass(a, [22, 10, 30, 10, 30, 15, 26, 17, 22, 15], p.skin, platinumEdge);
  a.r(23, 10, 6, 1, '#e8ceb2');
  a.r(27, 12, 1, 1, '#1d262e');
  a.r(27, 13, 2, 1, '#1d262e');
  a.r(30, 13, 1, 2, '#b08f74');
  a.r(23, 9, 7, 1, p.gold);
  a.r(26, 10, 1, 2, hallow); a.r(25, 10, 3, 1, hallow);

  // Short cross-staff with a filled sun disc at chest height - much lower and
  // solid compared with the mage's open ring at head height.
  const discY = a.attack ? [25, 20, 17, 24][f] : a.walk ? [25, 26, 25, 26][f] : [25, 25, 26, 25][f];
  const discX = 37;
  a.line([37, 41, 37, discY + 3], '#191410', 3);
  a.line([37, 41, 37, discY + 3], '#8a7551', 1);
  a.poly(octagon(discX, discY, 4), platinumEdge);
  a.poly(octagon(discX, discY, 3), p.gold);
  a.r(discX - 1, discY - 1, 3, 3, '#f8f0cd');
  a.r(discX, discY - 2, 1, 5, hallow);
  a.r(discX - 2, discY, 5, 1, hallow);

  // Front arm holding the staff upright (pale sleeve on the blue mantle).
  limb(a, [29, 18, 34, 27, 36, 29], platinum, platinumEdge, 2);
  a.r(34, 28, 2, 2, p.cloth);
  hand(a, 36, 29, p.skin, p.outline);

  // Free hand: blessing gestures only - a raised palm, never a swing.
  const bh = a.attack
    ? [[30, 16], [32, 13], [23, 20], [29, 18]][f]
    : a.walk
      ? [[30, 19], [31, 17], [31, 20], [30, 20]][f]
      : [[29, 20], [30, 18], [31, 19], [29, 21]][f];
  limb(a, [27, 18, bh[0], bh[1] + 1], platinum, platinumEdge, 1);
  hand(a, bh[0] - 1, bh[1] - 1, p.skin, platinumEdge);

  if (a.attack) {
    if (f === 1 || f === 2) {
      a.r(discX - 5, discY - 4, 1, 1, '#f8f0cd');
      a.r(discX + 4, discY - 3, 1, 1, '#f8f0cd');
      a.r(discX - 4, discY + 4, 1, 1, '#f1e6bd');
    }
    if (f === 2) {
      a.r(discX - 6, discY - 1, 2, 1, hallow);
      a.r(discX + 5, discY + 1, 2, 1, hallow);
      a.r(discX, discY - 5, 1, 2, hallow);
      a.r(bh[0] - 3, bh[1] - 1, 1, 1, hallow);
      a.r(bh[0] - 4, bh[1] + 1, 2, 1, hallow);
    }
  } else if (f % 2 === 1) {
    a.r(discX + 4, discY - 4, 1, 1, hallow);
  }

  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ fire mage
function drawFiremage(a: UnitArt) {
  const { p, ctx, f } = a;
  const step = a.walk ? [2, 0, -2, 0][f] : 0;
  const bob = a.walk ? (f % 2 ? 1 : 0) : !a.attack && f === 2 ? -1 : 0;
  const lean = a.attack ? [0, 1, 2, 1][f] : 0;
  const soot = '#4a3a32';
  const ember = '#f0975a';
  const flameLit = '#ffd28d';
  const brass = '#a98a58';
  const brassEdge = '#3a2a1c';

  ctx.save();
  ctx.translate(0, bob);

  // Heavy low stance: the shortest, most forward-leaning caster.
  for (const [x] of [[19 + step], [28 - step]] as const) {
    a.r(x, 38, 6, 3, p.outline);
    a.r(x + 1, 38, 4, 2, '#4a352a');
    a.r(x, 40, 6, 1, '#100b09');
  }

  ctx.save();
  ctx.translate(lean, 0);

  // Torn, scorched robe: jagged hem and hanging strips instead of a clean
  // A-line, so the outline alone separates him from the other two.
  mass(
    a,
    [24, 20, 33, 20, 35, 30, 33, 33, 32, 41, 29, 36, 27, 40, 24, 35, 21, 39, 18, 31, 20, 24],
    p.cloth,
    p.outline,
  );
  a.poly([33, 20, 35, 30, 33, 33, 32, 41, 31, 30], p.dark);
  a.r(21, 26, 1, 6, p.light);
  a.r(24, 30, 1, 5, '#4a6a86');
  a.poly([27, 25, 31, 25, 30, 30, 27, 31], soot);
  a.r(24, 35, 2, 2, '#2a2226');
  a.r(29, 26, 1, 2, ember);

  // Heavy shoulder wrap in faction cloth, plus the stoked collar pushed back.
  mass(a, [22, 19, 33, 18, 34, 24, 23, 25], p.cloth, p.outline);
  a.poly([33, 18, 34, 24, 28, 24, 31, 20], p.dark);
  a.r(23, 19, 2, 3, p.light);
  mass(a, [21, 16, 27, 12, 28, 20, 21, 22], '#3f2d26', p.outline);
  a.r(23, 17, 1, 3, soot);

  // Crooked staff with a wide brazier bowl.
  const bowlX = a.attack ? [35, 36, 39, 36][f] : a.walk ? [39, 38, 39, 38][f] : [39, 39, 38, 39][f];
  const bowlY = a.attack ? [18, 17, 20, 17][f] : 18;
  a.line([34, 42, 36, 32, 34, 25, bowlX, bowlY + 4], '#171010', 4);
  a.line([34, 42, 36, 32, 34, 25, bowlX, bowlY + 4], '#7a5a41', 2);
  a.r(35, 30, 1, 9, '#96714f');
  a.poly([bowlX - 5, bowlY - 1, bowlX + 5, bowlY - 1, bowlX + 4, bowlY + 5, bowlX - 4, bowlY + 5], brassEdge);
  a.poly([bowlX - 4, bowlY, bowlX + 4, bowlY, bowlX + 3, bowlY + 4, bowlX - 3, bowlY + 4], brass);
  a.poly([bowlX - 3, bowlY + 1, bowlX + 3, bowlY + 1, bowlX + 2, bowlY + 3, bowlX - 2, bowlY + 3], '#2a1b16');
  a.r(bowlX - 4, bowlY, 8, 1, '#d8bb80');
  // Burning brazier: three jagged tongues over the coals.
  const y0 = bowlY - 2;
  a.poly([bowlX - 3, y0, bowlX - 2, y0 - 3, bowlX - 1, y0 - 1, bowlX, y0 - 5, bowlX + 1, y0 - 1, bowlX + 2, y0 - 3, bowlX + 3, y0], ember);
  a.r(bowlX - 1, y0 - 2, 1, 2, flameLit);
  a.r(bowlX + 1, y0 - 1, 1, 1, flameLit);

  // Rear arm gripping the shaft below the bowl.
  limb(a, [26, 20, 31, 26, 33, 28], p.cloth, p.outline, 2);
  hand(a, 33, 28, p.skin, p.outline);

  // Front bare arm throws the fire from an open palm while the body lunges.
  const fh = a.attack
    ? [[32, 25], [34, 25], [36, 24], [33, 25]][f]
    : a.walk
      ? [[30, 25], [32, 24], [34, 25], [32, 26]][f]
      : [[30, 24], [31, 23], [32, 24], [31, 25]][f];
  mass(a, [28, 19, 31, 19, 32, 24, 28, 24], '#3b2b23', p.outline);
  limb(a, [29, 22, fh[0], fh[1]], p.skin, p.outline, 2);
  hand(a, fh[0] - 1, fh[1] - 1, p.skin, p.outline);

  if (a.attack) {
    if (f === 1) {
      a.r(fh[0] + 2, fh[1] + 1, 2, 2, flameLit);
      a.r(fh[0] + 5, fh[1], 1, 1, ember);
    }
    if (f === 2) {
      a.r(fh[0] + 2, fh[1] - 1, 2, 2, ember);
      a.r(fh[0] + 4, fh[1], 3, 2, flameLit);
      a.r(fh[0] + 7, fh[1] - 1, 2, 2, ember);
      a.r(fh[0] + 3, fh[1] + 3, 1, 1, flameLit);
    }
    if (f === 3) a.r(fh[0] + 3, fh[1] - 2, 1, 1, ember);
  } else if (f % 2 === 1) {
    a.r(bowlX + 5, bowlY - 5, 1, 1, flameLit);
  }

  // Bare head: the roster's only bald crown, pushed forward over the collar but
  // clear of the brazier so the silhouette never merges with the prop.
  a.r(27, 18, 4, 2, p.dark);
  mass(a, [24, 9, 32, 10, 34, 16, 30, 19, 24, 18, 21, 14], p.skin, p.outline);
  a.poly([25, 10, 30, 10, 31, 13, 25, 13], '#e9cba8');
  a.r(30, 14, 1, 1, '#1c1410');
  a.r(33, 14, 1, 3, '#c9a688');
  a.r(24, 16, 6, 2, '#3b2b23');
  a.r(23, 14, 1, 3, '#3b2b23');

  ctx.restore();
  ctx.restore();
}
