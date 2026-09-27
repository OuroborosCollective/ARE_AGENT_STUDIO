import React from 'react';
import { ArrowRight, Compass, Database, Gauge, ShieldCheck, Sparkles, Terminal, Zap, Radio, Gamepad2, UserCheck, Activity } from 'lucide-react';
import { SystemMode } from '../types';

type Context = {
  area: 'Capture' | 'Learn' | 'Run' | 'Evidence' | 'Advanced';
  stage?: number;
  title: string;
  purpose: string;
  prerequisite: string;
  outcome: string;
  next: string;
  icon: React.ComponentType<{ className?: string }>;
};

const contexts: Record<SystemMode, Context> = {
  [SystemMode.OBSERVE_RECORD]: { area: 'Capture', stage: 1, title: 'Observe & Record', purpose: 'Echtbild beobachten und menschliche Aktionen als Demonstrationen erfassen.', prerequisite: 'Verfügbare Screen-/Videoquelle.', outcome: 'Frame-/Action-Paare für Learn.', next: 'Stage 02 · Learn', icon: Radio },
  [SystemMode.GENRE_KNOWLEDGE]: { area: 'Learn', stage: 2, title: 'Genre Logic', purpose: 'Spieltyp und Kontrollmuster als Trainingskontext einordnen.', prerequisite: 'Ein ausgewähltes Genre.', outcome: 'Genre-Kontext für Regeln und Policy.', next: 'Tactical Memory', icon: Gamepad2 },
  [SystemMode.TACTICAL_MEMORY]: { area: 'Learn', stage: 2, title: 'Tactical Memory', purpose: 'Regeln und taktische Hinweise strukturiert prüfen.', prerequisite: 'Genre-Kontext oder vorhandene Regeln.', outcome: 'Lesbarer Playbook-Kontext.', next: 'Policy Training', icon: Sparkles },
  [SystemMode.POLICY_TRAINING]: { area: 'Learn', stage: 2, title: 'Policy Training', purpose: 'Beobachtete Frame-/Action-Paare für lokale Policy-Arbeit verwenden.', prerequisite: 'Vollständige beobachtete Trainingspaare.', outcome: 'Trainingsfortschritt und Checkpoint-Kandidaten.', next: 'DAgger', icon: Sparkles },
  [SystemMode.DAGGER_ACTIVE_LEARNING]: { area: 'Learn', stage: 2, title: 'DAgger Corrections', purpose: 'Menschliche Korrekturen frame-gebunden in die Lernschleife zurückführen.', prerequisite: 'Frame-gebundene Korrekturen.', outcome: 'Korrekturproben für weiteres Training.', next: 'Playstyle oder Run', icon: UserCheck },
  [SystemMode.PLAYSTYLE_PROFILER]: { area: 'Learn', stage: 2, title: 'Playstyle Profiler', purpose: 'Reaktionscadence und Spielprofil explizit konfigurieren.', prerequisite: 'Ausgewähltes Profil.', outcome: 'Konfigurierter Reaktions-Takt.', next: 'Stage 03 · Run', icon: UserCheck },
  [SystemMode.AUTONOMOUS_AGENT]: { area: 'Run', stage: 3, title: 'Agent Runtime', purpose: 'Policy-Prädiktionen beobachten und Device-Ausgabe separat autorisieren.', prerequisite: 'Zielgerät konfiguriert; ADB zunächst OFF.', outcome: 'Dry-Run oder ausdrücklich autorisierte Touch-Ausgabe.', next: 'Verify Runtime', icon: Zap },
  [SystemMode.RUNTIME_VERIFICATION]: { area: 'Run', stage: 3, title: 'Verify Runtime', purpose: 'Deterministische Laufzeitresultate und Readbacks prüfen.', prerequisite: 'Lauffähiger Studio-Kontext.', outcome: 'Nachvollziehbare Integritätsresultate.', next: 'Benchmark', icon: ShieldCheck },
  [SystemMode.CALIBRATION_BENCHMARK]: { area: 'Run', stage: 3, title: 'Benchmark', purpose: 'Gerät und Inferenzpfad messen.', prerequisite: 'Geräteparameter oder lokaler Runtime-Kontext.', outcome: 'Messwerte für die Konfiguration.', next: 'Stage 04 · Evidence', icon: Gauge },
  [SystemMode.UNIVERSAL_DATASET_SERVER]: { area: 'Evidence', stage: 4, title: 'Audit & Receipts', purpose: 'Synchronisation, Laufzeitquittungen und Provenienz nachvollziehen.', prerequisite: 'Lokale Daten können unabhängig geprüft werden.', outcome: 'Receipt-gebundene Evidence-Sicht.', next: 'Forge Control Room', icon: Database },
  [SystemMode.FORGE_CONTROL_ROOM]: { area: 'Evidence', stage: 4, title: 'Forge Control Room', purpose: 'Externe Runs, Provenienz und Publication-Status nachvollziehen.', prerequisite: 'Autorisierter Run oder vorhandener Readmodel-Kontext.', outcome: 'Nachvollziehbarer Evidence-Status.', next: 'Review / Publish Gate', icon: Activity },
  [SystemMode.OPERATION_CORRECTION_LEARNING]: { area: 'Advanced', title: 'Ops Correction Learning', purpose: 'Eigene Betriebsentscheidungen als getrennte Lernspur prüfen.', prerequisite: 'Owner-Kontext und Kandidaten.', outcome: 'Nicht-ausführende Lernkandidaten.', next: 'Technische Prüfung fortsetzen', icon: ShieldCheck },
  [SystemMode.TERMINAL_CLI]: { area: 'Advanced', title: 'Terminal CLI', purpose: 'Technische Diagnose und direkte Kommandoausführung.', prerequisite: 'Technischer Runtime-Kontext.', outcome: 'Diagnoseausgabe.', next: 'Zurück zum passenden Workspace', icon: Terminal },
  [SystemMode.CODEBASE_EXPORT]: { area: 'Advanced', title: 'Codebase Export', purpose: 'Relevanten Quellstand explizit exportieren.', prerequisite: 'Zugriff auf den aktuellen Codebestand.', outcome: 'Expliziter Codeexport.', next: 'Zurück zum passenden Workspace', icon: Terminal },
};

const groupTools: Record<Context['area'], SystemMode[]> = {
  Capture: [SystemMode.OBSERVE_RECORD],
  Learn: [SystemMode.GENRE_KNOWLEDGE, SystemMode.TACTICAL_MEMORY, SystemMode.POLICY_TRAINING, SystemMode.DAGGER_ACTIVE_LEARNING, SystemMode.PLAYSTYLE_PROFILER],
  Run: [SystemMode.AUTONOMOUS_AGENT, SystemMode.RUNTIME_VERIFICATION, SystemMode.CALIBRATION_BENCHMARK],
  Evidence: [SystemMode.UNIVERSAL_DATASET_SERVER, SystemMode.FORGE_CONTROL_ROOM],
  Advanced: [SystemMode.OPERATION_CORRECTION_LEARNING, SystemMode.TERMINAL_CLI, SystemMode.CODEBASE_EXPORT],
};

const toolLabels: Partial<Record<SystemMode, string>> = {
  [SystemMode.OBSERVE_RECORD]: 'Observe & Record',
  [SystemMode.GENRE_KNOWLEDGE]: 'Genre Logic',
  [SystemMode.TACTICAL_MEMORY]: 'Tactical Memory',
  [SystemMode.POLICY_TRAINING]: 'Policy Training',
  [SystemMode.DAGGER_ACTIVE_LEARNING]: 'DAgger Corrections',
  [SystemMode.PLAYSTYLE_PROFILER]: 'Playstyle',
  [SystemMode.AUTONOMOUS_AGENT]: 'Agent Runtime',
  [SystemMode.RUNTIME_VERIFICATION]: 'Verify Runtime',
  [SystemMode.CALIBRATION_BENCHMARK]: 'Benchmark',
  [SystemMode.UNIVERSAL_DATASET_SERVER]: 'Audit & Receipts',
  [SystemMode.FORGE_CONTROL_ROOM]: 'Forge Control Room',
};

const toolIcon = (mode: SystemMode) => {
  if (mode === SystemMode.OBSERVE_RECORD) return Radio;
  if (mode === SystemMode.POLICY_TRAINING || mode === SystemMode.TACTICAL_MEMORY) return Sparkles;
  if (mode === SystemMode.DAGGER_ACTIVE_LEARNING || mode === SystemMode.PLAYSTYLE_PROFILER) return UserCheck;
  if (mode === SystemMode.AUTONOMOUS_AGENT) return Zap;
  if (mode === SystemMode.RUNTIME_VERIFICATION) return ShieldCheck;
  if (mode === SystemMode.CALIBRATION_BENCHMARK) return Gauge;
  if (mode === SystemMode.UNIVERSAL_DATASET_SERVER) return Database;
  return Activity;
};

export const TaskContextHeader: React.FC<{ activeMode: SystemMode; onSelectMode: (mode: SystemMode) => void }> = ({ activeMode, onSelectMode }) => {
  const context = contexts[activeMode];
  const Icon = context.icon;
  const tools = groupTools[context.area];

  return (
    <section className="mb-4" aria-labelledby="task-context-title">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono-label text-mono-label uppercase tracking-widest text-ink-quiet">
              Stage {context.stage ? String(context.stage).padStart(2, '0') : 'ADV'} // {context.area}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised border border-structural-steel">
                <Icon className="h-4 w-4 text-signal-teal" aria-hidden="true" />
              </span>
              <h1 id="task-context-title" className="font-workspace-title text-workspace-title text-ink-primary truncate">{context.title}</h1>
            </div>
            <p className="mt-1.5 max-w-[65ch] text-body-secondary text-ink-secondary">{context.purpose}</p>
          </div>
          {context.stage && <span className="font-mono-label text-mono-label text-ink-quiet shrink-0">STEP {context.stage}/4</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="stitch-muted-surface rounded-lg px-3 py-2.5">
            <p className="font-mono-label text-mono-label uppercase text-ink-quiet">Voraussetzung</p>
            <p className="mt-1 text-body-secondary text-ink-secondary">{context.prerequisite}</p>
          </div>
          <div className="stitch-muted-surface rounded-lg px-3 py-2.5">
            <p className="font-mono-label text-mono-label uppercase text-ink-quiet">Ergebnis</p>
            <p className="mt-1 text-body-secondary text-ink-secondary">{context.outcome}</p>
          </div>
          <div className="stitch-muted-surface rounded-lg px-3 py-2.5">
            <p className="font-mono-label text-mono-label uppercase text-ink-quiet">Weiter</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-body-secondary text-ink-secondary"><ArrowRight className="h-3.5 w-3.5 text-signal-teal" aria-hidden="true" />{context.next}</p>
          </div>
        </div>

        <nav aria-label={`Tools in ${context.area}`} className="flex gap-1.5 overflow-x-auto pb-1">
          {tools.map((mode) => {
            const ToolIcon = toolIcon(mode);
            return (
              <button key={mode} type="button" onClick={() => onSelectMode(mode)} aria-current={mode === activeMode ? 'page' : undefined}
                className={`min-h-10 shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border text-caption font-semibold whitespace-nowrap ${mode === activeMode ? 'border-signal-teal/30 bg-surface-raised text-signal-teal' : 'border-structural-steel bg-surface-deep text-ink-secondary hover:bg-surface-raised'}`}>
                <ToolIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {toolLabels[mode] ?? contexts[mode].title}
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
};
