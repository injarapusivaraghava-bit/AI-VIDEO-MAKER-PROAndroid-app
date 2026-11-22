import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Download, ExternalLink, Sparkles, CheckCircle2, Share2 } from 'lucide-react';
import { LanguageMode, VideoProject, YouTubeSeo } from '../types/studio';
import { TRANSLATIONS } from '../i18n/translations';
import { generateSrtContent, renderThumbnailPng } from '../utils/canvasRenderer';
import { getWhatsAppShareUrl, shareMediaFile } from '../utils/shareUtils';

interface YouTubeUploadModalProps {
  project: VideoProject;
  lang: LanguageMode;
  onClose: () => void;
  onUpdateSeo: (seo: YouTubeSeo) => void;
  onDownloadVideo: () => void;
  isExporting: boolean;
  exportProgress: number;
}

export const YouTubeUploadModal: React.FC<YouTubeUploadModalProps> = ({
  project,
  lang,
  onClose,
  onUpdateSeo,
  onDownloadVideo,
  isExporting,
  exportProgress,
}) => {
  const t = TRANSLATIONS[lang];
  const [loadingSeo, setLoadingSeo] = useState(false);
  const [seoError, setSeoError] = useState('');
  const [thumbDataUrl, setThumbDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string>('');

  const seo: YouTubeSeo = project.youtubeSeo || {
    title: project.title,
    description: project.scenes.map((s, i) => `${i + 1}. ${s.title}: ${s.narration}`).join('\n'),
    tags: ['Telugu AI Video', 'Kala AI Studio', project.style],
    hashtags: ['#TeluguStories', '#AIVideo', project.aspectRatio === '9:16' ? '#Shorts' : '#YouTube'],
    thumbnailHook: project.title.slice(0, 28),
    uploadedStatus: 'draft',
  };

  useEffect(() => {
    renderThumbnailPng(project, seo.thumbnailHook || project.title).then(setThumbDataUrl);
  }, [project.id, seo.thumbnailHook]);

  const handleGenerateSeo = async () => {
    setLoadingSeo(true);
    setSeoError('');
    try {
      const res = await fetch('/api/studio/youtube-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          scenes: project.scenes,
          aspectRatio: project.aspectRatio,
          contentLanguage: project.contentLanguage,
          style: project.style,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate YouTube SEO');
      onUpdateSeo(data.seo);
    } catch (err: any) {
      setSeoError(err.message || 'SEO generation failed');
    } finally {
      setLoadingSeo(false);
    }
  };

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(''), 1800);
    } catch {}
  };

  const handleDownloadThumb = () => {
    if (!thumbDataUrl) return;
    const a = document.createElement('a');
    a.href = thumbDataUrl;
    a.download = `${project.title.replace(/\s+/g, '_')}_thumbnail.png`;
    a.click();
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtContent(project);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_subtitles.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#13161F] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{t.ytModalTitle}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {project.aspectRatio === '9:16' ? 'YouTube Shorts (9:16)' : 'YouTube Video (16:9)'} ·{' '}
              {seo.uploadedStatus === 'uploaded'
                ? lang === 'te'
                  ? 'YouTube లో అప్లోడ్ అయింది'
                  : 'Marked Uploaded'
                : lang === 'te'
                  ? 'అప్లోడ్ కు సిద్ధం'
                  : 'Ready for YouTube Studio'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: AI SEO Generator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleGenerateSeo}
            disabled={loadingSeo}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loadingSeo ? t.ytGeneratingSeo : t.ytGenerateSeo}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onDownloadVideo}
              disabled={isExporting}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-100 text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? `${t.exportingVideo} ${exportProgress}%` : t.exportVideoBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSrt}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.downloadSrtBtn}</span>
            </button>
          </div>
        </div>

        {seoError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {seoError}
          </div>
        )}

        {/* Two-column SEO & Thumbnail grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">{t.ytTitleLabel}</label>
                <button
                  type="button"
                  onClick={() => handleCopy('title', seo.title)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'title' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <input
                type="text"
                value={seo.title}
                onChange={(e) => onUpdateSeo({ ...seo, title: e.target.value })}
                className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">{t.ytDescLabel}</label>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('desc', `${seo.description}\n\n${(seo.hashtags || []).join(' ')}`)
                  }
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'desc' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={seo.description}
                onChange={(e) => onUpdateSeo({ ...seo, description: e.target.value })}
                className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">{t.ytTagsLabel}</label>
                <button
                  type="button"
                  onClick={() => handleCopy('tags', (seo.tags || []).join(', '))}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'tags' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <input
                type="text"
                value={(seo.tags || []).join(', ')}
                onChange={(e) =>
                  onUpdateSeo({
                    ...seo,
                    tags: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-slate-400">{(seo.hashtags || []).join(' ')}</p>
            </div>
          </div>

          {/* Thumbnail Studio */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-slate-400">{t.ytThumbLabel}</label>
            <div className="bg-[#0B0D12] border border-white/10 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {thumbDataUrl ? (
                <img
                  src={thumbDataUrl}
                  alt="YouTube Thumbnail Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xs text-slate-500">Rendering thumbnail...</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">
                {lang === 'te' ? 'థంబ్‌నెయిల్ టెక్స్ట్ (3-5 పదాలు)' : 'Thumbnail Hook Text'}
              </label>
              <input
                type="text"
                value={seo.thumbnailHook}
                onChange={(e) => onUpdateSeo({ ...seo, thumbnailHook: e.target.value })}
                className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadThumb}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-100 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.ytDownloadThumb}</span>
            </button>
          </div>
        </div>

        {/* Footer Upload Actions */}
        <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400 max-w-md">
            {lang === 'te'
              ? '1) వీడియో & థంబ్‌నెయిల్ డౌన్లోడ్ చేయండి → 2) టైటిల్/డిస్క్రిప్షన్ కాపీ చేయండి → 3) YouTube Studio లో అప్లోడ్ చేయండి.'
              : '1) Download video & thumbnail → 2) Copy SEO title & tags → 3) Upload directly in YouTube Studio.'}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {thumbDataUrl && (
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(thumbDataUrl);
                  const blob = await res.blob();
                  await shareMediaFile({
                    blob,
                    fileName: `${project.title.replace(/\s+/g, '_')}_poster.png`,
                    title: seo.title,
                    text: `${seo.title}\n${(seo.hashtags || []).join(' ')}`,
                  });
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{lang === 'te' ? 'WhatsApp / IG షేర్' : 'Share Poster (WA / IG)'}</span>
              </button>
            )}

            <a
              href={getWhatsAppShareUrl(`${seo.title}\n\n${seo.description.slice(0, 140)}...\n${(seo.hashtags || []).join(' ')}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>{lang === 'te' ? 'WhatsApp టెక్స్ట్' : 'WhatsApp'}</span>
            </a>

            <button
              type="button"
              onClick={() =>
                onUpdateSeo({
                  ...seo,
                  uploadedStatus: 'uploaded',
                  uploadedAt: new Date().toISOString(),
                })
              }
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.ytMarkUploaded}</span>
            </button>

            <a
              href="https://studio.youtube.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t.ytOpenStudio}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
