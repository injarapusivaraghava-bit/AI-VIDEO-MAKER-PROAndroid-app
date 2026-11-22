import React, { useState } from 'react';
import { Bot, Send, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { LanguageMode } from '../types/studio';

interface AIAssistantViewProps {
  lang: LanguageMode;
  onLaunchToolWithPrompt: (
    tool: 'video' | 'auto' | 'photo' | 'audio' | 'story' | 'game',
    suggestedPrompt: string
  ) => void;
}

interface AssistantReply {
  userMessage: string;
  reply: string;
  suggestedTool: 'video' | 'auto' | 'photo' | 'audio' | 'story' | 'game';
  suggestedPrompt: string;
  workflowSteps: string[];
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  lang,
  onLaunchToolWithPrompt,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<AssistantReply[]>([]);

  const handleSend = async (customMessage?: string) => {
    const msg = (customMessage ?? input).trim();
    if (!msg) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/studio/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant failed');
      const validTools = ['video', 'auto', 'photo', 'audio', 'story', 'game'] as const;
      const tool = validTools.includes(data.suggestedTool) ? data.suggestedTool : 'video';
      setHistory((prev) => [
        ...prev,
        {
          userMessage: msg,
          reply: data.reply || '',
          suggestedTool: tool,
          suggestedPrompt: data.suggestedPrompt || msg,
          workflowSteps: Array.isArray(data.workflowSteps) ? data.workflowSteps : [],
        },
      ]);
      if (!customMessage) setInput('');
    } catch (err: any) {
      setError(err.message || 'Assistant request failed');
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    lang === 'te' ? '10k వ్యూస్ వచ్చే తెలుగు YouTube Shorts ఐడియా చెప్పండి' : 'Plan a viral Telugu YouTube Shorts workflow',
    lang === 'te' ? 'పిల్లల కార్టూన్ కథ వీడియో ఎలా చేయాలి?' : 'How do I make a kids cartoon story video?',
    lang === 'te' ? 'చిన్న 2D తెలుగు క్విజ్ గేమ్ డిజైన్ చేయండి' : 'Design a simple 2D Telugu educational quiz game',
    lang === 'te' ? 'YouTube థంబ్‌నెయిల్ & పోస్టర్ చిట్కాలు' : 'YouTube thumbnail & poster design tips',
  ];

  const toolLabelMap: Record<string, string> = {
    video: lang === 'te' ? 'వీడియో ఎడిటర్ తెరవండి' : 'Open Video Studio',
    auto: lang === 'te' ? 'ఆటో క్రియేటర్ తెరవండి' : 'Open Auto Creator',
    photo: lang === 'te' ? 'ఫొటో స్టూడియో తెరవండి' : 'Open Photo Studio',
    audio: lang === 'te' ? 'వాయిస్ స్టూడియో తెరవండి' : 'Open Voice Studio',
    story: lang === 'te' ? 'కథల స్టూడియో తెరవండి' : 'Open Story Studio',
    game: lang === 'te' ? 'గేమ్ మేకర్ తెరవండి' : 'Open Game Maker',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'AI క్రియేటర్ అసిస్టెంట్ (తెలుగు + English)' : 'AI Creator Assistant'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'te'
            ? 'వీడియోలు, కార్టూన్ కథలు, థంబ్‌నెయిల్, ఆడియో లేదా 2D గేమ్‌ల కోసం వర్క్‌ఫ్లో & ప్రాంప్ట్ సహాయం పొందండి.'
            : 'Ask questions in Telugu or English, plan your creative workflow, and jump straight into any studio tool.'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Quick Starters */}
      <div className="flex flex-wrap gap-2">
        {quickChips.map((chip, i) => (
          <button
            key={i}
            type="button"
            disabled={loading}
            onClick={() => handleSend(chip)}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#13161F] hover:border-amber-500/50 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Conversation History */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-5 min-h-[320px]">
        {history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
              {lang === 'te'
                ? 'తెలుగు లేదా ఇంగ్లీష్ లో ఏదైనా అడగండి — మీ ప్రాజెక్ట్ కోసం దశల వారీ ప్లాన్ & ప్రాంప్ట్ తయారు చేస్తాను.'
                : 'Ask anything about making Telugu/English Shorts, YouTube videos, thumbnails, stories, voiceovers, or 2D games.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {history.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-3 border-b border-slate-200 dark:border-white/10 pb-4 last:border-b-0">
                <div className="self-end max-w-xl bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100">
                  {item.userMessage}
                </div>

                <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {item.reply}
                  </p>

                  {item.workflowSteps.length > 0 && (
                    <ol className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300 pl-4 list-decimal">
                      {item.workflowSteps.map((ws, si) => (
                        <li key={si}>{ws}</li>
                      ))}
                    </ol>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                      {item.suggestedPrompt}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLaunchToolWithPrompt(item.suggestedTool, item.suggestedPrompt)}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{toolLabelMap[item.suggestedTool] || toolLabelMap.video}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/10"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              lang === 'te' ? 'మీ ప్రశ్న లేదా క్రియేషన్ ఐడియా ఇక్కడ రాయండి...' : 'Ask for ideas, scripts, workflows...'
            }
            className="flex-1 min-h-[46px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="min-h-[46px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{lang === 'te' ? 'పంపండి' : 'Ask'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
