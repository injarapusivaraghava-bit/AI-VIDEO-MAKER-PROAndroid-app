import React, { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Download,
  Wand2,
  Film,
  Upload,
  Copy,
  Check,
  Loader2,
  RotateCw,
  FlipHorizontal,
  RotateCcw,
  HardDrive,
  Share2,
  LayoutGrid,
  Sparkles,
  Save,
} from 'lucide-react';
import { APP_LOGO_URL, LanguageMode, SavedAssetItem } from '../types/studio';
import { useFirebase } from '../contexts/FirebaseContext';
import { DriveAuthError, uploadBlobToDrive } from '../utils/googleDriveService';
import { shareMediaFile } from '../utils/shareUtils';

interface PhotoStudioViewProps {
  lang: LanguageMode;
  initialPhoto?: { dataUrl: string; title: string } | null;
  onClearInitialPhoto?: () => void;
  onSendPhotoToVideo: (dataUrl: string, title: string, prompt: string) => void;
  onSaveAsset?: (asset: Omit<SavedAssetItem, 'id' | 'createdAt'>) => Promise<void>;
}

type PhotoFilterPreset = 'original' | 'warm' | 'vivid' | 'bw' | 'vintage';

interface PhotoEditState {
  preset: PhotoFilterPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  rotation: number;
  flipH: boolean;
  caption: string;
  sticker: string;
  bgReplace: 'none' | 'studio-dark' | 'sunset' | 'emerald' | 'sky';
  removeDarkBg: boolean;
  stampLogo: boolean;
}

const DEFAULT_EDITS: PhotoEditState = {
  preset: 'original',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  rotation: 0,
  flipH: false,
  caption: '',
  sticker: '',
  bgReplace: 'none',
  removeDarkBg: false,
  stampLogo: false,
};

const STICKER_CHOICES = ['', '⭐', '🔥', '❤️', '🎉', '🎬', '✨'];

export const PhotoStudioView: React.FC<PhotoStudioViewProps> = ({
  lang,
  initialPhoto,
  onClearInitialPhoto,
  onSendPhotoToVideo,
  onSaveAsset,
}) => {
  const { driveToken, connectGoogleDrive, clearDriveToken } = useFirebase();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('3D Cartoon');
  const [size, setSize] = useState('1280x720');
  const [loading, setLoading] = useState(false);
  const [savingDrive, setSavingDrive] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [assetSavedNotice, setAssetSavedNotice] = useState(false);
  const [driveNotice, setDriveNotice] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    title: string;
    enhancedPrompt: string;
    pngDataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [edits, setEdits] = useState<PhotoEditState>(DEFAULT_EDITS);
  const [editedDataUrl, setEditedDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const collageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialPhoto) return;
    setEdits(DEFAULT_EDITS);
    setResult({
      title: initialPhoto.title || 'Google Drive Photo',
      enhancedPrompt: initialPhoto.title || 'Imported from Google Drive',
      pngDataUrl: initialPhoto.dataUrl,
      width: 1280,
      height: 720,
    });
    onClearInitialPhoto?.();
  }, [initialPhoto]);

  const svgToPngDataUrl = (svgMarkup: string, width: number, height: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const png = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(png);
        } else {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render generated artwork'));
      };
      img.src = url;
    });

  // Bake real photo edits (filters, BG replace/chroma key, rotation, captions, stickers, logo) onto canvas
  useEffect(() => {
    if (!result?.pngDataUrl) {
      setEditedDataUrl('');
      return;
    }

    let cancelled = false;
    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.onload = () => {
      if (cancelled) return;
      const rotated = edits.rotation % 180 !== 0;
      const srcW = baseImg.naturalWidth || result.width || 1024;
      const srcH = baseImg.naturalHeight || result.height || 1024;
      const outW = rotated ? srcH : srcW;
      const outH = rotated ? srcW : srcH;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Optional AI Background Replacement canvas layer
      if (edits.bgReplace !== 'none') {
        const bgGrad = ctx.createLinearGradient(0, 0, outW, outH);
        if (edits.bgReplace === 'studio-dark') {
          bgGrad.addColorStop(0, '#0F172A');
          bgGrad.addColorStop(1, '#312E81');
        } else if (edits.bgReplace === 'sunset') {
          bgGrad.addColorStop(0, '#EA580C');
          bgGrad.addColorStop(1, '#7C2D12');
        } else if (edits.bgReplace === 'emerald') {
          bgGrad.addColorStop(0, '#065F46');
          bgGrad.addColorStop(1, '#0F172A');
        } else {
          bgGrad.addColorStop(0, '#0284C7');
          bgGrad.addColorStop(1, '#1E3A8A');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, outW, outH);
      }

      // Draw transformed image onto an offscreen canvas if dark-bg removal is requested
      const fgCanvas = document.createElement('canvas');
      fgCanvas.width = outW;
      fgCanvas.height = outH;
      const fgCtx = fgCanvas.getContext('2d');
      if (fgCtx) {
        fgCtx.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%) sepia(${edits.sepia}%)`;
        fgCtx.translate(outW / 2, outH / 2);
        fgCtx.rotate((edits.rotation * Math.PI) / 180);
        fgCtx.scale(edits.flipH ? -1 : 1, 1);
        fgCtx.drawImage(baseImg, -srcW / 2, -srcH / 2, srcW, srcH);

        if (edits.removeDarkBg) {
          const imgData = fgCtx.getImageData(0, 0, outW, outH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] < 28 && d[i + 1] < 28 && d[i + 2] < 36) {
              d[i + 3] = 0;
            }
          }
          fgCtx.putImageData(imgData, 0, 0);
        }
        ctx.drawImage(fgCanvas, 0, 0);
      }

      // Optional Sticker Stamp
      if (edits.sticker) {
        const sizePx = Math.max(48, Math.round(Math.min(outW, outH) * 0.12));
        ctx.font = `${sizePx}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(edits.sticker, Math.round(outW * 0.04), Math.round(outH * 0.04));
      }

      // Optional Caption Strip
      if (edits.caption.trim()) {
        const barH = Math.max(54, Math.round(outH * 0.11));
        ctx.fillStyle = 'rgba(11, 13, 18, 0.80)';
        ctx.fillRect(0, outH - barH, outW, barH);
        ctx.fillStyle = '#F8FAFC';
        const fontPx = Math.max(20, Math.round(barH * 0.44));
        ctx.font = `700 ${fontPx}px "Noto Sans Telugu", "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edits.caption.trim(), outW / 2, outH - barH / 2, outW - 48);
      }

      const finalize = () => {
        if (!cancelled) {
          setEditedDataUrl(canvas.toDataURL('image/png'));
        }
      };

      if (edits.stampLogo) {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.onload = () => {
          if (cancelled) return;
          const badgeSize = Math.max(44, Math.round(Math.min(outW, outH) * 0.085));
          const pad = Math.round(badgeSize * 0.35);
          const bx = outW - badgeSize - pad;
          const by = pad;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(bx - 4, by - 4, badgeSize + 8, badgeSize + 8, 12);
          ctx.fillStyle = 'rgba(11, 13, 18, 0.82)';
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(bx, by, badgeSize, badgeSize, 9);
          ctx.clip();
          ctx.drawImage(logoImg, bx, by, badgeSize, badgeSize);
          ctx.restore();
          finalize();
        };
        logoImg.onerror = finalize;
        logoImg.src = APP_LOGO_URL;
      } else {
        finalize();
      }
    };
    baseImg.src = result.pngDataUrl;

    return () => {
      cancelled = true;
    };
  }, [result, edits]);

  const applyPreset = (preset: PhotoFilterPreset) => {
    if (preset === 'original') {
      setEdits((e) => ({ ...e, preset, brightness: 100, contrast: 100, saturation: 100, sepia: 0 }));
    } else if (preset === 'warm') {
      setEdits((e) => ({ ...e, preset, brightness: 106, contrast: 104, saturation: 120, sepia: 18 }));
    } else if (preset === 'vivid') {
      setEdits((e) => ({ ...e, preset, brightness: 104, contrast: 116, saturation: 145, sepia: 0 }));
    } else if (preset === 'bw') {
      setEdits((e) => ({ ...e, preset, brightness: 104, contrast: 115, saturation: 0, sepia: 0 }));
    } else if (preset === 'vintage') {
      setEdits((e) => ({ ...e, preset, brightness: 96, contrast: 92, saturation: 82, sepia: 45 }));
    }
  };

  const handleAutoEnhance = () => {
    setEdits((e) => ({
      ...e,
      preset: 'vivid',
      brightness: 106,
      contrast: 114,
      saturation: 128,
      sepia: 0,
    }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(lang === 'te' ? 'దయచేసి చిత్ర వివరణ రాయండి.' : 'Please enter an image description.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/studio/generate-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate artwork');

      const pngDataUrl = await svgToPngDataUrl(data.svgMarkup, data.width || 1024, data.height || 1024);
      setEdits(DEFAULT_EDITS);
      setResult({
        title: data.title,
        enhancedPrompt: data.enhancedPrompt,
        pngDataUrl,
        width: data.width || 1024,
        height: data.height || 1024,
      });
    } catch (err: any) {
      setError(err.message || 'Artwork generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCustomPhoto = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setEdits(DEFAULT_EDITS);
      setResult({
        title: file.name.replace(/\.[^.]+$/, ''),
        enhancedPrompt: prompt || file.name,
        pngDataUrl: reader.result as string,
        width: 1280,
        height: 720,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBuildCollage = async (files: FileList | null) => {
    if (!files || files.length < 2) {
      setError(lang === 'te' ? 'కొలాజ్ కోసం కనీసం 2 ఫొటోలు ఎంచుకోండి.' : 'Select 2–4 photos to build a collage.');
      return;
    }
    setError('');
    const picked = Array.from(files).slice(0, 4);
    const loadImg = (file: File) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = r.result as string;
        };
        r.readAsDataURL(file);
      });

    try {
      const imgs = await Promise.all(picked.map(loadImg));
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0B0D12';
      ctx.fillRect(0, 0, 1200, 1200);
      const pad = 20;

      if (imgs.length === 2) {
        const w = (1200 - pad * 3) / 2;
        const h = 1200 - pad * 2;
        imgs.forEach((im, idx) => {
          ctx.drawImage(im, pad + idx * (w + pad), pad, w, h);
        });
      } else {
        const w = (1200 - pad * 3) / 2;
        const h = (1200 - pad * 3) / 2;
        imgs.forEach((im, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          ctx.drawImage(im, pad + col * (w + pad), pad + row * (h + pad), w, h);
        });
      }

      setEdits(DEFAULT_EDITS);
      setResult({
        title: `Collage (${imgs.length} Photos)`,
        enhancedPrompt: `${imgs.length}-photo studio collage created in AI VIDEO MAKER PRO`,
        pngDataUrl: canvas.toDataURL('image/png'),
        width: 1200,
        height: 1200,
      });
    } catch {
      setError('Could not render multi-photo collage');
    }
  };

  const activePhotoUrl = editedDataUrl || result?.pngDataUrl || '';

  const handleDownloadPng = () => {
    if (!result || !activePhotoUrl) return;
    const a = document.createElement('a');
    a.href = activePhotoUrl;
    a.download = `${result.title.replace(/\s+/g, '_')}_edited.png`;
    a.click();
  };

  const handleSaveToHistory = async () => {
    if (!result || !activePhotoUrl || !onSaveAsset) return;
    setSavingAsset(true);
    try {
      await onSaveAsset({
        type: 'photo',
        title: result.title,
        subtitle: `${result.width}×${result.height} · ${style}`,
        dataUrl: activePhotoUrl,
        mimeType: 'image/png',
      });
      setAssetSavedNotice(true);
      setTimeout(() => setAssetSavedNotice(false), 2000);
    } finally {
      setSavingAsset(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (!result || !activePhotoUrl) return;
    setSavingDrive(true);
    setError('');
    setDriveNotice('');
    try {
      const token = driveToken || (await connectGoogleDrive());
      if (!token) return;
      const res = await fetch(activePhotoUrl);
      const blob = await res.blob();
      const safeName = `${result.title.replace(/\s+/g, '_')}_edited.png`;
      await uploadBlobToDrive({
        token,
        fileName: safeName,
        mimeType: 'image/png',
        blob,
        description: 'Photo edited in AI VIDEO MAKER PRO',
        useStudioFolder: true,
      });
      setDriveNotice(lang === 'te' ? 'ఫొటో Google Drive లో సేవ్ అయింది!' : 'Photo saved to Google Drive!');
      setTimeout(() => setDriveNotice(''), 3000);
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Failed to save photo to Google Drive');
    } finally {
      setSavingDrive(false);
    }
  };

  const handleSharePoster = async () => {
    if (!result || !activePhotoUrl) return;
    try {
      const res = await fetch(activePhotoUrl);
      const blob = await res.blob();
      await shareMediaFile({
        blob,
        fileName: `${result.title.replace(/\s+/g, '_')}_poster.png`,
        title: result.title,
        text: `${result.title} — Created with AI VIDEO MAKER PRO`,
      });
    } catch {}
  };

  const handleCopyPrompt = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.enhancedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === 'te' ? 'AI ఫొటో, పోస్టర్, కొలాజ్ & థంబ్‌నెయిల్ స్టూడియో' : 'AI Photo, Poster, Collage & Thumbnail Studio'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'te'
            ? 'AI వెక్టర్ ఆర్ట్ తయారు చేయండి, కొలాజ్ చేయండి, బ్యాక్‌గ్రౌండ్ మార్చండి, ఆటో ఎన్హాన్స్, స్టిక్కర్లు & లోగో స్టాంప్ తో ఎడిట్ చేయండి.'
            : 'Create SVG-to-PNG art, stitch multi-photo collages, remove/replace backgrounds, apply auto enhance, captions, stickers & App logo.'}
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
              {lang === 'te' ? 'చిత్ర వివరణ' : 'Image / Poster Description'}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                lang === 'te'
                  ? 'ఉదా: అందమైన 3D కార్టూన్ అడవిలో కుందేలు...'
                  : 'Example: Bold Telugu YouTube thumbnail with sunset mountains...'
              }
              className="w-full bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'చిత్ర శైలి' : 'Style / Preset'}
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="3D Cartoon">3D Cartoon</option>
                <option value="YouTube Thumbnail">YouTube Thumbnail</option>
                <option value="Portrait Art">AI Portrait Art</option>
                <option value="Realistic Cinema">Realistic Cinema</option>
                <option value="Anime">Anime Visual</option>
                <option value="Telugu Village Art">Telugu Village Art</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {lang === 'te' ? 'చిత్ర పరిమాణం' : 'Dimensions'}
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="min-h-[44px] bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="1280x720">1280 × 720 (YouTube Thumbnail 16:9)</option>
                <option value="1080x1350">1080 × 1350 (Instagram Poster 4:5)</option>
                <option value="720x1280">720 × 1280 (Shorts / Reels 9:16)</option>
                <option value="1024x1024">1024 × 1024 (Square Poster 1:1)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="min-h-[48px] w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>
              {loading
                ? lang === 'te'
                  ? 'చిత్రం తయారవుతోంది...'
                  : 'Generating Artwork...'
                : lang === 'te'
                  ? 'AI చిత్రం & Prompt తయారు చేయండి'
                  : 'Generate SVG-to-PNG Art & Prompt'}
            </span>
          </button>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'te'
              ? 'గమనిక: ఉచిత టైర్‌లో vector SVG→PNG ఆర్ట్ + వివరమైన Prompt వస్తాయి. ఫోటోరియలిస్టిక్ AI డిఫ్యూషన్ కోసం పెయిడ్ ఇమేజ్ API అవసరం.'
              : 'Free tier renders layered SVG-to-PNG artwork + enhanced prompts. External photorealistic raster diffusion requires a billing image API.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUploadCustomPhoto(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-500" />
              <span>{lang === 'te' ? 'ఫొటో అప్లోడ్' : 'Upload Photo'}</span>
            </button>

            <input
              ref={collageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleBuildCollage(e.target.files)}
            />
            <button
              type="button"
              onClick={() => collageInputRef.current?.click()}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-sky-500" />
              <span>{lang === 'te' ? 'కొలాజ్ (2–4 ఫొటోలు)' : 'Collage (2–4 Photos)'}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          {!result ? (
            <div className="aspect-video bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <ImageIcon className="w-10 h-10 text-slate-400 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
                {lang === 'te'
                  ? 'చిత్ర వివరణ రాయండి, ఫొటో అప్లోడ్ చేయండి లేదా 2–4 ఫొటోలతో కొలాజ్ తయారు చేయండి.'
                  : 'Generate artwork, upload a photo, or pick 2–4 photos for a multi-photo collage.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{result.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                    {result.width} × {result.height} · {style}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-500" />
                    <span>{lang === 'te' ? 'ఫొటో డౌన్లోడ్ (PNG)' : 'Download Photo'}</span>
                  </button>
                  {onSaveAsset && (
                    <button
                      type="button"
                      onClick={() => void handleSaveToHistory()}
                      disabled={savingAsset}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      {assetSavedNotice ? <Check className="w-4 h-4 text-emerald-500" /> : <Save className="w-4 h-4" />}
                      <span>{assetSavedNotice ? (lang === 'te' ? 'సేవ్ అయింది' : 'Saved') : lang === 'te' ? 'హిస్టరీలో సేవ్' : 'Save'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveToDrive()}
                    disabled={savingDrive}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    {savingDrive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <HardDrive className="w-4 h-4 text-amber-500" />
                    )}
                    <span>{driveNotice ? (lang === 'te' ? 'సేవ్ అయింది' : 'Drive OK') : 'Drive'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSharePoster()}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{lang === 'te' ? 'షేర్' : 'Share'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendPhotoToVideo(activePhotoUrl, result.title, result.enhancedPrompt)}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Film className="w-4 h-4" />
                    <span>{lang === 'te' ? 'వీడియోలో వాడండి' : 'Animate'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden flex items-center justify-center max-h-[360px]">
                <img
                  src={activePhotoUrl}
                  alt={result.title}
                  className="max-h-[360px] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Photo Editor Controls */}
              <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-amber-500">
                    {lang === 'te' ? 'ఫొటో ఎడిటర్ & ఎన్హాన్సర్' : 'Photo Editor & Enhancer'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoEnhance}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'te' ? 'ఆటో ఎన్హాన్స్' : 'Auto Enhance'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdits((e) => ({ ...e, rotation: (e.rotation + 90) % 360 }))}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{lang === 'te' ? 'తిప్పండి' : 'Rotate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdits((e) => ({ ...e, flipH: !e.flipH }))}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                      <span>{lang === 'te' ? 'ఫ్లిప్' : 'Flip'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdits(DEFAULT_EDITS)}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'te' ? 'రీసెట్' : 'Reset'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'original', te: 'ఒరిజినల్', en: 'Original' },
                      { id: 'warm', te: 'వార్మ్', en: 'Warm' },
                      { id: 'vivid', te: 'వివిడ్', en: 'Vivid' },
                      { id: 'bw', te: 'B & W', en: 'B & W' },
                      { id: 'vintage', te: 'వింటేజ్', en: 'Vintage' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => applyPreset(f.id)}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                        edits.preset === f.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {lang === 'te' ? f.te : f.en}
                    </button>
                  ))}
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'బ్రైట్‌నెస్' : 'Brightness'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{edits.brightness}%</strong>
                    </span>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={edits.brightness}
                      onChange={(e) => setEdits((p) => ({ ...p, brightness: Number(e.target.value) }))}
                      className="accent-amber-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'కాంట్రాస్ట్' : 'Contrast'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{edits.contrast}%</strong>
                    </span>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={edits.contrast}
                      onChange={(e) => setEdits((p) => ({ ...p, contrast: Number(e.target.value) }))}
                      className="accent-amber-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'te' ? 'రంగు తీవ్రత' : 'Saturation'}:{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-tabular">{edits.saturation}%</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={edits.saturation}
                      onChange={(e) => setEdits((p) => ({ ...p, saturation: Number(e.target.value) }))}
                      className="accent-amber-500"
                    />
                  </label>
                </div>

                {/* Background Removal & Replacement + Sticker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-white/5 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      {lang === 'te' ? 'బ్యాక్‌గ్రౌండ్ మార్పు' : 'Background Replace'}
                    </span>
                    <select
                      value={edits.bgReplace}
                      onChange={(e) =>
                        setEdits((p) => ({ ...p, bgReplace: e.target.value as PhotoEditState['bgReplace'] }))
                      }
                      className="min-h-[38px] bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="none">Original Backdrop</option>
                      <option value="studio-dark">Indigo Studio Gradient</option>
                      <option value="sunset">Warm Sunset Gradient</option>
                      <option value="emerald">Emerald Nature</option>
                      <option value="sky">Royal Sky Blue</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      {lang === 'te' ? 'స్టిక్కర్ జోడించండి' : 'Sticker Overlay'}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {STICKER_CHOICES.map((st, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEdits((p) => ({ ...p, sticker: st }))}
                          className={`min-h-[34px] min-w-[34px] px-2 rounded-lg text-xs cursor-pointer border ${
                            edits.sticker === st
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                              : 'bg-white dark:bg-[#13161F] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {st || 'Off'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Caption + Dark BG Remove + App Logo Corner Stamp */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-slate-200 dark:border-white/5">
                  <input
                    type="text"
                    value={edits.caption}
                    onChange={(e) => setEdits((p) => ({ ...p, caption: e.target.value }))}
                    placeholder={
                      lang === 'te' ? 'ఫొటో పై శీర్షిక / టెక్స్ట్ రాయండి...' : 'Add poster title / text...'
                    }
                    className="sm:col-span-6 min-h-[38px] bg-white dark:bg-[#13161F] border border-slate-200 dark:border-white/10 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <label className="sm:col-span-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={edits.removeDarkBg}
                      onChange={(e) => setEdits((p) => ({ ...p, removeDarkBg: e.target.checked }))}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>{lang === 'te' ? 'BG తొలగించు' : 'Key Dark BG'}</span>
                  </label>
                  <label className="sm:col-span-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={edits.stampLogo}
                      onChange={(e) => setEdits((p) => ({ ...p, stampLogo: e.target.checked }))}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>{lang === 'te' ? 'App Logo' : 'App Logo'}</span>
                  </label>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {lang === 'te' ? 'AI మెరుగుపరిచిన చిత్ర Prompt' : 'Enhanced AI Visual Prompt'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{result.enhancedPrompt}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
