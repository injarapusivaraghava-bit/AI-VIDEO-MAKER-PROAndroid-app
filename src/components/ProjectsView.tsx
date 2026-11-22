import React, { useState } from 'react';
import {
  FolderOpen,
  Copy,
  Trash2,
  Search,
  Film,
  Plus,
  Cloud,
  LogIn,
  Image as ImageIcon,
  Mic,
  Gamepad2,
  Download,
} from 'lucide-react';
import {
  AspectRatio,
  GameProject,
  LanguageMode,
  SavedAssetItem,
  VideoProject,
} from '../types/studio';
import { TRANSLATIONS } from '../i18n/translations';
import { getTotalDuration } from '../utils/canvasRenderer';
import { useFirebase } from '../contexts/FirebaseContext';

interface ProjectsViewProps {
  projects: VideoProject[];
  games: GameProject[];
  assets: SavedAssetItem[];
  lang: LanguageMode;
  onOpenProject: (project: VideoProject) => void;
  onDownloadProject?: (project: VideoProject) => void;
  onDuplicateProject: (project: VideoProject) => void;
  onDeleteProject: (id: string) => void;
  onClearDemos: () => void;
  onCreateNew: () => void;
  onOpenGame: (game: GameProject) => void;
  onDeleteGame: (id: string) => void;
  onDeleteAsset: (id: string) => void;
}

type HistoryCategory = 'videos' | 'photos' | 'audio' | 'games' | 'downloads';

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  games,
  assets,
  lang,
  onOpenProject,
  onDownloadProject,
  onDuplicateProject,
  onDeleteProject,
  onClearDemos,
  onCreateNew,
  onOpenGame,
  onDeleteGame,
  onDeleteAsset,
}) => {
  const { user, signInWithGoogle, signingIn } = useFirebase();
  const t = TRANSLATIONS[lang];
  const [category, setCategory] = useState<HistoryCategory>('videos');
  const [search, setSearch] = useState('');
  const [ratioFilter, setRatioFilter] = useState<'all' | AspectRatio>('all');

  const filteredVideos = projects.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt.toLowerCase().includes(search.toLowerCase());
    const matchesRatio = ratioFilter === 'all' || p.aspectRatio === ratioFilter;
    return matchesSearch && matchesRatio;
  });

  const photoAssets = assets.filter((a) => a.type === 'photo');
  const audioAssets = assets.filter((a) => a.type === 'audio');
  const downloadAssets = assets.filter((a) => a.type === 'download');

  const hasDemos = projects.some(
    (p) => p.id === 'proj-cartoon-rabbit' || p.id === 'proj-kakinada-short'
  );

  const tabs: { id: HistoryCategory; labelTe: string; labelEn: string; count: number }[] = [
    { id: 'videos', labelTe: 'వీడియోలు', labelEn: 'Videos', count: projects.length },
    { id: 'photos', labelTe: 'ఫొటోలు', labelEn: 'Photos', count: photoAssets.length },
    { id: 'audio', labelTe: 'ఆడియో', labelEn: 'Audio', count: audioAssets.length },
    { id: 'games', labelTe: 'గేమ్‌లు', labelEn: 'Games', count: games.length },
    { id: 'downloads', labelTe: 'డౌన్లోడ్స్', labelEn: 'Downloads', count: downloadAssets.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t.projectsTitle}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>
              {projects.length} {lang === 'te' ? 'వీడియోలు' : 'videos'} · {games.length}{' '}
              {lang === 'te' ? 'గేమ్‌లు' : 'games'} · {assets.length}{' '}
              {lang === 'te' ? 'మీడియా ఫైల్స్' : 'media assets'}
            </span>
            <span>·</span>
            {user ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <Cloud className="w-3.5 h-3.5" />
                <span>{lang === 'te' ? 'Firebase Cloud సింక్ ఆన్' : 'Firestore Synced'} ({user.email})</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={signingIn}
                className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 underline underline-offset-4 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>
                  {lang === 'te'
                    ? 'క్లౌడ్‌లో సేవ్ చేయడానికి Google సైన్-ఇన్ చేయండి'
                    : 'Sign in with Google for Firestore sync'}
                </span>
              </button>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasDemos && (
            <button
              type="button"
              onClick={onClearDemos}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-rose-500/15 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-rose-500 text-xs font-medium cursor-pointer"
            >
              {lang === 'te' ? 'Demo ప్రాజెక్టులను తొలగించండి' : 'Clear Demo Projects'}
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'te' ? 'కొత్త వీడియో' : 'New AI Video'}</span>
          </button>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-xl overflow-x-auto self-start max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
              category === tab.id
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {lang === 'te' ? tab.labelTe : tab.labelEn} ({tab.count})
          </button>
        ))}
      </div>

      {category === 'videos' && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchProjects}
                className="w-full bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-xl self-start">
              {(['all', '9:16', '16:9', '1:1'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRatioFilter(val)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    ratioFilter === val
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {val === 'all' ? t.filterAll : val}
                </button>
              ))}
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
              <Film className="w-8 h-8 text-amber-500" />
              <p className="text-slate-600 dark:text-slate-300 text-sm max-w-md">{t.projectsEmpty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVideos.map((proj) => {
                const firstImg = proj.scenes.find((s) => s.imageUrl)?.imageUrl;
                const totalSec = getTotalDuration(proj.scenes);
                return (
                  <div
                    key={proj.id}
                    className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-video bg-slate-900 relative overflow-hidden">
                        {firstImg ? (
                          <img
                            src={firstImg}
                            alt={proj.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${proj.scenes[0]?.palette?.skyTop || '#1E293B'}, ${proj.scenes[0]?.palette?.ground || '#0F172A'})`,
                            }}
                          >
                            <Film className="w-8 h-8 text-white/50" />
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex flex-col gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {proj.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                          {proj.aspectRatio} · {proj.style} · {proj.scenes.length} scenes · {totalSec}s
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{proj.prompt}</p>
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>{t.openInStudio}</span>
                        </button>
                        {onDownloadProject && (
                          <button
                            type="button"
                            onClick={() => onDownloadProject(proj)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-500" />
                            <span>{lang === 'te' ? 'ప్రాజెక్ట్ డౌన్లోడ్' : 'Download Project'}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onDuplicateProject(proj)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 cursor-pointer"
                          aria-label={t.duplicateBtn}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-700 dark:text-slate-300 hover:text-rose-500 cursor-pointer"
                          aria-label={t.deleteBtn}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {category === 'photos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {photoAssets.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              {lang === 'te' ? 'ఇంకా ఫొటోలు సేవ్ చేయలేదు. Photo Studio నుండి సేవ్ చేయండి.' : 'No saved photos yet. Save edits from Photo Studio.'}
            </div>
          ) : (
            photoAssets.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                {item.dataUrl && (
                  <img src={item.dataUrl} alt={item.title} className="aspect-video w-full object-cover bg-slate-900" />
                )}
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.dataUrl && (
                      <a
                        href={item.dataUrl}
                        download={`${item.title.replace(/\s+/g, '_')}.png`}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === 'te' ? 'ఫొటో డౌన్లోడ్' : 'Download Photo'}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(item.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {category === 'audio' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audioAssets.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <Mic className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              {lang === 'te' ? 'ఇంకా ఆడియో క్లిప్స్ సేవ్ చేయలేదు.' : 'No saved audio clips yet.'}
            </div>
          ) : (
            audioAssets.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.dataUrl && (
                      <a
                        href={item.dataUrl}
                        download={`${item.title.replace(/\s+/g, '_')}.wav`}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" />
                        <span>{lang === 'te' ? 'ఆడియో డౌన్లోడ్' : 'Download Audio'}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(item.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.dataUrl && <audio controls src={item.dataUrl} className="w-full" />}
              </div>
            ))
          )}
        </div>
      )}

      {category === 'games' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              {lang === 'te' ? 'ఇంకా గేమ్‌లు సేవ్ చేయలేదు. Game Maker నుండి తయారు చేయండి.' : 'No saved games yet. Create one in Game Maker Studio.'}
            </div>
          ) : (
            games.map((g) => (
              <div
                key={g.id}
                className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-2xl mb-1">{g.heroEmoji} {g.collectibleEmoji}</div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{g.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">{g.genre}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => onOpenGame(g)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    {lang === 'te' ? 'గేమ్ ఆడండి' : 'Play / Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteGame(g.id)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {category === 'downloads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {downloadAssets.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <Download className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              {lang === 'te' ? 'ఎగుమతి చేసిన వీడియోల చరిత్ర ఇక్కడ కనిపిస్తుంది.' : 'Exported download records will appear here.'}
            </div>
          ) : (
            downloadAssets.map((d) => (
              <div
                key={d.id}
                className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{d.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteAsset(d.id)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
