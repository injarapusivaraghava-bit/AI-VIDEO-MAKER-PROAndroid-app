import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Circle,
  Film,
  ArrowRight,
} from 'lucide-react';
import {
  AspectRatio,
  ContentLanguage,
  LanguageMode,
  MusicTrackId,
  SceneItem,
  VideoProject,
  VideoStyle,
} from '../types/studio';

interface AutoCreatorViewProps {
  lang: LanguageMode;
  onCreateAutoProject: (project: VideoProject) => void;
}

type StepStatus = 'pending' | 'running' | 'done' | 'unavailable';

interface PipelineStep {
  id: string;
  labelTe: string;
  labelEn: string;
  detailTe: string;
  detailEn: string;
  status: StepStatus;
}

const INITIAL_STEPS: PipelineStep[] = [
  {
    id: 'story',
    labelTe: '1. కథ & స్క్రిప్ట్ రచన',
    labelEn: '1. Story & Script Writing',
    detailTe: 'Gemini 4 ద్వారా తెలుగు/ఇంగ్లీష్ కథ రచన',
    detailEn: 'AI story & narration script via Gemini 4',
    status: 'pending',
  },
  {
    id: 'scenes',
    labelTe: '2. సీన్ల విభజన & యానిమేషన్',
    labelEn: '2. Scene Breakdown & Animation',
    detailTe: 'కెమెరా మోషన్, పాత్రలు & వాతావరణం',
    detailEn: 'Scene pacing, characters, camera motion & FX',
    status: 'pending',
  },
  {
    id: 'prompts',
    labelTe: '3. AI చిత్ర ప్రాంప్ట్‌లు',
    labelEn: '3. Image Prompts Generation',
    detailTe: 'ప్రతి సీన్ కోసం వివరమైన విజువల్ ప్రాంప్ట్',
    detailEn: 'Detailed visual prompts per scene',
    status: 'pending',
  },
  {
    id: 'diffusion',
    labelTe: '4. బాహ్య రాస్టర్ AI చిత్రాలు / వీడియో మోడల్',
    labelEn: '4. External Raster Image / Video Diffusion',
    detailTe: 'బిల్లింగ్ మోడల్ కనెక్ట్ చేయబడలేదు — బదులుగా యానిమేటెడ్ ఆర్ట్ ఉపయోగించబడుతుంది',
    detailEn: 'Not Connected (Billing Diffusion Key required) — using procedural animated art',
    status: 'pending',
  },
  {
    id: 'voice',
    labelTe: '5. తెలుగు / ఇంగ్లీష్ AI వాయిస్ ఓవర్',
    labelEn: '5. Telugu & English AI Voiceover',
    detailTe: 'Gemini 3.8 Flash TTS తో సహజ వాయిస్',
    detailEn: 'Natural speech synthesis per scene via Gemini 3.8 TTS',
    status: 'pending',
  },
  {
    id: 'music',
    labelTe: '6. సబ్టైటిల్స్ & బ్యాక్‌గ్రౌండ్ సంగీతం',
    labelEn: '6. Subtitles & Background Music',
    detailTe: 'తెలుగు/ఇంగ్లీష్ సబ్టైటిల్స్ & కాపీరైట్-ఫ్రీ ట్రాక్',
    detailEn: 'Bilingual subtitles + matched royalty-free music track',
    status: 'pending',
  },
  {
    id: 'timeline',
    labelTe: '7. వీడియో ఎడిటర్ టైమ్‌లైన్ కూర్పు',
    labelEn: '7. Video Editor Timeline Assembly',
    detailTe: 'MP4/WebM ఎగుమతి కోసం పూర్తి ప్రాజెక్ట్ సిద్ధం',
    detailEn: 'Assembled project ready to preview & export MP4/WebM',
    status: 'pending',
  },
];

export const AutoCreatorView: React.FC<AutoCreatorViewProps> = ({ lang, onCreateAutoProject }) => {
  const [prompt, setPrompt] = useState(
    lang === 'te'
      ? 'ఒక కష్టపడే రైతు మరియు అతని పొలంలో అద్భుతమైన పంట గురించి 30 సెకన్ల తెలుగు కార్టూన్ వీడియో తయారు చేయండి.'
      : 'Create a 30 second Telugu cartoon video about a kind farmer and his magical harvest.'
  );
  const [durationSec, setDurationSec] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('bilingual');
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [builtProject, setBuiltProject] = useState<VideoProject | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<{ title: string; imagePrompt: string }[]>([]);

  const updateStep = (id: string, status: StepStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const handleRunAutoPipeline = async () => {
    if (!prompt.trim()) {
      setError(lang === 'te' ? 'దయచేసి వీడియో ఆలోచన రాయండి.' : 'Please enter an auto-creation prompt.');
      return;
    }

    setRunning(true);
    setError('');
    setBuiltProject(null);
    setGeneratedPrompts([]);
    setSteps(INITIAL_STEPS);

    try {
      updateStep('story', 'running');
      updateStep('scenes', 'running');

      const planRes = await fetch('/api/studio/auto-create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, durationSec, language: contentLanguage, aspectRatio }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || 'Auto pipeline failed at story planning');

      updateStep('story', 'done');
      updateStep('scenes', 'done');
      updateStep('prompts', 'done');
      updateStep('diffusion', planData.capabilities?.rasterImageModelConnected ? 'done' : 'unavailable');

      const scenes: SceneItem[] = (planData.scenes || []).map((s: any) => ({ ...s }));
      setGeneratedPrompts(
        (planData.scenes || []).map((s: any) => ({
          title: s.title,
          imagePrompt: s.imagePrompt || s.sceneDescription || '',
        }))
      );

      // Synthesize voice per scene sequentially
      updateStep('voice', 'running');
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        if (!sc.narration.trim()) continue;
        try {
          const vRes = await fetch('/api/studio/generate-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: sc.narration,
              voiceName: 'Kore',
              voiceStyle: planData.suggestedStyle === 'cartoon' ? 'cartoon' : 'storyteller',
            }),
          });
          const vData = await vRes.json();
          if (vRes.ok && vData.audioBase64) {
            scenes[i] = {
              ...sc,
              audioBase64: vData.audioBase64,
              audioMimeType: vData.mimeType || 'audio/wav',
              audioStatus: 'ready',
            };
          } else {
            scenes[i] = { ...sc, audioStatus: 'error' };
          }
        } catch {
          scenes[i] = { ...sc, audioStatus: 'error' };
        }
      }
      updateStep('voice', 'done');
      updateStep('music', 'done');

      const now = new Date().toISOString();
      const assembled: VideoProject = {
        id: `auto-proj-${Date.now()}`,
        title: planData.videoTitle || 'Auto Created AI Video',
        mode: 'cartoon-maker',
        style: (planData.suggestedStyle as VideoStyle) || 'cartoon',
        aspectRatio,
        quality: '720p',
        targetDurationSec: durationSec,
        contentLanguage,
        prompt,
        voiceName: 'Kore',
        voiceStyle: planData.suggestedStyle === 'cartoon' ? 'cartoon' : 'storyteller',
        musicTrack: (planData.suggestedMusic as MusicTrackId) || 'kids-playful',
        musicVolume: 0.25,
        voiceVolume: 1.0,
        subtitleStyle: aspectRatio === '9:16' ? 'shorts-pop' : 'cinema',
        scenes,
        exportCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      setBuiltProject(assembled);
      updateStep('timeline', 'done');
    } catch (err: any) {
      setError(err.message || 'Automatic video creation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'AI ఆటోమేటిక్ వీడియో క్రియేటర్' : 'AI Automatic Creation Pipeline'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'te'
            ? 'ఒక్క ప్రాంప్ట్ ఇస్తే చాలు — కథ, సీన్లు, AI చిత్ర ప్రాంప్ట్‌లు, తెలుగు/ఇంగ్లీష్ వాయిస్, సంగీతం & టైమ్‌లైన్ ఆటోమేటిక్‌గా తయారవుతాయి.'
            : 'Enter one prompt to automatically run Story -> Scene Breakdown -> Image Prompts -> Telugu/English Voiceover -> Music -> Video Timeline.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: One-Click Prompt Composer */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {lang === 'te' ? 'మీ వీడియో ఆదేశం (Prompt)' : 'Single-Prompt Instruction'}
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              {
                te: '30 సె. తెలుగు రైతు కార్టూన్',
                en: '30s Telugu Farmer Cartoon',
                prompt: 'Create a 30 second Telugu cartoon video about a farmer',
                dur: 30,
              },
              {
                te: '60 సె. పిల్లల నీతి కథ',
                en: '60s Kids Moral Story',
                prompt: 'Create a 60 second kids moral story about honesty in a village school',
                dur: 60,
              },
            ].map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPrompt(chip.prompt);
                  setDurationSec(chip.dur);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {lang === 'te' ? chip.te : chip.en}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'te' ? 'నిడివి' : 'Duration'}
              </span>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="min-h-[40px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-2.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value={15}>15s Short</option>
                <option value={30}>30s Short</option>
                <option value={60}>60s Reel</option>
                <option value={90}>90s Story</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'te' ? 'ఫార్మాట్' : 'Format'}
              </span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="min-h-[40px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-2.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="9:16">9:16 Shorts</option>
                <option value="16:9">16:9 YouTube</option>
                <option value="1:1">1:1 Square</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'te' ? 'భాష' : 'Language'}
              </span>
              <select
                value={contentLanguage}
                onChange={(e) => setContentLanguage(e.target.value as ContentLanguage)}
                className="min-h-[40px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-2.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="bilingual">తెలుగు + EN</option>
                <option value="te">తెలుగు</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAutoPipeline}
            disabled={running}
            className="min-h-[48px] w-full px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>
              {running
                ? lang === 'te'
                  ? 'ఆటో వీడియో తయారవుతోంది...'
                  : 'Running Auto Creation...'
                : lang === 'te'
                  ? 'ఆటోమేటిక్‌గా వీడియో తయారు చేయండి'
                  : 'Auto-Create Full Video'}
            </span>
          </button>
        </div>

        {/* Right: Transparent Task Checklist & Launch Button */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'te' ? 'ప్రతి దశ ప్రత్యక్ష స్థితి (Live Pipeline)' : 'Pipeline Step Status'}
            </h2>
            {builtProject && (
              <button
                type="button"
                onClick={() => onCreateAutoProject(builtProject)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>{lang === 'te' ? 'వీడియో ఎడిటర్‌లో తెరవండి' : 'Open in Video Editor'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {steps.map((st) => (
              <div
                key={st.id}
                className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {st.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : st.status === 'running' ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0 mt-0.5" />
                  ) : st.status === 'unavailable' ? (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {lang === 'te' ? st.labelTe : st.labelEn}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'te' ? st.detailTe : st.detailEn}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono-tabular font-semibold whitespace-nowrap ${
                    st.status === 'done'
                      ? 'text-emerald-500'
                      : st.status === 'running'
                        ? 'text-amber-500'
                        : st.status === 'unavailable'
                          ? 'text-amber-500'
                          : 'text-slate-400'
                  }`}
                >
                  {st.status === 'done'
                    ? 'Done'
                    : st.status === 'running'
                      ? 'Running'
                      : st.status === 'unavailable'
                        ? 'Needs Billing Model'
                        : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {generatedPrompts.length > 0 && (
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-amber-500">
                {lang === 'te' ? 'తయారైన AI చిత్ర ప్రాంప్ట్‌లు' : 'Generated Scene Image Prompts'}
              </p>
              {generatedPrompts.map((gp, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-white/5 pt-2">
                  <strong className="text-slate-900 dark:text-slate-100">
                    {i + 1}. {gp.title}:
                  </strong>{' '}
                  {gp.imagePrompt}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
