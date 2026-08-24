import React from 'react';
import {
  SystemMode,
  DeviceConfig,
  GameArchetype
} from '../types';
import {
  Radio,
  Cpu,
  Brain,
  Zap,
  Activity,
  FileCode2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  GitPullRequest,
  UserCheck,
  Terminal,
  Gamepad2,
  Server,
  ShieldCheck,
  FolderKanban,
  Route,
} from 'lucide-react';

interface NavbarProps {
  activeMode: SystemMode;
  onSelectMode: (mode: SystemMode) => void;
  device: DeviceConfig;
  isAgentRunning: boolean;
  onTriggerKillswitch: () => void;
  recordedFrameCount: number;
  gameArchetype: GameArchetype;
  onSelectGameArchetype: (archetype: GameArchetype) => void;
  activeProjectName: string | null;
  activeRunName: string | null;
  onOpenProjectRuns: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMode,
  onSelectMode,
  device,
  isAgentRunning,
  onTriggerKillswitch,
  recordedFrameCount,
  gameArchetype,
  onSelectGameArchetype,
  activeProjectName,
  activeRunName,
  onOpenProjectRuns,
}) => {
  return (
    <header className="glass-navbar border-b border-cyber-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo & Agent Status */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 p-0.5 shadow-lg shadow-emerald-500/20">
                <div className="w-full h-full bg-[#0a0d14] rounded-[10px] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-emerald-300 text-lg tracking-wider">
                  ARE AGENT STUDIO<span className="text-white text-xs px-1.5 py-0.5 ml-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded font-mono font-normal">APEX VLA LAB</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>EXPERIMENTAL VISUAL CONTROL STUDIO</span>
                <span className="text-emerald-400">● RECEIPT-BOUND CLAIMS</span>
              </p>
            </div>
          </div>

          {/* Nav Modes */}
          <nav className="glass-panel hidden lg:flex items-center gap-1 p-1 rounded-xl border overflow-x-auto max-w-2xl">
            <button
              onClick={onOpenProjectRuns}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.PROJECT_RUNS
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
              <span>Projects</span>
            </button>
            <button
              onClick={() => onSelectMode(SystemMode.OBSERVE_RECORD)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.OBSERVE_RECORD
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>1. Observe</span>
              {recordedFrameCount > 0 && (
                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1 py-0.2 rounded-full font-mono">
                  {recordedFrameCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.GENRE_KNOWLEDGE)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.GENRE_KNOWLEDGE
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Genre Logic</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.TACTICAL_MEMORY)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.TACTICAL_MEMORY
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>3. Memory</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.MODEL_ROUTING)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.MODEL_ROUTING
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Route className="w-3.5 h-3.5 text-purple-400" />
              <span>Model Route</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.POLICY_TRAINING)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.POLICY_TRAINING
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>4. Train</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.DAGGER_ACTIVE_LEARNING)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.DAGGER_ACTIVE_LEARNING
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5 text-red-400" />
              <span>5. DAgger</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.OPERATION_CORRECTION_LEARNING)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.OPERATION_CORRECTION_LEARNING
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
              <span>6. Ops Learn</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.AUTONOMOUS_AGENT)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.AUTONOMOUS_AGENT
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>7. Agent</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.RUNTIME_VERIFICATION)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.RUNTIME_VERIFICATION
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verify</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.UNIVERSAL_DATASET_SERVER)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.UNIVERSAL_DATASET_SERVER
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Server Sync</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.PLAYSTYLE_PROFILER)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.PLAYSTYLE_PROFILER
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Playstyle</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.TERMINAL_CLI)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.TERMINAL_CLI
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>CLI</span>
            </button>

            <button
              onClick={() => onSelectMode(SystemMode.CODEBASE_EXPORT)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMode === SystemMode.CODEBASE_EXPORT
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </nav>

          {/* Right Action: Game Archetype & Emergency Killswitch */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenProjectRuns}
              className="hidden xl:flex max-w-[190px] items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-2.5 py-1.5 text-left transition hover:border-emerald-400/50"
              title="Open local project runs"
            >
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="min-w-0 font-mono text-[10px] leading-tight text-emerald-100">
                <span className="block truncate">{activeProjectName || 'No local project'}</span>
                <span className="block truncate text-emerald-400/80">{activeRunName || 'create a run before recording'}</span>
              </span>
            </button>
            <div className="glass-panel hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono">
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={gameArchetype}
                onChange={(e) => onSelectGameArchetype(e.target.value as any)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={GameArchetype.MOBA_ARENA} className="bg-slate-900">MOBA / ARPG Arena</option>
                <option value={GameArchetype.FPS} className="bg-slate-900">Ego-Shooter (FPS)</option>
                <option value={GameArchetype.SIM_MANAGEMENT} className="bg-slate-900">Sim / Management</option>
                <option value={GameArchetype.ACTION_RPG} className="bg-slate-900">Action-RPG (ARPG)</option>
                <option value={GameArchetype.MMORPG} className="bg-slate-900">MMORPG Persistent</option>
                <option value={GameArchetype.PUZZLE_MATCH} className="bg-slate-900">Puzzle / Match-3</option>
              </select>
            </div>

            <button
              onClick={onTriggerKillswitch}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-200 ${
                isAgentRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse neon-glow-red'
                  : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50'
              }`}
              title="Instantly cut off agent touch control & revert to human"
            >
              <ShieldAlert className="w-4 h-4 text-red-300" />
              <span>{isAgentRunning ? 'ABORT (ESC)' : 'KILLSWITCH'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
