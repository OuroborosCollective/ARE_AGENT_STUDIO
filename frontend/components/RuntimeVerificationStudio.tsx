import React, { useState, useEffect } from 'react';
import { TestCaseResult } from '../types';
import { globalVerificationSuite } from '../services/runtimeVerification';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Play,
  RefreshCw,
  Activity,
  Cpu,
  Layers,
  Terminal,
  Check,
  Zap,
  Gauge
} from 'lucide-react';

export const RuntimeVerificationStudio: React.FC = () => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');

  const runAllTests = async () => {
    setIsRunning(true);
    try {
      const results = await globalVerificationSuite.runFullSuite();
      setTestResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const totalPassed = testResults.filter((t) => t.status === 'PASSED').length;
  const passRate = testResults.length > 0 ? (totalPassed / testResults.length) * 100 : 0;

  const liveReadback = testResults.find((t) => t.category === 'RUNTIME_READBACK');
  const latencyResult = testResults.find((t) => t.category === 'LATENCY_SLA');

  const filteredTests = testResults.filter((t) => {
    if (activeTab === 'PASSED') return t.status === 'PASSED';
    if (activeTab === 'FAILED') return t.status === 'FAILED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>DETERMINISTIC RUNTIME & REGRESSION VERIFICATION SUITE</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Automated Integrity & Pipeline Verification
            </h2>
            <p className="text-xs text-slate-400 font-mono max-w-2xl mt-1">
              Runs isolated deterministic regression fixtures plus a separate live dataset-daemon health readback. Fixture success is never presented as device/runtime evidence.
            </p>
          </div>

          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-lg ${
              isRunning
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'RUNNING ASSERTIONS...' : 'EXECUTE FULL TEST SUITE'}</span>
          </button>
        </div>

        {/* Realtime Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">SUITE PASS RATE</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {passRate.toFixed(1)}% <span className="text-xs text-slate-500 font-normal">({totalPassed}/{testResults.length})</span>
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">TRAINED WEIGHT BATCHES</span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {globalNeuralPolicy.totalTrainedBatches} <span className="text-xs text-slate-500 font-normal">steps</span>
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">LIVE DAEMON READBACK</span>
            <span className={`text-sm font-bold font-mono mt-1 block ${liveReadback?.status === 'PASSED' ? 'text-teal-400' : 'text-red-400'}`}>
              {liveReadback ? (liveReadback.status === 'PASSED' ? '● VERIFIED' : '● NOT VERIFIED') : 'pending'}
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">INFERENCE SLA STATUS</span>
            <span className="text-sm font-bold font-mono text-purple-400 mt-1 block">
              {latencyResult ? (latencyResult.status === 'PASSED' ? '● MEASURED PASS' : '● MEASURED FAIL') : 'not measured'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Test List */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Test Case Assertions & Regression Results</h3>
          </div>

          <div className="flex gap-1 bg-[#0c101c] p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-md transition-all ${activeTab === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
            >
              All ({testResults.length})
            </button>
            <button
              onClick={() => setActiveTab('PASSED')}
              className={`px-3 py-1 rounded-md transition-all ${activeTab === 'PASSED' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'}`}
            >
              Passed ({totalPassed})
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              className="p-4 rounded-xl bg-[#0c101c] border border-slate-800/80 hover:border-slate-700 transition-all font-mono text-xs"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                      {test.id}
                    </span>
                    <span className="font-bold text-white text-sm">{test.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {test.category}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs mt-1">{test.details}</p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 ${
                      test.status === 'PASSED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {test.status === 'PASSED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{test.status}</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {test.assertionsPassed}/{test.assertionsTotal} assertions • {test.durationMs}ms
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
