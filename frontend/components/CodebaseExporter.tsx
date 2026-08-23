import React, { useMemo, useState } from 'react';
import { FileCode2, Copy, Check, FolderTree, ShieldCheck, Database, Smartphone, BrainCircuit } from 'lucide-react';

const SURFACES = [
  {
    path: 'frontend/services/neuralPolicyEngine.ts',
    status: 'active',
    description: 'Seeded 16→32→16→4 browser MLP. Trains only on captured frame/action pairs.',
    boundary: 'Policy output is a prediction. It is not device execution evidence.',
  },
  {
    path: 'frontend/services/datasetCodec.ts',
    status: 'active',
    description: 'Serializes complete observed frame/action pairs into are-agent-vla.v1 rows.',
    boundary: 'Never fabricates future action chunks or truncates frame payloads.',
  },
  {
    path: 'backend/src/datasetStore.js',
    status: 'active',
    description: 'Append-only content-addressed JSONL ledger with deduplication and SHA-256 receipts.',
    boundary: 'A row counts as synchronized only after a daemon receipt.',
  },
  {
    path: 'backend/src/adbBridge.js',
    status: 'opt-in',
    description: 'ADB tap output through fixed execFile arguments and optional serial allowlist.',
    boundary: 'Disabled by default; real Android execution requires backend acknowledgement.',
  },
  {
    path: 'scripts/prepare_hf_dataset.py',
    status: 'offline publisher',
    description: 'Transforms the verified local ledger into Hugging Face dataset artifacts.',
    boundary: 'Preparation is not a Hub upload; publishing is a separate explicit action.',
  },
];

export const CodebaseExporter: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = SURFACES[selected];
  const manifest = useMemo(() => JSON.stringify({
    project: 'ARE Agent Studio',
    truth_model: 'observation -> action -> receipt -> dataset',
    surfaces: SURFACES,
  }, null, 2), []);

  const copyManifest = async () => {
    await navigator.clipboard.writeText(manifest);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
          <div>
            <div className="text-emerald-400 font-mono text-xs">ACTIVE REPOSITORY SURFACE INVENTORY</div>
            <h2 className="text-xl font-bold text-white mt-1">Truth-bound code map</h2>
            <p className="text-xs text-slate-400 font-mono max-w-3xl mt-1">
              This view describes code that actually exists in the repository. It no longer exports aspirational Python files as if they were the running production stack.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-2 py-1 mb-2 border-b border-slate-800"><FolderTree className="w-3.5 h-3.5 text-emerald-400" /> VERIFIED SURFACES</div>
          {SURFACES.map((surface, idx) => (
            <button key={surface.path} onClick={() => setSelected(idx)} className={`w-full text-left px-3 py-2.5 rounded-xl font-mono text-xs transition-all ${selected === idx ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800/60'}`}>
              <div className="flex items-center gap-2"><FileCode2 className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{surface.path}</span></div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 bg-[#0a0d14] border border-cyber-border rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-400">{active.path}</span>
              <h3 className="text-white font-bold mt-1">{active.description}</h3>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-slate-800 text-cyan-300">{active.status}</span>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs font-mono text-amber-200">Truth boundary: {active.boundary}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl border border-slate-800 bg-[#0c101c]"><BrainCircuit className="w-4 h-4 text-purple-400 mb-2" />Policy = prediction</div>
            <div className="p-3 rounded-xl border border-slate-800 bg-[#0c101c]"><Database className="w-4 h-4 text-emerald-400 mb-2" />Receipt = persisted dataset evidence</div>
            <div className="p-3 rounded-xl border border-slate-800 bg-[#0c101c]"><Smartphone className="w-4 h-4 text-cyan-400 mb-2" />ADB ack = emitted device action</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-mono text-slate-400">MACHINE-READABLE ARCHITECTURE MANIFEST</span><button onClick={copyManifest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button></div>
            <pre className="max-h-[340px] overflow-auto p-4 rounded-xl border border-slate-800 bg-[#07090e] text-[11px] text-slate-300"><code>{manifest}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
};
