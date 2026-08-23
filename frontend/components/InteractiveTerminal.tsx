import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import { globalServerGateway } from '../services/serverSyncGateway';

export const InteractiveTerminal: React.FC = () => {
  const [lines, setLines] = useState<string[]>(['ARE Agent Studio diagnostics. Type help. No shell commands are executed from this browser console.']);
  const [input, setInput] = useState('');

  const run = async (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    if (cmd === 'clear') { setLines([]); return; }
    let output = '';
    if (cmd === 'help') output = 'Commands: help, policy, dataset, bench, health, clear';
    else if (cmd === 'policy') output = `seed=${globalNeuralPolicy.seed} architecture=16→32→16→4 optimizer_steps=${globalNeuralPolicy.totalTrainedBatches}`;
    else if (cmd === 'dataset') { const c = globalServerGateway.getConfig(); output = `daemon=${c.serverHost}:${c.port} receipt_confirmed_rows=${c.totalSyncedSamples} target=${c.repoName}`; }
    else if (cmd === 'bench') {
      const features = new Array(16).fill(0.5); const n = 200; const t0 = performance.now();
      for (let i=0;i<n;i++) globalNeuralPolicy.forward(features);
      output = `measured_policy_forward_avg=${((performance.now()-t0)/n).toFixed(4)}ms runs=${n}`;
    } else if (cmd === 'health') {
      const endpoint = globalServerGateway.getEndpoint('/api/v1/health');
      try { const r = await fetch(endpoint); output = `GET ${endpoint} -> HTTP ${r.status} ${await r.text()}`; }
      catch (e) { output = `GET ${endpoint} -> unreachable: ${e instanceof Error ? e.message : 'unknown error'}`; }
    } else output = `Unknown diagnostic command: ${raw}`;
    setLines((prev) => [...prev, `> ${raw}`, output]);
  };

  return <div className="bg-[#05070b] border border-slate-800 rounded-2xl overflow-hidden font-mono text-xs">
    <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 text-emerald-400"><Terminal className="w-4 h-4" /> EVIDENCE DIAGNOSTIC CONSOLE</div>
    <div className="p-4 h-[420px] overflow-y-auto whitespace-pre-wrap text-slate-300">{lines.map((line,i)=><div key={i} className={line.startsWith('>')?'text-cyan-300':''}>{line}</div>)}</div>
    <form onSubmit={(e)=>{e.preventDefault(); const value=input; setInput(''); void run(value);}} className="border-t border-slate-800 px-4 py-3 flex gap-2"><span className="text-emerald-400">$</span><input value={input} onChange={(e)=>setInput(e.target.value)} placeholder="help" className="flex-1 bg-transparent text-slate-100 outline-none" /></form>
  </div>;
};
