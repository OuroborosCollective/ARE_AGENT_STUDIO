import React from 'react';
import { ArrowRight, Compass, Database, Gauge, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react';
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
  [SystemMode.OBSERVE_RECORD]: { area: 'Capture', stage: 1, title: 'Observe & Record', purpose: 'Spielscreen verbinden und echte menschliche Aktionen als Demonstrationen erfassen.', prerequisite: 'Eine verfügbare Browser- oder Videoquelle.', outcome: 'Frame-/Action-Paare für weitere Lernschritte.', next: 'Danach: Learn', icon: Compass },
  [SystemMode.GENRE_KNOWLEDGE]: { area: 'Learn', stage: 2, title: 'Genre Logic', purpose: 'Spieltyp, Kontrollmuster und typische Entscheidungsstrukturen einordnen.', prerequisite: 'Ein ausgewähltes Game-Genre.', outcome: 'Kontext für Regeln und Policy-Arbeit.', next: 'Danach: Tactical Memory', icon: Sparkles },
  [SystemMode.TACTICAL_MEMORY]: { area: 'Learn', stage: 2, title: 'Tactical Memory', purpose: 'Regeln und taktische Hinweise sichtbar prüfen und organisieren.', prerequisite: 'Genre-Kontext oder vorhandene Regeln.', outcome: 'Ein lesbarer Playbook-Kontext.', next: 'Danach: Policy Training', icon: Sparkles },
  [SystemMode.POLICY_TRAINING]: { area: 'Learn', stage: 2, title: 'Policy Training', purpose: 'Aus beobachteten Frame-/Action-Paaren die lokale Policy trainieren.', prerequisite: 'Beobachtete, vollständige Trainingspaare.', outcome: 'Aktualisierte lokale Policy-Gewichte.', next: 'Danach: DAgger', icon: Sparkles },
  [SystemMode.DAGGER_ACTIVE_LEARNING]: { area: 'Learn', stage: 2, title: 'DAgger Learning', purpose: 'Menschliche Korrekturen erfassen und für die nächste Lernrunde auswerten.', prerequisite: 'Frame-gebundene menschliche Korrekturen.', outcome: 'Korrekturproben für die Lernschleife.', next: 'Danach: Playstyle oder Run', icon: Sparkles },
  [SystemMode.PLAYSTYLE_PROFILER]: { area: 'Learn', stage: 2, title: 'Playstyle', purpose: 'Reaktionscadence und weitere Verhaltensparameter explizit konfigurieren.', prerequisite: 'Ein ausgewähltes Research-Profil.', outcome: 'Konfigurierter Reaktions-Takt für den aktiven Loop.', next: 'Danach: Run', icon: Sparkles },
  [SystemMode.AUTONOMOUS_AGENT]: { area: 'Run', stage: 3, title: 'Autonomous Agent', purpose: 'Policy-Vorhersagen beobachten und Android-Ausgabe getrennt davon ausführen.', prerequisite: 'Konfiguriertes Zielgerät; ADB bleibt separat disarmed.', outcome: 'Vorhersage oder ausdrücklich bestätigte Device-Ausgabe.', next: 'Danach: Verify Runtime', icon: Zap },
  [SystemMode.RUNTIME_VERIFICATION]: { area: 'Run', stage: 3, title: 'Runtime Verification', purpose: 'Deterministische Prüfungen und Live-Readbacks getrennt auswerten.', prerequisite: 'Lauffähiger Studio-/Daemon-Kontext.', outcome: 'Messbare Integritäts- und Laufzeitresultate.', next: 'Danach: Benchmark', icon: Gauge },
  [SystemMode.CALIBRATION_BENCHMARK]: { area: 'Run', stage: 3, title: 'Calibration Benchmark', purpose: 'Gerät, Auflösung und Inferenzkennwerte messen.', prerequisite: 'Geräteparameter oder lokaler Runtime-Kontext.', outcome: 'Messwerte für die Konfiguration.', next: 'Danach: Evidence', icon: Gauge },
  [SystemMode.UNIVERSAL_DATASET_SERVER]: { area: 'Evidence', stage: 4, title: 'Dataset Sync', purpose: 'Beobachtete Daten über einen verifizierten Receipt-Pfad synchronisieren.', prerequisite: 'Vollständige beobachtete Frame-/Action-Paare und erreichbarer Daemon.', outcome: 'Receipt-gebundene Synchronisation.', next: 'Danach: Forge Control Room', icon: Database },
  [SystemMode.FORGE_CONTROL_ROOM]: { area: 'Evidence', stage: 4, title: 'Forge Control Room', purpose: 'Externe Runs, Provenienz, Reconciliation und Publication-Status nachvollziehen.', prerequisite: 'Ein autorisierter Run oder ein vorhandener Readmodel-Kontext.', outcome: 'Nachvollziehbarer Evidence-Status.', next: 'Danach: Review / Publish Gate', icon: ShieldCheck },
  [SystemMode.OPERATION_CORRECTION_LEARNING]: { area: 'Advanced', title: 'Ops Correction Learning', purpose: 'Eigene Betriebsentscheidungen und Korrekturen als getrennte Lernspur prüfen.', prerequisite: 'Owner-Kontext und vorhandene Kandidaten.', outcome: 'Nicht-ausführende Korrektur-/Lernkandidaten.', next: 'Technische Prüfung fortsetzen', icon: ShieldCheck },
  [SystemMode.TERMINAL_CLI]: { area: 'Advanced', title: 'Terminal CLI', purpose: 'Technische Diagnose und direkte Kommandoausführung für erfahrene Nutzer.', prerequisite: 'Technischer Runtime-Kontext.', outcome: 'Direkte Diagnoseausgabe.', next: 'Nach der Diagnose zurück zum passenden Arbeitsbereich', icon: Terminal },
  [SystemMode.CODEBASE_EXPORT]: { area: 'Advanced', title: 'Codebase Export', purpose: 'Den relevanten Quellstand für Analyse oder Weitergabe exportieren.', prerequisite: 'Zugriff auf den aktuellen Codebestand.', outcome: 'Expliziter Codeexport.', next: 'Danach: passend zum Arbeitsziel zurückkehren', icon: Terminal },
};

export const TaskContextHeader: React.FC<{ activeMode: SystemMode }> = ({ activeMode }) => {
  const context = contexts[activeMode];
  const Icon = context.icon;

  return (
    <section className="mb-4 rounded-2xl border border-emerald-900/30 bg-[#0b1420]/78 p-4" aria-labelledby="task-context-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-900/50 bg-cyan-500/10">
          <Icon className="w-4 h-4 text-cyan-200" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300">{context.area}{context.stage ? ` · Schritt ${context.stage}/4` : ''}</span>
            <h1 id="task-context-title" className="text-base sm:text-lg font-bold text-white">{context.title}</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm leading-5 text-slate-400">{context.purpose}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
        <div className="rounded-xl border border-slate-800 bg-black/20 p-2.5">
          <div className="font-mono uppercase text-[9px] tracking-wider text-slate-600">Voraussetzung</div>
          <div className="mt-0.5 text-slate-300">{context.prerequisite}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/20 p-2.5">
          <div className="font-mono uppercase text-[9px] tracking-wider text-slate-600">Ergebnis</div>
          <div className="mt-0.5 text-slate-300">{context.outcome}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-black/20 p-2.5">
          <div className="font-mono uppercase text-[9px] tracking-wider text-slate-600">Weiter</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 text-cyan-200"><ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />{context.next}</div>
        </div>
      </div>
    </section>
  );
};
