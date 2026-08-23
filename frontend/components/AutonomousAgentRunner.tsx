import React from 'react';
import type { AgentPrediction, DeviceConfig } from '../types';
import { Zap, ShieldAlert, Crosshair, Play, Square, Radio, LockKeyhole, Smartphone } from 'lucide-react';

interface AutonomousAgentRunnerProps {
  isAgentRunning: boolean;
  onToggleAgent: () => void;
  prediction: AgentPrediction | null;
  device: DeviceConfig;
  onUpdateDevice: (patch: Partial<DeviceConfig>) => void;
  gamePhase: string;
  actionBridgeArmed: boolean;
  onToggleActionBridge: () => void;
  injectionStatus: string | null;
}

export const AutonomousAgentRunner: React.FC<AutonomousAgentRunnerProps> = ({
  isAgentRunning, onToggleAgent, prediction, device, onUpdateDevice, gamePhase,
  actionBridgeArmed, onToggleActionBridge, injectionStatus,
}) => {
  const canArm = Boolean(device.connected && device.serial);
  return (
    <div className="space-y-6">
      <div className={`border rounded-2xl p-6 transition-all ${isAgentRunning ? 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-[#0c101c] border-amber-500/50' : 'bg-cyber-card border-cyber-border'}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-amber-400"><Zap className="w-4 h-4" /> POLICY INFERENCE + OPT-IN ADB OUTPUT</div>
            <h2 className="text-xl font-bold text-white mt-1">Autonomous Agent Control Loop</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">Prediction can run without device output. Android taps are sent only while the separate ADB output arm is enabled and the backend acknowledges them.</p>
          </div>
          <button onClick={onToggleAgent} className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-mono text-xs font-bold ${isAgentRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
            {isAgentRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isAgentRunning ? 'STOP POLICY LOOP (ESC)' : 'START POLICY LOOP'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <Metric label="POLICY LOOP" value={isAgentRunning ? 'RUNNING' : 'STANDBY'} />
          <Metric label="MEASURED FORWARD LATENCY" value={prediction ? `${prediction.latencyMs.toFixed(3)} ms` : 'not measured'} />
          <Metric label="TOUCH PROBABILITY" value={prediction ? `${(prediction.confidence * 100).toFixed(1)}%` : 'not measured'} />
          <Metric label="GAME PHASE" value={gamePhase} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2"><Crosshair className="w-4 h-4 text-amber-400" /> Current policy output</h3>
          <div className="space-y-3 text-xs font-mono">
            <Row label="Normalized target" value={prediction ? `[${prediction.targetX.toFixed(4)}, ${prediction.targetY.toFixed(4)}]` : 'no prediction'} />
            <Row label="Mapped pixel" value={prediction && device.resolutionWidth > 0 ? `${Math.round(prediction.targetX * device.resolutionWidth)} × ${Math.round(prediction.targetY * device.resolutionHeight)}` : 'device not configured'} />
            <Row label="Touch decision" value={prediction ? (prediction.isTouch ? 'TOUCH' : 'IDLE') : 'no prediction'} />
            <Row label="Policy" value="Seeded MLP 16→32→16→4" />
          </div>
        </div>

        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2"><Smartphone className="w-4 h-4 text-cyan-400" /> Android output target</h3>
          <div className="space-y-3 text-xs font-mono">
            <label className="block"><span className="text-slate-400 block mb-1">ADB SERIAL</span><input value={device.serial} onChange={(e) => onUpdateDevice({ serial: e.target.value })} placeholder="adb device serial" className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="text-slate-400 block mb-1">WIDTH</span><input type="number" value={device.resolutionWidth} onChange={(e) => onUpdateDevice({ resolutionWidth: Number(e.target.value) })} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2" /></label>
              <label><span className="text-slate-400 block mb-1">HEIGHT</span><input type="number" value={device.resolutionHeight} onChange={(e) => onUpdateDevice({ resolutionHeight: Number(e.target.value) })} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2" /></label>
            </div>
            <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={device.connected} onChange={(e) => onUpdateDevice({ connected: e.target.checked })} /> Treat this serial as the intended local target</label>
            <button disabled={!canArm} onClick={onToggleActionBridge} className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold ${actionBridgeArmed ? 'bg-red-600 text-white' : canArm ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
              {actionBridgeArmed ? <Radio className="w-4 h-4" /> : <LockKeyhole className="w-4 h-4" />}
              {actionBridgeArmed ? 'DISARM ADB OUTPUT' : 'ARM ADB OUTPUT'}
            </button>
            <p className={actionBridgeArmed ? 'text-amber-300' : 'text-slate-500'}>{injectionStatus || (actionBridgeArmed ? 'Armed; waiting for a touch prediction and backend acknowledgement.' : 'Prediction-only mode. No Android actions will be emitted.')}</p>
          </div>
        </div>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2 text-red-400"><ShieldAlert className="w-4 h-4" /> Execution safeguards</h3>
        <ul className="space-y-2 text-xs font-mono text-slate-400">
          <li>• Human pointer input stops the policy loop and disarms ADB output.</li>
          <li>• ESC stops the policy loop and disarms ADB output.</li>
          <li>• ADB output is a separate explicit arm; the backend bridge is disabled by default.</li>
          <li>• Predictions below 35% touch probability are not emitted to the device bridge.</li>
          <li>• Backend device serials are syntax-checked and can be allowlisted.</li>
        </ul>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="bg-[#0c101c] p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-400 font-mono block">{label}</span><span className="text-sm font-bold font-mono text-cyan-300 mt-1 block">{value}</span></div>;
const Row = ({ label, value }: { label: string; value: string }) => <div className="p-3 bg-[#0c101c] rounded-xl border border-slate-800 flex items-center justify-between gap-4"><span className="text-slate-400">{label}</span><span className="text-slate-200 font-bold text-right">{value}</span></div>;
