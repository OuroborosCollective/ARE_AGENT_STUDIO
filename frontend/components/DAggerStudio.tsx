import React, { useState } from 'react';
import { DAggerIntervention } from '../types';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import {
  ShieldAlert,
  GitPullRequest,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  TrendingDown,
  Crosshair,
  ArrowRight,
  Zap,
  Activity
} from 'lucide-react';

interface DAggerStudioProps {
  interventions: DAggerIntervention[];
  onTriggerFineTune: () => void;
  isFineTuning: boolean;
  correctionSampleCount: number;
}

export const DAggerStudio: React.FC<DAggerStudioProps> = ({
  interventions,
  onTriggerFineTune,
  isFineTuning,
  correctionSampleCount,
}) => {
  const [selectedIntervention, setSelectedIntervention] = useState<DAggerIntervention | null>(
    interventions[0] || null
  );

  const averageGap = interventions.length ? interventions.reduce((sum, item) => sum + item.lossDelta, 0) / interventions.length : null;
  const maxGap = interventions.length ? Math.max(...interventions.map((item) => item.lossDelta)) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950/40 via-amber-950/30 to-[#0c101c] border border-red-500/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>DAGGER (DATASET AGGREGATION) ACTIVE LEARNING ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Distribution Shift & Failure Recovery Studio
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-1 font-mono">
              Human takeover records the policy/human divergence. Only corrections that also have a bound frame feature vector are eligible for policy fine-tuning; intervention cards alone are not training evidence.
            </p>
          </div>

          <button
            onClick={onTriggerFineTune}
            disabled={isFineTuning || correctionSampleCount === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-xs font-bold transition-all shadow-lg flex-shrink-0 ${
              isFineTuning
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-500/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isFineTuning ? 'animate-spin' : ''}`} />
            <span>{isFineTuning ? 'UPDATING NEURAL WEIGHTS...' : 'RUN ONLINE DAGGER FINE-TUNE'}</span>
          </button>
        </div>

        {/* Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">LOGGED INTERVENTIONS</span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {interventions.length} <span className="text-xs text-slate-500 font-normal">events</span>
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">AVG DISTRIBUTION GAP</span>
            <span className="text-xl font-bold font-mono text-red-400">
              {averageGap == null ? '—' : `Δ ${averageGap.toFixed(4)}`} <span className="text-xs text-slate-500 font-normal">coord distance</span>
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">FRAME-BOUND CORRECTIONS</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {correctionSampleCount} <span className="text-xs text-slate-500 font-normal">trainable</span>
            </span>
          </div>

          <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">MAX OBSERVED GAP</span>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {maxGap == null ? '—' : maxGap.toFixed(4)} <span className="text-xs text-slate-500 font-normal">coord distance</span>
            </span>
          </div>
        </div>
      </div>

      {/* Interventions Ledger & Visual Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List of Interventions */}
        <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-6">
          <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-amber-400" />
            <span>Human Takeover & Trajectory Divergence Ledger</span>
          </h3>

          <div className="space-y-3">
            {interventions.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedIntervention(item)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedIntervention?.id === item.id
                    ? 'bg-[#0f172a] border-amber-500 ring-1 ring-amber-500/30'
                    : 'bg-[#0c101c] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] font-bold border border-red-500/30">
                      {item.id}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-semibold">
                      Human Override Triggered ({item.gamePhase})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Resolved
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-2 font-mono">
                  {item.notes}
                </p>

                <div className="mt-3 flex items-center gap-4 text-xs font-mono">
                  <div className="text-red-400">
                    Agent Error: [{item.agentPredictedAction[0].toFixed(2)}, {item.agentPredictedAction[1].toFixed(2)}]
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <div className="text-emerald-400 font-bold">
                    Human Target: [{item.humanCorrectedAction[0].toFixed(2)}, {item.humanCorrectedAction[1].toFixed(2)}]
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Intervention Inspector Box */}
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 h-fit">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2 text-amber-400">
            <Crosshair className="w-4 h-4" />
            <span>Trajectory Correction Delta</span>
          </h3>

          {selectedIntervention ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-slate-500 block text-[10px]">EVENT ID</span>
                <span className="text-white font-bold">{selectedIntervention.id}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ERROR MAGNITUDE (LOSS DELTA)</span>
                <span className="text-red-400 font-bold text-sm">
                  {selectedIntervention.lossDelta.toFixed(4)} MSE
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-slate-500 block text-[10px]">RECOVERY ACTION DESCRIPTION</span>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  {selectedIntervention.notes}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                <span className="font-bold block mb-1">Training boundary:</span>
                A correction may update the policy only when the captured human action is bound to the corresponding observed frame feature vector.
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-mono">Select an intervention to inspect divergence.</p>
          )}
        </div>
      </div>
    </div>
  );
};
