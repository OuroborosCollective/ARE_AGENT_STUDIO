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

const advancedModes = [
  { mode: SystemMode.OPERATION_CORRECTION_LEARNING, label: 'Ops Correction Learning', description: 'Owner-Korrekturen prüfen', icon: ShieldCheck },
  { mode: SystemMode.TERMINAL_CLI, label: 'Terminal CLI', description: 'Technische Diagnose und Bedienung', icon: Terminal },
  { mode: SystemMode.CODEBASE_EXPORT, label: 'Codebase Export', description: 'Quellstand exportieren', icon: Code2 },
];

const StatusPill = ({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'safe' | 'warn' | 'danger' }) => {
  const toneClass = {
    neutral: 'text-ink-secondary border-structural-steel bg-surface-deep',
    safe: 'text-signal-teal border-signal-teal/20 bg-surface-deep',
    warn: 'text-status-caution border-status-caution/30 bg-surface-deep',
    danger: 'text-status-alert border-status-alert/30 bg-surface-deep',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-mono-label border whitespace-nowrap ${toneClass}`}>
      <span className="text-ink-quiet">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  activeMode, onSelectMode, isHome, onOpenHome, device, isAgentRunning, actionBridgeArmed = false,
  publicationAllowed = false, onTriggerKillswitch, recordedFrameCount, gameArchetype, onSelectGameArchetype,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectMode = (mode: SystemMode) => { onSelectMode(mode); setAdvancedOpen(false); };
  const activeGroup = (Object.keys(taskGroups) as Array<keyof typeof taskGroups>).find((key) => {
    const modes = [taskGroups[key].defaultMode];
    return modes.includes(activeMode as never);
  });

  return (
    <>
      <header className="stitch-header fixed top-0 inset-x-0 z-50 pt-safe">
        <div className="max-w-7xl mx-auto">
          <div className="h-14 px-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenHome}
              className="flex items-center gap-2 min-w-0 rounded focus-visible:outline-none"
              aria-label="ARE Agent Studio Home"
            >
              <span className="h-7 w-7 rounded bg-signal-teal text-on-primary flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-workspace-title text-caption uppercase tracking-tight text-ink-primary truncate">ARE Agent Studio</span>
                <span className="font-mono-label text-mono-label text-ink-quiet uppercase truncate">{isHome ? 'Home' : activeGroup ? taskGroups[activeGroup].label : 'Advanced'}</span>
              </span>
            </button>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <button type="button" onClick={onOpenHome} aria-current={isHome ? 'page' : undefined} className={`min-h-10 inline-flex items-center gap-2 px-3 rounded text-xs font-semibold ${isHome ? 'bg-surface-raised text-signal-teal' : 'text-ink-secondary hover:bg-surface-deep'}`}><Home className="w-4 h-4" aria-hidden="true" />Home</button>
              {(Object.keys(taskGroups) as Array<keyof typeof taskGroups>).map((key) => {
                const group = taskGroups[key]; const Icon = group.icon; const active = !isHome && activeGroup === key;
                return <button key={key} type="button" onClick={() => selectMode(group.defaultMode)} aria-current={active ? 'page' : undefined} title={group.description} className={`min-h-10 inline-flex items-center gap-2 px-3 rounded text-xs font-semibold ${active ? 'bg-surface-raised text-signal-teal' : 'text-ink-secondary hover:bg-surface-deep'}`}><Icon className="w-4 h-4" aria-hidden="true" />{group.label}</button>;
              })}
              <button type="button" onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen} className={`min-h-10 inline-flex items-center gap-1.5 px-3 rounded text-xs font-semibold ${advancedOpen ? 'bg-surface-raised text-ink-primary' : 'text-ink-secondary hover:bg-surface-deep'}`}><Layers3 className="w-4 h-4" aria-hidden="true" />Advanced<ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <label className="h-7 px-2 rounded bg-surface-deep border border-structural-steel inline-flex items-center gap-1.5 text-mono-label text-ink-secondary">
                <Gamepad2 className="w-3.5 h-3.5 text-signal-teal" aria-hidden="true" />
                <span className="sr-only">Game profile</span>
                <select aria-label="Game profile" value={gameArchetype} onChange={(e) => onSelectGameArchetype(e.target.value as GameArchetype)} className="bg-transparent max-w-[7.5rem] text-ink-secondary focus:outline-none">
                  <option value={GameArchetype.MOBA_ARENA}>MOBA / ARPG</option>
                  <option value={GameArchetype.FPS}>FPS</option>
                  <option value={GameArchetype.SIM_MANAGEMENT}>Sim / Management</option>
                  <option value={GameArchetype.ACTION_RPG}>Action-RPG</option>
                  <option value={GameArchetype.MMORPG}>MMORPG</option>
                  <option value={GameArchetype.PUZZLE_MATCH}>Puzzle / Match-3</option>
                </select>
              </label>
              <StatusPill label="ADB" value={actionBridgeArmed ? 'ARMED' : 'OFF'} tone={actionBridgeArmed ? 'danger' : 'neutral'} />
              <button
                type="button"
                onClick={onTriggerKillswitch}
                className={`h-8 min-w-8 px-2 rounded inline-flex items-center justify-center gap-1.5 text-xs font-semibold border ${isAgentRunning ? 'bg-status-alert text-white border-status-alert' : 'bg-surface-deep text-ink-secondary border-structural-steel'}`}
                aria-label={isAgentRunning ? 'Stop agent and disarm Android output' : 'Emergency stop control'}
              >
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{isAgentRunning ? 'STOP' : 'SAFE'}</span>
              </button>
            </div>
          </div>

          {advancedOpen && (
            <div className="hidden lg:grid grid-cols-3 gap-2 px-3 pb-3" role="menu" aria-label="Advanced tools">
              {advancedModes.map(({ mode, label, description, icon: Icon }) => (
                <button key={mode} type="button" role="menuitem" onClick={() => selectMode(mode)} className={`text-left min-h-16 p-3 rounded-lg border ${activeMode === mode ? 'border-signal-teal/30 bg-surface-raised' : 'border-structural-steel bg-surface-deep hover:bg-surface-raised'}`}>
                  <span className="flex items-center gap-2 text-caption font-semibold text-ink-primary"><Icon className="w-4 h-4 text-signal-teal" aria-hidden="true" />{label}</span>
                  <span className="block mt-1 text-body-secondary text-ink-quiet">{description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-surface/95 backdrop-blur-xl border-t border-structural-steel/80 pb-safe" aria-label="Mobile primary">
        <div className="h-16 grid grid-cols-5 max-w-xl mx-auto">
          <button type="button" onClick={onOpenHome} aria-current={isHome ? 'page' : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold min-h-12 ${isHome ? 'text-signal-teal' : 'text-ink-quiet'}`}>
            {isHome && <span className="absolute top-0 inset-x-3 h-0.5 bg-signal-teal rounded-full" aria-hidden="true" />}
            <Home className="w-5 h-5" aria-hidden="true" />Home
          </button>
          {(Object.keys(taskGroups) as Array<keyof typeof taskGroups>).map((key) => {
            const group = taskGroups[key]; const Icon = group.icon; const active = !isHome && activeGroup === key;
            return (
              <button key={key} type="button" onClick={() => selectMode(group.defaultMode)} aria-current={active ? 'page' : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold min-h-12 ${active ? 'text-signal-teal' : 'text-ink-quiet'}`}>
                {active && <span className="absolute top-0 inset-x-3 h-0.5 bg-signal-teal rounded-full" aria-hidden="true" />}
                <Icon className="w-5 h-5" aria-hidden="true" />{group.shortLabel}
              </button>
            );
          })}
        </div>
        <div className="px-3 pb-1 flex justify-end">
          <button type="button" onClick={() => setAdvancedOpen(true)} className="min-h-8 px-2 text-mono-label text-ink-quiet underline underline-offset-2">Advanced</button>
        </div>
      </nav>

      {advancedOpen && (
        <div className="lg:hidden fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Advanced tools">
          <button type="button" onClick={() => setAdvancedOpen(false)} className="absolute inset-0 bg-canvas-off-black/75" aria-label="Advanced schließen" />
          <section className="absolute inset-x-0 bottom-0 rounded-t-xl bg-surface-raised border-t border-structural-steel shadow-2xl pb-safe">
            <div className="h-14 px-4 flex items-center justify-between border-b border-structural-steel">
              <div>
                <p className="font-mono-label text-mono-label text-ink-quiet uppercase">Secondary Tools</p>
                <h2 className="font-section-title text-section-title text-ink-primary">Advanced</h2>
              </div>
              <button type="button" onClick={() => setAdvancedOpen(false)} className="min-h-10 px-3 rounded stitch-outline text-xs font-semibold">Schließen</button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto p-3 space-y-2">
              {advancedModes.map(({ mode, label, description, icon: Icon }) => (
                <button key={mode} type="button" onClick={() => selectMode(mode)} className={`w-full text-left min-h-16 p-3 rounded-lg border ${activeMode === mode ? 'border-signal-teal/30 bg-surface-deep' : 'border-structural-steel bg-surface-deep'}`}>
                  <span className="flex items-center gap-2 text-caption font-semibold text-ink-primary"><Icon className="w-4 h-4 text-signal-teal" aria-hidden="true" />{label}</span>
                  <span className="block mt-1 text-body-secondary text-ink-quiet">{description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
