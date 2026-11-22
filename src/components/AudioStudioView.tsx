import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Download,
  Music,
  Play,
  Square,
  Loader2,
  Film,
  Upload,
  Sliders,
  RotateCcw,
  HardDrive,
  Volume2,
  FileAudio,
  Save,
  Check,
} from 'lucide-react';
import {
  ContentLanguage,
  LanguageMode,
  MusicTrackId,
  SavedAssetItem,
  SceneSfxId,
  VoiceName,
  VoiceStylePreset,
} from '../types/studio';
import {
  blobToBase64,
  encodeWavFromAudioBuffer,
  extractAudioFromMediaFile,
  MUSIC_TRACK_OPTIONS,
  playSfxPreview,
  processVoiceClipToWav,
  renderSfxToWavBase64,
  scheduleProceduralMusic,
  SFX_OPTIONS,
  VoiceTonePreset,
} from '../utils/audioEngine';
import { useFirebase } from '../contexts/FirebaseContext';
import { DriveAuthError, uploadBlobToDrive } from '../utils/googleDriveService';

interface AudioStudioViewProps {
  lang: LanguageMode;
  initialAudio?: { base64: string; title: string } | null;
  onClearInitialAudio?: () => void;
  onAttachVoiceToScene: (text: string, audioBase64: string, mimeType: string, voiceName: VoiceName) => void;
  onSaveAsset?: (asset: Omit<SavedAssetItem, 'id' | 'createdAt'>) => Promise<void>;
}

interface ClipData {
  base64: string;
  mimeType: string;
  url: string;
}

export const AudioStudioView: React.FC<AudioStudioViewProps> = ({
  lang,
  initialAudio,
  onClearInitialAudio,
  onAttachVoiceToScene,
  onSaveAsset,
}) => {
  const { driveToken, connectGoogleDrive, clearDriveToken } = useFirebase();
  const [text, setText] = useState('');
  const [contentLang, setContentLang] = useState<ContentLanguage>('te');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  const [voiceStyle, setVoiceStyle] = useState<VoiceStylePreset>('storyteller');
  const [loading, setLoading] = useState(false);
  const [savingDrive, setSavingDrive] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [assetSavedNotice, setAssetSavedNotice] = useState(false);
  const [driveNotice, setDriveNotice] = useState('');
  const [error, setError] = useState('');

  const [originalAudio, setOriginalAudio] = useState<ClipData | null>(null);
  const [audioData, setAudioData] = useState<ClipData | null>(null);

  useEffect(() => {
    if (!initialAudio) return;
    const clip: ClipData = {
      base64: initialAudio.base64,
      mimeType: 'audio/wav',
      url: `data:audio/wav;base64,${initialAudio.base64}`,
    };
    setOriginalAudio(clip);
    setAudioData(clip);
    if (!text.trim() && initialAudio.title) {
      setText(initialAudio.title);
    }
    onClearInitialAudio?.();
  }, [initialAudio]);

  // Mic Recording + Audio / Video-to-Audio Extraction
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoExtractInputRef = useRef<HTMLInputElement | null>(null);

  // Simple Voice Editor state
  const [trimStartPct, setTrimStartPct] = useState(0);
  const [trimEndPct, setTrimEndPct] = useState(100);
  const [speed, setSpeed] = useState(1.0);
  const [tonePreset, setTonePreset] = useState<VoiceTonePreset>('natural');
  const [gain, setGain] = useState(1.0);
  const [fadeEdges, setFadeEdges] = useState(true);
  const [processingEdit, setProcessingEdit] = useState(false);

  const [playingTrack, setPlayingTrack] = useState<MusicTrackId | null>(null);
  const musicCtxRef = useRef<AudioContext | null>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);

  const stopPreviewMusic = () => {
    if (stopMusicRef.current) {
      stopMusicRef.current();
      stopMusicRef.current = null;
    }
    if (musicCtxRef.current && musicCtxRef.current.state !== 'closed') {
      musicCtxRef.current.close().catch(() => {});
      musicCtxRef.current = null;
    }
    setPlayingTrack(null);
  };

  useEffect(() => {
    return () => {
      stopPreviewMusic();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    };
  }, []);

  const resetVoiceEdits = () => {
    setTrimStartPct(0);
    setTrimEndPct(100);
    setSpeed(1.0);
    setTonePreset('natural');
    setGain(1.0);
    setFadeEdges(true);
    if (originalAudio) setAudioData(originalAudio);
  };

  const handleToggleMusicPreview = (trackId: MusicTrackId) => {
    if (playingTrack === trackId || trackId === 'none') {
      stopPreviewMusic();
      return;
    }
    stopPreviewMusic();
    const ctx = new AudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.35;
    gainNode.connect(ctx.destination);
    musicCtxRef.current = ctx;
    stopMusicRef.current = scheduleProceduralMusic(ctx, gainNode, trackId, ctx.currentTime + 0.05, 16);
    setPlayingTrack(trackId);
  };

  const handleGenerateVoice = async () => {
    if (!text.trim()) {
      setError(lang === 'te' ? 'దయచేసి వాయిస్ చదవాల్సిన టెక్స్ట్ రాయండి.' : 'Please enter text to synthesize.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/studio/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName, voiceStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Voice synthesis failed');

      const mime = data.mimeType || 'audio/wav';
      const url = `data:${mime};base64,${data.audioBase64}`;
      const clip: ClipData = { base64: data.audioBase64, mimeType: mime, url };
      setOriginalAudio(clip);
      setAudioData(clip);
      resetVoiceEdits();
    } catch (err: any) {
      setError(err.message || 'Voice synthesis failed');
    } finally {
      setLoading(false);
    }
  };

  const decodeAnyBlobToWavClip = async (blob: Blob) => {
    const arr = await blob.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(arr);
      const wavBlob = encodeWavFromAudioBuffer(decoded);
      const base64 = await blobToBase64(wavBlob);
      const clip: ClipData = {
        base64,
        mimeType: 'audio/wav',
        url: `data:audio/wav;base64,${base64}`,
      };
      setOriginalAudio(clip);
      setAudioData(clip);
      setTrimStartPct(0);
      setTrimEndPct(100);
      setSpeed(1.0);
      setTonePreset('natural');
      setGain(1.0);
    } finally {
      await ctx.close().catch(() => {});
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      return;
    }

    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        try {
          const rawBlob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          await decodeAnyBlobToWavClip(rawBlob);
        } catch (err: any) {
          setError(err.message || 'Could not process recorded audio');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordSec(0);
      setIsRecording(true);
      recordTimerRef.current = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch {
      setError(
        lang === 'te'
          ? 'మైక్రోఫోన్ అనుమతి అందుబాటులో లేదు.'
          : 'Microphone permission denied or unavailable.'
      );
    }
  };

  const handleUploadAudioFile = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setError('');
    try {
      await decodeAnyBlobToWavClip(files[0]);
      if (!text.trim()) {
        setText(files[0].name.replace(/\.[^.]+$/, ''));
      }
    } catch (err: any) {
      setError(err.message || 'Could not decode uploaded audio file');
    }
  };

  const handleExtractFromVideo = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setError('');
    setProcessingEdit(true);
    try {
      const extracted = await extractAudioFromMediaFile(files[0]);
      const clip: ClipData = {
        base64: extracted.base64,
        mimeType: 'audio/wav',
        url: extracted.url,
      };
      setOriginalAudio(clip);
      setAudioData(clip);
      if (!text.trim()) {
        setText(`Extracted: ${files[0].name.replace(/\.[^.]+$/, '')}`);
      }
    } catch (err: any) {
      setError(err.message || 'Could not extract audio track from this video file');
    } finally {
      setProcessingEdit(false);
    }
  };

  const handleApplyVoiceEdits = async () => {
    if (!originalAudio) return;
    setProcessingEdit(true);
    setError('');
    try {
      const safeEnd = Math.max(trimStartPct + 10, trimEndPct);
      const edited = await processVoiceClipToWav(originalAudio.base64, {
        trimStartPct,
        trimEndPct: Math.min(100, safeEnd),
        speed,
        gain,
        tonePreset,
        fadeEdges,
      });
      setAudioData({ base64: edited.base64, mimeType: 'audio/wav', url: edited.url });
    } catch (err: any) {
      setError(err.message || 'Voice editing failed');
    } finally {
      setProcessingEdit(false);
    }
  };

  const handleDownloadWav = () => {
    if (!audioData) return;
    const a = document.createElement('a');
    a.href = audioData.url;
    a.download = `ai_voice_${voiceName.toLowerCase()}.wav`;
    a.click();
  };

  const handleSaveToHistory = async () => {
    if (!audioData || !onSaveAsset) return;
    setSavingAsset(true);
    try {
      await onSaveAsset({
        type: 'audio',
        title: text.trim().slice(0, 48) || `AI Voice (${voiceName})`,
        subtitle: `${voiceName} · ${voiceStyle} · WAV`,
        dataUrl: audioData.url,
        mimeType: 'audio/wav',
      });
      setAssetSavedNotice(true);
      setTimeout(() => setAssetSavedNotice(false), 2000);
    } finally {
      setSavingAsset(false);
    }
  };

  const handleDownloadSfxWav = async (sfxId: SceneSfxId) => {
    if (sfxId === 'none') return;
    const rendered = await renderSfxToWavBase64(sfxId);
    const a = document.createElement('a');
    a.href = rendered.url;
    a.download = `sfx_${sfxId}.wav`;
    a.click();
  };

  const handleSaveToDrive = async () => {
    if (!audioData) return;
    setSavingDrive(true);
    setError('');
    setDriveNotice('');
    try {
      const token = driveToken || (await connectGoogleDrive());
      if (!token) return;
      const res = await fetch(audioData.url);
      const blob = await res.blob();
      const safeName = `ai_voice_${voiceName.toLowerCase()}_${Date.now()}.wav`;
      await uploadBlobToDrive({
        token,
        fileName: safeName,
        mimeType: 'audio/wav',
        blob,
        description: 'Voiceover edited in AI VIDEO MAKER PRO',
        useStudioFolder: true,
      });
      setDriveNotice(lang === 'te' ? 'వాయిస్ Drive లో సేవ్ అయింది!' : 'Voice saved to Drive!');
      setTimeout(() => setDriveNotice(''), 3000);
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Failed to save audio to Google Drive');
    } finally {
      setSavingDrive(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'AI వాయిస్, ఆడియో ఎడిటర్ & SFX స్టూడియో' : 'AI Voice, Audio Editor & SFX Studio'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'te'
            ? 'తెలుగు & ఇంగ్లీష్ AI వాయిస్, మైక్ రికార్డ్, వీడియో నుండి ఆడియో వేరు చేయడం, ట్రిమ్ & సౌండ్ ఎఫెక్ట్స్.'
            : 'Telugu & English Male/Female AI voices, mic recording, Video-to-Audio extractor, WAV editor & Sound Effects pad.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Voice Generator + Record + Extract + Voice Editor */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <Mic className="w-4 h-4" />
              <span>{lang === 'te' ? 'వాయిస్ & ఎక్స్‌ట్రాక్షన్ టూల్స్' : 'Voice & Extraction Tools'}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleRecording}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200'
                }`}
              >
                {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-500" />}
                <span>
                  {isRecording
                    ? `${lang === 'te' ? 'ఆపండి' : 'Stop'} (${recordSec}s)`
                    : lang === 'te'
                      ? 'మైక్ రికార్డ్'
                      : 'Record Mic'}
                </span>
              </button>

              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleUploadAudioFile(e.target.files)}
              />
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'te' ? 'ఆడియో అప్లోడ్' : 'Upload Audio'}</span>
              </button>

              <input
                ref={videoExtractInputRef}
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => void handleExtractFromVideo(e.target.files)}
              />
              <button
                type="button"
                onClick={() => videoExtractInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <FileAudio className="w-3.5 h-3.5 text-sky-500" />
                <span>{lang === 'te' ? 'వీడియో నుండి ఆడియో' : 'Extract from Video'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'వాయిస్ కోసం టెక్స్ట్' : 'Voiceover Script Text'}
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                lang === 'te'
                  ? 'వాయిస్ చదవాల్సిన కథ / మాటలు ఇక్కడ రాయండి...'
                  : 'Enter Telugu or English narration text here...'
              }
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'భాష' : 'Language'}
              </label>
              <select
                value={contentLang}
                onChange={(e) => setContentLang(e.target.value as ContentLanguage)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="te">తెలుగు (Telugu)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'వాయిస్ (Female / Male)' : 'Voice Actor'}
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value as VoiceName)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="Kore">Kore (Female · Warm)</option>
                <option value="Zephyr">Zephyr (Female · Calm)</option>
                <option value="Puck">Puck (Male · Youth)</option>
                <option value="Charon">Charon (Male · Deep Cinema)</option>
                <option value="Fenrir">Fenrir (Male · Bold Narrator)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'వాయిస్ శైలి' : 'Voice Style'}
              </label>
              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value as VoiceStylePreset)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="storyteller">Warm Storyteller</option>
                <option value="cartoon">Kids Cartoon</option>
                <option value="documentary">Documentary</option>
                <option value="energetic">Energetic Shorts</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateVoice}
            disabled={loading}
            className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            <span>
              {loading
                ? lang === 'te'
                  ? 'AI వాయిస్ తయారవుతోంది...'
                  : 'Generating AI Voice...'
                : lang === 'te'
                  ? 'AI వాయిస్ తయారు చేయండి (WAV)'
                  : 'Generate AI Voiceover (WAV)'}
            </span>
          </button>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {lang === 'te'
              ? 'గమనిక: బ్రౌజర్ వెబ్ ఆడియో నేరుగా లాస్‌లెస్ WAV ఫార్మాట్‌లో ఎగుమతి చేస్తుంది (MP3 ఎన్‌కోడింగ్ సర్వర్ ffmpeg పై ఆధారపడుతుంది).'
              : 'Note: Browser Web Audio exports clean lossless WAV files directly (native MP3 encoding is not bundled in client JS).'}
          </p>

          {audioData && (
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-4">
              <audio controls src={audioData.url} className="w-full" />

              {/* Simple Voice Editor Controls */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{lang === 'te' ? 'సులభమైన వాయిస్ ఎడిటర్' : 'Voice Trim, Speed & EQ Editor'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={resetVoiceEdits}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === 'te' ? 'రీసెట్' : 'Reset'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'మొదలు ట్రిమ్' : 'Trim Start'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{trimStartPct}%</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={trimStartPct}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTrimStartPct(v);
                        if (trimEndPct <= v + 10) setTrimEndPct(Math.min(100, v + 15));
                      }}
                      className="accent-amber-500"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'చివర ట్రిమ్' : 'Trim End'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{trimEndPct}%</strong>
                    </span>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={trimEndPct}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTrimEndPct(Math.max(v, trimStartPct + 10));
                      }}
                      className="accent-amber-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-600 dark:text-slate-400">{lang === 'te' ? 'స్పీడ్' : 'Speed'}</span>
                    <select
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="min-h-[38px] bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value={0.85}>0.85x Slow</option>
                      <option value={1}>1.0x Normal</option>
                      <option value={1.15}>1.15x Fast</option>
                      <option value={1.3}>1.30x Shorts</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-slate-600 dark:text-slate-400">{lang === 'te' ? 'వాయిస్ టోన్' : 'Tone EQ'}</span>
                    <select
                      value={tonePreset}
                      onChange={(e) => setTonePreset(e.target.value as VoiceTonePreset)}
                      className="min-h-[38px] bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="natural">Natural (సాధారణ)</option>
                      <option value="warm">Warm Radio</option>
                      <option value="studio">Studio Crisp</option>
                      <option value="kids">Bright Kids</option>
                    </select>
                  </div>

                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'వాల్యూమ్' : 'Boost'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{Math.round(gain * 100)}%</strong>
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.05}
                      value={gain}
                      onChange={(e) => setGain(Number(e.target.value))}
                      className="accent-amber-500 mt-1.5"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fadeEdges}
                      onChange={(e) => setFadeEdges(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>{lang === 'te' ? 'స్మూత్ ఫేడ్ ఇన్/అవుట్' : 'Smooth Fade In / Out'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleApplyVoiceEdits}
                    disabled={processingEdit}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    {processingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
                    <span>{lang === 'te' ? 'మార్పులు వర్తింపజేయండి' : 'Apply Edits'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadWav}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-100 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-500" />
                    <span>{lang === 'te' ? 'ఆడియో డౌన్లోడ్ (WAV)' : 'Download Audio'}</span>
                  </button>
                  {onSaveAsset && (
                    <button
                      type="button"
                      onClick={() => void handleSaveToHistory()}
                      disabled={savingAsset}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      {assetSavedNotice ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />}
                      <span>{assetSavedNotice ? (lang === 'te' ? 'సేవ్ అయింది' : 'Saved') : lang === 'te' ? 'సేవ్' : 'Save'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveToDrive()}
                    disabled={savingDrive}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    {savingDrive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <HardDrive className="w-4 h-4 text-amber-500" />
                    )}
                    <span>{driveNotice ? 'Drive OK' : 'Drive'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onAttachVoiceToScene(text || 'Voiceover', audioData.base64, audioData.mimeType, voiceName)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>{lang === 'te' ? 'వీడియో సీన్‌కు జోడించండి' : 'Send to Video Scene'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Royalty-Free Music + Sound Effects Pad */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <Music className="w-4 h-4" />
              <span>{lang === 'te' ? 'కాపీరైట్ ఫ్రీ బ్యాక్‌గ్రౌండ్ సంగీతం' : 'Royalty-Free Music Tracks'}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {MUSIC_TRACK_OPTIONS.filter((m) => m.id !== 'none').map((track) => {
                const isPlaying = playingTrack === track.id;
                return (
                  <div
                    key={track.id}
                    className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {lang === 'te' ? track.labelTe : track.labelEn}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                        {track.bpm} BPM · YouTube Safe
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleMusicPreview(track.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isPlaying
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? (lang === 'te' ? 'ఆపండి' : 'Stop') : lang === 'te' ? 'వినండి' : 'Play'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <Volume2 className="w-4 h-4" />
              <span>{lang === 'te' ? 'సౌండ్ ఎఫెక్ట్స్ (SFX ప్యాడ్)' : 'Sound Effects (SFX Pad)'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SFX_OPTIONS.filter((s) => s.id !== 'none').map((sfx) => (
                <div
                  key={sfx.id}
                  className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => playSfxPreview(sfx.id)}
                    className="text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'te' ? sfx.labelTe : sfx.labelEn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadSfxWav(sfx.id)}
                    className="text-[11px] text-slate-500 hover:text-amber-500 flex items-center gap-1 cursor-pointer"
                    title="Download SFX WAV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
