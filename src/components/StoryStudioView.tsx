import React, { useState } from 'react';
import { BookOpen, Film, Loader2, Sparkles } from 'lucide-react';
import { ContentLanguage, LanguageMode, SceneItem } from '../types/studio';

interface StoryStudioViewProps {
  lang: LanguageMode;
  onConvertStoryToVideo: (title: string, topic: string, scenes: SceneItem[], contentLang: ContentLanguage) => void;
}

export const StoryStudioView: React.FC<StoryStudioViewProps> = ({ lang, onConvertStoryToVideo }) => {
  const [topic, setTopic] = useState('');
  const [storyType, setStoryType] = useState('పిల్లల కథ');
  const [characterConsistency, setCharacterConsistency] = useState('');
  const [sceneCount, setSceneCount] = useState(3);
  const [storyLang, setStoryLang] = useState<ContentLanguage>('te');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storyResult, setStoryResult] = useState<{
    title: string;
    moral: string;
    fullStory: string;
    scenes: SceneItem[];
  } | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError(lang === 'te' ? 'దయచేసి కథ అంశం రాయండి.' : 'Please enter a story topic.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullTopic = characterConsistency.trim()
        ? `${topic} (Keep main character consistent across all scenes: ${characterConsistency.trim()})`
        : topic;
      const res = await fetch('/api/studio/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: fullTopic,
          storyType,
          sceneCount,
          language: storyLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Story generation failed');
      setStoryResult(data);
    } catch (err: any) {
      setError(err.message || 'Story generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'తెలుగు & ఇంగ్లీష్ కథల స్టూడియో' : 'Telugu & English Story Studio'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'te'
            ? 'పిల్లల, కార్టూన్, యాక్షన్, కామెడీ, పల్లెటూరి & నీతి కథలు తయారు చేసి ఒకే క్లిక్‌తో AI వీడియోగా మార్చండి.'
            : 'Write Kids, Cartoon, Action, Comedy, Village, or Moral stories in Telugu/English and turn them into videos.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'కథ అంశం' : 'Story Topic'}
            </label>
            <textarea
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                lang === 'te'
                  ? 'ఉదా: నిజాయితీ కలిగిన కట్టెలు కొట్టేవాడి కథ...'
                  : 'Example: The honest woodcutter and the golden axe...'
              }
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'ప్రధాన పాత్ర నిలకడ (Character Consistency)' : 'Character Consistency Guide (Optional)'}
            </label>
            <input
              type="text"
              value={characterConsistency}
              onChange={(e) => setCharacterConsistency(e.target.value)}
              placeholder={
                lang === 'te'
                  ? 'ఉదా: పసుపు చొక్కా వేసుకున్న చిట్టి కుందేలు రాజు'
                  : 'e.g. Little bunny Raju wearing a yellow vest'
              }
              className="min-h-[42px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'కథ రకం' : 'Story Category'}
              </label>
              <select
                value={storyType}
                onChange={(e) => setStoryType(e.target.value)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="పిల్లల కథ">పిల్లల కథ (Kids Story)</option>
                <option value="కార్టూన్ కథ">కార్టూన్ కథ (Cartoon Story)</option>
                <option value="నీతి కథ">నీతి కథ (Moral Story)</option>
                <option value="పల్లెటూరి కథ">పల్లెటూరి కథ (Village Tale)</option>
                <option value="యాక్షన్ సాహస కథ">యాక్షన్ కథ (Action / Adventure)</option>
                <option value="కామెడీ కథ">కామెడీ కథ (Comedy Story)</option>
                <option value="భక్తి కథ">భక్తి / పురాణ కథ (Devotional)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'సీన్లు' : 'Scenes'}
              </label>
              <select
                value={sceneCount}
                onChange={(e) => setSceneCount(Number(e.target.value))}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 font-mono-tabular"
              >
                <option value={3}>3 {lang === 'te' ? 'సీన్లు' : 'Scenes'}</option>
                <option value={5}>5 {lang === 'te' ? 'సీన్లు' : 'Scenes'}</option>
                <option value={8}>8 {lang === 'te' ? 'సీన్లు' : 'Scenes'}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'భాష' : 'Language'}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl">
              {(['te', 'en'] as const).map((cl) => (
                <button
                  key={cl}
                  type="button"
                  onClick={() => setStoryLang(cl)}
                  className={`min-h-[38px] rounded-lg text-xs font-medium cursor-pointer ${
                    storyLang === cl
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cl === 'te' ? 'తెలుగు' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>
              {loading
                ? lang === 'te'
                  ? 'కథ & సీన్ ప్లాన్ తయారవుతోంది...'
                  : 'Writing Story...'
                : lang === 'te'
                  ? 'కథ & సీన్ ప్లాన్ తయారు చేయండి'
                  : 'Generate Story & Scene Plan'}
            </span>
          </button>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          {!storyResult ? (
            <div className="min-h-[320px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                {lang === 'te'
                  ? 'కథ అంశం రాసి "కథ & సీన్ ప్లాన్ తయారు చేయండి" నొక్కండి. తయారైన కథను వెంటనే AI వీడియోగా మార్చవచ్చు.'
                  : 'Enter a story topic and click Generate. You can convert the generated scene plan directly into an AI video.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{storyResult.title}</h2>
                  <p className="text-xs text-amber-500 mt-0.5">{storyResult.moral}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onConvertStoryToVideo(storyResult.title, topic, storyResult.scenes, storyLang)
                  }
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>{lang === 'te' ? 'ఈ కథతో AI వీడియో చేయండి' : 'Convert Story to AI Video'}</span>
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {storyResult.fullStory}
              </div>

              <div className="flex flex-col gap-2.5">
                {storyResult.scenes.map((sc, idx) => (
                  <div
                    key={sc.id}
                    className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5"
                  >
                    <p className="text-xs font-semibold text-amber-500">
                      0{idx + 1}. {sc.title} · {sc.durationSec}s
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 mt-1">{sc.narration}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
