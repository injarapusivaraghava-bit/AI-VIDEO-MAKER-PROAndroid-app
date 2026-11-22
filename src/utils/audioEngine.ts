import { MusicTrackId } from '../types/studio';

export const MUSIC_TRACK_OPTIONS: { id: MusicTrackId; labelTe: string; labelEn: string; bpm: number }[] = [
  { id: 'kids-playful', labelTe: 'పిల్లల కార్టూన్ మ్యూజిక్', labelEn: 'Kids Playful Cartoon', bpm: 120 },
  { id: 'cinematic-dawn', labelTe: 'సినిమాటిక్ డాన్', labelEn: 'Cinematic Dawn', bpm: 78 },
  { id: 'devotional-flute', labelTe: 'వేణుగానం / భక్తి', labelEn: 'Serene Flute & Drone', bpm: 70 },
  { id: 'shorts-beat', labelTe: 'షార్ట్స్ రిథమ్ బీట్', labelEn: 'Upbeat Shorts Beat', bpm: 128 },
  { id: 'calm-documentary', labelTe: 'డాక్యుమెంటరీ పియానో', labelEn: 'Calm Documentary', bpm: 86 },
  { id: 'none', labelTe: 'సంగీతం వద్దు (వాయిస్ మాత్రమే)', labelEn: 'No Music (Voice Only)', bpm: 0 },
];

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decodeWavBase64(ctx: AudioContext, base64: string): Promise<AudioBuffer> {
  const bytes = base64ToUint8Array(base64);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return ctx.decodeAudioData(copy);
}

/**
 * Schedules procedural, copyright-free background music onto an AudioContext GainNode.
 * Works identically for live preview playback and MediaStreamDestination video recording.
 */
export function scheduleProceduralMusic(
  ctx: AudioContext,
  destNode: AudioNode,
  trackId: MusicTrackId,
  startTime: number,
  totalDurationSec: number
): () => void {
  if (trackId === 'none' || totalDurationSec <= 0) {
    return () => {};
  }

  const activeNodes: AudioScheduledSourceNode[] = [];
  const track = MUSIC_TRACK_OPTIONS.find((t) => t.id === trackId) || MUSIC_TRACK_OPTIONS[0];
  const beatSec = 60 / (track.bpm || 90);

  const playTone = (
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    peakGain: number,
    attack = 0.02
  ) => {
    if (when > startTime + totalDurationSec) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peakGain, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(gain);
    gain.connect(destNode);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    activeNodes.push(osc);
  };

  if (trackId === 'kids-playful') {
    // Cheerful marimba/xylophone pentatonic bounce
    const notes = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33];
    const bass = [261.63, 196.0, 220.0, 196.0];
    const step = beatSec / 2;
    const steps = Math.ceil(totalDurationSec / step);
    for (let i = 0; i < steps; i++) {
      const t = startTime + i * step;
      playTone(notes[i % notes.length], t, step * 0.85, 'triangle', 0.22, 0.01);
      if (i % 4 === 0) {
        playTone(bass[(i / 4) % bass.length], t, step * 3.5, 'sine', 0.18, 0.02);
      }
    }
  } else if (trackId === 'cinematic-dawn') {
    // Lush warm chord pads + gentle top arpeggio
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [164.81, 196, 246.94],
    ];
    const chordDur = beatSec * 4;
    const count = Math.ceil(totalDurationSec / chordDur);
    for (let i = 0; i < count; i++) {
      const t = startTime + i * chordDur;
      const chord = chords[i % chords.length];
      chord.forEach((f) => playTone(f, t, chordDur * 0.96, 'sine', 0.12, 0.35));
      chord.forEach((f, idx) => {
        playTone(f * 2, t + idx * beatSec, beatSec * 1.4, 'triangle', 0.08, 0.04);
      });
    }
  } else if (trackId === 'devotional-flute') {
    // Serene tanpura-like Sa-Pa drone + bansuri pentatonic melody (Bhupali raga feel)
    const sa = 261.63;
    const pa = 392.0;
    playTone(sa / 2, startTime, totalDurationSec, 'sine', 0.14, 0.5);
    playTone(pa / 2, startTime, totalDurationSec, 'sine', 0.08, 0.5);
    const raga = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];
    const step = beatSec * 1.5;
    const count = Math.ceil(totalDurationSec / step);
    for (let i = 0; i < count; i++) {
      const t = startTime + i * step;
      playTone(raga[(i * 3) % raga.length], t, step * 0.92, 'sine', 0.16, 0.18);
    }
  } else if (trackId === 'shorts-beat') {
    // Crisp energetic pulse + synth bass
    const bassLine = [110, 110, 130.81, 146.83];
    const lead = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440];
    const step = beatSec / 2;
    const count = Math.ceil(totalDurationSec / step);
    for (let i = 0; i < count; i++) {
      const t = startTime + i * step;
      if (i % 2 === 0) {
        playTone(65, t, 0.12, 'sine', 0.3, 0.005); // kick pulse
        playTone(bassLine[(i / 2) % bassLine.length], t, step * 1.5, 'sawtooth', 0.06, 0.01);
      }
      playTone(lead[i % lead.length], t, step * 0.75, 'triangle', 0.14, 0.01);
    }
  } else if (trackId === 'calm-documentary') {
    const arp = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63];
    const step = beatSec;
    const count = Math.ceil(totalDurationSec / step);
    for (let i = 0; i < count; i++) {
      const t = startTime + i * step;
      playTone(arp[i % arp.length], t, step * 1.6, 'sine', 0.15, 0.05);
      if (i % 6 === 0) {
        playTone(130.81, t, step * 5.8, 'triangle', 0.1, 0.25);
      }
    }
  }

  return () => {
    activeNodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        // already stopped
      }
    });
  };
}

export function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0);
  const length = ch0.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, ch0[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio'));
    reader.readAsDataURL(blob);
  });
}

export type VoiceTonePreset = 'natural' | 'warm' | 'studio' | 'kids';

export async function processVoiceClipToWav(
  base64: string,
  options: {
    trimStartPct: number;
    trimEndPct: number;
    speed: number;
    gain: number;
    tonePreset: VoiceTonePreset;
    fadeEdges: boolean;
  }
): Promise<{ base64: string; url: string; durationSec: number }> {
  const tempCtx = new AudioContext();
  const decoded = await decodeWavBase64(tempCtx, base64);
  await tempCtx.close().catch(() => {});

  const totalDur = decoded.duration;
  const startSec = Math.max(0, Math.min(totalDur - 0.15, (options.trimStartPct / 100) * totalDur));
  const endSec = Math.max(startSec + 0.15, Math.min(totalDur, (options.trimEndPct / 100) * totalDur));
  const trimDur = endSec - startSec;
  const speed = Math.max(0.7, Math.min(1.5, options.speed || 1));
  const outDuration = Math.max(0.15, trimDur / speed);

  const sampleRate = decoded.sampleRate || 24000;
  const offline = new OfflineAudioContext(1, Math.ceil(outDuration * sampleRate), sampleRate);

  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.playbackRate.value = speed;

  // Tone EQ shaping
  const lowShelf = offline.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 180;

  const highShelf = offline.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 3200;

  if (options.tonePreset === 'warm') {
    lowShelf.gain.value = 5;
    highShelf.gain.value = -1.5;
  } else if (options.tonePreset === 'studio') {
    lowShelf.gain.value = 2.5;
    highShelf.gain.value = 4;
  } else if (options.tonePreset === 'kids') {
    lowShelf.gain.value = -2;
    highShelf.gain.value = 5.5;
  } else {
    lowShelf.gain.value = 0;
    highShelf.gain.value = 0;
  }

  const masterGain = offline.createGain();
  const vol = Math.max(0.2, Math.min(2.0, options.gain || 1));
  if (options.fadeEdges && outDuration > 0.3) {
    const fadeSec = Math.min(0.18, outDuration * 0.2);
    masterGain.gain.setValueAtTime(0.01, 0);
    masterGain.gain.linearRampToValueAtTime(vol, fadeSec);
    masterGain.gain.setValueAtTime(vol, Math.max(fadeSec, outDuration - fadeSec));
    masterGain.gain.linearRampToValueAtTime(0.01, outDuration);
  } else {
    masterGain.gain.setValueAtTime(vol, 0);
  }

  src.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(masterGain);
  masterGain.connect(offline.destination);

  src.start(0, startSec, trimDur);
  const rendered = await offline.startRendering();
  const wavBlob = encodeWavFromAudioBuffer(rendered);
  const nextBase64 = await blobToBase64(wavBlob);
  return {
    base64: nextBase64,
    url: `data:audio/wav;base64,${nextBase64}`,
    durationSec: rendered.duration,
  };
}

export const SFX_OPTIONS: { id: 'none' | 'pop' | 'whoosh' | 'chime' | 'bell' | 'drum'; labelTe: string; labelEn: string }[] = [
  { id: 'none', labelTe: 'SFX వద్దు', labelEn: 'No SFX' },
  { id: 'pop', labelTe: 'పాప్', labelEn: 'Cartoon Pop' },
  { id: 'whoosh', labelTe: 'వూష్', labelEn: 'Transition Whoosh' },
  { id: 'chime', labelTe: 'చైమ్', labelEn: 'Magic Chime' },
  { id: 'bell', labelTe: 'బెల్', labelEn: 'Notification Bell' },
  { id: 'drum', labelTe: 'డ్రమ్ హిట్', labelEn: 'Action Drum' },
];

export function scheduleSfx(
  ctx: AudioContext,
  destNode: AudioNode,
  sfx: 'none' | 'pop' | 'whoosh' | 'chime' | 'bell' | 'drum' | undefined,
  when: number
) {
  if (!sfx || sfx === 'none') return;
  const gain = ctx.createGain();
  gain.connect(destNode);

  if (sfx === 'pop') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, when);
    osc.frequency.exponentialRampToValueAtTime(860, when + 0.08);
    gain.gain.setValueAtTime(0.32, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.11);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + 0.12);
  } else if (sfx === 'whoosh') {
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220, when);
    filter.frequency.exponentialRampToValueAtTime(1800, when + 0.18);
    filter.frequency.exponentialRampToValueAtTime(300, when + 0.35);
    gain.gain.setValueAtTime(0.01, when);
    gain.gain.linearRampToValueAtTime(0.28, when + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
    src.connect(filter);
    filter.connect(gain);
    src.start(when);
    src.stop(when + 0.36);
  } else if (sfx === 'chime') {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, when + i * 0.06);
      g.gain.setValueAtTime(0.18, when + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, when + i * 0.06 + 0.45);
      osc.connect(g);
      g.connect(destNode);
      osc.start(when + i * 0.06);
      osc.stop(when + i * 0.06 + 0.48);
    });
  } else if (sfx === 'bell') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, when);
    gain.gain.setValueAtTime(0.26, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + 0.62);
  } else if (sfx === 'drum') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.22);
    gain.gain.setValueAtTime(0.5, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + 0.27);
  }
}

export async function playSfxPreview(sfx: 'none' | 'pop' | 'whoosh' | 'chime' | 'bell' | 'drum'): Promise<void> {
  if (sfx === 'none') return;
  const ctx = new AudioContext();
  scheduleSfx(ctx, ctx.destination, sfx, ctx.currentTime + 0.02);
  setTimeout(() => {
    ctx.close().catch(() => {});
  }, 850);
}

export async function renderSfxToWavBase64(
  sfx: 'pop' | 'whoosh' | 'chime' | 'bell' | 'drum'
): Promise<{ base64: string; url: string }> {
  const sampleRate = 24000;
  const dur = 0.7;
  const offline = new OfflineAudioContext(1, Math.ceil(dur * sampleRate), sampleRate);
  scheduleSfx(offline as unknown as AudioContext, offline.destination, sfx, 0.02);
  const buf = await offline.startRendering();
  const blob = encodeWavFromAudioBuffer(buf);
  const base64 = await blobToBase64(blob);
  return { base64, url: `data:audio/wav;base64,${base64}` };
}

export async function extractAudioFromMediaFile(file: File): Promise<{
  base64: string;
  url: string;
  durationSec: number;
}> {
  const arr = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arr.slice(0));
    const wavBlob = encodeWavFromAudioBuffer(decoded);
    const base64 = await blobToBase64(wavBlob);
    return {
      base64,
      url: `data:audio/wav;base64,${base64}`,
      durationSec: decoded.duration,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

