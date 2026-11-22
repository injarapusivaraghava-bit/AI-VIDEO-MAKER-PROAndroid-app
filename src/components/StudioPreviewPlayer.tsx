import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { LanguageMode, VideoProject } from '../types/studio';
import { TRANSLATIONS } from '../i18n/translations';
import {
  findSceneAtTime,
  getCanvasDimensions,
  getSceneEffectiveDuration,
  getTotalDuration,
  preloadProjectImages,
  renderSceneFrame,
} from '../utils/canvasRenderer';
import { decodeWavBase64, scheduleProceduralMusic, scheduleSfx } from '../utils/audioEngine';

interface StudioPreviewPlayerProps {
  project: VideoProject;
  lang: LanguageMode;
  watermarkText?: string;
  activeSceneIndex: number;
  onSelectSceneIndex: (index: number) => void;
}

export const StudioPreviewPlayer: React.FC<StudioPreviewPlayerProps> = ({
  project,
  lang,
  watermarkText,
  activeSceneIndex,
  onSelectSceneIndex,
}) => {
  const t = TRANSLATIONS[lang];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);
  const voiceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef<number>(0);
  const playStartOffsetRef = useRef<number>(0);

  const totalDuration = Math.max(1, getTotalDuration(project.scenes));
  const dims = getCanvasDimensions(project.aspectRatio, project.quality || '720p');

  // Preload images whenever scenes change
  useEffect(() => {
    let cancelled = false;
    preloadProjectImages(project.scenes).then((cache) => {
      if (!cancelled) {
        imageCacheRef.current = cache;
        drawAt(currentTime);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project.scenes]);

  // Jump to scene when user clicks a scene card while paused
  useEffect(() => {
    if (isPlaying) return;
    let cursor = 0;
    for (let i = 0; i < activeSceneIndex && i < project.scenes.length; i++) {
      cursor += getSceneEffectiveDuration(project.scenes[i]);
    }
    setCurrentTime(cursor);
    drawAt(cursor);
  }, [activeSceneIndex]);

  const drawAt = (timeSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas || project.scenes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scene, progress } = findSceneAtTime(project.scenes, timeSec);
    renderSceneFrame(ctx, project, scene, progress, timeSec, imageCacheRef.current, watermarkText);
  };

  useEffect(() => {
    drawAt(currentTime);
  }, [project, watermarkText, currentTime]);

  const stopAudio = () => {
    if (stopMusicRef.current) {
      stopMusicRef.current();
      stopMusicRef.current = null;
    }
    voiceNodesRef.current.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {}
    });
    voiceNodesRef.current = [];
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const startPlayback = async (fromTime: number) => {
    stopAudio();
    const startOffset = fromTime >= totalDuration - 0.1 ? 0 : fromTime;
    setCurrentTime(startOffset);
    setIsPlaying(true);

    if (!isMuted) {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const musicGain = ctx.createGain();
        musicGain.gain.value = project.musicVolume ?? 0.25;
        musicGain.connect(ctx.destination);

        const voiceGain = ctx.createGain();
        voiceGain.gain.value = project.voiceVolume ?? 1.0;
        voiceGain.connect(ctx.destination);

        const remaining = Math.max(0.2, totalDuration - startOffset);
        stopMusicRef.current = scheduleProceduralMusic(
          ctx,
          musicGain,
          project.musicTrack,
          ctx.currentTime + 0.05,
          remaining
        );

        // Schedule scene voiceovers & SFX that intersect [startOffset, totalDuration]
        const sfxGain = ctx.createGain();
        sfxGain.gain.value = 0.7;
        sfxGain.connect(ctx.destination);

        let cursor = 0;
        for (const s of project.scenes) {
          const dur = getSceneEffectiveDuration(s);
          const sceneEnd = cursor + dur;
          if (s.sfx && s.sfx !== 'none' && cursor >= startOffset) {
            scheduleSfx(ctx, sfxGain, s.sfx, ctx.currentTime + 0.05 + (cursor - startOffset));
          }
          if (s.audioBase64 && sceneEnd > startOffset) {
            try {
              const buf = await decodeWavBase64(ctx, s.audioBase64);
              const src = ctx.createBufferSource();
              src.buffer = buf;
              src.playbackRate.value = Math.max(0.5, Math.min(2, s.speed || 1));
              src.connect(voiceGain);
              const offsetInScene = Math.max(0, startOffset - cursor);
              const delay = Math.max(0, cursor - startOffset);
              if (offsetInScene < buf.duration) {
                src.start(ctx.currentTime + 0.05 + delay, offsetInScene);
                voiceNodesRef.current.push(src);
              }
            } catch {}
          }
          cursor = sceneEnd;
        }
      } catch (e) {
        console.warn('AudioContext preview failed:', e);
      }
    }

    playStartWallRef.current = performance.now();
    playStartOffsetRef.current = startOffset;

    const tick = () => {
      const elapsed = playStartOffsetRef.current + (performance.now() - playStartWallRef.current) / 1000;
      if (elapsed >= totalDuration) {
        setCurrentTime(totalDuration);
        drawAt(totalDuration);
        setIsPlaying(false);
        stopAudio();
        return;
      }
      setCurrentTime(elapsed);
      drawAt(elapsed);
      const { index } = findSceneAtTime(project.scenes, elapsed);
      if (index !== activeSceneIndex) {
        onSelectSceneIndex(index);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    stopAudio();
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopAudio();
    };
  }, []);

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setCurrentTime(next);
    drawAt(next);
    const { index } = findSceneAtTime(project.scenes, next);
    onSelectSceneIndex(index);
    if (isPlaying) {
      startPlayback(next);
    }
  };

  return (
    <div className="bg-[#13161F] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-100 truncate">{project.title}</h2>
          <p className="text-xs text-slate-400">
            {project.aspectRatio} · {project.scenes.length} {lang === 'te' ? 'సీన్లు' : 'scenes'} ·{' '}
            <span className="font-mono-tabular">{formatSec(totalDuration)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextMute = !isMuted;
            setIsMuted(nextMute);
            if (isPlaying && nextMute) {
              stopAudio();
            } else if (isPlaying && !nextMute) {
              startPlayback(currentTime);
            }
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          aria-label={isMuted ? 'Unmute preview' : 'Mute preview'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Video Stage */}
      <div className="w-full bg-[#07090D] rounded-xl border border-white/5 flex items-center justify-center overflow-hidden p-2">
        <canvas
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          className={
            project.aspectRatio === '9:16'
              ? 'h-[420px] sm:h-[480px] w-auto max-w-full rounded-lg shadow-2xl'
              : project.aspectRatio === '1:1'
                ? 'h-[360px] sm:h-[420px] w-auto max-w-full aspect-square rounded-lg shadow-2xl'
                : 'w-full max-h-[440px] aspect-video object-contain rounded-lg shadow-2xl'
          }
        />
      </div>

      {/* Transport & Timeline Scrubber */}
      <div className="flex flex-col gap-3">
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.05}
          value={currentTime}
          onChange={handleScrub}
          aria-label="Video timeline scrubber"
          className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (isPlaying ? pausePlayback() : startPlayback(currentTime))}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? t.previewPause : t.previewPlay}</span>
            </button>

            <button
              type="button"
              onClick={() => startPlayback(0)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.previewRestart}</span>
            </button>
          </div>

          <div className="text-sm font-mono-tabular text-slate-300 bg-[#0B0D12] px-3 py-1.5 rounded-lg border border-white/5">
            {formatSec(currentTime)} / {formatSec(totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};
