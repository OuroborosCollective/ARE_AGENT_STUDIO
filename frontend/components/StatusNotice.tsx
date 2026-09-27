import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type NoticeKind = 'success' | 'info' | 'warning' | 'error';

interface StatusNoticeProps {
  kind: NoticeKind;
  message: string;
  onDismiss?: () => void;
}

const tone = {
  success: { box: 'border-signal-teal/30 bg-surface-deep', text: 'text-ink-primary', icon: CheckCircle2 },
  info: { box: 'border-structural-steel bg-surface-deep', text: 'text-ink-primary', icon: Info },
  warning: { box: 'border-status-caution/40 bg-surface-deep', text: 'text-ink-primary', icon: AlertTriangle },
  error: { box: 'border-status-alert/40 bg-surface-deep', text: 'text-ink-primary', icon: XCircle },
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
            className="shrink-0 min-h-10 min-w-10 rounded-lg p-2 text-ink-quiet hover:text-ink-primary hover:bg-surface-container focus-visible:outline-none"
            aria-label="Notice schließen"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
