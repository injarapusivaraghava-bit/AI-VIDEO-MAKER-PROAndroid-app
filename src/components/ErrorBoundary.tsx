import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Studio ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          displayMsg = `Cloud Sync (${parsed.operationType} · ${parsed.path || 'firestore'}): ${parsed.error}`;
        }
      } catch {
        // Non-JSON message
      }

      return (
        <div className="min-h-screen bg-[#0B0D12] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#13161F] border border-rose-500/30 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold">AI VIDEO MAKER PRO — Error</h1>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed break-words">{displayMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer self-start"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Studio</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
