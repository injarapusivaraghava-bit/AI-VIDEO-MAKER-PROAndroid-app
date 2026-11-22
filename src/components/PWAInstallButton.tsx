import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LanguageMode } from '../types/studio';

interface PWAInstallButtonProps {
  lang: LanguageMode;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>{lang === 'te' ? 'యాప్ ఇన్‌స్టాల్' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[34px] px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>{lang === 'te' ? 'iPhone యాప్' : 'Install on iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#13161F] border border-white/15 p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-slate-100">
                {lang === 'te' ? 'iPhone / iPad లో ఇన్‌స్టాల్ చేయండి' : 'Install on iPhone / iPad'}
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[40px] rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                {lang === 'te' ? 'మూసివేయండి' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
