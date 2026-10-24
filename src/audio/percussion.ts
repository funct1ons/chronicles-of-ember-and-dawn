/**
 * Beat-synchronised scheduling for the climax percussion layer.
 *
 * The layer is synthesized locally (low timpani + snare, no pitched material) so
 * the battle theme stays the only melody. Hits are derived from the playhead of
 * the currently playing recording, which keeps the pulse locked to the file:
 * whenever the track loops or restarts, the cursor re-syncs instead of drifting.
 *
 * This module is pure: AudioManager turns the returned hits into Web Audio
 * nodes. The scheduler can therefore be tested without a browser.
 */

/** Content-aligned sparse cue scheduling. No tempo assumption or catch-up bursts. */
export function collectAccentPercussion(input: {
  cursor: PulseCursor; trackTime: number; lookahead: number; cues: readonly number[];
}): CollectPercussionResult {
  const {trackTime:time,cues}=input;
  if(!Number.isFinite(time)||time<0)return {hits:[],cursor:input.cursor,resynced:false};
  let next=Math.max(0,Math.floor(input.cursor.nextBeat)),resynced=false;
  const horizon=time+Math.max(0,input.lookahead);
  const previous=cues[next-1];
  if((previous!==undefined&&previous>horizon+.12)||(cues[next]!==undefined&&cues[next]!<time-.12)){
    next=0;while(next<cues.length&&cues[next]!<time-.12)next++;resynced=true;
  }
  const hits:PercussionHit[]=[];
  while(next<cues.length&&cues[next]!<=horizon&&hits.length<8){
    const index=next++,delay=cues[index]!-time;
    if(delay<-.12)continue;
    hits.push({beat:index,kind:percussionPattern(index*2)??'timpaniSoft',delay:Math.max(0,delay)});
  }
  return {hits,cursor:{nextBeat:next},resynced};
}

export type PercussionKind = 'timpani' | 'timpaniSoft' | 'snare' | 'snareGhost';

export interface PercussionHit {
  /** Absolute beat index since the start of the playing recording. */
  beat: number;
  kind: PercussionKind;
  /** Seconds from "now" (the sampled playhead) until the hit should sound. */
  delay: number;
}

export interface PulseCursor {
  /** Next beat index that has not been scheduled yet. */
  nextBeat: number;
}

export interface CollectPercussionInput {
  cursor: PulseCursor;
  /** Current playhead position in the recording (seconds). */
  trackTime: number;
  bpm: number;
  /** How far ahead to schedule, in seconds. */
  lookahead: number;
  /** Safety cap for a single call. */
  maxHits?: number;
}

export interface CollectPercussionResult {
  hits: PercussionHit[];
  cursor: PulseCursor;
  /** True when a jump in the playhead (loop wrap or seek) forced a re-sync. */
  resynced: boolean;
}

export function createPulseCursor(): PulseCursor {
  return { nextBeat: 0 };
}

/**
 * A sparse marching figure over eight beats: accent timpani on 1 and 5,
 * snare on 3 and 7, one ghost snare before the next accent.
 */
export function percussionPattern(beat: number): PercussionKind | null {
  const step = ((Math.floor(beat) % 8) + 8) % 8;
  if (step === 0) return 'timpani';
  if (step === 2) return 'snare';
  if (step === 4) return 'timpaniSoft';
  if (step === 6) return 'snare';
  if (step === 7) return 'snareGhost';
  return null;
}

export function beatLength(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 60 / 84;
  return 60 / Math.min(240, Math.max(30, bpm));
}

export function collectPercussion(input: CollectPercussionInput): CollectPercussionResult {
  const length = beatLength(input.bpm);
  const time = input.trackTime;
  if (!Number.isFinite(time) || time < 0) return { hits: [], cursor: input.cursor, resynced: false };

  const firstBeat = Math.floor(time / length);
  const previous = Number.isFinite(input.cursor.nextBeat) ? input.cursor.nextBeat : firstBeat;
  let nextBeat = previous;
  let resynced = false;

  // A loop wrap or a seek moves the playhead behind the cursor; a stalled frame
  // can leave it far ahead. Either way, restart from the current beat instead of
  // firing a burst of catch-up hits.
  if (nextBeat < firstBeat || nextBeat > firstBeat + 2) {
    nextBeat = firstBeat;
    resynced = true;
  }

  const hits: PercussionHit[] = [];
  const maxHits = Math.max(1, Math.min(16, input.maxHits ?? 8));
  const horizon = time + Math.max(0, input.lookahead);
  while (nextBeat * length <= horizon && hits.length < maxHits) {
    const delay = nextBeat * length - time;
    const beat = nextBeat;
    nextBeat += 1;
    if (delay < -0.12) continue;
    const kind = percussionPattern(beat);
    if (!kind) continue;
    hits.push({ beat, kind, delay: Math.max(0, delay) });
  }

  return { hits, cursor: { nextBeat }, resynced };
}
