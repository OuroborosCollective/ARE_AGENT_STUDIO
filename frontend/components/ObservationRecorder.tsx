import React, { useState } from 'react';
import { FrameTelemetry, TouchAction, TouchEventType } from '../types';
import {
  Radio,
  Download,
  Trash2,
  Layers,
  Sparkles,
  Clock,
  CheckCircle2,
  Activity,
  Maximize2
} from 'lucide-react';

interface ObservationRecorderProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  recordedTelemetries: FrameTelemetry[];
  onClearTelemetry: () => void;
  latestAction: TouchAction | null;
  onSynthesizePlaybook: () => void;
  isSynthesizing: boolean;
  publicationAllowed: boolean;
  onPublicationAllowedChange: (allowed: boolean) => void;
  gamePhase: string;
  onGamePhaseChange: (phase: string) => void;
  projectName: string | null;
  runName: string | null;
  sessionId: string | null;
}

export const ObservationRecorder: React.FC<ObservationRecorderProps> = ({
  isRecording,
  onToggleRecording,
  recordedTelemetries,
  onClearTelemetry,
  latestAction,
  onSynthesizePlaybook,
  isSynthesizing,
  publicationAllowed,
  onPublicationAllowedChange,
  gamePhase,
  onGamePhaseChange,
  projectName,
  runName,
  sessionId,
}) => {
  const [selectedFrame, setSelectedFrame] = useState<FrameTelemetry | null>(null);

  const timing = React.useMemo(() => {
    if (recordedTelemetries.length < 3) return null;
    const recent = recordedTelemetries.slice(-60);
    const deltas = recent.slice(1).map((item, idx) => item.timestamp - recent[idx].timestamp).filter((d) => d > 0);
    if (!deltas.length) return null;
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
    return { hz: 1000 / mean, jitterMs: Math.sqrt(variance) };
  }, [recordedTelemetries]);

  const handleExportJSONL = () => {
    if (recordedTelemetries.length === 0) return;
    const lines = recordedTelemetries.map((t) =>
      JSON.stringify({
        frame_id: t.frameId,
        timestamp: t.timestamp,
        game_state: t.gameState,
        action: t.action
          ? [t.action.x, t.action.y, t.action.pressure, t.action.type === TouchEventType.UP ? 0 : 1]
          : null,
      })
    );
    const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `actions_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Recording Controls */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Live Human Observation & Telemetry Logger
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Records frame/touch pairs from observed browser capture timestamps; timing stats are derived from recorded samples
                </p>
                <p className="mt-1 text-[10px] font-mono text-cyan-300">
                  {projectName && runName ? `LOCAL PROJECT: ${projectName} / ${runName} · session ${sessionId?.replace(/^session-/, '').slice(0, 8) || 'pending'}` : 'NO LOCAL PROJECT RUN SELECTED — recording is blocked'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleRecording}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-lg ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-red-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-emerald-300 animate-ping'}`} />
              <span>{isRecording ? 'STOP LOGGING' : 'START RECORDING PLAYBOOK'}</span>
            </button>

            <button
              onClick={handleExportJSONL}
              disabled={recordedTelemetries.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSONL</span>
            </button>

            <button
              onClick={onSynthesizePlaybook}
              disabled={recordedTelemetries.length === 0 || isSynthesizing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-mono shadow-md disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
              <span>{isSynthesizing ? 'Synthesizing...' : 'AI Synthesize Playbook'}</span>
            </button>

            <button
              onClick={onClearTelemetry}
              disabled={recordedTelemetries.length === 0}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 text-xs disabled:opacity-40"
              title="Clear dataset buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs font-mono text-amber-100">
            <input type="checkbox" className="mt-0.5" checked={publicationAllowed} onChange={(e) => onPublicationAllowedChange(e.target.checked)} />
            <span><strong>PUBLIC DATASET ELIGIBILITY:</strong> mark newly recorded samples as eligible for public Hugging Face preparation only when you have the right to publish the captured frames. Default is off; local training/ledger collection still works.</span>
          </label>
          <label className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/10 text-xs font-mono text-cyan-100">
            <span className="block text-[10px] uppercase tracking-wider text-cyan-400 mb-2">Operator phase label</span>
            <select
              value={gamePhase}
              onChange={(e) => onGamePhaseChange(e.target.value)}
              className="w-full rounded-lg border border-cyan-900 bg-slate-950 px-3 py-2 text-xs text-cyan-100 outline-none"
            >
              {['COMBAT', 'FARMING', 'RETREAT', 'MENU', 'BOSS_FIGHT', 'POSITIONING', 'EXPLORATION'].map((phase) => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
            <span className="mt-2 block text-[10px] leading-relaxed text-slate-400">Explicit human label; never inferred from unverified HUD heuristics.</span>
          </label>
        </div>

        {/* Realtime Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="signal-metric p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 font-mono block">BUFFERED SAMPLES</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {recordedTelemetries.length} <span className="text-xs text-slate-500 font-normal">frames</span>
            </span>
          </div>

          <div className="signal-metric p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 font-mono block">LATEST TOUCH VECTOR</span>
            <span className="text-xs font-mono text-cyan-300 truncate block mt-1">
              {latestAction
                ? `(${latestAction.x.toFixed(2)}, ${latestAction.y.toFixed(2)}) • ${latestAction.type.replace('TOUCH_', '')}`
                : 'IDLE (No Touch)'}
            </span>
          </div>

          <div className="signal-metric p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 font-mono block">STREAM SYNC JITTER</span>
            <span className="text-xl font-bold font-mono text-teal-400">
              {timing ? timing.jitterMs.toFixed(1) : '—'} <span className="text-xs text-slate-500 font-normal">ms</span>
            </span>
          </div>

          <div className="signal-metric p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 font-mono block">SAMPLING FREQUENCY</span>
            <span className="text-xl font-bold font-mono text-purple-400">
              {timing ? timing.hz.toFixed(1) : '—'} <span className="text-xs text-slate-500 font-normal">Hz</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dataset Sequence Carousel & Inspector */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Synchronized Paired Frame Ledger</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing latest {Math.min(12, recordedTelemetries.length)} steps
          </span>
        </div>

        {recordedTelemetries.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
            <p className="text-sm text-slate-400">No frames logged yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Start Recording Playbook&quot; and interact with the game screen to stream paired telemetry.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {recordedTelemetries.slice(-12).map((item) => (
              <div
                key={item.frameId}
                onClick={() => setSelectedFrame(item)}
                className={`group cursor-pointer rounded-xl bg-slate-900 border p-2 transition-all hover:scale-105 ${
                  selectedFrame?.frameId === item.frameId
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden">
                  <img
                    src={item.imageDataUrl}
                    alt={`Frame ${item.frameId}`}
                    className="w-full h-full object-cover"
                  />
                  {item.action && (
                    <div
                      style={{
                        left: `${item.action.x * 100}%`,
                        top: `${item.action.y * 100}%`,
                      }}
                      className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 ring-2 ring-white"
                    />
                  )}
                  <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-black/80 text-emerald-300 px-1 rounded">
                    #{item.frameId}
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">
                  {item.action
                    ? `TAP (${item.action.x.toFixed(2)}, ${item.action.y.toFixed(2)})`
                    : 'IDLE'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Frame Inspector Modal / Detail */}
        {selectedFrame && (
          <div className="glass-panel mt-6 p-4 rounded-xl border flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 aspect-[9/16] rounded-lg overflow-hidden border border-slate-700 flex-shrink-0">
              <img
                src={selectedFrame.imageDataUrl}
                alt="Selected inspect"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  FRAME INSPECTION: #{selectedFrame.frameId}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(selectedFrame.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">GAME STATE</span>
                  <span className="text-slate-200 font-bold">{selectedFrame.gameState}</span>
                </div>

                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">COORDINATES</span>
                  <span className="text-cyan-300">
                    {selectedFrame.action
                      ? `[${selectedFrame.action.x.toFixed(4)}, ${selectedFrame.action.y.toFixed(4)}]`
                      : '[0.0000, 0.0000]'}
                  </span>
                </div>

                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">ESTIMATED HP</span>
                  <span className="text-emerald-400 font-bold">{selectedFrame.hpPercentage}%</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 italic">
                {selectedFrame.tacticalNote || 'Standard gameplay traversal step synced with touch input.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
