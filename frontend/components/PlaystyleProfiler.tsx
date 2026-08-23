import React, { useState } from 'react';
import { PlaystyleProfile } from '../types';
import { PLAYSTYLE_PROFILES } from '../constants';
import {
  UserCheck,
  Sliders,
  Gauge,
  Flame,
  Shield,
  Zap,
  Save,
  Activity
} from 'lucide-react';

interface PlaystyleProfilerProps {
  currentProfile: PlaystyleProfile;
  onSelectProfile: (profile: PlaystyleProfile) => void;
  onUpdateProfile: (updated: PlaystyleProfile) => void;
}

export const PlaystyleProfiler: React.FC<PlaystyleProfilerProps> = ({
  currentProfile,
  onSelectProfile,
  onUpdateProfile,
}) => {
  const [profile, setProfile] = useState<PlaystyleProfile>(currentProfile);

  const handleSave = () => {
    onUpdateProfile(profile);
    alert('Playstyle profile saved. Reaction-time cadence is applied to the agent loop; the other fields remain explicit research metadata until a measured adapter is implemented.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-mono text-xs">
              <UserCheck className="w-4 h-4" />
              <span>HUMAN BEHAVIORAL PROFILER & PERSONALIZATION ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Playstyle Profiling & Gesture Cadence Tuning
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Operator-defined behavioral research metadata. Only reaction-time cadence currently affects the live prediction loop; other fields are not presented as learned or executed behavior.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold shadow-lg shadow-purple-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Research Profile</span>
          </button>
        </div>
      </div>

      {/* Profile Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAYSTYLE_PROFILES.map((preset) => (
          <div
            key={preset.name}
            onClick={() => {
              setProfile(preset);
              onSelectProfile(preset);
            }}
            className={`p-5 rounded-2xl cursor-pointer border transition-all ${
              profile.name === preset.name
                ? 'bg-[#111726] border-purple-500 ring-2 ring-purple-500/30'
                : 'bg-cyber-card border-cyber-border hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{preset.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {preset.archetype}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Reaction Latency:</span>
                <span className="text-emerald-400 font-bold">{preset.reactionTimeMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Tolerance:</span>
                <span className="text-amber-400 font-bold">{(preset.riskTolerance * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Camera Motion:</span>
                <span className="text-cyan-300">{preset.cameraPanCadence}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fine-Tuning Sliders */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <h3 className="font-bold text-white text-base mb-6 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>Parametric Playstyle Tuning</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
          <div>
            <div className="flex justify-between text-slate-300 mb-1 font-bold">
              <span>Reaction Time Lag ({profile.reactionTimeMs} ms)</span>
              <span className="text-purple-400">Sub-Human to Reflex</span>
            </div>
            <input
              type="range"
              min={60}
              max={300}
              value={profile.reactionTimeMs}
              onChange={(e) => setProfile({ ...profile, reactionTimeMs: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Sets the prediction-loop cadence. This is a configured timing parameter, not a measured human reaction time.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1 font-bold">
              <span>Risk & Aggressiveness Curve ({(profile.riskTolerance * 100).toFixed(0)}%)</span>
              <span className="text-amber-400">Safe Kiting ↔ High Dive</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={profile.riskTolerance * 100}
              onChange={(e) => setProfile({ ...profile, riskTolerance: Number(e.target.value) / 100 })}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Research metadata for future outcome-conditioned policies. It does not currently bias the active MLP.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1 font-bold">
              <span>Touch Coordinate Jitter ({profile.tapJitterVariance * 1000} px)</span>
              <span className="text-cyan-300">Human Gaussian Noise</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={profile.tapJitterVariance * 1000}
              onChange={(e) => setProfile({ ...profile, tapJitterVariance: Number(e.target.value) / 1000 })}
              className="w-full accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Research metadata only. The active runtime does not inject random coordinate jitter.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1 font-bold">
              <span>Skill Combo Rhythm Gap ({profile.skillComboPacingMs} ms)</span>
              <span className="text-emerald-400">Finger Cadence</span>
            </div>
            <input
              type="range"
              min={20}
              max={250}
              value={profile.skillComboPacingMs}
              onChange={(e) => setProfile({ ...profile, skillComboPacingMs: Number(e.target.value) })}
              className="w-full accent-emerald-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Research metadata for a future temporal action policy; not currently applied to action execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
