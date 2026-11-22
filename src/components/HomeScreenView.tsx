import React from 'react';
import {
  Clapperboard,
  Smartphone,
  Image as ImageIcon,
  Mic,
  BookOpen,
  Gamepad2,
  Sparkles,
  Bot,
  FolderKanban,
  ArrowRight,
  CheckCircle2,
  Server,
  HardDrive,
  Download,
  FileJson,
  Loader2,
  AlertCircle,
  Film,
} from 'lucide-react';
import {
  APP_LOGO_URL,
  ApkStatusInfo,
  LanguageMode,
  SavedAssetItem,
  UsageStats,
  VideoProject,
} from '../types/studio';
import { PWAInstallButton } from './PWAInstallButton';
import { detectBestVideoExportCodec } from '../utils/shareUtils';

interface HomeScreenViewProps {
  lang: LanguageMode;
  usageStats: UsageStats;
  projectCount: number;
  gameCount: number;
  apkStatus: ApkStatusInfo | null;
  currentProject: VideoProject;
  assets: SavedAssetItem[];
  isExportingVideo: boolean;
  exportProgress: number;
  onDownloadVideo: () => Promise<void>;
  onDownloadProject: (project?: VideoProject) => void;
  onStartLongVideo: () => void;
  onStartShortsVideo: () => void;
  onOpenTool: (
    tool: 'video' | 'auto' | 'photo' | 'audio' | 'game' | 'story' | 'assistant' | 'drive'
  ) => void;
  onOpenProjects: () => void;
}

export const HomeScreenView: React.FC<HomeScreenViewProps> = ({
  lang,
  usageStats,
  projectCount,
  gameCount,
  apkStatus,
  currentProject,
  assets,
  isExportingVideo,
  exportProgress,
  onDownloadVideo,
  onDownloadProject,
  onStartLongVideo,
  onStartShortsVideo,
  onOpenTool,
  onOpenProjects,
}) => {
  const latestPhoto = assets.find((a) => a.type === 'photo' && Boolean(a.dataUrl));
  const latestAudioAsset = assets.find((a) => a.type === 'audio' && Boolean(a.dataUrl));
  const sceneWithAudio = currentProject.scenes.find((s) => Boolean(s.audioBase64));

  const readyAudioUrl = latestAudioAsset?.dataUrl
    ? latestAudioAsset.dataUrl
    : sceneWithAudio?.audioBase64
      ? `data:${sceneWithAudio.audioMimeType || 'audio/wav'};base64,${sceneWithAudio.audioBase64}`
      : null;

  const readyAudioLabel = latestAudioAsset?.title
    ? latestAudioAsset.title
    : sceneWithAudio?.title || 'AI Voiceover';

  const videoCodecExt = detectBestVideoExportCodec().ext.toUpperCase();

  const scrollToDownloads = () => {
    const el = document.getElementById('apk-download-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const quickTools = [
    {
      id: 'video' as const,
      icon: <Clapperboard className="w-5 h-5 text-amber-500" />,
      titleTe: 'AI వీడియో మేకర్ & ఎడిటర్',
      titleEn: 'AI Video Maker & Editor',
      descTe: 'కట్, ట్రిమ్, స్ప్లిట్, మెర్జ్, రొటేట్, క్రాప్, స్లో/ఫాస్ట్ మోషన్, సబ్టైటిల్స్ & MP4.',
      descEn: 'Cut, trim, split, merge, rotate, crop, slow/fast motion, 9:16 / 16:9 / 1:1 & MP4 export.',
    },
    {
      id: 'auto' as const,
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      titleTe: 'AI ఆటోమేటిక్ వీడియో క్రియేటర్',
      titleEn: 'AI Automatic Creator',
      descTe: 'ఒకే ప్రాంప్ట్ తో కథ, సీన్లు, AI వాయిస్, సంగీతం & టైమ్‌లైన్ ఆటోమేటిక్ తయారీ.',
      descEn: 'One prompt builds Story, Scenes, Image Prompts, Telugu/English Voice & Timeline.',
    },
    {
      id: 'photo' as const,
      icon: <ImageIcon className="w-5 h-5 text-sky-500" />,
      titleTe: 'AI ఫొటో, పోస్టర్ & కొలాజ్',
      titleEn: 'AI Photo, Poster & Collage',
      descTe: 'SVG ఆర్ట్, ఫొటో ఎడిటర్, కొలాజ్, బ్యాక్‌గ్రౌండ్ మార్పు, థంబ్‌నెయిల్స్ & లోగో.',
      descEn: 'Vector-to-PNG art, collages, BG replace, YouTube thumbnails & App logo stamp.',
    },
    {
      id: 'audio' as const,
      icon: <Mic className="w-5 h-5 text-emerald-500" />,
      titleTe: 'AI వాయిస్, ఆడియో & SFX',
      titleEn: 'AI Voice, Audio & SFX',
      descTe: 'తెలుగు/ఇంగ్లీష్ మేల్/ఫిమేల్ వాయిస్, మైక్ రికార్డ్, వీడియో ఆడియో ఎక్స్‌ట్రాక్ట్.',
      descEn: 'Telugu & English AI voices, mic rec, video-to-audio extract, EQ & SFX pad.',
    },
    {
      id: 'game' as const,
      icon: <Gamepad2 className="w-5 h-5 text-rose-500" />,
      titleTe: 'AI 2D గేమ్ మేకర్ స్టూడియో',
      titleEn: 'AI Game Maker Studio',
      descTe: 'రేసింగ్, ప్లాట్‌ఫారమ్, పజిల్ & క్విజ్ గేమ్‌లు సృష్టించి ఇక్కడే ఆడండి & సేవ్ చేయండి.',
      descEn: 'Create & play 2D Racing, Platformer, Puzzle & Quiz games and export HTML.',
    },
    {
      id: 'story' as const,
      icon: <BookOpen className="w-5 h-5 text-violet-500" />,
      titleTe: 'తెలుగు & ఇంగ్లీష్ కథల స్టూడియో',
      titleEn: 'AI Story Studio',
      descTe: 'పిల్లల, కార్టూన్, యాక్షన్, కామెడీ, పల్లెటూరి & నీతి కథలతో వీడియో చేయండి.',
      descEn: 'Kids, Cartoon, Action, Comedy & Moral stories with one-click video conversion.',
    },
    {
      id: 'assistant' as const,
      icon: <Bot className="w-5 h-5 text-cyan-500" />,
      titleTe: 'AI క్రియేటర్ అసిస్టెంట్',
      titleEn: 'AI Assistant & Planner',
      descTe: 'వీడియో, ఆడియో లేదా గేమ్ ప్లాన్ కోసం తెలుగు/ఇంగ్లీష్ లో సహాయం పొందండి.',
      descEn: 'Ask workflow questions in Telugu or English and jump straight into any tool.',
    },
    {
      id: 'drive' as const,
      icon: <HardDrive className="w-5 h-5 text-amber-500" />,
      titleTe: 'Google Drive క్లౌడ్ స్టోరేజ్',
      titleEn: 'Google Drive Cloud Sync',
      descTe: 'వీడియోలు, ఫొటోలు & వాయిస్ ఫైళ్లను Drive నుండి ఇంపోర్ట్ / సేవ్ చేయండి.',
      descEn: 'Import photos/audio from Google Drive and back up your studio exports.',
    },
    {
      id: 'projects' as const,
      icon: <FolderKanban className="w-5 h-5 text-indigo-500" />,
      titleTe: 'ప్రాజెక్టులు & మీడియా హిస్టరీ',
      titleEn: 'Projects & Asset History',
      descTe: `${projectCount} వీడియోలు · ${gameCount} గేమ్‌లు సేవ్ చేయబడ్డాయి.`,
      descEn: `${projectCount} videos · ${gameCount} games · photos, audio & downloads history.`,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-8">
      {/* Studio Home Hero with Prominent Download App CTA */}
      <section className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 max-w-2xl">
          <img
            src={APP_LOGO_URL}
            alt="AI VIDEO MAKER PRO"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-amber-500/40 shadow-lg shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              AI VIDEO MAKER PRO
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              {lang === 'te'
                ? 'తెలుగు & ఇంగ్లీష్ క్రియేటర్ స్టూడియో — AI వీడియో మేకర్, ఆటో క్రియేటర్, ఫొటో & కొలాజ్, వాయిస్, 2D గేమ్ మేకర్ మరియు MP4 ఎగుమతి.'
                : 'Complete bilingual Telugu & English creator studio: Video Maker & Editor, Auto Creator, Photo & Poster, Voice & SFX, 2D Game Maker, Story Studio & AI Assistant.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              <span>
                {lang === 'te' ? 'ప్రాజెక్టులు:' : 'Projects:'}{' '}
                <strong className="text-slate-900 dark:text-slate-100">{projectCount}</strong>
              </span>
              <span>·</span>
              <span>
                {lang === 'te' ? 'గేమ్‌లు:' : 'Games:'}{' '}
                <strong className="text-slate-900 dark:text-slate-100">{gameCount}</strong>
              </span>
              <span>·</span>
              <span>
                {lang === 'te' ? 'ఎగుమతులు:' : 'Exports:'}{' '}
                <strong className="text-amber-500">{usageStats.totalExports}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={scrollToDownloads}
            className="min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'te' ? 'యాప్ డౌన్లోడ్' : 'Download App'}</span>
          </button>

          <button
            type="button"
            onClick={onStartShortsVideo}
            className="min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>{lang === 'te' ? '9:16 షార్ట్ వీడియో' : 'Create 9:16 Short'}</span>
          </button>

          <button
            type="button"
            onClick={onStartLongVideo}
            className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Clapperboard className="w-4 h-4 text-amber-500" />
            <span>{lang === 'te' ? '16:9 లాంగ్ వీడియో' : 'Create 16:9 Long Video'}</span>
          </button>
        </div>
      </section>

      {/* Dedicated APP DOWNLOAD (Android APK) & Media Downloads Hub */}
      <section
        id="apk-download-section"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left: Real Android APK Download Section */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                <Smartphone className="w-4 h-4" />
                <span>{lang === 'te' ? 'Android యాప్ (APK) డౌన్లోడ్' : 'Android App (APK) Download'}</span>
              </div>
              <PWAInstallButton lang={lang} />
            </div>

            {apkStatus?.available && apkStatus.downloadUrl ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'te'
                    ? 'నిజమైన Android APK ఫైల్ సిద్ధంగా ఉంది. మీ ఫోన్‌లో డౌన్లోడ్ చేసి ఇన్‌స్టాల్ చేసుకోండి.'
                    : 'Verified Android APK build is ready. Download and install directly on your Android phone.'}
                </p>

                {/* Show real metadata fields ONLY when actually present */}
                {(apkStatus.version || apkStatus.fileSizeBytes !== null || apkStatus.updatedAt) && (
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3 font-mono-tabular">
                    {apkStatus.version && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">
                          {lang === 'te' ? 'వెర్షన్' : 'Version'}
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100">{apkStatus.version}</strong>
                      </div>
                    )}
                    {apkStatus.fileSizeBytes !== null && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">
                          {lang === 'te' ? 'సైజు' : 'File Size'}
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          {(apkStatus.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </strong>
                      </div>
                    )}
                    {apkStatus.updatedAt && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">
                          {lang === 'te' ? 'అప్‌డేట్' : 'Updated'}
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          {new Date(apkStatus.updatedAt).toLocaleDateString()}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                <a
                  href={apkStatus.downloadUrl}
                  download="AI-VIDEO-MAKER-PRO.apk"
                  className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'te' ? 'Android APK డౌన్లోడ్ చేయండి' : 'Download Android APK'}</span>
                </a>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'te'
                    ? 'ఇన్‌స్టాల్ విధానం: APK డౌన్లోడ్ చేసి ఓపెన్ చేయండి → "Install unknown apps" అనుమతించండి → Install నొక్కండి.'
                    : 'Install guide: Download APK → Tap downloaded file → Allow "Install unknown apps" → Tap Install.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    <p className="font-semibold">APK is not ready yet. Build the Android app first.</p>
                    {lang === 'te' && (
                      <p className="text-slate-600 dark:text-slate-300 mt-1">
                        APK ఇంకా సిద్ధంగా లేదు. ముందుగా Android యాప్‌ను బిల్డ్ చేయండి.
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === 'te'
                    ? 'Android Studio / Capacitor (`npx cap sync android`) ద్వారా APK బిల్డ్ చేసి `public/downloads/ai-video-maker-pro.apk` లో ఉంచితే ఇక్కడ డౌన్లోడ్ బటన్ కనిపిస్తుంది (`ANDROID_APK_GUIDE.md` చూడండి).'
                    : 'Once built via Capacitor / Android Studio (`ANDROID_APK_GUIDE.md`) and placed at `public/downloads/ai-video-maker-pro.apk`, the verified APK download button, version, size, and date appear automatically.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Separate Mobile-Friendly Media Download Hub (Video, Photo, Audio, Project) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'te' ? 'మీడియా & ప్రాజెక్ట్ డౌన్లోడ్లు' : 'Studio Media & Project Downloads'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'te'
                ? 'వీడియో, ఫొటో, ఆడియో మరియు సేవ్ చేసిన ప్రాజెక్ట్ ఫైళ్లను నేరుగా ఫోన్‌లో డౌన్లోడ్ చేయండి.'
                : 'Separate one-tap mobile download buttons for Video, Photo, Audio, and Project files.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Download Video */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                  <Film className="w-3.5 h-3.5" />
                  <span>{lang === 'te' ? 'వీడియో ఎగుమతి' : 'Exported Video'}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1">
                  {currentProject.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDownloadVideo()}
                disabled={isExportingVideo}
                className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {isExportingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {isExportingVideo
                    ? `${exportProgress}%`
                    : `${lang === 'te' ? 'వీడియో డౌన్లోడ్' : 'Download Video'} (${videoCodecExt})`}
                </span>
              </button>
            </div>

            {/* 2. Download Photo */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{lang === 'te' ? 'తయారైన ఫొటో' : 'Generated / Edited Photo'}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1">
                  {latestPhoto
                    ? latestPhoto.title
                    : lang === 'te'
                      ? 'ఇంకా ఫొటో సేవ్ చేయలేదు'
                      : 'No saved photo yet'}
                </p>
              </div>
              {latestPhoto?.dataUrl ? (
                <a
                  href={latestPhoto.dataUrl}
                  download={`${latestPhoto.title.replace(/\s+/g, '_')}.png`}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'te' ? 'ఫొటో డౌన్లోడ్' : 'Download Photo'}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenTool('photo')}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-sky-500" />
                  <span>{lang === 'te' ? 'ఫొటో స్టూడియో తెరవండి' : 'Create Photo First'}</span>
                </button>
              )}
            </div>

            {/* 3. Download Audio */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <Mic className="w-3.5 h-3.5" />
                  <span>{lang === 'te' ? 'తయారైన ఆడియో' : 'Generated / Edited Audio'}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1">
                  {readyAudioUrl
                    ? readyAudioLabel
                    : lang === 'te'
                      ? 'ఇంకా ఆడియో సిద్ధం కాలేదు'
                      : 'No generated audio yet'}
                </p>
              </div>
              {readyAudioUrl ? (
                <a
                  href={readyAudioUrl}
                  download={`${readyAudioLabel.replace(/\s+/g, '_')}.wav`}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'te' ? 'ఆడియో డౌన్లోడ్' : 'Download Audio'}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenTool('audio')}
                  className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-emerald-500" />
                  <span>{lang === 'te' ? 'ఆడియో స్టూడియో తెరవండి' : 'Generate Audio First'}</span>
                </button>
              )}
            </div>

            {/* 4. Download Project */}
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                  <FileJson className="w-3.5 h-3.5" />
                  <span>{lang === 'te' ? 'సేవ్ చేసిన ప్రాజెక్ట్ (.JSON)' : 'Saved Project File (.JSON)'}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-1">
                  {currentProject.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDownloadProject(currentProject)}
                className="min-h-[44px] w-full px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'te' ? 'ప్రాజెక్ట్ డౌన్లోడ్' : 'Download Project'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9-Tile Complete Studio Hub */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'స్టూడియో ఫీచర్లు & ఎడిటర్లు' : 'Complete AI Creator Suite'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => (tool.id === 'projects' ? onOpenProjects() : onOpenTool(tool.id))}
              className="text-left bg-white dark:bg-[#13161F] hover:bg-slate-50 dark:hover:bg-[#171B26] border border-slate-200 dark:border-white/10 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                  {tool.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'te' ? tool.titleTe : tool.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'te' ? tool.descTe : tool.descEn}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <span>{lang === 'te' ? 'తెరవండి' : 'Open Studio'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Honest Capability Breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {lang === 'te'
                ? 'ఆఫ్‌లైన్ / లోకల్ పరికరంలో పనిచేసే ఫీచర్లు'
                : 'Works Locally On Your Device (No External Billing Required)'}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {lang === 'te'
              ? 'వీడియో ట్రిమ్, కట్, స్ప్లిట్, మెర్జ్, రొటేట్, క్రాప్, స్లో/ఫాస్ట్ మోషన్, మల్టీ-ట్రాక్ ఎడిటింగ్, ఫొటో & కొలాజ్ ఎడిటర్, మైక్ రికార్డ్, ఆడియో ఎక్స్‌ట్రాక్షన్, ప్లేయబుల్ 2D గేమ్‌లు & MP4/WebM ఎగుమతి.'
              : 'Video Trim, Cut, Split, Merge, Rotate, Crop, Speed, Chroma Key, Photo & Collage Editor, Mic Recording, Video-to-Audio Extraction, Playable 2D Games + HTML Export & MP4/WebM Export.'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
            <Server className="w-4 h-4" />
            <span>
              {lang === 'te'
                ? 'సర్వర్ API & అడ్వాన్స్‌డ్ మోడల్ స్థితి'
                : 'Server API & External Billing Model Status'}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {lang === 'te'
              ? 'కథలు, తెలుగు/ఇంగ్లీష్ AI వాయిస్ (TTS), 2D గేమ్ AI డిజైన్ & AI అసిస్టెంట్ సర్వర్ GEMINI_API_KEY తో పనిచేస్తాయి. ఫోటోరియలిస్టిక్ AI ఇమేజ్/వీడియో డిఫ్యూషన్ & 3D ఇంజన్ ఎగుమతికి బిల్లింగ్ API అవసరం.'
              : 'Scripts, Telugu/English AI TTS Voice, Auto Plan, 2D Game AI & Assistant run on server GEMINI_API_KEY. Photorealistic raster diffusion video/image generation & 3D Unity export require paid external APIs.'}
          </p>
        </div>
      </section>
    </div>
  );
};
