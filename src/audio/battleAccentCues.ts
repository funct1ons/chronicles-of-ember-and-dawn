/**
 * Sparse accents aligned to transients in the shipped CC0 recording, NOT a guessed BPM.
 * Source SHA-256: 401fa62b9ed9bb2eea5821bdbe245e3eb991a89ecd1509c3742f7b5393b0df1c.
 * Extraction: 20ms low-band RMS positive differences; strongest local maxima,
 * >=2.4s apart, excluding the intro/outro. These are cue points, not claimed beats.
 * See scripts/analyze-battle-accents.mjs for reproducible analysis.
 * Source song is never modified; the separate synthesized layer follows its playhead.
 */
export const BATTLE_ACCENT_CUES: readonly number[] = [
  9,12,15,18,22.5,25.5,30,33,36.12,42.12,46.5,49.52,52.52,55.5,60,66,
  72,75,78,83.48,87,90,94.5,100.42,114.76,117.76,120.2,124.68,127.58,132,136.68,141,
];
export const BATTLE_ACCENT_SOURCE_SHA256='401fa62b9ed9bb2eea5821bdbe245e3eb991a89ecd1509c3742f7b5393b0df1c';
