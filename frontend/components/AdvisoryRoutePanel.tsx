import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BrainCircuit, Cpu, LockKeyhole, RefreshCw, Route, Server, ShieldCheck } from 'lucide-react';
import type { AdvisoryRuntimeStatus } from '../types';
import { getAdvisoryRuntimeStatus } from '../services/advisoryService';

interface AdvisoryRoutePanelProps {
  onOpenTacticalMemory: () => void;
}

export const AdvisoryRoutePanel: React.FC<AdvisoryRoutePanelProps> = ({ onOpenTacticalMemory }) => {
  const [status, setStatus] = useState<AdvisoryRuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getAdvisoryRuntimeStatus());
    } catch (requestError) {
      setStatus(null);
      setError(requestError instanceof Error ? requestError.message : 'Advisory route status is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <section className="bg-cyber-card border border-cyber-border rounded-2xl p-6 overflow-hidden relative">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-purple-300 text-xs font-mono font-bold"><Route className="w-4 h-4" /> MODEL & ROUTING BOUNDARY</div>
            <h2 className="mt-2 text-2xl font-bold text-white">A policy learns. An LLM may advise.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              The active controller is the run-scoped deterministic 16→32→16→4 browser policy. It trains only on frame-bound human actions and never calls an LLM to decide or inject a device action.
            </p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh route status
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-6">
          <div className="flex items-center gap-3"><span className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300"><Cpu className="w-5 h-5" /></span><div><p className="font-mono text-[10px] font-bold tracking-wider text-cyan-300">CONTROL & LEARNING</p><h3 className="font-bold text-white">Run-scoped imitation policy</h3></div></div>
          <dl className="mt-5 space-y-3 text-xs font-mono">
            <div className="flex justify-between gap-4 border-b border-cyan-900/60 pb-3"><dt className="text-slate-400">Model</dt><dd className="text-right text-cyan-100">16→32→16→4 MLP</dd></div>
            <div className="flex justify-between gap-4 border-b border-cyan-900/60 pb-3"><dt className="text-slate-400">Training input</dt><dd className="text-right text-cyan-100">recorded frame/action pairs</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Device authority</dt><dd className="text-right text-cyan-100">separate ADB arm + receipt only</dd></div>
          </dl>
          <p className="mt-5 rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-300">Each local project run owns an independent model checkpoint. Switching a run does not carry its weights into another run.</p>
        </section>

        <section className="rounded-2xl border border-purple-500/30 bg-purple-950/10 p-6">
          <div className="flex items-center gap-3"><span className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2 text-purple-300"><BrainCircuit className="w-5 h-5" /></span><div><p className="font-mono text-[10px] font-bold tracking-wider text-purple-300">OPTIONAL ADVISORY ROUTE</p><h3 className="font-bold text-white">Server-owned OpenAI-compatible endpoint</h3></div></div>
          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-xs font-mono">
            {loading && <p className="text-slate-400">Reading configured daemon status…</p>}
            {!loading && error && <p className="text-amber-200">Status unavailable: {error}</p>}
            {!loading && !error && status && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Status</span><span className={status.enabled ? 'text-emerald-300' : 'text-slate-300'}>{status.enabled ? 'configured advisory only' : 'not configured / fail closed'}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Provider label</span><span className="truncate text-right text-purple-100">{status.providerLabel || '—'}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Model</span><span className="truncate text-right text-purple-100">{status.model || '—'}</span></div>
              </div>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-300">A manually requested analysis can propose a tactical candidate in Memory. It cannot write evidence, train the policy, or call ADB. A browser never receives or stores the provider token.</p>
          <button onClick={onOpenTacticalMemory} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-purple-500"><span>Open tactical advisory</span><ArrowRight className="w-4 h-4" /></button>
        </section>
      </div>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-6">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 w-5 h-5 shrink-0 text-emerald-300" /><div><h3 className="font-bold text-white">Admin configuration, not a browser key form</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">An operator may configure a fixed, approved OpenAI-compatible vision route on the private server — for example OpenRouter or an OmniRoute-compatible endpoint — with <code className="text-emerald-200">ADVISORY_PROVIDER_LABEL</code>, <code className="text-emerald-200">ADVISORY_API_URL</code>, <code className="text-emerald-200">ADVISORY_MODEL</code> and a server-only <code className="text-emerald-200">ADVISORY_API_TOKEN</code>. MCP is not used as the model or device-control transport; it belongs to external tool orchestration.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 text-xs">
          <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3"><ShieldCheck className="mb-2 w-4 h-4 text-emerald-300" /><strong className="block text-slate-100">Fail closed</strong><span className="mt-1 block text-slate-400">No configured route means no invented analysis.</span></div>
          <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3"><Server className="mb-2 w-4 h-4 text-emerald-300" /><strong className="block text-slate-100">Server-held secret</strong><span className="mt-1 block text-slate-400">Provider credentials never persist in a project run.</span></div>
          <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3"><Route className="mb-2 w-4 h-4 text-emerald-300" /><strong className="block text-slate-100">Candidate plane only</strong><span className="mt-1 block text-slate-400">A suggestion must still be reviewed outside the control path.</span></div>
        </div>
      </section>
    </div>
  );
};
