import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type NoticeKind = 'success' | 'info' | 'warning' | 'error';

interface StatusNoticeProps {
  kind: NoticeKind;
  message: string;
  onDismiss?: () => void;
}

const tone = {
  success: { box: 'border-emerald-800/60 bg-emerald-950/25', text: 'text-emerald-100', icon: CheckCircle2 },
  info: { box: 'border-cyan-800/60 bg-cyan-950/25', text: 'text-cyan-100', icon: Info },
  warning: { box: 'border-amber-800/60 bg-amber-950/25', text: 'text-amber-100', icon: AlertTriangle },
  error: { box: 'border-red-800/60 bg-red-950/25', text: 'text-red-100', icon: XCircle },
} as const;

export const StatusNotice: React.FC<StatusNoticeProps> = ({ kind, message, onDismiss }) => {
  const config = tone[kind];
  const Icon = config.icon;
  const isError = kind === 'error';

  return (
    <div
      className={`min-h-12 rounded-xl border px-3 py-2.5 ${config.box} ${config.text}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs sm:text-sm leading-5 flex-1">{message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-black/20 focus-visible:outline-none"
            aria-label="Notice schließen"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
