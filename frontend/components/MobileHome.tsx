import React from 'react';
import { ArrowRight, Brain, CheckCircle2, Database, Gamepad2, LockKeyhole, Radio, ShieldCheck, Smartphone, Sparkles, Zap } from 'lucide-react';
import { DeviceConfig, SystemMode } from '../types';

interface MobileHomeProps {
  device: DeviceConfig;
  isAgentRunning: boolean;
  actionBridgeArmed: boolean;
  recordedFrameCount: number;
  publicationAllowed: boolean;
  onSelectMode: (mode: SystemMode) => void;
}

type StageProps = {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  prerequisite: string;
  result: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
};

const Stage: React.FC<StageProps> = ({ number, eyebrow, title, description, prerequisite, result, action, icon: Icon, active, onClick }) => (
  <article className={`relative flex items-start gap-3 rounded-xl border p-3.5 ${active ? 'bg-surface-raised border-structural-steel shadow-md' : 'bg-surface-deep border-structural-steel/80'}`}>
    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono-label text-caption font-bold ${active ? 'bg-signal-teal text-on-primary' : 'bg-surface-container text-ink-secondary'}`}>
      {number}
    </span>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-mono-label text-mono-label uppercase tracking-widest ${active ? 'text-signal-teal' : 'text-ink-quiet'}`}>{eyebrow}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <Icon className="h-4 w-4 text-signal-teal shrink-0" aria-hidden="true" />
            <h2 className="font-section-title text-section-title text-ink-primary">{title}</h2>
          </div>
        </div>
        {active && <span className="font-mono-label text-mono-label text-ink-quiet shrink-0">ACTIVE</span>}
      </div>
      <p className="text-body-secondary text-ink-secondary">{description}</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div className="rounded bg-surface-deep border border-structural-steel px-2.5 py-2">
          <p className="font-mono-label text-mono-label uppercase text-ink-quiet">Voraussetzung</p>
          <p className="mt-0.5 text-caption text-ink-secondary">{prerequisite}</p>
        </div>
        <div className="rounded bg-surface-deep border border-structural-steel px-2.5 py-2">
          <p className="font-mono-label text-mono-label uppercase text-ink-quiet">Ergebnis</p>
          <p className="mt-0.5 text-caption text-ink-secondary">{result}</p>
        </div>
      </div>
      <button type="button" onClick={onClick} className="stitch-cta min-h-12 w-full rounded-lg px-3 text-caption font-semibold inline-flex items-center justify-center gap-2">
        {action}<ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </article>
);

export const MobileHome: React.FC<MobileHomeProps> = ({
  device, isAgentRunning, actionBridgeArmed, recordedFrameCount, publicationAllowed, onSelectMode
}) => {
  const readyForRun = device.connected && Boolean(device.serial);
  return (
    <section className="space-y-5 pb-4" aria-labelledby="home-title">
      <header className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono-label text-mono-label uppercase tracking-widest text-ink-quiet">Start Here</p>
          <span className="inline-flex items-center gap-1.5 rounded bg-surface-deep border border-structural-steel px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-teal" aria-hidden="true" />
            <span className="font-mono-label text-mono-label text-ink-secondary">STUDIO</span>
          </span>
        </div>
        <h1 id="home-title" className="font-screen-title-mobile text-screen-title-mobile text-ink-primary tracking-tight">Was möchtest du tun?</h1>
        <p className="max-w-[65ch] text-body-secondary text-ink-secondary">Wähle eine Arbeitsphase für Beobachtung, Lernen, Ausführung oder überprüfbare Evidence.</p>
      </header>

      <div className="relative space-y-3 pl-1">
        <div className="stitch-stage-rail absolute left-[1.15rem] top-4 bottom-10 w-px" aria-hidden="true" />
        <Stage number="01" eyebrow="PHASE 01" title="Observe & Record" icon={Radio} active={recordedFrameCount === 0}
          description="Einen echten Spielscreen verbinden und menschliche Aktionen als Demonstration aufzeichnen."
          prerequisite="Screen-/Videoquelle verfügbar."
          result={String(recordedFrameCount) + ' aufgezeichnete Frames / Aktionen'}
          action="Capture öffnen" onClick={() => onSelectMode(SystemMode.OBSERVE_RECORD)} />
        <Stage number="02" eyebrow="PHASE 02" title="Train & Correct" icon={Brain} active={recordedFrameCount > 0}
          description="Beobachtete Frame-/Action-Paare für Policy Training und menschliche Korrekturen nutzen."
          prerequisite={recordedFrameCount > 0 ? 'Beobachtete Daten vorhanden.' : 'Zuerst Capture aufzeichnen.'}
          result="Policy-, Memory- und DAgger-Werkzeuge"
          action="Learn öffnen" onClick={() => onSelectMode(SystemMode.POLICY_TRAINING)} />
        <Stage number="03" eyebrow="PHASE 03" title="Inference & Arming" icon={Zap} active={isAgentRunning || actionBridgeArmed}
          description="Prädiktion zuerst im Shadow/Dry-Run beobachten; Android-Ausgabe bleibt separat und bewusst armierbar."
          prerequisite={readyForRun ? 'Gerät und Serial konfiguriert.' : 'Gerät/Serial konfigurieren.'}
          result={(isAgentRunning ? 'Agent läuft' : 'Agent standby') + ' · ADB ' + (actionBridgeArmed ? 'ARMED' : 'OFF')}
          action="Run öffnen" onClick={() => onSelectMode(SystemMode.AUTONOMOUS_AGENT)} />
        <Stage number="04" eyebrow="PHASE 04" title="Audit & Provenance" icon={ShieldCheck} active={publicationAllowed}
          description="Receipts, Synchronisation, Runtime-Verifikation und Herkunft der Ergebnisse nachvollziehen."
          prerequisite="Lokale Daten unabhängig prüfbar."
          result={publicationAllowed ? 'User-confirmed' : 'Private / nicht veröffentlicht'}
          action="Evidence öffnen" onClick={() => onSelectMode(SystemMode.UNIVERSAL_DATASET_SERVER)} />
      </div>

      <section className="stitch-muted-surface rounded-xl p-3.5" aria-labelledby="current-state-title">
        <div className="flex items-start gap-3">
          <Smartphone className="h-4 w-4 text-signal-teal mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="current-state-title" className="font-section-title text-section-title text-ink-primary">Current State</h2>
            <p className="mt-0.5 text-body-secondary text-ink-quiet">Vier Zustände bleiben lesbar, ohne eine technische Tabelle vor die eigentliche Aufgabe zu stellen.</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className="stitch-status-cell rounded-lg p-2.5"><span className="font-mono-label text-mono-label text-ink-quiet block">DEVICE</span><span className="mt-1 block text-caption text-ink-primary">{device.connected ? device.model || 'Connected' : 'Not connected'}</span></div>
              <div className="stitch-status-cell rounded-lg p-2.5"><span className="font-mono-label text-mono-label text-ink-quiet block">AGENT</span><span className="mt-1 block text-caption text-ink-primary">{isAgentRunning ? 'Running' : 'Idle'}</span></div>
              <div className="stitch-status-cell rounded-lg p-2.5"><span className="font-mono-label text-mono-label text-ink-quiet block">ADB</span><span className="mt-1 block text-caption text-ink-primary">{actionBridgeArmed ? 'ARMED' : 'OFF'}</span></div>
              <div className="stitch-status-cell rounded-lg p-2.5"><span className="font-mono-label text-mono-label text-ink-quiet block">DATA</span><span className="mt-1 block text-caption text-ink-primary">{publicationAllowed ? 'User-confirmed' : 'Private'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-x-4 gap-y-2 text-caption text-ink-quiet" aria-label="Truth boundaries">
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-signal-teal" aria-hidden="true" />Prediction ≠ Device Output</span>
        <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-4 w-4 text-signal-teal" aria-hidden="true" />ADB separat</span>
        <span className="inline-flex items-center gap-1.5"><Database className="h-4 w-4 text-signal-teal" aria-hidden="true" />Receipts vor Claims</span>
      </section>

      <div className="flex items-center gap-2 text-caption text-ink-quiet">
        <Gamepad2 className="h-4 w-4 text-signal-teal" aria-hidden="true" />
        <span>Game profile wird im kompakten Header gewählt; technische Werkzeuge liegen unter Advanced.</span>
        <Sparkles className="h-3.5 w-3.5 text-signal-teal ml-auto shrink-0" aria-hidden="true" />
      </div>
    </section>
  );
};
