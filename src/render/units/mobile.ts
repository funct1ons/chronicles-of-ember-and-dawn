import type { UnitArt } from './pixelArt';

/**
 * Mobile / light-role sprite pack for the seven maneuver units.
 *
 * Only the shared `r`/`poly`/`line` tools are reused (plus the army palette);
 * every unit below owns its anatomy, proportions, stance and weapon language.
 * All drawing is integer-source-pixel rasterised by UnitArt, never raw ctx paths,
 * so alpha stays 0/255 and nothing may leave the 48x48 source window.
 *
 * Conventions: feet rest on rows 39..41 (ground line y=42), the unit faces right
 * and the key light comes from the upper-left (lit edges top/left, shadow bottom/right).
 *
 * Material recipe (kept uniform so the army reads as one pixel density):
 *   cloth  = p.cloth + p.light lit edge + p.dark folds + p.gold trim
 *   leather= p.leather + p.wood lit edge + p.outline contour
 *   steel  = p.steelShadow base + p.metal plane + p.shine glint
 *   wood   = p.leather base + p.wood lit edge
 *   skin   = p.skin + SKIN_HI + SKIN_LO
 */

const SKIN_HI = '#e7ccb0';
const SKIN_LO = '#7a5e4a';

export function drawMobile(a: UnitArt): boolean {
  const draw = MOBILE[a.id];
  if (!draw) return false;
  a.ctx.save();
  draw(a);
  a.ctx.restore();
  return true;
}

type UnitDraw = (a: UnitArt) => void;

const MOBILE: Record<string, UnitDraw> = { runner, bow, crossbow, rider, knight, assassin, ballista };

/* ------------------------------------------------------------------------- */
/* runner - 逐风斥候: tall, forward-leaning, open-faced cloth hood, short       */
/* capelet, cloth leg wraps and one short falchion. The opposite of the low,   */
/* dark, dual-blade assassin.                                                 */
/* ------------------------------------------------------------------------- */
function runner(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, -1][f] : atk ? [0, 0, 0, -1][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const footX = run ? [33, 31, 28, 30][f] : atk ? [33, 36, 37, 32][f] : 31;
  const rearX = run ? [13, 16, 18, 16][f] : atk ? [16, 17, 15, 16][f] : 17;
  const footY = run && f === 1 ? 39 : 41;
  const rearY = run && f === 3 ? 39 : 41;
  const lean = run ? 1 : atk ? [0, 0, 1, 0][f] : 0;
  const handX = atk ? [31, 35, 38, 34][f] : run ? [35, 33, 32, 34][f] : 35;
  const handY = atk ? [20, 22, 23, 26][f] : run ? [23, 24, 24, 23][f] : 23;
  const tipX = atk ? [36, 43, 44, 39][f] : run ? [41, 43, 41, 39][f] : 42;
  const tipY = atk ? [14, 18, 23, 31][f] : run ? [19, 21, 26, 20][f] : 19;
  const rearHandX = run ? [18, 20, 21, 19][f] : atk ? [19, 20, 21, 19][f] : 19;
  const rearHandY = run ? [24, 25, 25, 24][f] : atk ? [24, 25, 25, 24][f] : 25;

  // short capelet, cloth face with a dark under-hem and gold clasp
  poly([24, 16, 27, 17, 23, 22, 18, 24, 12, 26, 10, 23, 16, 19, 21, 17], p.dark);
  poly([23, 17, 25, 18, 22, 22, 18, 23, 13, 24, 12, 22, 17, 20, 21, 18], p.cloth);
  r(13, 23, 5, 1, p.dark);
  r(17, 19, 4, 1, p.light);
  r(22, 17, 2, 2, p.gold);
  r(22, 17, 1, 1, p.shine);

  // rear leg: leather trousers, cloth shin wrap, soft boot
  const rearKnee = Math.round((22 + rearX) / 2) - 1;
  line([22, 28, rearKnee, 34, rearX, rearY - 2], p.dark, 3);
  line([22, 28, rearKnee, 34, rearX, rearY - 2], p.leather, 1);
  r(rearKnee - 1, 33, 3, 2, p.cloth);
  r(rearKnee - 1, 36, 3, 2, p.cloth);
  r(rearX - 3, rearY - 2, 7, 2, p.outline);
  r(rearX - 2, rearY - 2, 5, 1, p.leather);
  r(rearX - 3, rearY, 7, 1, p.outline);
  r(rearX + 1, rearY - 1, 2, 1, p.steelShadow);

  // lead leg planted forward
  const frontKnee = Math.round((25 + footX) / 2) + 1;
  line([25, 28, frontKnee, 34, footX, footY - 2], p.dark, 3);
  line([25, 28, frontKnee, 34, footX, footY - 2], p.leather, 1);
  r(frontKnee - 1, 33, 3, 2, p.cloth);
  r(frontKnee - 1, 36, 3, 2, p.cloth);
  r(footX - 3, footY - 2, 8, 2, p.outline);
  r(footX - 2, footY - 2, 6, 1, p.leather);
  r(footX - 3, footY, 8, 1, p.outline);
  r(footX + 1, footY - 1, 3, 1, p.steelShadow);

  // tunic: broad faction cloth with a small shadowed side and gold hem
  poly([19, 28, 20 + lean, 18, 29 + lean, 17, 32, 25, 28, 30, 21, 30], p.dark);
  poly([21, 19, 28 + lean, 18, 30 + lean, 24, 27, 29, 22, 28], p.cloth);
  poly([26 + lean, 19, 29 + lean, 18, 30, 23, 27, 28, 25, 25], p.dark);
  line([22, 20, 22, 27], p.light, 1);
  line([23, 20, 24, 27], p.light, 1);
  r(22, 27, 7, 1, p.gold);
  r(21, 26, 9, 2, p.leather);
  r(25, 26, 2, 2, p.gold);
  r(25, 26, 1, 1, p.shine);
  r(19, 27, 3, 3, p.leather);

  // collar scarf keeps faction colour at the neck
  r(25, 16, 6, 2, p.cloth);
  r(24, 17, 3, 2, p.light);
  r(28, 17, 2, 2, p.gold);

  // trailing arm with a cloth sleeve
  line([24, 20, rearHandX + 1, rearHandY + 2, rearHandX, rearHandY], p.dark, 3);
  line([24, 20, rearHandX + 1, rearHandY + 2, rearHandX, rearHandY], p.cloth, 1);
  r(rearHandX - 1, rearHandY - 1, 3, 3, p.skin);
  r(rearHandX - 1, rearHandY - 1, 2, 1, SKIN_HI);
  r(rearHandX - 1, rearHandY - 1, 2, 2, p.cloth);

  // open-faced hood: the lit face is fully visible, the cowl only wraps crown/nape
  const hx = lean;
  poly([25 + hx, 8, 31 + hx, 7, 35 + hx, 10, 34 + hx, 16, 29 + hx, 18, 26 + hx, 14], p.dark);
  poly([26 + hx, 9, 31 + hx, 8, 33 + hx, 10, 32 + hx, 15, 29 + hx, 16, 27 + hx, 13], p.cloth);
  r(27 + hx, 10, 4, 2, p.dark);
  line([27 + hx, 10, 26 + hx, 14], p.light, 1);
  r(29 + hx, 15, 4, 2, p.cloth);
  r(30 + hx, 12, 3, 4, p.skin);
  r(30 + hx, 12, 2, 1, SKIN_HI);
  r(32 + hx, 13, 1, 1, p.outline);
  r(31 + hx, 16, 2, 1, SKIN_LO);
  r(26 + hx, 15, 3, 2, p.gold);

  // lead arm and short falchion: hilt, guard, single-edged blade
  line([28 + hx, 20, 31, 22, handX - 1, handY], p.dark, 3);
  line([28 + hx, 20, 31, 22, handX - 1, handY], p.cloth, 1);
  line([handX + 1, handY, tipX, tipY], p.dark, 3);
  line([handX + 1, handY, tipX, tipY], p.metal, 1);
  r(handX + 2, handY - 1, 1, 1, p.shine);
  r(tipX, tipY, 1, 1, p.shine);
  line([handX + 1, handY - 2, handX + 2, handY + 1], p.gold, 1);
  r(handX, handY, 2, 2, p.leather);
  r(handX - 1, handY - 1, 3, 3, p.skin);
  r(handX - 1, handY - 1, 2, 1, SKIN_HI);
}

/* ------------------------------------------------------------------------- */
/* assassin - 夜幕行者: low asymmetric crouch, long hood tail, slanted cloth   */
/* cape, two clearly readable short blades. Shorter and darker than the runner */
/* but still faction-coloured, never a recoloured copy of it.                  */
/* ------------------------------------------------------------------------- */
function assassin(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, 0][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const footX = run ? [34, 33, 29, 31][f] : atk ? [33, 35, 34, 32][f] : 33;
  const rearX = run ? [11, 13, 17, 14][f] : atk ? [15, 14, 16, 16][f] : 14;
  const handX = atk ? [34, 37, 35, 37][f] : run ? [34, 36, 33, 35][f] : 36;
  const handY = atk ? [21, 24, 28, 27][f] : run ? [25, 26, 26, 25][f] : 25;
  const tipX = atk ? [40, 44, 41, 43][f] : run ? [41, 43, 40, 42][f] : 43;
  const tipY = atk ? [15, 32, 34, 30][f] : run ? [23, 24, 30, 23][f] : 20;
  const rearHandX = atk ? [16, 18, 30, 29][f] : run ? [14, 16, 17, 15][f] : 15;
  const rearHandY = atk ? [28, 29, 27, 28][f] : run ? [29, 29, 28, 28][f] : 29;
  const rearTipX = atk ? [9, 12, 38, 33][f] : run ? [9, 11, 12, 10][f] : 8;
  const rearTipY = atk ? [31, 33, 20, 34][f] : run ? [34, 35, 33, 34][f] : 34;

  // slanted cape: broad cloth face, only the hem is dark
  poly([26, 20, 22, 24, 13, 30, 8, 33, 10, 36, 14, 33, 17, 36, 23, 30, 29, 23], p.dark);
  poly([25, 21, 21, 25, 13, 31, 10, 32, 12, 33, 15, 31, 18, 33, 22, 28, 27, 23], p.cloth);
  r(11, 33, 4, 1, p.dark);
  r(16, 32, 4, 1, p.dark);
  r(19, 27, 5, 1, p.light);
  r(24, 21, 2, 2, p.gold);
  line([21, 24, 13, 31], p.light, 1);

  // rear arm and reverse-grip blade (behind the torso)
  line([22, 24, rearHandX + 1, rearHandY - 2, rearHandX, rearHandY], p.dark, 3);
  line([22, 24, rearHandX + 1, rearHandY - 2, rearHandX, rearHandY], p.leather, 1);
  r(rearHandX - 2, rearHandY - 4, 3, 2, p.cloth);
  line([rearHandX, rearHandY, rearTipX, rearTipY], p.dark, 3);
  line([rearHandX, rearHandY, rearTipX, rearTipY], p.metal, 1);
  r(rearTipX, rearTipY, 1, 1, p.shine);
  line([rearHandX - 1, rearHandY - 1, rearHandX + 1, rearHandY + 1], p.gold, 1);
  r(rearHandX, rearHandY, 2, 2, p.leather);
  r(rearHandX - 1, rearHandY - 1, 3, 3, p.skin);
  r(rearHandX - 1, rearHandY, 1, 1, SKIN_HI);

  // wide low stance, cloth-tied shins
  const rearKnee = Math.round((20 + rearX) / 2) - 1;
  line([20, 30, rearKnee, 34, rearX, 39], p.dark, 3);
  line([20, 30, rearKnee, 34, rearX, 39], p.leather, 1);
  r(rearKnee - 1, 33, 3, 2, p.cloth);
  r(rearKnee - 1, 36, 3, 2, p.cloth);
  r(rearX - 3, 39, 7, 2, p.outline);
  r(rearX - 2, 39, 5, 1, p.leather);
  r(rearX - 3, 41, 7, 1, p.outline);
  const frontKnee = Math.round((25 + footX) / 2) + 1;
  line([25, 31, frontKnee, 33, footX, 39], p.dark, 3);
  line([25, 31, frontKnee, 33, footX, 39], p.leather, 1);
  r(frontKnee - 1, 32, 3, 2, p.cloth);
  r(frontKnee - 1, 36, 3, 2, p.cloth);
  r(footX - 3, 39, 8, 2, p.outline);
  r(footX - 2, 39, 6, 1, p.leather);
  r(footX - 3, 41, 8, 1, p.outline);

  // crouched dark torso crossed by a broad faction sash
  poly([18, 31, 20, 22, 29, 20, 33, 27, 29, 33, 22, 33], p.dark);
  poly([20, 23, 28, 21, 31, 27, 28, 31, 21, 31], p.dark);
  poly([21, 23, 25, 22, 24, 30, 21, 30], p.cloth);
  line([24, 26, 23, 30], p.dark, 1);
  poly([21, 23, 29, 26, 29, 29, 21, 26], p.cloth);
  r(20, 27, 9, 2, p.cloth);
  line([21, 27, 27, 27], p.light, 1);
  line([22, 24, 27, 26], p.light, 1);
  r(24, 25, 2, 2, p.gold);
  r(20, 30, 8, 2, p.leather);
  r(20, 30, 8, 1, p.gold);
  r(26, 20, 5, 2, p.cloth);
  r(27, 20, 3, 1, p.light);
  r(29, 21, 1, 1, p.gold);

  // long asymmetric hood with tail; one lit eye keeps the shadowed face readable
  poly([22, 13, 28, 10, 34, 12, 35, 18, 31, 21, 26, 19, 21, 17], p.dark);
  poly([14, 11, 22, 13, 21, 16, 25, 18, 23, 21, 18, 18, 11, 13], p.dark);
  poly([23, 13, 28, 11, 33, 13, 33, 17, 30, 19, 26, 18, 22, 16], p.dark);
  poly([15, 12, 21, 14, 21, 16, 17, 15, 12, 13], p.dark);
  line([23, 14, 21, 18, 17, 19], p.cloth, 1);
  r(21, 15, 3, 4, p.cloth);
  r(22, 15, 2, 1, p.light);
  r(21, 19, 2, 1, p.gold);
  r(16, 13, 3, 2, p.cloth);
  r(17, 13, 2, 1, p.gold);
  r(19, 17, 2, 1, p.cloth);
  r(19, 17, 1, 1, p.gold);
  line([27, 10, 16, 12], p.light, 1);
  r(22, 16, 2, 2, p.cloth);
  r(30, 16, 3, 3, p.skin);
  r(30, 16, 2, 1, SKIN_HI);
  r(32, 17, 1, 1, p.shine);
  r(29, 15, 1, 4, p.outline);

  // lead arm + forward blade, drawn last so the hand sits on the grip
  line([30, 23, handX - 1, handY - 1, handX, handY], p.dark, 3);
  line([30, 23, handX - 1, handY - 1, handX, handY], p.leather, 1);
  r(handX - 3, handY - 3, 3, 2, p.cloth);
  line([handX, handY, tipX, tipY], p.dark, 3);
  line([handX, handY, tipX, tipY], p.metal, 1);
  r(handX + 1, handY - 1, 1, 1, p.shine);
  r(tipX, tipY, 1, 1, p.shine);
  line([handX - 1, handY - 1, handX + 1, handY + 1], p.gold, 1);
  r(handX, handY, 2, 2, p.leather);
  r(handX - 1, handY - 1, 3, 3, p.skin);
}

/* ------------------------------------------------------------------------- */
/* bow - 灰羽游侠: side-on archer, tall recurve bow, back quiver, grey feather. */
/* Four attack beats: nock, draw, full draw at the cheek, loose.               */
/* ------------------------------------------------------------------------- */
function bow(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, -1][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const footX = run ? [33, 31, 28, 30][f] : atk ? [32, 32, 33, 32][f] : 31;
  const rearX = run ? [13, 16, 18, 16][f] : atk ? [17, 17, 16, 17][f] : 17;
  const bx = atk ? 34 : run ? 32 : 33;

  // broad cloak and quiver behind the body
  poly([27, 17, 22, 21, 14, 27, 13, 30, 17, 30, 21, 27, 26, 23, 28, 20], p.dark);
  poly([26, 18, 21, 22, 15, 27, 15, 29, 18, 28, 22, 25, 26, 22, 27, 20], p.cloth);
  r(15, 28, 4, 1, p.gold);
  r(19, 20, 5, 1, p.light);
  line([22, 21, 16, 27], p.dark, 1);
  poly([19, 14, 23, 16, 17, 27, 13, 25], p.dark);
  poly([19, 15, 22, 17, 16, 26, 14, 25], p.cloth);
  line([19, 17, 15, 25], p.leather, 1);
  r(15, 22, 3, 2, p.leather);
  r(16, 20, 4, 3, p.dark);
  r(15, 20, 4, 2, p.cloth);
  line([18, 16, 14, 24], p.gold, 1);
  line([20, 15, 18, 8], p.outline, 1);
  line([20, 15, 18, 9], p.wood, 1);
  r(17, 7, 2, 2, p.light);
  line([22, 16, 21, 9], p.outline, 1);
  r(20, 8, 2, 2, p.light);
  line([18, 16, 15, 10], p.outline, 1);
  r(14, 9, 2, 2, p.light);
  r(18, 7, 1, 1, p.gold);
  r(21, 8, 1, 1, p.gold);

  // legs: leather boots over cloth trousers
  const rearKnee = Math.round((21 + rearX) / 2) - 1;
  line([21, 30, rearKnee, 35, rearX, 39], p.dark, 3);
  line([21, 30, rearKnee, 35, rearX, 39], p.cloth, 1);
  r(rearKnee - 1, 36, 3, 1, p.leather);
  r(rearKnee - 1, 34, 3, 2, p.cloth);
  r(rearKnee - 1, 31, 3, 3, p.cloth);
  r(rearX - 3, 39, 7, 2, p.outline);
  r(rearX - 2, 39, 5, 1, p.leather);
  const frontKnee = Math.round((26 + footX) / 2) + 1;
  line([26, 30, frontKnee, 35, footX, 39], p.dark, 3);
  line([26, 30, frontKnee, 35, footX, 39], p.cloth, 1);
  r(frontKnee - 1, 36, 3, 1, p.leather);
  r(frontKnee - 1, 34, 3, 2, p.cloth);
  r(frontKnee - 1, 31, 3, 3, p.cloth);
  r(footX - 3, 39, 8, 2, p.outline);
  r(footX - 2, 39, 6, 1, p.leather);
  r(footX - 3, 41, 8, 1, p.outline);

  // slim torso with a broad faction tabard, leather chest strap and gold stripe
  poly([20, 30, 22, 19, 30, 18, 33, 27, 28, 31], p.dark);
  poly([22, 20, 29, 19, 31, 26, 27, 30], p.cloth);
  poly([27, 20, 30, 19, 31, 25, 27, 29], p.dark);
  line([22, 22, 23, 29], p.light, 1);
  line([22, 21, 24, 28], p.light, 1);
  r(23, 22, 5, 2, p.cloth);
  line([24, 22, 26, 23], p.light, 1);
  r(27, 23, 1, 1, p.gold);
  line([23, 20, 26, 29], p.leather, 1);
  r(25, 23, 2, 2, p.gold);
  r(22, 29, 7, 1, p.gold);
  r(22, 28, 7, 2, p.leather);
  r(25, 28, 2, 2, p.gold);

  // head: cloth hood and the grey wing-feather of the 灰羽
  poly([25, 10, 30, 8, 34, 11, 34, 15, 30, 17, 26, 15], p.dark);
  poly([26, 11, 30, 9, 32, 11, 32, 14, 29, 15, 27, 13], p.cloth);
  r(27, 11, 3, 2, p.dark);
  line([27, 15, 31, 16], p.cloth, 1);
  r(27, 15, 2, 2, p.gold);
  r(30, 11, 3, 4, p.skin);
  r(30, 11, 2, 1, SKIN_HI);
  r(32, 12, 1, 1, p.outline);
  r(31, 14, 2, 1, SKIN_LO);
  poly([29, 9, 25, 5, 23, 6, 27, 10], p.dark);
  poly([28, 8, 25, 5, 24, 7], p.metal);
  poly([28, 8, 26, 6, 25, 7], p.shine);
  r(23, 5, 1, 1, p.dark);

  // bow: tall recurve, lit belly, leather grip
  const bowPts = [bx, 9, bx + 3, 12, bx + 5, 16, bx + 6, 22, bx + 5, 28, bx + 3, 32, bx, 35];
  line(bowPts, p.outline, 3);
  line(bowPts, p.wood, 1);
  r(bx + 3, 12, 1, 1, p.shine);
  r(bx + 6, 20, 1, 2, p.shine);
  r(bx + 4, 29, 1, 1, p.shine);
  r(bx - 1, 20, 3, 7, p.leather);
  r(bx - 1, 20, 3, 1, p.steelShadow);

  // string, arrow and drawing hand per attack phase
  const drawX = atk ? [31, 28, 27, 25][f] : 0;
  const drawY = atk ? [22, 21, 21, 17][f] : 0;
  if (atk) {
    if (f < 3) line([bx, 10, drawX, drawY, bx, 34], p.shine, 1);
    else line([bx, 10, bx + 2, 22, bx, 34], p.shine, 1);
    if (f < 3) {
      const nockX = [31, 28, 27, 0][f];
      line([nockX, 22, 40, 22], p.wood, 1);
      poly([40, 21, 43, 22, 40, 23], p.shine);
      poly([nockX - 1, 21, nockX + 2, 21, nockX + 1, 23, nockX - 1, 23], p.light);
      r(nockX - 1, 21, 1, 1, p.gold);
    }
  } else {
    line([bx, 10, bx, 34], p.shine, 1);
    line([28, 27, 36, 25], p.outline, 1);
    r(36, 24, 1, 1, p.shine);
    r(28, 27, 2, 1, p.gold);
  }

  // bow arm to the grip (hand always on the leather)
  line([28, 20, 31, 23, bx - 1, 24], p.dark, 3);
  line([28, 20, 31, 23, bx - 1, 24], p.cloth, 1);
  r(bx - 2, 22, 3, 3, p.skin);
  r(bx - 2, 22, 2, 1, SKIN_HI);
  r(bx - 2, 24, 2, 1, SKIN_LO);

  // drawing arm: nock, draw to the cheek, loose
  const elbowX = atk ? [30, 25, 21, 20][f] : run ? [21, 23, 24, 22][f] : 22;
  const elbowY = atk ? [25, 24, 23, 21][f] : run ? [25, 26, 26, 25][f] : 26;
  const restX = atk ? drawX : run ? [20, 22, 23, 21][f] : 22;
  const restY = atk ? drawY : run ? [26, 27, 27, 26][f] : 27;
  line([25, 21, elbowX, elbowY, restX, restY], p.dark, 3);
  line([25, 21, elbowX, elbowY, restX, restY], p.cloth, 1);
  r(restX - 1, restY - 1, 3, 3, p.skin);
  r(restX - 1, restY - 1, 2, 1, SKIN_HI);
  if (atk && f < 3) {
    r(restX, restY - 1, 1, 3, p.leather);
    r(restX + 1, restY, 1, 1, p.leather);
  }
}

/* ------------------------------------------------------------------------- */
/* crossbow - 钢弦弩手: squat short-robed gunner with a wide-brim hat and a     */
/* compact dark crossbow held across the body. Attack beats: aim, recoil,      */
/* span at the crank, then re-loaded.                                          */
/* ------------------------------------------------------------------------- */
function crossbow(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, 0][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const footX = run ? [33, 31, 29, 31][f] : atk ? [32, 32, 33, 32][f] : 31;
  const rearX = run ? [18, 20, 16, 18][f] : atk ? [19, 19, 18, 19][f] : 19;

  // short robe: the dominant cloth block (faction colour), dark folds only at the hem
  poly([17, 19, 29, 18, 33, 26, 32, 34, 27, 38, 20, 37, 16, 29], p.dark);
  poly([19, 20, 28, 19, 31, 26, 30, 33, 26, 36, 21, 35, 18, 28], p.cloth);
  poly([27, 20, 31, 26, 29, 32, 26, 35, 25, 31], p.cloth);
  line([29, 27, 26, 34], p.dark, 1);
  line([19, 21, 19, 29], p.light, 1);
  line([21, 20, 22, 30], p.light, 1);
  line([20, 32, 26, 34], p.gold, 1);
  line([21, 34, 25, 35], p.gold, 1);
  r(18, 28, 13, 2, p.leather);
  r(24, 28, 2, 2, p.gold);
  r(24, 28, 1, 1, p.shine);
  r(17, 27, 3, 4, p.leather);
  r(17, 27, 3, 1, p.wood);
  r(18, 29, 1, 1, p.gold);

  // legs and boots under the skirt
  const rearKnee = Math.round((21 + rearX) / 2) - 1;
  line([21, 32, rearKnee, 36, rearX, 39], p.dark, 3);
  line([21, 32, rearKnee, 36, rearX, 39], p.cloth, 1);
  r(rearKnee - 1, 34, 3, 3, p.cloth);
  r(rearX - 3, 39, 7, 2, p.outline);
  r(rearX - 2, 39, 5, 1, p.leather);
  r(rearX - 3, 41, 7, 1, p.outline);
  const frontKnee = Math.round((26 + footX) / 2) + 1;
  line([26, 32, frontKnee, 36, footX, 39], p.dark, 3);
  line([26, 32, frontKnee, 36, footX, 39], p.cloth, 1);
  r(frontKnee - 1, 34, 3, 3, p.cloth);
  r(footX - 3, 39, 8, 2, p.outline);
  r(footX - 2, 39, 6, 1, p.leather);
  r(footX - 3, 41, 8, 1, p.outline);
  r(footX + 1, 39, 3, 1, p.steelShadow);

  // padded cloth gambeson with leather straps and a cloth shoulder mantle
  poly([19, 18, 28, 17, 30, 27, 20, 28], p.dark);
  poly([20, 19, 27, 18, 29, 26, 21, 27], p.cloth);
  poly([26, 19, 29, 26, 26, 26, 24, 21], p.dark);
  line([21, 20, 23, 26], p.light, 1);
  line([22, 19, 26, 26], p.leather, 1);
  poly([19, 18, 27, 17, 29, 21, 21, 22], p.cloth);
  line([20, 18, 27, 18], p.light, 1);
  r(20, 22, 7, 1, p.cloth);
  r(24, 16, 5, 1, p.cloth);
  r(33, 13, 2, 1, p.gold);
  r(22, 20, 2, 2, p.gold);
  r(20, 26, 9, 2, p.leather);
  r(24, 26, 2, 2, p.gold);

  // wide-brim hat: dark steel brim, short crown, cloth band
  poly([20, 14, 35, 13, 37, 15, 21, 16], p.dark);
  poly([21, 14, 35, 13, 36, 14, 22, 15], p.steelShadow);
  r(22, 13, 9, 1, p.steelShadow);
  r(25, 9, 8, 5, p.outline);
  r(26, 9, 6, 5, p.cloth);
  r(26, 9, 1, 4, p.light);
  r(31, 10, 1, 3, p.dark);
  r(29, 9, 1, 1, p.metal);
  r(25, 12, 8, 2, p.cloth);
  r(32, 12, 1, 2, p.gold);
  r(27, 15, 4, 4, p.skin);
  r(27, 15, 3, 1, SKIN_HI);
  r(29, 16, 1, 1, p.outline);
  r(28, 18, 2, 1, p.leather);

  // crossbow pose: rear/front on the stock, kept inside the frame
  let rearSX = 19, rearSY = 28, frontSX = 35, frontSY = 24;
  let phase: 'loaded' | 'aim' | 'released' | 'half' = 'loaded';
  if (run) { rearSX = 20; rearSY = 27; frontSX = 35; frontSY = 23; }
  if (atk) {
    if (f === 0) { rearSX = 18; rearSY = 27; frontSX = 35; frontSY = 25; phase = 'aim'; }
    if (f === 1) { rearSX = 18; rearSY = 25; frontSX = 34; frontSY = 24; phase = 'released'; }
    if (f === 2) { rearSX = 20; rearSY = 30; frontSX = 34; frontSY = 26; phase = 'half'; }
    if (f === 3) { rearSX = 19; rearSY = 28; frontSX = 35; frontSY = 25; phase = 'loaded'; }
  }

  // stock: dark wood with a lit top edge and iron end caps
  line([rearSX, rearSY, frontSX, frontSY], p.dark, 5);
  line([rearSX, rearSY, frontSX, frontSY], p.leather, 3);
  line([rearSX, rearSY - 1, frontSX, frontSY - 1], p.wood, 1);
  r(frontSX - 1, frontSY - 2, 3, 4, p.steelShadow);
  r(rearSX - 2, rearSY - 2, 4, 4, p.leather);
  r(rearSX - 2, rearSY - 2, 4, 1, p.steelShadow);

  // prod: short thick steel bow limbs with a dark base and bright edge
  const prodPts = [frontSX - 2, frontSY - 8, frontSX + 1, frontSY - 5, frontSX + 2, frontSY - 1,
    frontSX + 2, frontSY + 3, frontSX, frontSY + 6, frontSX - 2, frontSY + 8];
  line(prodPts, p.outline, 4);
  line(prodPts, p.steelShadow, 2);
  line([frontSX, frontSY - 6, frontSX + 1, frontSY - 1], p.metal, 1);
  r(frontSX - 2, frontSY - 8, 1, 1, p.shine);
  r(frontSX - 2, frontSY + 7, 1, 1, p.shine);
  r(frontSX + 1, frontSY + 5, 1, 1, p.metal);

  const topX = frontSX - 2, topY = frontSY - 8, botX = frontSX - 2, botY = frontSY + 8;
  const nutT = phase === 'half' ? 0.7 : 0.42;
  const nutX = Math.round(rearSX + (frontSX - rearSX) * nutT);
  const nutY = Math.round(rearSY + (frontSY - rearSY) * nutT);
  if (phase === 'released') line([topX, topY, botX, botY], p.shine, 1);
  else line([topX, topY, nutX, nutY, botX, botY], p.shine, 1);
  r(nutX - 1, nutY - 1, 3, 3, p.steelShadow);
  r(nutX, nutY, 1, 1, p.gold);
  r(rearSX - 1, rearSY - 5, 5, 5, p.steelShadow);
  r(rearSX, rearSY - 4, 3, 2, p.metal);
  r(rearSX, rearSY - 4, 1, 1, p.shine);
  const crankX = rearSX - 4, crankY = rearSY - 8;
  if (phase === 'half') {
    line([rearSX, rearSY - 4, crankX, crankY], p.metal, 1);
    r(crankX - 1, crankY - 1, 2, 2, p.shine);
    r(rearSX - 2, rearSY - 5, 2, 2, p.gold);
  } else {
    line([rearSX, rearSY - 4, rearSX + 2, rearSY - 6], p.metal, 1);
    r(rearSX + 2, rearSY - 7, 2, 2, p.gold);
  }
  line([rearSX + 1, rearSY - 3, nutX - 1, nutY], p.shine, 1);

  // bolt while spanned; the groove is empty on the recoil frame
  if (phase !== 'released') {
    const len = Math.hypot(frontSX - rearSX, frontSY - rearSY);
    const ux = (frontSX - rearSX) / len, uy = (frontSY - rearSY) / len;
    const tipBX = Math.round(frontSX + ux * 7), tipBY = Math.round(frontSY + uy * 7);
    line([nutX, nutY, tipBX, tipBY], p.wood, 1);
    poly([tipBX, tipBY - 1, tipBX + 2, tipBY, tipBX, tipBY + 1], p.shine);
    r(nutX + 1, nutY - 1, 2, 1, p.cloth);
    r(nutX + 2, nutY - 1, 1, 1, p.gold);
  }

  // hands stay on the stock: front grip, rear trigger or span crank
  const gripX = Math.round(rearSX + (frontSX - rearSX) * 0.64);
  const gripY = Math.round(rearSY + (frontSY - rearSY) * 0.64);
  const rearHandX = phase === 'half' ? crankX + 1 : Math.round(rearSX + (frontSX - rearSX) * 0.2);
  const rearHandY = phase === 'half' ? crankY + 2 : Math.round(rearSY + (frontSY - rearSY) * 0.2);
  line([27, 19, gripX - 1, gripY - 2, gripX, gripY], p.dark, 3);
  line([27, 19, gripX - 1, gripY - 2, gripX, gripY], p.cloth, 1);
  line([23, 18, rearHandX - 1, rearHandY - 1, rearHandX, rearHandY], p.dark, 3);
  line([23, 18, rearHandX - 1, rearHandY - 1, rearHandX, rearHandY], p.cloth, 1);
  r(gripX - 2, gripY - 2, 4, 1, p.cloth);
  r(gripX - 1, gripY - 1, 3, 3, p.skin);
  r(gripX - 1, gripY - 1, 2, 1, SKIN_HI);
  r(rearHandX - 2, rearHandY - 2, 4, 1, p.cloth);
  r(rearHandX - 1, rearHandY - 1, 3, 3, p.skin);
  r(rearHandX - 1, rearHandY - 1, 2, 1, SKIN_HI);
}

/* ------------------------------------------------------------------------- */
/* rider - 风暴轻骑: bare-coated horse, light harness, forward-leaning rider   */
/* with a curved saber and a big saddle blanket. No barding and no kite        */
/* shield, so it reads apart from the knight at a glance.                      */
/* ------------------------------------------------------------------------- */
function rider(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, -1][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const nf = run ? [37, 32, 28, 34][f] : atk ? [39, 41, 36, 33][f] : 34;
  const ff = run ? [33, 31, 26, 32][f] : atk ? [36, 38, 33, 31][f] : 31;
  const nr = run ? [13, 17, 22, 16][f] : atk ? [12, 11, 15, 17][f] : 16;
  const fr = run ? [16, 21, 26, 20][f] : atk ? [15, 14, 18, 20][f] : 20;

  // tail streaming behind the rump
  poly([14, 24, 10, 27, 7, 30, 9, 31, 12, 28, 14, 32, 16, 28], p.dark);
  line([13, 25, 10, 30], p.leather, 1);
  line([15, 26, 12, 31], p.leather, 1);
  r(8, 30, 2, 1, p.dark);

  const horseLeg = (hx: number, hy: number, fx: number, fy: number, coat: string, shade: string) => {
    const kx = Math.round((hx + fx) / 2) + 1;
    line([hx, hy, kx, 35, fx, fy - 2], p.dark, 5);
    line([hx, hy, kx, 35, fx, fy - 2], shade, 3);
    line([kx, 34, fx, fy - 3], coat, 1);
    r(fx - 2, fy - 2, 5, 2, p.outline);
    r(fx - 1, fy - 2, 3, 1, p.steelShadow);
  };

  // far legs (darker, behind the barrel)
  horseLeg(28, 29, ff, atk ? 40 : 39, p.leather, p.leather);
  horseLeg(21, 30, fr, atk ? 40 : 39, p.leather, p.leather);

  // barrel: light horse coat with a dark belly and a lit back
  poly([12, 27, 14, 22, 23, 20, 31, 22, 36, 26, 35, 30, 28, 33, 17, 33, 12, 30], p.dark);
  poly([15, 23, 23, 21, 31, 23, 34, 26, 32, 29, 26, 31, 17, 31, 14, 29], p.wood);
  poly([14, 29, 22, 31, 31, 29, 33, 27, 32, 30, 25, 32, 17, 32, 14, 30], p.leather);
  r(16, 22, 5, 1, p.shine);
  r(22, 21, 7, 1, p.shine);
  r(18, 24, 3, 2, p.light);

  // arched neck and head
  poly([28, 26, 30, 19, 34, 14, 39, 14, 41, 17, 40, 20, 36, 19, 33, 23, 32, 27], p.dark);
  poly([29, 25, 31, 19, 35, 15, 39, 15, 40, 18, 39, 19, 36, 18, 33, 22, 32, 26], p.wood);
  line([32, 18, 35, 15], p.shine, 1);
  poly([37, 13, 42, 13, 44, 16, 43, 20, 40, 21, 36, 19], p.dark);
  poly([38, 14, 42, 14, 43, 17, 42, 19, 40, 20, 37, 18], p.wood);
  r(38, 14, 3, 1, p.light);
  line([37, 11, 38, 14], p.outline, 1);
  r(38, 11, 1, 2, p.leather);
  r(42, 16, 1, 1, p.outline);
  r(43, 18, 1, 1, p.outline);
  r(41, 19, 2, 1, p.leather);
  // mane
  line([34, 14, 30, 20, 29, 25], p.outline, 1);
  line([33, 15, 31, 19], p.dark, 1);
  r(35, 13, 2, 1, p.dark);

  // light harness: bridle, bit, breast strap, girth
  line([38, 15, 42, 17], p.leather, 1);
  r(42, 17, 2, 2, p.gold);
  r(42, 17, 1, 1, p.shine);
  line([32, 26, 27, 30], p.leather, 1);
  r(31, 27, 2, 2, p.gold);
  line([27, 21, 27, 30], p.leather, 1);
  // cloth martingale adds a small faction block on the chest
  poly([28, 23, 33, 24, 32, 27, 28, 26], p.cloth);
  r(29, 24, 1, 1, p.gold);

  // near legs (lit coat, in front of the barrel)
  horseLeg(32, 29, nf, atk ? 41 : 41, p.wood, p.leather);
  horseLeg(18, 30, nr, atk ? 41 : 41, p.wood, p.leather);
  r(nf - 1, 38, 3, 1, p.light);
  r(nr - 1, 38, 3, 1, p.light);

  // big saddle blanket and saddle: the strongest cloth block on the unit
  poly([17, 20, 30, 19, 32, 25, 24, 28, 18, 26], p.dark);
  poly([18, 21, 29, 20, 31, 25, 24, 27, 19, 25], p.cloth);
  line([18, 25, 25, 27], p.gold, 1);
  r(20, 21, 9, 1, p.light);
  r(26, 22, 4, 1, p.dark);
  r(21, 19, 7, 3, p.leather);
  r(21, 19, 6, 1, p.steelShadow);
  r(21, 20, 7, 2, p.cloth);
  r(22, 21, 5, 1, p.gold);
  poly([19, 25, 30, 24, 31, 28, 23, 30, 18, 28], p.cloth);
  line([19, 28, 29, 27], p.gold, 1);
  r(20, 25, 6, 1, p.light);
  // rear flank cloth pad and crupper strap (wider faction block on the horse)
  poly([13, 25, 20, 24, 21, 29, 14, 30], p.cloth);
  line([14, 29, 20, 28], p.gold, 1);
  r(15, 25, 4, 1, p.light);
  r(28, 29, 3, 2, p.cloth);
  r(28, 29, 2, 1, p.light);
  r(15, 26, 2, 2, p.cloth);
  r(29, 25, 3, 2, p.cloth);
  r(30, 26, 1, 1, p.gold);
  r(21, 27, 2, 1, p.cloth);
  poly([13, 22, 18, 21, 19, 24, 14, 25], p.cloth);
  line([14, 24, 18, 23], p.gold, 1);
  r(14, 22, 3, 1, p.light);

  // rider: open, forward-leaning, cloth tunic with leather straps
  r(17, 24, 3, 3, p.cloth);
  r(17, 26, 2, 1, p.gold);
  poly([24, 20, 26, 12, 32, 11, 33, 18, 28, 21], p.dark);
  poly([25, 20, 27, 13, 31, 12, 31, 18, 27, 20], p.cloth);
  poly([29, 13, 31, 12, 31, 17, 28, 19], p.dark);
  r(26, 14, 2, 4, p.leather);
  line([26, 15, 31, 16], p.leather, 1);
  r(25, 19, 7, 1, p.gold);
  r(26, 16, 2, 2, p.gold);
  r(25, 13, 2, 1, p.light);
  r(26, 12, 4, 2, p.cloth);
  r(27, 12, 2, 1, p.light);
  poly([24, 20, 29, 21, 31, 26, 28, 27, 25, 23], p.dark);
  poly([25, 20, 29, 21, 30, 25, 28, 26, 26, 23], p.cloth);
  line([26, 22, 29, 24], p.leather, 1);
  r(28, 26, 5, 3, p.outline);
  r(28, 26, 4, 1, p.metal);
  line([31, 27, 31, 30], p.metal, 1);
  r(30, 30, 2, 1, p.steelShadow);
  r(25, 22, 3, 1, p.cloth);
  r(25, 24, 2, 1, p.cloth);
  poly([24, 12, 27, 11, 27, 16, 23, 16], p.cloth);
  r(24, 12, 3, 1, p.light);
  r(25, 14, 1, 1, p.gold);

  // head with open face and a cloth hood-cap
  poly([27, 5, 32, 5, 35, 8, 34, 11, 28, 12, 27, 8], p.dark);
  poly([28, 6, 32, 6, 34, 8, 33, 10, 29, 11, 28, 8], p.cloth);
  r(29, 6, 3, 1, p.light);
  r(30, 8, 4, 4, p.skin);
  r(30, 8, 3, 1, SKIN_HI);
  r(32, 9, 1, 1, p.outline);
  r(30, 11, 3, 1, SKIN_LO);
  r(27, 10, 6, 2, p.cloth);
  r(30, 10, 2, 1, p.gold);

  // short cape streaming back
  poly([26, 11, 20, 14, 16, 18, 18, 20, 23, 17, 27, 16], p.dark);
  poly([26, 12, 21, 15, 17, 18, 18, 19, 22, 17, 26, 15], p.cloth);
  line([18, 19, 22, 17], p.light, 1);
  r(25, 12, 2, 2, p.gold);

  // reins: bit to the rear hand, then the hand itself
  const reinX = 27, reinY = 20;
  line([43, 18, reinX, reinY], p.leather, 1);
  line([24, 14, reinX - 1, reinY - 1, reinX, reinY], p.dark, 3);
  line([24, 14, reinX - 1, reinY - 1, reinX, reinY], p.leather, 1);
  r(reinX - 1, reinY - 1, 3, 3, p.skin);
  r(reinX - 1, reinY - 1, 2, 1, SKIN_HI);

  // saber arm: high guard, cut, low follow-through
  const handX = atk ? [30, 34, 35, 32][f] : run ? [32, 33, 32, 31][f] : 33;
  const handY = atk ? [11, 12, 17, 15][f] : run ? [13, 14, 15, 14][f] : 13;
  const tipX = atk ? [36, 44, 43, 40][f] : run ? [43, 44, 43, 42][f] : 43;
  const tipY = atk ? [5, 6, 25, 12][f] : run ? [8, 9, 12, 9][f] : 7;
  line([29, 13, handX - 2, handY + 1, handX, handY], p.dark, 3);
  line([29, 13, handX - 2, handY + 1, handX, handY], p.leather, 1);
  line([handX, handY, Math.round((handX + tipX) / 2) + 1, Math.round((handY + tipY) / 2) - 1, tipX, tipY], p.dark, 3);
  line([handX, handY, Math.round((handX + tipX) / 2) + 1, Math.round((handY + tipY) / 2) - 1, tipX, tipY], p.metal, 1);
  r(tipX, tipY, 1, 1, p.shine);
  line([handX - 1, handY - 2, handX + 1, handY], p.gold, 1);
  r(handX, handY, 2, 2, p.leather);
  r(handX - 1, handY - 1, 3, 3, p.skin);
  r(handX - 1, handY - 1, 2, 1, SKIN_HI);
}

/* ------------------------------------------------------------------------- */
/* knight - 苍穹重骑: barded horse, tall crest/plume, big kite shield, heavy    */
/* straight blade. Heavier mass than the rider but kept off the frame edges.   */
/* ------------------------------------------------------------------------- */
function knight(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const bob = run ? [0, -1, 0, -1][f] : [0, -1, 0, 0][f];
  ctx.translate(0, bob);

  const nf = run ? [36, 32, 30, 35][f] : atk ? [38, 39, 36, 34][f] : 35;
  const ff = run ? [33, 30, 27, 32][f] : atk ? [35, 36, 33, 32][f] : 32;
  const nr = run ? [14, 17, 20, 16][f] : atk ? [13, 12, 15, 17][f] : 16;
  const fr = run ? [17, 20, 24, 19][f] : atk ? [16, 15, 18, 20][f] : 19;

  // braided tail with a faction cloth tie
  poly([12, 25, 8, 29, 7, 32, 9, 32, 12, 30, 14, 33, 15, 29], p.dark);
  line([12, 26, 9, 31], p.leather, 1);
  r(9, 27, 2, 2, p.cloth);
  r(10, 27, 1, 1, p.gold);

  const bardedLeg = (hx: number, hy: number, fx: number, fy: number, coat: string) => {
    const kx = Math.round((hx + fx) / 2) + 1;
    line([hx, hy, kx, 35, fx, fy - 2], p.dark, 5);
    line([hx, hy, kx, 35, fx, fy - 2], p.steelShadow, 3);
    line([kx, 33, kx + 1, 37], p.metal, 1);
    r(fx - 2, fy - 3, 5, 3, p.steelShadow);
    r(fx - 2, fy - 3, 5, 1, p.metal);
    r(fx - 2, fy - 2, 5, 2, p.outline);
    r(fx - 1, fy - 2, 3, 1, coat);
  };

  // far legs behind the barrel
  bardedLeg(28, 29, ff, atk ? 40 : 39, p.steelShadow);
  bardedLeg(20, 30, fr, atk ? 40 : 39, p.steelShadow);

  // armoured barrel: dark steel base with bright plate planes
  poly([11, 27, 14, 22, 23, 20, 31, 21, 36, 25, 35, 30, 28, 33, 17, 33, 11, 30], p.dark);
  poly([14, 23, 23, 21, 31, 22, 34, 26, 33, 29, 27, 31, 18, 31, 13, 29], p.steelShadow);
  poly([15, 24, 23, 22, 30, 24, 30, 27, 23, 28, 17, 28, 14, 26], p.metal);
  r(15, 23, 5, 1, p.shine);
  r(23, 21, 6, 1, p.shine);
  line([18, 24, 18, 29], p.outline, 1);
  line([23, 23, 23, 29], p.outline, 1);
  r(19, 25, 1, 1, p.gold);
  r(24, 25, 1, 1, p.gold);

  // caparison cloth skirt below the barrel: the big faction colour block
  poly([14, 27, 30, 26, 33, 30, 31, 34, 18, 34, 13, 31], p.dark);
  poly([16, 28, 29, 27, 32, 30, 30, 33, 19, 33, 15, 30], p.cloth);
  line([16, 32, 30, 31], p.gold, 1);
  line([17, 28, 28, 28], p.light, 1);
  r(22, 30, 3, 1, p.gold);
  r(24, 31, 3, 1, p.gold);
  r(19, 31, 2, 1, p.gold);
  r(21, 32, 1, 1, p.gold);
  r(26, 32, 1, 1, p.gold);
  r(19, 25, 3, 2, p.cloth);
  r(30, 25, 3, 2, p.cloth);
  r(31, 25, 2, 1, p.light);
  r(14, 27, 3, 2, p.cloth);
  r(15, 28, 1, 1, p.gold);
  r(18, 26, 2, 1, p.cloth);
  r(16, 26, 2, 2, p.cloth);
  r(30, 26, 2, 2, p.cloth);
  r(21, 31, 1, 1, p.gold);
  r(27, 32, 1, 1, p.gold);
  r(33, 27, 1, 1, p.gold);
  poly([10, 28, 15, 27, 16, 31, 12, 32, 10, 30], p.cloth);
  line([10, 31, 15, 30], p.gold, 1);
  r(11, 28, 3, 1, p.light);
  r(19, 23, 3, 3, p.cloth);
  line([19, 25, 21, 25], p.gold, 1);
  r(19, 23, 2, 1, p.light);

  // peytral / crupper plates with gold rivets
  poly([31, 23, 36, 25, 37, 29, 33, 32, 30, 29], p.dark);
  poly([32, 24, 35, 26, 36, 28, 33, 30, 31, 28], p.steelShadow);
  r(32, 25, 3, 1, p.metal);
  r(33, 25, 1, 1, p.gold);
  r(34, 28, 1, 1, p.gold);
  poly([11, 25, 17, 22, 18, 30, 13, 31, 10, 28], p.dark);
  poly([12, 26, 17, 23, 17, 29, 14, 30, 12, 28], p.steelShadow);
  r(13, 24, 2, 1, p.shine);

  // crinet segments and chanfron
  poly([28, 26, 30, 19, 34, 14, 39, 14, 41, 17, 40, 20, 36, 19, 33, 23, 32, 27], p.dark);
  poly([29, 25, 31, 19, 35, 15, 39, 15, 40, 18, 39, 19, 36, 18, 33, 22, 32, 26], p.steelShadow);
  line([31, 20, 35, 16], p.metal, 1);
  line([33, 22, 37, 18], p.metal, 1);
  r(33, 17, 2, 1, p.shine);
  r(36, 17, 1, 1, p.metal);
  poly([36, 12, 42, 12, 44, 15, 43, 19, 40, 20, 36, 18], p.dark);
  poly([37, 13, 42, 13, 43, 16, 42, 18, 40, 19, 37, 17], p.metal);
  r(37, 13, 3, 1, p.shine);
  r(41, 15, 2, 1, p.outline);
  r(41, 18, 2, 1, p.steelShadow);
  r(39, 14, 1, 1, p.gold);
  line([37, 10, 38, 12], p.steelShadow, 1);
  r(38, 9, 2, 2, p.cloth);
  r(38, 9, 2, 1, p.light);

  // near legs
  bardedLeg(32, 29, nf, atk ? 41 : 41, p.metal);
  bardedLeg(17, 30, nr, atk ? 41 : 41, p.metal);
  r(nf - 1, 38, 3, 1, p.shine);
  r(nr - 1, 38, 3, 1, p.shine);

  // saddle and the rider's armoured leg
  r(21, 19, 9, 3, p.leather);
  r(21, 19, 8, 1, p.steelShadow);
  poly([29, 21, 33, 22, 33, 24, 30, 25], p.cloth);
  r(30, 22, 2, 1, p.light);
  r(31, 23, 1, 1, p.gold);
  poly([23, 20, 28, 21, 30, 26, 27, 27, 24, 23], p.dark);
  poly([24, 20, 28, 21, 29, 25, 27, 26, 25, 23], p.steelShadow);
  r(29, 25, 4, 3, p.outline);
  r(29, 25, 3, 1, p.metal);
  line([31, 26, 31, 29], p.metal, 1);
  r(30, 29, 2, 1, p.steelShadow);

  // reins kept slack under the rider's rear hand
  line([42, 17, 25, 19], p.leather, 1);
  line([22, 14, 24, 19], p.dark, 3);
  line([22, 14, 24, 19], p.leather, 1);
  r(23, 18, 3, 3, p.skin);
  r(23, 18, 2, 1, SKIN_HI);

  // full plate torso, gold belt, pauldron
  poly([21, 20, 24, 11, 31, 10, 33, 18, 29, 21], p.dark);
  poly([22, 20, 25, 12, 30, 11, 31, 18, 28, 20], p.steelShadow);
  poly([25, 13, 30, 12, 30, 17, 27, 19, 24, 17], p.metal);
  r(25, 12, 2, 5, p.shine);
  r(22, 18, 8, 1, p.gold);
  r(25, 15, 1, 1, p.gold);
  poly([25, 11, 31, 10, 32, 13, 26, 14], p.dark);
  poly([26, 11, 31, 11, 31, 12, 26, 13], p.metal);
  r(26, 11, 3, 1, p.shine);
  // cloth surcoat panel under the breastplate
  poly([22, 17, 28, 16, 29, 20, 23, 20], p.cloth);
  r(23, 17, 4, 1, p.light);
  r(25, 18, 1, 2, p.gold);

  // great helm with tall cloth crest (kept off the frame top edge)
  poly([26, 5, 33, 5, 35, 8, 34, 11, 28, 12, 25, 9], p.dark);
  poly([27, 6, 32, 6, 34, 8, 33, 10, 28, 11, 26, 9], p.metal);
  r(27, 6, 1, 5, p.shine);
  r(31, 7, 1, 3, p.steelShadow);
  r(28, 8, 5, 1, p.outline);
  r(27, 10, 7, 1, p.gold);
  poly([30, 5, 29, 3, 26, 3, 23, 5, 25, 6, 28, 5], p.dark);
  poly([29, 5, 29, 4, 26, 4, 24, 5, 26, 5, 28, 5], p.cloth);
  r(25, 5, 2, 1, p.light);
  r(29, 4, 1, 1, p.gold);

  // big kite shield: dark rim, cloth field, gold boss
  poly([11, 21, 21, 18, 23, 23, 20, 33, 16, 37, 11, 31], p.dark);
  poly([12, 22, 20, 20, 21, 24, 19, 32, 16, 35, 12, 30], p.dark);
  poly([13, 23, 19, 21, 20, 25, 18, 31, 16, 33, 13, 29], p.cloth);
  r(14, 27, 2, 1, p.cloth);
  r(17, 24, 1, 1, p.cloth);
  r(16, 25, 1, 1, p.cloth);
  r(14, 24, 2, 1, p.cloth);
  r(15, 30, 1, 1, p.gold);
  r(17, 26, 1, 1, p.gold);
  r(16, 31, 1, 1, p.gold);
  line([12, 29, 16, 34], p.gold, 1);
  line([20, 25, 18, 31], p.gold, 1);
  r(13, 23, 3, 1, p.light);
  poly([15, 25, 18, 24, 18, 28, 15, 29], p.gold);
  r(16, 25, 2, 1, p.shine);

  // heavy straight blade and gauntlet
  const handX = atk ? [31, 34, 35, 33][f] : run ? [33, 33, 32, 32][f] : 32;
  const handY = atk ? [11, 12, 18, 14][f] : run ? [14, 15, 15, 14][f] : 13;
  const tipX = atk ? [34, 43, 44, 38][f] : run ? [38, 39, 38, 37][f] : 37;
  const tipY = atk ? [5, 7, 30, 9][f] : run ? [7, 8, 10, 8][f] : 6;
  line([28, 13, handX - 2, handY, handX, handY], p.dark, 5);
  line([28, 13, handX - 2, handY, handX, handY], p.steelShadow, 3);
  line([handX, handY, tipX, tipY], p.dark, 5);
  line([handX, handY, tipX, tipY], p.steelShadow, 3);
  line([handX, handY, tipX, tipY], p.metal, 1);
  r(tipX, tipY, 2, 1, p.shine);
  line([handX - 2, handY - 1, handX + 2, handY - 1], p.gold, 1);
  r(handX, handY, 2, 3, p.leather);
  // shield field and rivets drawn last so they stay visible in the swing frames
  r(13, 26, 2, 2, p.cloth);
  r(19, 22, 1, 2, p.cloth);
  r(19, 29, 1, 2, p.cloth);
  r(13, 28, 1, 1, p.gold);
  r(19, 24, 1, 1, p.gold);
  r(19, 31, 1, 1, p.gold);
  r(14, 24, 1, 1, p.cloth);
  r(13, 25, 1, 1, p.cloth);
  r(19, 27, 1, 1, p.cloth);
  r(18, 30, 1, 1, p.cloth);
  r(14, 29, 1, 1, p.gold);
  r(19, 23, 1, 1, p.gold);
  r(18, 22, 1, 1, p.gold);
}

/* ------------------------------------------------------------------------- */
/* ballista - 破城弩炮: the widest, heaviest silhouette. Winch drum, heavy      */
/* wheels, long bow arms, loaded slider and a faction pennant on the frame.    */
/* ------------------------------------------------------------------------- */
function ballista(a: UnitArt): void {
  const { r, poly, line, p, ctx, f } = a;
  const run = a.walk, atk = a.attack;
  const kick = atk ? (f === 0 ? -2 : f === 1 ? -1 : 0) : 0;
  if (kick) ctx.translate(kick, 0);

  const fired = atk && f < 2;
  const halfSpan = atk && f === 2;
  const nutX = fired ? 44 : halfSpan ? 36 : 30;
  const nutY = 24;
  const crankAngle = atk ? [Math.PI * 0.9, Math.PI * 0.6, Math.PI * 0.15, Math.PI * 1.15][f]
    : run ? [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4][f] : Math.PI * 0.15;

  const wheel = (cx: number, ang: number) => {
    poly([cx + 6, 36, cx + 4, 40, cx, 42, cx - 4, 40, cx - 6, 36,
      cx - 4, 32, cx, 30, cx + 4, 32], p.dark);
    poly([cx + 4, 36, cx + 2.5, 39, cx, 40, cx - 2.5, 39, cx - 4, 36,
      cx - 2.5, 33, cx, 32, cx + 2.5, 33], p.leather);
    r(cx - 3, 32, 3, 1, p.steelShadow);
    r(cx - 5, 33, 1, 3, p.steelShadow);
    for (let i = 0; i < 4; i++) {
      const t = ang + (i * Math.PI) / 2;
      const ex = Math.round(cx + Math.cos(t) * 4.2);
      const ey = Math.round(36 + Math.sin(t) * 4.2);
      line([cx, 36, ex, ey], p.wood, 1);
    }
    r(cx - 1, 35, 2, 2, p.steelShadow);
    r(cx - 1, 35, 1, 1, p.gold);
  };

  // heavy carriage frame, dark timber with lit top edges
  poly([6, 32, 41, 31, 44, 35, 42, 38, 8, 38, 5, 35], p.dark);
  poly([8, 32, 40, 32, 42, 35, 40, 37, 9, 37, 7, 35], p.leather);
  line([9, 32, 40, 32], p.wood, 1);
  line([10, 36, 39, 36], p.wood, 1);
  r(10, 32, 2, 5, p.steelShadow);
  r(37, 32, 2, 5, p.steelShadow);
  r(8, 36, 4, 1, p.gold);
  r(34, 36, 4, 1, p.gold);

  // crew pennant + pole: the faction cloth kept on the machine
  line([17, 22, 17, 8], p.outline, 1);
  line([17, 22, 17, 9], p.wood, 1);
  const flag = f === 0 ? [18, 8, 28, 9, 26, 12, 28, 14, 18, 15]
    : f === 1 ? [18, 8, 27, 10, 25, 12, 27, 15, 18, 15]
      : f === 2 ? [18, 8, 26, 9, 28, 12, 25, 13, 18, 15]
        : [18, 8, 28, 10, 26, 13, 18, 15];
  poly(flag, p.cloth);
  line([19, 9, 26, 10], p.light, 1);
  r(26, 11, 1, 2, p.gold);
  r(18, 14, 7, 1, p.gold);
  r(23, 9, 2, 1, p.dark);

  // cloth drape over the carriage side (second faction block)
  poly([9, 31, 23, 30, 22, 37, 12, 37, 8, 34], p.dark);
  poly([10, 32, 22, 31, 21, 36, 13, 36, 9, 34], p.cloth);
  line([10, 35, 21, 34], p.gold, 1);
  line([11, 32, 21, 32], p.light, 1);
  r(15, 33, 3, 1, p.dark);

  // cloth band over the carriage frame between the wheels
  r(20, 34, 9, 3, p.cloth);
  r(21, 34, 6, 1, p.light);
  line([20, 36, 28, 36], p.gold, 1);
  r(23, 35, 2, 1, p.dark);

  // winch housing with a cloth cover
  r(10, 17, 8, 8, p.outline);
  r(11, 18, 6, 6, p.steelShadow);
  r(11, 19, 6, 3, p.cloth);
  line([12, 19, 15, 19], p.light, 1);
  r(11, 20, 6, 1, p.leather);
  r(11, 23, 6, 1, p.leather);
  poly([10, 24, 18, 24, 17, 28, 11, 28], p.cloth);
  line([12, 27, 16, 27], p.gold, 1);
  r(39, 18, 2, 2, p.cloth);
  r(39, 28, 2, 2, p.cloth);
  r(40, 18, 1, 1, p.gold);
  r(21, 33, 1, 1, p.gold);
  r(26, 34, 1, 1, p.gold);
  r(29, 35, 1, 1, p.gold);
  r(30, 34, 1, 3, p.cloth);
  r(30, 34, 1, 1, p.gold);
  r(11, 24, 6, 1, p.light);
  r(11, 27, 6, 1, p.gold);

  // winch crank: angle changes with the span/recoil phase
  const axleX = 14, axleY = 22;
  const crankX = Math.round(axleX + Math.cos(crankAngle) * 4);
  const crankY = Math.round(axleY + Math.sin(crankAngle) * 4);
  line([axleX, axleY, crankX, crankY], p.dark, 3);
  line([axleX, axleY, crankX, crankY], p.metal, 1);
  r(crankX - 1, crankY - 1, 2, 2, p.gold);
  r(crankX - 1, crankY - 1, 1, 1, p.shine);
  r(axleX - 1, axleY - 1, 2, 2, p.shine);

  // wheels
  const roll = run ? f * (Math.PI / 8) : atk ? [0, Math.PI / 8, 0, 0][f] : 0;
  wheel(12, roll);
  wheel(36, roll);

  // stock beam
  poly([8, 22, 41, 21, 42, 26, 9, 27], p.dark);
  poly([9, 23, 40, 22, 41, 25, 10, 26], p.leather);
  line([10, 23, 40, 22], p.wood, 1);
  line([12, 25, 39, 25], p.outline, 1);
  r(10, 22, 2, 4, p.steelShadow);
  r(39, 21, 2, 4, p.steelShadow);
  r(20, 22, 8, 2, p.cloth);
  r(21, 22, 5, 1, p.light);
  r(20, 24, 8, 1, p.gold);

  // slider block and winch rope
  r(nutX - 2, nutY - 2, 5, 5, p.steelShadow);
  r(nutX - 1, nutY - 1, 3, 3, p.dark);
  r(nutX, nutY, 1, 1, p.gold);
  line([18, 24, nutX - 2, nutY], p.shine, 1);

  // bow arms: dark steel limbs, bright inner planes, flexed when fired
  const flex = fired ? 1 : 0;
  const upper = [37, 22, 41 + flex, 16, 44 + flex, 14];
  const lower = [37, 26, 41 + flex, 32, 44 + flex, 34];
  line(upper, p.outline, 5);
  line(upper, p.steelShadow, 3);
  line([38, 21, 43 + flex, 15], p.metal, 1);
  line(lower, p.outline, 5);
  line(lower, p.steelShadow, 3);
  line([38, 27, 43 + flex, 33], p.metal, 1);
  r(43 + flex, 13, 2, 2, p.shine);
  r(43 + flex, 34, 2, 2, p.shine);

  // string: straight after release, V-shaped while spanned
  if (fired) line([45, 14, 45, 34], p.shine, 1);
  else line([45, 14, nutX, nutY, 45, 34], p.shine, 1);

  // bolt in the groove unless it has just been loosed
  if (!fired) {
    line([nutX, nutY, 43, 24], p.wood, 1);
    poly([42, 23, 46, 24, 42, 25], p.shine);
    r(nutX + 2, nutY - 1, 3, 1, p.cloth);
    r(nutX + 3, nutY - 1, 1, 1, p.gold);
  }

  // faction standard hanging between the wheels (machine crew banner)
  poly([19, 26, 29, 25, 30, 38, 24, 38, 19, 32], p.dark);
  poly([20, 27, 28, 26, 29, 37, 24, 38, 20, 31], p.cloth);
  line([20, 31, 28, 30], p.gold, 1);
  line([21, 37, 27, 36], p.gold, 1);
  r(21, 27, 5, 1, p.light);
  r(22, 29, 2, 1, p.dark);
  r(25, 32, 1, 1, p.gold);

  // ratchet pawl: reads as a machine, not a cart
  line([11, 18, 13, 21], p.metal, 1);
  r(11, 17, 2, 1, p.shine);
  // brass studs on the crew banner stay visible through the recoil frames
  r(21, 33, 1, 1, p.gold);
  r(26, 34, 1, 1, p.gold);
  r(29, 35, 1, 1, p.gold);
  r(25, 31, 1, 1, p.gold);
  r(28, 33, 1, 1, p.gold);
  r(23, 35, 1, 1, p.gold);
  r(27, 32, 1, 1, p.gold);
  r(22, 30, 1, 1, p.gold);
}
