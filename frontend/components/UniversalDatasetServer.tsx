import React, { useMemo, useState } from 'react';
import type { DatasetReceipt, FrameTelemetry, ServerSyncConfig, TacticalRule } from '../types';
import { globalServerGateway } from '../services/serverSyncGateway';
import { telemetryToDatasetRows } from '../services/datasetCodec';
import { Server, Cloud, Download, UploadCloud, Layers, Copy, Check, ShieldCheck, AlertTriangle } from 'lucide-react';

interface UniversalDatasetServerProps {
  telemetries: FrameTelemetry[];
  rules: TacticalRule[];
  deviceModel: string;
}

export const UniversalDatasetServer: React.FC<UniversalDatasetServerProps> = ({ telemetries, rules, deviceModel }) => {
  const [config, setConfig] = useState<ServerSyncConfig>(globalServerGateway.getConfig());
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<DatasetReceipt | null>(null);

  const rows = useMemo(() => telemetryToDatasetRows(telemetries, rules, deviceModel), [telemetries, rules, deviceModel]);
  const jsonlOutput = rows.map((row) => JSON.stringify(row)).join('\n');

  const handlePushToServer = async () => {
    setIsSyncing(true);
    setSyncStatus({ ok: true, text: 'Submitting observed pairs to the local evidence-bound dataset daemon…' });
    const result = await globalServerGateway.pushBatchToServer(telemetries, rules, deviceModel);
    setIsSyncing(false);
    setConfig(globalServerGateway.getConfig());
    if (result.success && result.receipt) {
      setLastReceipt(result.receipt);
      setSyncStatus({ ok: true, text: `Daemon accepted ${result.rowsUploaded} new rows; ${result.duplicateRows} duplicates were not re-counted.` });
    } else {
      setLastReceipt(null);
      setSyncStatus({ ok: false, text: `Sync not verified: ${result.error || 'dataset daemon did not return a receipt'}` });
    }
  };

  const handleDownloadDataset = () => {
    if (!jsonlOutput) return;
    const blob = new Blob([jsonlOutput], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `are_agent_vla_dataset_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSONL = async () => {
    if (!jsonlOutput) return;
    await navigator.clipboard.writeText(jsonlOutput);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel border border-emerald-500/30 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs"><Server className="w-4 h-4" /> EVIDENCE-BOUND VLA DATASET GATEWAY</div>
            <h2 className="text-xl font-bold text-white mt-1">Human Demonstration & DAgger Dataset Builder</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-1 font-mono">
              Only complete frame/action pairs become rows. The local daemon content-addresses them, deduplicates them and returns a SHA-256 receipt before the UI counts them as synchronized.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handlePushToServer} disabled={isSyncing || rows.length === 0} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-mono text-xs font-bold ${isSyncing ? 'bg-amber-600 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40'}`}>
              <UploadCloud className="w-4 h-4" /> {isSyncing ? 'AWAITING RECEIPT…' : 'COMMIT DATASET BATCH'}
            </button>
            <button onClick={handleDownloadDataset} disabled={!jsonlOutput} className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono disabled:opacity-40"><Download className="w-4 h-4" /> Export JSONL</button>
          </div>
        </div>

        {syncStatus && (
          <div className={`mt-4 p-3 rounded-xl border font-mono text-xs flex items-center gap-2 ${syncStatus.ok ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-red-950/50 border-red-500/40 text-red-300'}`}>
            {syncStatus.ok ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{syncStatus.text}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="signal-metric p-3 rounded-xl"><span className="text-[10px] text-slate-400 font-mono block">CLIENT NODE</span><span className="text-xs font-bold font-mono text-emerald-400 truncate block mt-1">{globalServerGateway.getClientUUID()}</span></div>
          <div className="signal-metric p-3 rounded-xl"><span className="text-[10px] text-slate-400 font-mono block">RECEIPT-CONFIRMED ROWS</span><span className="text-xl font-bold font-mono text-cyan-400">{config.totalSyncedSamples}</span><span className="text-[10px] text-slate-500 block">{rows.length} locally eligible</span></div>
          <div className="signal-metric p-3 rounded-xl"><span className="text-[10px] text-slate-400 font-mono block">INTENDED HUB TARGET</span><span className="text-xs font-bold font-mono text-purple-400 truncate block mt-1">{config.targetRepository} / {config.repoName}</span></div>
          <div className="signal-metric p-3 rounded-xl"><span className="text-[10px] text-slate-400 font-mono block">LAST LEDGER HASH</span><span className="text-[10px] font-bold font-mono text-teal-400 mt-1 block truncate">{lastReceipt?.ledger_sha256 || 'no receipt yet'}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 h-fit space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2"><Cloud className="w-4 h-4 text-cyan-400" /> Dataset Daemon & Publish Metadata</h3>
          <div className="space-y-3 text-xs font-mono">
            <div><label className="text-slate-400 block mb-1">DAEMON HOST</label><input value={config.serverHost} onChange={(e) => { const updated = { ...config, serverHost: e.target.value }; setConfig(updated); globalServerGateway.updateConfig(updated); }} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></div>
            <div><label className="text-slate-400 block mb-1">PORT (0 = SAME ORIGIN)</label><input type="number" min="0" value={config.port} onChange={(e) => { const updated = { ...config, port: Number(e.target.value) }; setConfig(updated); globalServerGateway.updateConfig(updated); }} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></div>
            <div><label className="text-slate-400 block mb-1">AUTH TOKEN (OPTIONAL LOCAL GATE)</label><input type="password" value={config.authToken} onChange={(e) => { const updated = { ...config, authToken: e.target.value }; setConfig(updated); globalServerGateway.updateConfig(updated); }} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></div>
            <div><label className="text-slate-400 block mb-1">HUGGING FACE DATASET REPO</label><input value={config.repoName} onChange={(e) => { const updated = { ...config, repoName: e.target.value }; setConfig(updated); globalServerGateway.updateConfig(updated); }} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></div>
            <p className="text-[10px] leading-relaxed text-slate-500">The daemon writes an append-only local ledger. Hugging Face publishing is a separate explicit step so a local write is never mislabeled as a Hub upload.</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-white text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Live `are-agent-vla.v1` JSONL</h3><button onClick={handleCopyJSONL} disabled={!jsonlOutput} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-40">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy JSONL'}</button></div>
          <div className="bg-[#07090e] border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[420px] text-xs font-mono text-emerald-400"><pre><code>{jsonlOutput || '// Record a real frame + human touch pair to create the first dataset row.'}</code></pre></div>
        </div>
      </div>
    </div>
  );
};
