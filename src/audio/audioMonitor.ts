/**
 * QA/acceptance taps for the audible buses.
 *
 * Why this exists: orchestral music is played by HTMLAudioElements, so its loudness
 * lives in `el.volume` and there is deliberately **no** Web Audio `musicGain` node to
 * analyse (routing music through Web Audio would also break the release check that
 * verifies a music element is actually playing). This module builds the missing tap
 * on demand, without changing the mix:
 *
 *  - every music deck (including the lazy loop standbys) gets one
 *    `MediaElementAudioSourceNode`, summed into `musicIn` (gain 1) and analysed;
 *    `musicIn` is connected to `ctx.destination`, so the page stays audible;
 *  - `layerGain` (climax percussion) and `masterGain` (effects + ambience + layer)
 *    are tapped in parallel — a tap is a leaf branch, it cannot duplicate sound;
 *  - `combinedPeak` is the conservative upper bound of what the browser mixer
 *    receives for music (Web Audio graph) + the rest, so headroom checks are real.
 *
 * The module is only imported by tests/tools; the shipped game never attaches it.
 */

import type { AudioManager } from './AudioManager';

interface MusicVoiceLike {
  track: string;
  el: HTMLAudioElement;
}

interface AudioInternals {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  layerGain: GainNode | null;
  current: MusicVoiceLike | null;
  twin: MusicVoiceLike | null;
  elements: Map<string, HTMLAudioElement>;
  twins: Map<string, HTMLAudioElement>;
  loopCrossfades: number;
  readonly scene: string;
}

export interface DeckSnapshot {
  track: string;
  currentTime: number;
  duration: number;
  volume: number;
  paused: boolean;
}

export interface AudioMonitorSample {
  /** Seconds since page load (performance.now()/1000). */
  t: number;
  /** Audible music bus (all decks summed, equal to what the player hears from BGM). */
  musicRms: number;
  musicPeak: number;
  /** Climax percussion layer only. */
  layerRms: number;
  layerPeak: number;
  /** Everything else that runs through Web Audio (effects + ambience + layer). */
  webRms: number;
  webPeak: number;
  /** Conservative mixer input bound: musicPeak + webPeak. Must stay below 1.0. */
  combinedPeak: number;
  scene: string;
  track: string | null;
  loopCrossfades: number;
  decks: DeckSnapshot[];
}

export interface AudioMonitor {
  readonly ctx: AudioContext;
  readonly music: AnalyserNode;
  readonly layer: AnalyserNode | null;
  readonly web: AnalyserNode;
  /** One measurement window (analyser buffers cover ~46-190ms depending on fftSize). */
  sample(): AudioMonitorSample;
  /** Convenience polling; returns a stop function. */
  start(intervalMs: number, onSample: (sample: AudioMonitorSample) => void): () => void;
  /** Removes the analyser taps but keeps the music audible. */
  detach(): void;
}

const MUSIC_FFT = 8192;
const NODE_FFT = 4096;

function measure(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): { rms: number; peak: number } {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = buffer[i];
    sum += value * value;
    const magnitude = Math.abs(value);
    if (magnitude > peak) peak = magnitude;
  }
  return { rms: Math.sqrt(sum / buffer.length), peak };
}

function snapshotDecks(internals: AudioInternals): DeckSnapshot[] {
  const decks: DeckSnapshot[] = [];
  for (const voice of [internals.current, internals.twin]) {
    if (!voice) continue;
    const { el } = voice;
    if (decks.some((deck) => deck.track === voice.track && deck.currentTime === el.currentTime)) {
      continue;
    }
    decks.push({
      track: voice.track,
      currentTime: el.currentTime,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      volume: el.volume,
      paused: el.paused,
    });
  }
  return decks;
}

/**
 * Attach measurement taps to a live AudioManager. Returns null before unlock()
 * (there is no AudioContext yet).
 */
export function attachAudioMonitor(audio: AudioManager): AudioMonitor | null {
  const internals = audio as unknown as AudioInternals;
  const ctx = internals.ctx;
  const master = internals.masterGain;
  if (!ctx || !master) return null;

  // Music bus: element playback is rerouted into this gain, which then feeds the
  // real destination at unity so the audible level is unchanged.
  const musicIn = ctx.createGain();
  musicIn.gain.value = 1;
  const music = ctx.createAnalyser();
  music.fftSize = MUSIC_FFT;
  musicIn.connect(music);
  musicIn.connect(ctx.destination);

  const web = ctx.createAnalyser();
  web.fftSize = NODE_FFT;
  master.connect(web);

  const layerGain = internals.layerGain;
  let layer: AnalyserNode | null = null;
  if (layerGain) {
    layer = ctx.createAnalyser();
    layer.fftSize = NODE_FFT;
    layerGain.connect(layer);
  }

  const attached = new WeakSet<HTMLAudioElement>();
  const attachDecks = () => {
    for (const el of [...internals.elements.values(), ...internals.twins.values()]) {
      if (attached.has(el)) continue;
      try {
        ctx.createMediaElementSource(el).connect(musicIn);
        attached.add(el);
      } catch {
        // Already owned by another context/source: that deck stays untapped.
      }
    }
  };
  attachDecks();

  const musicBuffer = new Float32Array(MUSIC_FFT);
  const nodeBuffer = new Float32Array(NODE_FFT);

  const sample = (): AudioMonitorSample => {
    attachDecks();
    const m = measure(music, musicBuffer);
    const l = layer ? measure(layer, nodeBuffer) : { rms: 0, peak: 0 };
    const w = measure(web, nodeBuffer);
    return {
      t: performance.now() / 1000,
      musicRms: m.rms,
      musicPeak: m.peak,
      layerRms: l.rms,
      layerPeak: l.peak,
      webRms: w.rms,
      webPeak: w.peak,
      combinedPeak: m.peak + w.peak,
      scene: internals.scene,
      track: internals.current?.track ?? null,
      loopCrossfades: internals.loopCrossfades,
      decks: snapshotDecks(internals),
    };
  };

  return {
    ctx,
    music,
    layer,
    web,
    sample,
    start(intervalMs, onSample) {
      const handle = setInterval(() => onSample(sample()), Math.max(16, intervalMs));
      return () => clearInterval(handle);
    },
    detach() {
      // Remove the analyser branches. `musicIn` keeps feeding the destination, so the
      // music stays audible after measurement stops.
      try {
        musicIn.disconnect(music);
        master.disconnect(web);
        if (layer) layerGain?.disconnect(layer);
      } catch {
        /* ignore */
      }
    },
  };
}
