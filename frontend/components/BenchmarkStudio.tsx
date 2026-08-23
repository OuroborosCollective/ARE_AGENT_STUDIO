import React, { useState } from 'react';
import type { DeviceConfig } from '../types';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import { Activity, Smartphone, Gauge, RefreshCw, AlertTriangle } from 'lucide-react';

interface BenchmarkStudioProps { device: DeviceConfig; }

export const BenchmarkStudio: React.FC<BenchmarkStudioProps> = ({ device }) => {
  const [result, setResult] = useState<{ avg: number; p95: number; runs: number } | null>(null);
  const runBenchmark = () => {
    const features = new Array(16).fill(0.5);
    const samples: number[] = [];
    for (let i = 0; i < 500; i++) {
      const t0 = performance.now();
      globalNeuralPolicy.forward(features);
      samples.push(performance.now() - t0);
    }
    const sorted = [...samples].sort((a,b) => a-b);
    setResult({ avg: samples.reduce((a,b) => a+b,0) / samples.length, p95: sorted[Math.floor(sorted.length * 0.95)], runs: samples.length });
  };
  return (
    <div className="space-y-6">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div><div className="flex items-center gap-2 text-blue-400 font-mono text-xs"><Gauge className="w-4 h-4" /> MEASURED LOCAL POLICY BENCHMARK</div><h2 className="text-xl font-bold text-white mt-1">Runtime Performance Diagnostics</h2><p className="text-xs text-slate-400 font-mono mt-1">Only the in-browser policy stage is measured here. Capture, transport and ADB latency remain unverified until a real device path reports them.</p></div>
          <button onClick={runBenchmark} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold"><RefreshCw className="w-4 h-4" /> Run 500 forwards</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="POLICY AVG" value={result ? `${result.avg.toFixed(4)} ms` : 'not measured'} />
        <Card label="POLICY P95" value={result ? `${result.p95.toFixed(4)} ms` : 'not measured'} />
        <Card label="ADB / CAPTURE E2E" value="not measured" />
      </div>
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2"><Smartphone className="w-4 h-4 text-cyan-400" /> Intended Android target</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <Card label="SERIAL" value={device.serial || 'unconfigured'} />
          <Card label="RESOLUTION" value={device.resolutionWidth && device.resolutionHeight ? `${device.resolutionWidth}×${device.resolutionHeight}` : 'unconfigured'} />
          <Card label="CONNECTED FLAG" value={device.connected ? 'configured by user' : 'false'} />
          <Card label="PROTOCOL" value={device.connectionProtocol || 'unconfigured'} />
        </div>
        <div className="mt-4 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> A configured flag is not device evidence. Real Android execution is proven only by a successful backend ADB acknowledgement.</div>
      </div>
    </div>
  );
};
const Card = ({ label, value }: { label: string; value: string }) => <div className="bg-[#0c101c] p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-400 font-mono block">{label}</span><span className="text-sm font-bold font-mono text-white mt-1 block break-all">{value}</span></div>;
