import React, { useState } from 'react';
import { Activity, Brain, ChevronDown, Code2, Gamepad2, Gauge, Home, Layers3, Radio, Server, ShieldAlert, ShieldCheck, Sparkles, Terminal, UserCheck, Zap } from 'lucide-react';
import { SystemMode, DeviceConfig, GameArchetype } from '../types';

interface NavbarProps {
  activeMode: SystemMode;
  onSelectMode: (mode: SystemMode) => void;
  isHome: boolean;
  onOpenHome: () => void;
  device: DeviceConfig;
  isAgentRunning: boolean;
  actionBridgeArmed?: boolean;
  publicationAllowed?: boolean;
  onTriggerKillswitch: () => void;
  recordedFrameCount: number;
  gameArchetype: GameArchetype;
  onSelectGameArchetype: (archetype: GameArchetype) => void;
}

const taskGroups = {
  capture: { label: 'Capture', shortLabel: 'Capture', description: 'Screen beobachten und Demonstrationen erfassen', defaultMode: SystemMode.OBSERVE_RECORD, icon: Radio },
  learn: { label: 'Learn', shortLabel: 'Learn', description: 'Policy, Memory und menschliche Korrekturen', defaultMode: SystemMode.POLICY_TRAINING, icon: Brain },
  run: { label: 'Run', shortLabel: 'Run', description: 'Agentenlauf, Gerät und Laufzeit prüfen', defaultMode: SystemMode.AUTONOMOUS_AGENT, icon: Zap },
  evidence: { label: 'Evidence', shortLabel: 'Evidence', description: 'Synchronisation, Belege und externe Evaluation', defaultMode: SystemMode.UNIVERSAL_DATASET_SERVER, icon: ShieldCheck },
} as const;

const groupModes: Record<keyof typeof taskGroups, Array<{ mode: SystemMode; label: string; description: string; icon: React.ComponentType<{ className?: string }> }>> = {
  capture: [{ mode: SystemMode.OBSERVE_RECORD, label: 'Observe & Record', description: 'Live-Bild und menschliche Aktionen erfassen', icon: Radio }],
  learn: [
    { mode: SystemMode.GENRE_KNOWLEDGE, label: 'Genre Logic', description: 'Spieltyp und Kontrollstruktur verstehen', icon: Gamepad2 },
    { mode: SystemMode.TACTICAL_MEMORY, label: 'Tactical Memory', description: 'Regeln und Erinnerungen verwalten', icon: Sparkles },
    { mode: SystemMode.POLICY_TRAINING, label: 'Policy Training', description: 'Aus beobachteten Aktionen lernen', icon: Brain },
    { mode: SystemMode.DAGGER_ACTIVE_LEARNING, label: 'DAgger', description: 'Menschliche Korrekturen nutzen', icon: UserCheck },
    { mode: SystemMode.PLAYSTYLE_PROFILER, label: 'Playstyle', description: 'Reaktions- und Spielprofil justieren', icon: UserCheck },
  ],
  run: [
    { mode: SystemMode.AUTONOMOUS_AGENT, label: 'Agent', description: 'Vorhersagen und optional ADB ausführen', icon: Zap },
    { mode: SystemMode.RUNTIME_VERIFICATION, label: 'Verify Runtime', description: 'Deterministische Laufzeitprüfungen', icon: ShieldCheck },
    { mode: SystemMode.CALIBRATION_BENCHMARK, label: 'Benchmark', description: 'Gerät und Inferenz messen', icon: Gauge },
  ],
  evidence: [
    { mode: SystemMode.UNIVERSAL_DATASET_SERVER, label: 'Dataset Sync', description: 'Receipt-gebundene Synchronisation', icon: Server },
    { mode: SystemMode.FORGE_CONTROL_ROOM, label: 'Forge Control Room', description: 'Externe Läufe und Provenienz prüfen', icon: Activity },
  ],
};

const advancedModes = [
  { mode: SystemMode.OPERATION_CORRECTION_LEARNING, label: 'Ops Correction Learning', description: 'Owner-Korrekturen prüfen', icon: ShieldCheck },
  { mode: SystemMode.TERMINAL_CLI, label: 'Terminal CLI', description: 'Technische Diagnose und Bedienung', icon: Terminal },
  { mode: SystemMode.CODEBASE_EXPORT, label: 'Codebase Export', description: 'Quellstand exportieren', icon: Code2 },
];

const StatusPill = ({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'safe' | 'warn' | 'danger' }) => {
  const toneClass = {
    neutral: 'text-slate-300 border-slate-700 bg-slate-900/70',
    safe: 'text-emerald-200 border-emerald-800/70 bg-emerald-950/30',
    warn: 'text-amber-200 border-amber-800/70 bg-amber-950/30',
    danger: 'text-red-200 border-red-800/70 bg-red-950/30',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono whitespace-nowrap ${toneClass}`}><span className="text-slate-500">{label}</span><span className="font-bold">{value}</span></span>;
};

export const Navbar: React.FC<NavbarProps> = ({
  activeMode, onSelectMode, isHome, onOpenHome, device, isAgentRunning, actionBridgeArmed = false,
  publicationAllowed = false, onTriggerKillswitch, recordedFrameCount, gameArchetype, onSelectGameArchetype,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectMode = (mode: SystemMode) => { onSelectMode(mode); setAdvancedOpen(false); };
  const activeGroup = (Object.keys(taskGroups) as Array<keyof typeof taskGroups>).find((key) => groupModes[key].some((item) => item.mode === activeMode));

  return (
    <>
      <header className="glass-navbar border-b border-cyber-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="min-h-16 py-2 flex items-center justify-between gap-3">
            <button type="button" onClick={onOpenHome} className="flex items-center gap-2.5 min-w-0 text-left rounded-xl focus-visible:outline-none" aria-label="ARE Agent Studio Home">
              <span className="relative shrink-0">
                <span className="w-10 h-10 rounded-xl bg-emerald-500 p-0.5 block"><span className="w-full h-full bg-[#0a0d14] rounded-[10px] flex items-center justify-center"><Brain className="w-5 h-5 text-emerald-300" aria-hidden="true" /></span></span>
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a0d14] ${isAgentRunning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </span>
              <span className="min-w-0"><span className="block text-emerald-200 font-extrabold tracking-wide text-sm sm:text-lg truncate">ARE AGENT STUDIO</span><span className="hidden sm:block text-[10px] text-slate-500 font-mono truncate">Evidence-bound visual control</span></span>
            </button>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <button type="button" onClick={onOpenHome} aria-current={isHome ? 'page' : undefined} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${isHome ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}><Home className="w-4 h-4" aria-hidden="true" />Home</button>
              {(Object.keys(taskGroups) as Array<keyof typeof taskGroups>).map((key) => {
                const group = taskGroups[key]; const Icon = group.icon; const active = !isHome && activeGroup === key;
                return <button key={key} type="button" onClick={() => selectMode(group.defaultMode)} aria-current={active ? 'page' : undefined} title={group.description} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${active ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}><Icon className="w-4 h-4" aria-hidden="true" />{group.label}</button>;
              })}
              <button type="button" onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ${advancedOpen ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'}`}><Layers3 className="w-4 h-4" aria-hidden="true" />Advanced<ChevronDown className={`w-3.5 h-3.5 ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5">
                <StatusPill label="Device" value={device.connected ? 'Connected' : 'Local'} tone={device.connected ? 'safe' : 'neutral'} />
                <StatusPill label="Agent" value={isAgentRunning ? 'Running' : 'Idle'} tone={isAgentRunning ? 'warn' : 'neutral'} />
                <StatusPill label="ADB" value={actionBridgeArmed ? 'Armed' : 'Off'} tone={actionBridgeArmed ? 'danger' : 'safe'} />
                <label className="glass-panel inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-slate-400">
                  <Gamepad2 className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
                  <span className="sr-only">Game profile</span>
                  <select value={gameArchetype} onChange={(e) => onSelectGameArchetype(e.target.value as GameArchetype)} className="bg-transparent text-slate-200 focus:outline-none max-w-36">
                    <option value={GameArchetype.MOBA_ARENA}>MOBA / ARPG</option>
                    <option value={GameArchetype.FPS}>FPS</option>
                    <option value={GameArchetype.SIM_MANAGEMENT}>Sim / Management</option>
                    <option value={GameArchetype.ACTION_RPG}>Action-RPG</option>
                    <option value={GameArchetype.MMORPG}>MMORPG</option>
                    <option value={GameArchetype.PUZZLE_MATCH}>Puzzle / Match-3</option>
                  </select>
                </label>
              </div>
              <button type="button" onClick={onTriggerKillswitch} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold ${isAgentRunning ? 'bg-red-600 text-white' : 'bg-red-950/40 text-red-300 border border-red-800/60'}`} aria-label={isAgentRunning ? 'Stop agent and disarm Android output' : 'Emergency stop control'}>
                <ShieldAlert className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">{isAgentRunning ? 'STOP' : 'SAFE'}</span>
              </button>
            </div>
          </div>

          <div className="lg:hidden pb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Current state">
              <label className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-900/70 bg-cyan-950/20 text-[10px] font-mono text-cyan-200">
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">Game profile</span>
                <select aria-label="Game profile" value={gameArchetype} onChange={(e) => onSelectGameArchetype(e.target.value as GameArchetype)} className="bg-transparent text-cyan-100 focus:outline-none">
                  <option value={GameArchetype.MOBA_ARENA}>MOBA / ARPG</option>
                  <option value={GameArchetype.FPS}>FPS</option>
                  <option value={GameArchetype.SIM_MANAGEMENT}>Sim / Management</option>
                  <option value={GameArchetype.ACTION_RPG}>Action-RPG</option>
                  <option value={GameArchetype.MMORPG}>MMORPG</option>
                  <option value={GameArchetype.PUZZLE_MATCH}>Puzzle / Match-3</option>
                </select>
              </label>
              <StatusPill label="Device" value={device.connected ? 'Connected' : 'Local only'} tone={device.connected ? 'safe' : 'neutral'} />
              <StatusPill label="Agent" value={isAgentRunning ? 'Running' : 'Idle'} tone={isAgentRunning ? 'warn' : 'neutral'} />
              <StatusPill label="ADB" value={actionBridgeArmed ? 'ARMED' : 'DISARMED'} tone={actionBridgeArmed ? 'danger' : 'safe'} />
              <StatusPill label="Data" value={publicationAllowed ? 'Eligible' : 'Private'} tone={publicationAllowed ? 'warn' : 'neutral'} />
              {recordedFrameCount > 0 && <StatusPill label="Frames" value={String(recordedFrameCount)} tone="neutral" />}
            </div>
          </div>

          {!isHome && activeGroup && (
            <div className="hidden lg:flex items-center gap-1 overflow-x-auto pb-3" aria-label="Current task tools">
              <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider px-2 shrink-0">{taskGroups[activeGroup].label}</span>
              {groupModes[activeGroup].map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => selectMode(mode)}
                  aria-current={activeMode === mode ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-xs font-semibold whitespace-nowrap ${activeMode === mode ? 'bg-cyan-500/12 text-cyan-200 border border-cyan-500/30' : 'text-slate-400 border border-transparent hover:text-white hover:bg-slate-800/60'}`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          )}

          {!isHome && activeGroup && (
            <div className="lg:hidden pb-2 -mt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Current task tools">
                {groupModes[activeGroup].map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => selectMode(mode)}
                    aria-current={activeMode === mode ? 'page' : undefined}
                    className={`min-h-10 shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-semibold whitespace-nowrap ${activeMode === mode ? 'bg-cyan-500/12 text-cyan-200 border border-cyan-500/30' : 'bg-slate-950/30 text-slate-400 border border-slate-800'}`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {advancedOpen && (
            <div className="hidden lg:grid grid-cols-3 gap-2 pb-3" role="menu" aria-label="Advanced tools">
              {advancedModes.map(({ mode, label, description, icon: Icon }) => (
                <button key={mode} type="button" role="menuitem" onClick={() => selectMode(mode)} className={`text-left p-3 rounded-xl border ${activeMode === mode ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="w-4 h-4 text-cyan-300" aria-hidden="true" />{label}</span>
                  <span className="block mt-1 text-[11px] text-slate-500">{description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[60] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 bg-[#071019]/96 backdrop-blur-xl border-t border-emerald-900/30" aria-label="Mobile primary">
        <div className="grid grid-cols-5 gap-1 max-w-xl mx-auto">
          <button type="button" onClick={onOpenHome} aria-current={isHome ? 'page' : undefined} className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isHome ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400'}`}><Home className="w-5 h-5" aria-hidden="true" />Home</button>
          {(Object.keys(taskGroups) as Array<keyof typeof taskGroups>).map((key) => {
            const group = taskGroups[key]; const Icon = group.icon; const active = !isHome && activeGroup === key;
            return <button key={key} type="button" onClick={() => selectMode(group.defaultMode)} aria-current={active ? 'page' : undefined} className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400'}`}><Icon className="w-5 h-5" aria-hidden="true" />{group.shortLabel}</button>;
          })}
        </div>
        <div className="max-w-xl mx-auto mt-1 flex items-center justify-between px-2">
          <span className="text-[10px] text-slate-600 font-mono">All tools available in Advanced</span>
          <button type="button" onClick={() => setAdvancedOpen(true)} className="text-[10px] text-cyan-300 underline underline-offset-2">Open tools</button>
        </div>
        {advancedOpen && (
          <div className="mt-2 max-w-xl mx-auto rounded-2xl border border-slate-800 bg-[#0b111b] p-2 space-y-1 max-h-60 overflow-auto">
            {advancedModes.map(({ mode, label, description, icon: Icon }) => (
              <button key={mode} type="button" onClick={() => selectMode(mode)} className="w-full text-left p-3 rounded-xl hover:bg-slate-800/80">
                <span className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="w-4 h-4 text-cyan-300" aria-hidden="true" />{label}</span>
                <span className="block mt-1 text-[11px] text-slate-500">{description}</span>
              </button>
            ))}
          </div>
        )}
      </nav>
    </>
  );
};