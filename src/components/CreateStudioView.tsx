import React, { useRef, useState } from 'react';
import {
  Wand2,
  ImagePlus,
  Smile,
  BookOpen,
  Mic,
  Music,
  Download,
  Youtube,
  Save,
  Plus,
  Trash2,
  Check,
  Loader2,
  Captions,
  ChevronUp,
  ChevronDown,
  Copy,
  HardDrive,
  Scissors,
  GitMerge,
  Share2,
  Undo2,
  Redo2,
  Volume2,
} from 'lucide-react';
import {
  AdminSettings,
  AspectRatio,
  CameraMotion,
  CartoonCharacter,
  ContentLanguage,
  CreationMode,
  LanguageMode,
  MusicTrackId,
  SceneFilter,
  SceneItem,
  SceneSfxId,
  SceneTransition,
  STUDIO_BACKDROPS,
  SubtitleStyle,
  VideoProject,
  VideoQuality,
  VideoStyle,
  VoiceName,
  VoiceStylePreset,
  WeatherFx,
} from '../types/studio';
import { TRANSLATIONS } from '../i18n/translations';
import { MUSIC_TRACK_OPTIONS, playSfxPreview, SFX_OPTIONS } from '../utils/audioEngine';
import {
  generateSrtContent,
  getSceneEffectiveDuration,
  getTotalDuration,
} from '../utils/canvasRenderer';
import { detectBestVideoExportCodec, getWhatsAppShareUrl } from '../utils/shareUtils';
import { StudioPreviewPlayer } from './StudioPreviewPlayer';

interface CreateStudioViewProps {
  project: VideoProject;
  lang: LanguageMode;
  adminSettings: Omit<AdminSettings, 'adminPin'>;
  onChangeProject: (updated: VideoProject) => void;
  onSaveProject: () => Promise<void>;
  onDownloadProject?: () => void;
  onDownloadVideo: () => Promise<void>;
  onShareVideo?: () => Promise<void>;
  onSaveVideoToDrive?: () => Promise<void>;
  onOpenYouTubeModal: () => void;
  isExporting: boolean;
  sharingVideo?: boolean;
  savingToDrive?: boolean;
  driveSavedNotice?: boolean;
  exportProgress: number;
  savingProject: boolean;
  savedNotice: boolean;
}

const QUICK_STARTERS = [
  {
    id: 'starter-cartoon',
    labelTe: 'పిల్లల కార్టూన్ కథ',
    labelEn: 'Kids Cartoon Story',
    mode: 'cartoon-maker' as CreationMode,
    style: 'cartoon' as VideoStyle,
    aspectRatio: '16:9' as AspectRatio,
    promptTe: 'ఒక అల్లరి కుందేలు, తెలివైన గుడ్లగూబ కలిసి అడవిలో తప్పిపోయిన చిన్న పక్షిని ఇంటికి చేర్చిన పిల్లల కార్టూన్ కథ.',
    promptEn: 'A playful rabbit and a wise owl team up to guide a lost baby bird home through the sunlit forest.',
  },
  {
    id: 'starter-shorts',
    labelTe: 'YouTube షార్ట్స్ (9:16)',
    labelEn: 'YouTube Shorts Reel',
    mode: 'text-to-video' as CreationMode,
    style: 'realistic' as VideoStyle,
    aspectRatio: '9:16' as AspectRatio,
    promptTe: 'జీవితంలో విజయం సాధించడానికి ప్రతిరోజూ ఉదయం పాటించాల్సిన 3 శక్తివంతమైన అలవాట్ల పై మోటివేషనల్ యూట్యూబ్ షార్ట్.',
    promptEn: 'Three powerful morning habits that transform focus and discipline in 30 days, cinematic vertical short.',
  },
  {
    id: 'starter-village',
    labelTe: 'తెలుగు పల్లెటూరి కథ',
    labelEn: 'Telugu Village Tale',
    mode: 'story-maker' as CreationMode,
    style: 'devotional' as VideoStyle,
    aspectRatio: '16:9' as AspectRatio,
    promptTe: 'గోదావరి తీరంలోని అందమైన పల్లెటూరిలో తాతయ్య తన మనవడికి చెప్పిన నిజాయితీ విలువ గురించి హృద్యమైన తెలుగు కథ.',
    promptEn: 'A heartwarming tale of a grandfather sharing a timeless lesson on honesty along a quiet riverside village at dusk.',
  },
];

const SCENE_STICKERS = ['', '⭐', '🔥', '❤️', '🎉', '💡', '🎬'];

export const CreateStudioView: React.FC<CreateStudioViewProps> = ({
  project,
  lang,
  adminSettings,
  onChangeProject,
  onSaveProject,
  onDownloadProject,
  onDownloadVideo,
  onShareVideo,
  onSaveVideoToDrive,
  onOpenYouTubeModal,
  isExporting,
  sharingVideo = false,
  savingToDrive = false,
  driveSavedNotice = false,
  exportProgress,
  savingProject,
  savedNotice,
}) => {
  const t = TRANSLATIONS[lang];
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [generationStep, setGenerationStep] = useState<'idle' | 'scripting' | 'voicing'>('idle');
  const [autoGenerateVoice, setAutoGenerateVoice] = useState(true);
  const [generatingVoices, setGeneratingVoices] = useState(false);
  const [durationMode, setDurationMode] = useState<'short' | 'long'>(
    (project.targetDurationSec || 30) > 90 ? 'long' : 'short'
  );
  const [undoStack, setUndoStack] = useState<VideoProject[]>([]);
  const [redoStack, setRedoStack] = useState<VideoProject[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const scenePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [targetSceneForPhoto, setTargetSceneForPhoto] = useState<string | null>(null);

  const commitChange = (updated: VideoProject, recordHistory = true) => {
    if (recordHistory) {
      setUndoStack((prev) => [...prev.slice(-19), project]);
      setRedoStack([]);
    }
    onChangeProject(updated);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevState = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, project]);
    onChangeProject(prevState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, project]);
    onChangeProject(nextState);
  };

  const updateScene = (sceneId: string, patch: Partial<SceneItem>) => {
    commitChange({
      ...project,
      scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    });
  };

  const handleGenerateStoryboard = async () => {
    if (!project.prompt.trim()) {
      setErrorMsg(lang === 'te' ? 'దయచేసి ముందుగా కథ లేదా వీడియో ఆలోచన రాయండి.' : 'Please enter a story or prompt first.');
      return;
    }
    setGeneratingStoryboard(true);
    setGenerationStep('scripting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/studio/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: project.prompt,
          style: project.style,
          aspectRatio: project.aspectRatio,
          contentLanguage: project.contentLanguage,
          mode: project.mode,
          targetDurationSec: project.targetDurationSec || 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate storyboard');

      let updatedProject: VideoProject = {
        ...project,
        title: data.videoTitle || project.title,
        scenes: data.scenes || project.scenes,
      };
      commitChange(updatedProject);
      setActiveSceneIndex(0);

      if (autoGenerateVoice && updatedProject.scenes.length > 0) {
        setGenerationStep('voicing');
        const voicedScenes = [...updatedProject.scenes];
        for (let i = 0; i < voicedScenes.length; i++) {
          const s = voicedScenes[i];
          if (!s.narration.trim()) continue;
          voicedScenes[i] = { ...s, audioStatus: 'generating' };
          onChangeProject({ ...updatedProject, scenes: [...voicedScenes] });

          const vRes = await fetch('/api/studio/generate-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: s.narration,
              voiceName: updatedProject.voiceName,
              voiceStyle: updatedProject.voiceStyle,
            }),
          });
          const vData = await vRes.json();
          if (vRes.ok && vData.audioBase64) {
            voicedScenes[i] = {
              ...s,
              audioBase64: vData.audioBase64,
              audioMimeType: vData.mimeType || 'audio/wav',
              audioStatus: 'ready',
            };
          } else {
            voicedScenes[i] = { ...s, audioStatus: 'error' };
          }
          updatedProject = { ...updatedProject, scenes: [...voicedScenes] };
          onChangeProject(updatedProject);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI video generation failed');
    } finally {
      setGeneratingStoryboard(false);
      setGenerationStep('idle');
    }
  };

  const handleGenerateSingleVoice = async (scene: SceneItem) => {
    if (!scene.narration.trim()) return;
    updateScene(scene.id, { audioStatus: 'generating' });
    setErrorMsg('');
    try {
      const res = await fetch('/api/studio/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scene.narration,
          voiceName: project.voiceName,
          voiceStyle: project.voiceStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Voice generation failed');

      updateScene(scene.id, {
        audioBase64: data.audioBase64,
        audioMimeType: data.mimeType || 'audio/wav',
        audioStatus: 'ready',
      });
    } catch (err: any) {
      updateScene(scene.id, { audioStatus: 'error' });
      setErrorMsg(err.message || 'Voice generation failed');
    }
  };

  const handleGenerateAllVoices = async () => {
    setGeneratingVoices(true);
    setErrorMsg('');
    try {
      const nextScenes = [...project.scenes];
      for (let i = 0; i < nextScenes.length; i++) {
        const s = nextScenes[i];
        if (!s.narration.trim()) continue;
        nextScenes[i] = { ...s, audioStatus: 'generating' };
        onChangeProject({ ...project, scenes: [...nextScenes] });

        const res = await fetch('/api/studio/generate-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: s.narration,
            voiceName: project.voiceName,
            voiceStyle: project.voiceStyle,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Voice generation failed');

        nextScenes[i] = {
          ...s,
          audioBase64: data.audioBase64,
          audioMimeType: data.mimeType || 'audio/wav',
          audioStatus: 'ready',
        };
        onChangeProject({ ...project, scenes: [...nextScenes] });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Voice generation failed');
    } finally {
      setGeneratingVoices(false);
    }
  };

  const handleUploadPhotosForVideo = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const readFile = (file: File) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

    const loaded = await Promise.all(
      Array.from(files).map(async (file, idx) => ({
        file,
        idx,
        dataUrl: await readFile(file),
      }))
    );

    const newScenes: SceneItem[] = loaded.map(({ file, idx, dataUrl }) => ({
      id: `img-scene-${Date.now()}-${idx}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      narration:
        project.contentLanguage === 'en'
          ? 'Watch this scene come alive with smooth cinematic motion.'
          : 'ఈ సుందరమైన దృశ్యం కదిలే వీడియో రూపంలో మీ ముందుకు వస్తోంది.',
      subtitleTe: 'ఈ సుందరమైన దృశ్యం కదిలే వీడియో రూపంలో మీ ముందుకు వస్తోంది.',
      subtitleEn: 'Watch this scene come alive with smooth cinematic motion.',
      durationSec: 5,
      cameraMotion: idx % 2 === 0 ? 'ken-burns' : 'zoom-in',
      weatherFx: 'golden-dust',
      backdropType: 'uploaded',
      imageUrl: dataUrl,
      palette: { skyTop: '#0F172A', skyBottom: '#1E293B', ground: '#0F172A', accent: '#F59E0B' },
      cartoonElements: { character: 'none', setting: 'mountains', mood: 'sunset' },
    }));

    const baseScenes =
      project.scenes.length === 1 && project.scenes[0].id.startsWith('blank-') ? [] : project.scenes;
    commitChange({
      ...project,
      mode: 'image-to-video',
      scenes: [...baseScenes, ...newScenes].slice(0, 20),
    });
  };

  const handleScenePhotoReplace = (files: FileList | null) => {
    if (!files || !files[0] || !targetSceneForPhoto) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateScene(targetSceneForPhoto, {
        backdropType: 'uploaded',
        imageUrl: reader.result as string,
      });
      setTargetSceneForPhoto(null);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleAddScene = () => {
    const newScene: SceneItem = {
      id: `scene-${Date.now()}`,
      title: lang === 'te' ? `కొత్త సీన్ ${project.scenes.length + 1}` : `Scene ${project.scenes.length + 1}`,
      narration:
        project.contentLanguage === 'en'
          ? 'Add your narration line here.'
          : 'ఇక్కడ మీ కథా వాక్యం రాయండి.',
      subtitleTe: 'ఇక్కడ మీ తెలుగు సబ్టైటిల్ రాయండి.',
      subtitleEn: 'Add your English subtitle here.',
      durationSec: 5,
      cameraMotion: project.style === 'cartoon' ? 'bounce-cartoon' : 'ken-burns',
      weatherFx: 'golden-dust',
      backdropType: 'procedural',
      palette: { skyTop: '#1E293B', skyBottom: '#334155', ground: '#14532D', accent: '#FBBF24' },
      cartoonElements: {
        character: project.style === 'cartoon' ? 'rabbit' : 'none',
        setting: 'forest',
        mood: 'sunny',
      },
    };
    commitChange({
      ...project,
      scenes: [...project.scenes, newScene],
    });
    setActiveSceneIndex(project.scenes.length);
  };

  const handleDuplicateScene = (index: number) => {
    const src = project.scenes[index];
    if (!src) return;
    const copy: SceneItem = {
      ...src,
      id: `scene-${Date.now()}-copy`,
      title: `${src.title} (Copy)`,
    };
    const next = [...project.scenes];
    next.splice(index + 1, 0, copy);
    commitChange({ ...project, scenes: next });
    setActiveSceneIndex(index + 1);
  };

  const handleMoveScene = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= project.scenes.length) return;
    const next = [...project.scenes];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commitChange({ ...project, scenes: next });
    if (activeSceneIndex === index) setActiveSceneIndex(target);
    else if (activeSceneIndex === target) setActiveSceneIndex(index);
  };

  const splitTextHalf = (txt: string): [string, string] => {
    const words = txt.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [txt, txt];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };

  const handleSplitScene = (index: number) => {
    const src = project.scenes[index];
    if (!src || project.scenes.length >= 20) return;
    const halfDur = Math.max(1, Number((Math.max(2, src.durationSec || 4) / 2).toFixed(1)));
    const [nar1, nar2] = splitTextHalf(src.narration);
    const [te1, te2] = splitTextHalf(src.subtitleTe || src.narration);
    const [en1, en2] = splitTextHalf(src.subtitleEn || src.narration);

    const part1: SceneItem = {
      ...src,
      title: `${src.title} (1/2)`,
      narration: nar1,
      subtitleTe: te1,
      subtitleEn: en1,
      durationSec: halfDur,
    };
    const part2: SceneItem = {
      ...src,
      id: `scene-${Date.now()}-split`,
      title: `${src.title} (2/2)`,
      narration: nar2,
      subtitleTe: te2,
      subtitleEn: en2,
      durationSec: halfDur,
      audioBase64: undefined,
      audioStatus: 'idle',
    };

    const next = [...project.scenes];
    next.splice(index, 1, part1, part2);
    commitChange({ ...project, scenes: next });
    setActiveSceneIndex(index);
  };

  const handleMergeWithNext = (index: number) => {
    if (index < 0 || index >= project.scenes.length - 1) return;
    const first = project.scenes[index];
    const second = project.scenes[index + 1];
    const merged: SceneItem = {
      ...first,
      title: `${first.title} + ${second.title}`.slice(0, 120),
      narration: [first.narration, second.narration].filter(Boolean).join(' '),
      subtitleTe: [first.subtitleTe, second.subtitleTe].filter(Boolean).join(' '),
      subtitleEn: [first.subtitleEn, second.subtitleEn].filter(Boolean).join(' '),
      durationSec: Math.min(60, Number(((first.durationSec || 4) + (second.durationSec || 4)).toFixed(1))),
      imageUrl: first.imageUrl || second.imageUrl,
      audioBase64: first.audioBase64 || second.audioBase64,
      audioMimeType: first.audioMimeType || second.audioMimeType,
    };
    const next = [...project.scenes];
    next.splice(index, 2, merged);
    commitChange({ ...project, scenes: next });
    setActiveSceneIndex(index);
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtContent(project);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeTabs: { id: CreationMode; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'text-to-video', label: t.modeTextToVideo, icon: <Wand2 className="w-4 h-4" /> },
    {
      id: 'image-to-video',
      label: t.modeImageToVideo,
      icon: <ImagePlus className="w-4 h-4" />,
      disabled: !adminSettings.enableImageToVideo,
    },
    {
      id: 'cartoon-maker',
      label: t.modeCartoonMaker,
      icon: <Smile className="w-4 h-4" />,
      disabled: !adminSettings.enableCartoon,
    },
    { id: 'story-maker', label: t.modeStoryMaker, icon: <BookOpen className="w-4 h-4" /> },
  ];

  const totalEffectiveSec = getTotalDuration(project.scenes);
  const currentSec = Math.max(5, Math.min(900, project.targetDurationSec || 30));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-6">
      {/* Studio Headline + Undo/Redo + Creation Mode Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight text-balance">
            {t.studioHeadline}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">{t.studioSubhead}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-medium flex items-center gap-1 cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{lang === 'te' ? 'అన్డు' : 'Undo'}</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-medium flex items-center gap-1 cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>{lang === 'te' ? 'రీడు' : 'Redo'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full">
            {modeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => {
                  const nextStyle: VideoStyle =
                    tab.id === 'cartoon-maker' ? 'cartoon' : tab.id === 'story-maker' ? 'devotional' : project.style;
                  commitChange({ ...project, mode: tab.id, style: nextStyle });
                }}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40 ${
                  project.mode === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-xs underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Studio Grid: Left Composer (5 cols) + Right Preview Stage (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Composer */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-5">
          {/* Style + Quality + Aspect Ratio (16:9 / 9:16 / 1:1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.styleLabel}</label>
              <select
                value={project.style}
                onChange={(e) => commitChange({ ...project, style: e.target.value as VideoStyle })}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {adminSettings.enableCartoon && <option value="cartoon">{t.styleCartoon}</option>}
                {adminSettings.enableRealistic && <option value="realistic">{t.styleRealistic}</option>}
                <option value="anime">{t.styleAnime}</option>
                <option value="3d-render">{t.style3dRender}</option>
                <option value="devotional">{t.styleDevotional}</option>
                <option value="explainer">{t.styleExplainer}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'వీడియో నాణ్యత (Quality)' : 'Export Quality'}
              </label>
              <select
                value={project.quality || '720p'}
                onChange={(e) => commitChange({ ...project, quality: e.target.value as VideoQuality })}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="480p">480p (Fast Mobile)</option>
                <option value="720p">720p HD (Recommended)</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.formatLabel}</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl">
              {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() =>
                    commitChange({
                      ...project,
                      aspectRatio: ratio,
                      subtitleStyle: ratio === '9:16' ? 'shorts-pop' : 'cinema',
                    })
                  }
                  className={`min-h-[36px] px-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    project.aspectRatio === ratio
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {ratio === '16:9'
                    ? lang === 'te'
                      ? '16:9 లాంగ్'
                      : '16:9 Long'
                    : ratio === '9:16'
                      ? lang === 'te'
                        ? '9:16 షార్ట్స్'
                        : '9:16 Shorts'
                      : lang === 'te'
                        ? '1:1 స్క్వేర్'
                        : '1:1 Square'}
                </button>
              ))}
            </div>
          </div>

          {/* Short Video (5s-90s) & Long Video (3m, 5m, 10m, 15m + custom) Duration Selector */}
          <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setDurationMode('short');
                    if (currentSec > 90) commitChange({ ...project, targetDurationSec: 30 });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    durationMode === 'short'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'te' ? 'షార్ట్ (15-90s)' : 'Short (5-90s)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDurationMode('long');
                    if (currentSec < 180) commitChange({ ...project, targetDurationSec: 180 });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    durationMode === 'long'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'te' ? 'లాంగ్ (3-15m)' : 'Long (3-15m)'}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={900}
                  value={currentSec}
                  onChange={(e) =>
                    commitChange({
                      ...project,
                      targetDurationSec: Math.min(900, Math.max(5, Number(e.target.value) || 5)),
                    })
                  }
                  aria-label="Custom target duration seconds"
                  className="w-16 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-0.5 text-xs font-bold font-mono-tabular text-amber-500 text-right focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">s</span>
              </div>
            </div>

            {durationMode === 'short' ? (
              <>
                <input
                  id="target-duration-slider"
                  type="range"
                  min={5}
                  max={project.aspectRatio === '9:16' ? 60 : 90}
                  step={1}
                  value={Math.min(project.aspectRatio === '9:16' ? 60 : 90, currentSec)}
                  onChange={(e) =>
                    commitChange({ ...project, targetDurationSec: Number(e.target.value) })
                  }
                  aria-label="Target video duration in seconds"
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[15, 30, 60, 90].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => commitChange({ ...project, targetDurationSec: len })}
                      className={`min-h-[32px] rounded-lg text-xs font-medium font-mono-tabular cursor-pointer ${
                        currentSec === len
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {len}s
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: '3m', sec: 180 },
                  { label: '5m', sec: 300 },
                  { label: '10m', sec: 600 },
                  { label: '15m', sec: 900 },
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => commitChange({ ...project, targetDurationSec: opt.sec })}
                    className={`min-h-[34px] rounded-lg text-xs font-medium font-mono-tabular cursor-pointer ${
                      currentSec === opt.sec
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.contentLangLabel}</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl">
              {(['te', 'en', 'bilingual'] as ContentLanguage[]).map((cl) => (
                <button
                  key={cl}
                  type="button"
                  onClick={() => commitChange({ ...project, contentLanguage: cl })}
                  className={`min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    project.contentLanguage === cl
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cl === 'te' ? t.langTe : cl === 'en' ? t.langEn : t.langBilingual}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-Photo Upload to Video Anytime */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-dashed border-amber-500/40 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'te' ? 'ఫొటోల నుండి వీడియో (Multi-Photo)' : 'Multiple Photos to Video'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'te' ? 'అనేక ఫొటోలను ఒకే వీడియో సీన్లుగా కలపండి.' : 'Pick 1 or multiple photos to append scenes.'}
              </p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleUploadPhotosForVideo(e.target.files)}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>{lang === 'te' ? 'ఫొటోలు' : 'Add Photos'}</span>
            </button>
          </div>

          {/* Story / Text-to-Video Prompt */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.promptLabel}</label>
            <textarea
              rows={3}
              value={project.prompt}
              onChange={(e) => onChangeProject({ ...project, prompt: e.target.value })}
              placeholder={t.promptPlaceholder}
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Quick Starters */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_STARTERS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() =>
                  commitChange({
                    ...project,
                    mode: st.mode,
                    style: st.style,
                    aspectRatio: st.aspectRatio,
                    prompt: lang === 'te' ? st.promptTe : st.promptEn,
                  })
                }
                className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {lang === 'te' ? st.labelTe : st.labelEn}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoGenerateVoice}
              onChange={(e) => setAutoGenerateVoice(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span>{t.autoVoiceLabel}</span>
          </label>

          <button
            type="button"
            onClick={handleGenerateStoryboard}
            disabled={generatingStoryboard}
            className="min-h-[48px] w-full px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {generatingStoryboard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>
              {generationStep === 'scripting'
                ? t.stepScripting
                : generationStep === 'voicing'
                  ? t.stepVoicing
                  : t.generateBtn}
            </span>
          </button>
        </div>

        {/* Right Preview Stage & Export Strip */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <StudioPreviewPlayer
            project={project}
            lang={lang}
            watermarkText={adminSettings.watermarkEnabled ? adminSettings.watermarkText : undefined}
            activeSceneIndex={activeSceneIndex}
            onSelectSceneIndex={setActiveSceneIndex}
          />

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onSaveProject}
                disabled={savingProject}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {savedNotice ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />}
                <span>{savedNotice ? t.projectSaved : t.saveProjectBtn}</span>
              </button>

              {onDownloadProject && (
                <button
                  type="button"
                  onClick={onDownloadProject}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>{lang === 'te' ? 'ప్రాజెక్ట్ డౌన్లోడ్' : 'Download Project'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadSrt}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Captions className="w-4 h-4" />
                <span>{t.downloadSrtBtn}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onDownloadVideo}
                disabled={isExporting || savingToDrive || sharingVideo}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {isExporting
                    ? `${t.exportingVideo} ${exportProgress}%`
                    : `${lang === 'te' ? 'వీడియో డౌన్లోడ్' : 'Download Video'} (.${detectBestVideoExportCodec().ext.toUpperCase()})`}
                </span>
              </button>

              {onShareVideo && (
                <button
                  type="button"
                  onClick={onShareVideo}
                  disabled={isExporting || savingToDrive || sharingVideo}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {sharingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  <span>{sharingVideo ? `${exportProgress}%` : 'WhatsApp / IG'}</span>
                </button>
              )}

              {onSaveVideoToDrive && (
                <button
                  type="button"
                  onClick={onSaveVideoToDrive}
                  disabled={isExporting || savingToDrive || sharingVideo}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 disabled:opacity-60 text-slate-800 dark:text-slate-100 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {savingToDrive ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  ) : driveSavedNotice ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <HardDrive className="w-4 h-4 text-amber-500" />
                  )}
                  <span>{savingToDrive ? `${exportProgress}%` : driveSavedNotice ? 'Drive OK' : 'Drive'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenYouTubeModal}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Youtube className="w-4 h-4" />
                <span>{t.youtubeUploadBtn}</span>
              </button>

              <a
                href={getWhatsAppShareUrl(`${project.title} - Created with AI VIDEO MAKER PRO`)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{lang === 'te' ? 'WhatsApp' : 'WhatsApp Chat'}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Track Video, Voice & Music Timeline */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {lang === 'te' ? 'మల్టీ-ట్రాక్ ఎడిటర్ టైమ్‌లైన్' : 'Multi-Track Timeline'} ({totalEffectiveSec}s)
          </span>
          <span className="text-slate-500 dark:text-slate-400 font-mono-tabular">
            {project.aspectRatio} · {project.quality || '720p'}
          </span>
        </div>

        {/* Track 1: Video Clips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-20 shrink-0">
            Video ({project.scenes.length})
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {project.scenes.map((sc, idx) => {
              const eff = getSceneEffectiveDuration(sc);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setActiveSceneIndex(idx)}
                  style={{ flexGrow: Math.max(1, Math.round(eff)) }}
                  className={`min-h-[36px] min-w-[76px] px-2.5 py-1 rounded-lg border text-left text-[11px] truncate cursor-pointer transition-colors ${
                    activeSceneIndex === idx
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-slate-100 dark:bg-[#0B0D12] border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {idx + 1}. {sc.title} ({eff}s)
                </button>
              );
            })}
          </div>
        </div>

        {/* Track 2: Voiceover Clips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-20 shrink-0">
            Voice Track
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {project.scenes.map((sc, idx) => (
              <div
                key={sc.id}
                style={{ flexGrow: Math.max(1, Math.round(getSceneEffectiveDuration(sc))) }}
                className={`min-h-[26px] min-w-[76px] px-2 py-1 rounded-lg text-[10px] font-medium truncate border ${
                  sc.audioBase64
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-white/5 text-slate-400'
                }`}
              >
                {sc.audioBase64 ? `🎙️ Voice ${idx + 1}` : 'No Voice'}
              </div>
            ))}
          </div>
        </div>

        {/* Track 3: Music + SFX */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-20 shrink-0">
            Music + SFX
          </span>
          <div className="flex-1 min-h-[26px] px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-[11px] text-sky-700 dark:text-sky-300 truncate">
            🎵 {project.musicTrack === 'none' ? 'No Music' : project.musicTrack} · SFX:{' '}
            {project.scenes.filter((s) => s.sfx && s.sfx !== 'none').length} clips
          </div>
        </div>
      </div>

      {/* Audio Voiceover + Music + Subtitles Mixer */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Mic className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.voiceSettings}</h2>
          </div>

          <button
            type="button"
            onClick={handleGenerateAllVoices}
            disabled={generatingVoices}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-600 dark:text-amber-300 font-semibold text-xs flex items-center gap-2 cursor-pointer"
          >
            {generatingVoices ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            <span>{generatingVoices ? t.generatingVoice : t.generateAllVoices}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-600 dark:text-slate-400">{t.voiceActor}</label>
            <select
              value={project.voiceName}
              onChange={(e) => commitChange({ ...project, voiceName: e.target.value as VoiceName })}
              className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="Kore">Kore (Female · Storyteller)</option>
              <option value="Zephyr">Zephyr (Female · Calm)</option>
              <option value="Puck">Puck (Male · Youth)</option>
              <option value="Charon">Charon (Male · Cinema)</option>
              <option value="Fenrir">Fenrir (Male · Bold)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-600 dark:text-slate-400">{t.voiceStyle}</label>
            <select
              value={project.voiceStyle}
              onChange={(e) =>
                commitChange({ ...project, voiceStyle: e.target.value as VoiceStylePreset })
              }
              className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="storyteller">Storyteller (కథనం)</option>
              <option value="cartoon">Kids Cartoon (కార్టూన్)</option>
              <option value="documentary">Documentary (డాక్యుమెంటరీ)</option>
              <option value="energetic">Energetic Shorts (షార్ట్స్)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>{t.musicTrack}</span>
            </label>
            <select
              value={project.musicTrack}
              onChange={(e) => commitChange({ ...project, musicTrack: e.target.value as MusicTrackId })}
              className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
            >
              {MUSIC_TRACK_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === 'te' ? m.labelTe : m.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-600 dark:text-slate-400">{t.subtitleStyle}</label>
            <select
              value={project.subtitleStyle}
              onChange={(e) =>
                commitChange({ ...project, subtitleStyle: e.target.value as SubtitleStyle })
              }
              className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="cinema">Cinema Bar (సినిమా బార్)</option>
              <option value="shorts-pop">Shorts Bold Pop (షార్ట్స్)</option>
              <option value="minimal">Clean Minimal (సాధారణ)</option>
              <option value="off">Subtitles Off</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {t.voiceVol}: <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{Math.round(project.voiceVolume * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={Math.min(1, project.voiceVolume)}
              onChange={(e) => commitChange({ ...project, voiceVolume: Number(e.target.value) })}
              className="w-full max-w-xs accent-amber-500"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {t.musicVol}: <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{Math.round(project.musicVolume * 100)}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={project.musicVolume}
              onChange={(e) => commitChange({ ...project, musicVolume: Number(e.target.value) })}
              className="w-full max-w-xs accent-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Hidden input for replacing a single scene's backdrop photo */}
      <input
        ref={scenePhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleScenePhotoReplace(e.target.files)}
      />

      {/* Scene Cards List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.scenesHeader} ({project.scenes.length})
          </h2>
          <button
            type="button"
            onClick={handleAddScene}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addScene}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.scenes.map((scene, idx) => {
            const isActive = idx === activeSceneIndex;
            return (
              <div
                key={scene.id}
                onClick={() => setActiveSceneIndex(idx)}
                className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#171B26] border-amber-500/60'
                    : 'bg-white dark:bg-[#13161F] border-slate-200 dark:border-white/10'
                }`}
              >
                {/* Header & Quick Scene Actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono-tabular px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                      0{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={scene.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                      className="bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-amber-500 min-w-0"
                    />
                  </div>

                  <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveScene(idx, -1)}
                      className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 disabled:opacity-30 text-slate-700 dark:text-slate-300 cursor-pointer"
                      aria-label="Move scene up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === project.scenes.length - 1}
                      onClick={() => handleMoveScene(idx, 1)}
                      className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 disabled:opacity-30 text-slate-700 dark:text-slate-300 cursor-pointer"
                      aria-label="Move scene down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSplitScene(idx)}
                      className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer"
                      title={lang === 'te' ? 'స్ప్లిట్' : 'Split'}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                    {idx < project.scenes.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMergeWithNext(idx)}
                        className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer"
                        title={lang === 'te' ? 'మెర్జ్' : 'Merge Next'}
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDuplicateScene(idx)}
                      className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer"
                      title={lang === 'te' ? 'నకలు' : 'Duplicate'}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateSingleVoice(scene)}
                      disabled={scene.audioStatus === 'generating'}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        scene.audioBase64
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {scene.audioStatus === 'generating' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Mic className="w-3 h-3" />
                      )}
                      <span>{scene.audioBase64 ? t.voiceReady : t.genSceneVoice}</span>
                    </button>
                    {project.scenes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitChange({
                            ...project,
                            scenes: project.scenes.filter((s) => s.id !== scene.id),
                          })
                        }
                        className="min-h-[32px] min-w-[28px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 cursor-pointer"
                        title={lang === 'te' ? 'తొలగించు' : 'Delete Scene'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Narration + Subtitles + Title Callout */}
                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    rows={2}
                    value={scene.narration}
                    onChange={(e) =>
                      updateScene(scene.id, {
                        narration: e.target.value,
                        subtitleTe: project.contentLanguage !== 'en' ? e.target.value : scene.subtitleTe,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    placeholder="Voiceover narration text..."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={scene.subtitleTe}
                      onChange={(e) => updateScene(scene.id, { subtitleTe: e.target.value })}
                      placeholder="తెలుగు సబ్టైటిల్"
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200"
                    />
                    <input
                      type="text"
                      value={scene.subtitleEn}
                      onChange={(e) => updateScene(scene.id, { subtitleEn: e.target.value })}
                      placeholder="English subtitle"
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200"
                    />
                  </div>

                  <input
                    type="text"
                    value={scene.visualCallout || ''}
                    onChange={(e) => updateScene(scene.id, { visualCallout: e.target.value })}
                    placeholder={
                      lang === 'te' ? 'వీడియో స్క్రీన్ పై శీర్షిక / టెక్స్ట్' : 'On-screen Title Overlay (optional)'
                    }
                    className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Complete Video Editor Controls */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-white/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'ట్రిమ్ (సె.)' : 'Trim (sec)'}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={0.5}
                      value={scene.durationSec}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          durationSec: Math.min(60, Math.max(1, Number(e.target.value) || 3)),
                        })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono-tabular"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'స్పీడ్' : 'Speed'}
                    </span>
                    <select
                      value={scene.speed ?? 1}
                      onChange={(e) => updateScene(scene.id, { speed: Number(e.target.value) })}
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value={0.5}>0.5x Slow-Mo</option>
                      <option value={0.75}>0.75x Slow</option>
                      <option value={1}>1.0x Normal</option>
                      <option value={1.25}>1.25x Brisk</option>
                      <option value={1.5}>1.5x Fast</option>
                      <option value={2}>2.0x Fast-Mo</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'రొటేట్' : 'Rotate'}
                    </span>
                    <select
                      value={scene.rotation ?? 0}
                      onChange={(e) =>
                        updateScene(scene.id, { rotation: Number(e.target.value) as 0 | 90 | 180 | 270 })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value={0}>0° Normal</option>
                      <option value={90}>90° Right</option>
                      <option value={180}>180° Flip</option>
                      <option value={270}>270° Left</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'క్రాప్ / జూమ్' : 'Crop Zoom'}
                    </span>
                    <select
                      value={scene.cropZoom ?? 1}
                      onChange={(e) => updateScene(scene.id, { cropZoom: Number(e.target.value) })}
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value={1}>1.0x Full</option>
                      <option value={1.2}>1.2x Crop</option>
                      <option value={1.4}>1.4x Tight</option>
                      <option value={1.6}>1.6x Close</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'రీసైజ్ ఫిట్' : 'Resize Fit'}
                    </span>
                    <select
                      value={scene.fitMode || 'cover'}
                      onChange={(e) =>
                        updateScene(scene.id, { fitMode: e.target.value as 'cover' | 'contain' })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="cover">Fill Frame (Cover)</option>
                      <option value="contain">Fit Whole (Contain)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'స్టిక్కర్' : 'Sticker'}
                    </span>
                    <select
                      value={scene.sticker || ''}
                      onChange={(e) => updateScene(scene.id, { sticker: e.target.value })}
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      {SCENE_STICKERS.map((st, si) => (
                        <option key={si} value={st}>
                          {st || 'None'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.cameraMotion}</span>
                    <select
                      value={scene.cameraMotion}
                      onChange={(e) =>
                        updateScene(scene.id, { cameraMotion: e.target.value as CameraMotion })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-out">Zoom Out</option>
                      <option value="pan-left">Pan Left</option>
                      <option value="pan-right">Pan Right</option>
                      <option value="ken-burns">Ken Burns</option>
                      <option value="bounce-cartoon">Cartoon Bounce</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.weatherFx}</span>
                    <select
                      value={scene.weatherFx}
                      onChange={(e) =>
                        updateScene(scene.id, { weatherFx: e.target.value as WeatherFx })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="none">None</option>
                      <option value="golden-dust">Golden Dust</option>
                      <option value="fireflies">Fireflies</option>
                      <option value="rain">Rain</option>
                      <option value="stars">Twinkling Stars</option>
                      <option value="petals">Flower Petals</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'రంగు ఫిల్టర్' : 'Color Filter'}
                    </span>
                    <select
                      value={scene.filterPreset || 'none'}
                      onChange={(e) =>
                        updateScene(scene.id, { filterPreset: e.target.value as SceneFilter })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="none">Original</option>
                      <option value="warm">Warm Cinema</option>
                      <option value="vivid">Vivid Pop</option>
                      <option value="golden">Golden Sunset</option>
                      <option value="bw">Classic B & W</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'ట్రాన్సిషన్' : 'Transition'}
                    </span>
                    <select
                      value={scene.transition || 'fade'}
                      onChange={(e) =>
                        updateScene(scene.id, { transition: e.target.value as SceneTransition })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="fade">Smooth Fade</option>
                      <option value="slide">Slide In</option>
                      <option value="cut">Quick Cut</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'te' ? 'సౌండ్ ఎఫెక్ట్ (SFX)' : 'Scene SFX'}
                    </span>
                    <div className="flex items-center gap-1">
                      <select
                        value={scene.sfx || 'none'}
                        onChange={(e) => updateScene(scene.id, { sfx: e.target.value as SceneSfxId })}
                        className="flex-1 min-w-0 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        {SFX_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {lang === 'te' ? opt.labelTe : opt.labelEn}
                          </option>
                        ))}
                      </select>
                      {scene.sfx && scene.sfx !== 'none' && (
                        <button
                          type="button"
                          onClick={() => playSfxPreview(scene.sfx || 'none')}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-amber-500 cursor-pointer"
                          title="Preview SFX"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.backdropSource}</span>
                    <select
                      value={scene.backdropType === 'procedural' ? 'procedural' : scene.imageUrl || 'procedural'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'upload') {
                          setTargetSceneForPhoto(scene.id);
                          scenePhotoInputRef.current?.click();
                        } else if (val === 'procedural') {
                          updateScene(scene.id, { backdropType: 'procedural', imageUrl: undefined });
                        } else {
                          updateScene(scene.id, { backdropType: 'template', imageUrl: val });
                        }
                      }}
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="procedural">AI Animated Art</option>
                      {STUDIO_BACKDROPS.map((b) => (
                        <option key={b.id} value={b.url}>
                          {lang === 'te' ? b.labelTe : b.labelEn}
                        </option>
                      ))}
                      {scene.backdropType === 'uploaded' && scene.imageUrl && (
                        <option value={scene.imageUrl}>Uploaded Photo</option>
                      )}
                      <option value="upload">+ Upload Photo...</option>
                    </select>
                  </div>
                </div>

                {/* AI Enhance & BG Remove + Cartoon Character */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(scene.enhance)}
                        onChange={(e) => updateScene(scene.id, { enhance: e.target.checked })}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <span>{lang === 'te' ? 'AI ఎన్హాన్స్' : 'AI Enhance'}</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(scene.chromaKey)}
                        onChange={(e) => updateScene(scene.id, { chromaKey: e.target.checked })}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <span>{lang === 'te' ? 'గ్రీన్/డార్క్ BG తొలగింపు' : 'Chroma BG Remove'}</span>
                    </label>
                  </div>

                  {scene.backdropType === 'procedural' && (
                    <select
                      value={scene.cartoonElements?.character || 'rabbit'}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          cartoonElements: {
                            ...scene.cartoonElements,
                            character: e.target.value as CartoonCharacter,
                          },
                        })
                      }
                      className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="rabbit">Rabbit (కుందేలు)</option>
                      <option value="turtle">Turtle (తాబేలు)</option>
                      <option value="kid">Kid (పిల్లవాడు)</option>
                      <option value="elder">Elder (తాతయ్య)</option>
                      <option value="owl">Owl (గుడ్లగూబ)</option>
                      <option value="robot">AI Robot (రోబో)</option>
                      <option value="none">Scenery Only</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
