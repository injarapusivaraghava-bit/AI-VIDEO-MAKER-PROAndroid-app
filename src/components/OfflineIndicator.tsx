import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { LanguageMode } from '../types/studio';

interface OfflineIndicatorProps {
  lang: LanguageMode;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {lang === 'te'
          ? 'ఆఫ్‌లైన్ మోడ్ — లోకల్ ఎడిటర్ పనిచేస్తుంది'
          : 'Offline Mode — Local editor remains available'}
      </span>
    </div>
  );
};
