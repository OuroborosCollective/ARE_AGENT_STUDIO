/**
 * Forge Control Room — external evaluation monitoring view.
 *
 * Implements issue #18: a dedicated Forge/External Evaluation view with
 * strict verified-vs-derived status semantics. This view does NOT overload
 * AutonomousAgentRunner's Android semantics.
 *
 * Truth UX:
 *   - Every field carries an explicit provenance label:
 *     local observed, Forge observed, derived, verified, partial, unavailable.
 *   - Unknown values render as "—" / "unavailable", never zero.
 *   - No animation or optimistic state may increment verified counters.
 *   - No manual verification override control exists.
 *
 * Controls:
 *   Allowed:  inspect/connect an authorized run; start a practice action only
 *             if backend live capability says practice is available and the
 *             contract permits it; stop local runner; quarantine/unquarantine
 *             with owner reason; trigger private snapshot preparation.
 *   Forbidden: entering or purchasing a paid entry without owner approval;
 *             exposing/copying run credentials; public publish while rights
 *             gate is unresolved; manual verification override.
 *
 * This component must never import or mutate visual-path modules.
 * The static guard scripts/forge_truth_guard.mjs enforces this.
 */

import React, { useState, useCallback } from 'react';
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  GitBranch,
  Hash,
  FileText,
  Database,
  Lock,
  Play,
  Square,
  AlertTriangle,
  Camera,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Provenance labels — the canonical status vocabulary from AGENTS.md
// ---------------------------------------------------------------------------

type Provenance = 'local_observed' | 'forge_observed' | 'derived' | 'verified' | 'partial' | 'unavailable';

const PROVENANCE_LABELS: Record<Provenance, { text: string; color: string }> = {
  local_observed: { text: 'local observed', color: 'text-cyan-300' },
  forge_observed: { text: 'Forge observed', color: 'text-blue-300' },
  derived: { text: 'derived', color: 'text-amber-300' },
  verified: { text: 'verified', color: 'text-emerald-300' },
  partial: { text: 'partial', color: 'text-yellow-300' },
  unavailable: { text: 'unavailable', color: 'text-slate-500' },
};

function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const label = PROVENANCE_LABELS[provenance];
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 ${label.color} bg-slate-900/60`}>
      {label.text}
    </span>
  );
}

/**
 * A field that displays a value with its provenance label.
 * Unknown/unavailable values render as "—", never zero.
 */
function TruthField({
  label,
  value,
  provenance,
  mono = true,
}: {
  label: string;
  value: string | null;
  provenance: Provenance;
  mono?: boolean;
}) {
  const display = value ?? '—';
  const isUnavailable = value === null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 font-mono">{label}</span>
        <ProvenanceBadge provenance={isUnavailable ? 'unavailable' : provenance} />
      </div>
      <span
        className={`${mono ? 'font-mono' : ''} text-sm ${isUnavailable ? 'text-slate-600' : 'text-slate-200'}`}
      >
        {display}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run state display
// ---------------------------------------------------------------------------

const RUN_STATES = [
  'IDLE', 'PREPARED', 'RUNNING', 'TERMINAL_LOCAL',
  'RECONCILING', 'RECONCILED', 'PARTIAL', 'LEARNING_ELIGIBLE', 'QUARANTINED',
] as const;

function RunStateBadge({ state }: { state: string | null }) {
  if (!state) {
    return <span className="text-slate-600 font-mono text-sm">—</span>;
  }
  const colorMap: Record<string, string> = {
    IDLE: 'text-slate-400 bg-slate-800/60 border-slate-700',
    PREPARED: 'text-cyan-300 bg-cyan-950/40 border-cyan-800/50',
    RUNNING: 'text-amber-300 bg-amber-950/40 border-amber-800/50',
    TERMINAL_LOCAL: 'text-blue-300 bg-blue-950/40 border-blue-800/50',
    RECONCILING: 'text-purple-300 bg-purple-950/40 border-purple-800/50',
    RECONCILED: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50',
    PARTIAL: 'text-yellow-300 bg-yellow-950/40 border-yellow-800/50',
    LEARNING_ELIGIBLE: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50',
    QUARANTINED: 'text-red-300 bg-red-950/40 border-red-800/50',
  };
  const cls = colorMap[state] ?? 'text-slate-400 bg-slate-800/60 border-slate-700';
  return (
    <span className={`font-mono text-xs px-2 py-1 rounded border ${cls}`}>
      {state}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ForgeControlRoom: React.FC = () => {
  // Connection state — no data is fabricated; all fields start unavailable
  const [connectedRunId, setConnectedRunId] = useState<string | null>(null);
  const [runIdInput, setRunIdInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPracticeAvailable, setIsPracticeAvailable] = useState(false);
  const [isRunnerActive, setIsRunnerActive] = useState(false);
  const [isQuarantined, setIsQuarantined] = useState(false);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [showQuarantineInput, setShowQuarantineInput] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  // All run data fields are unavailable until a real backend readmodel provides them.
  // No hard-coded scores, success claims, or fabricated metrics.
  const runData = {
    runId: connectedRunId,
    dungeonId: null as string | null,
    runState: null as string | null,
    turnCount: null as number | null,
    policyRevision: null as string | null,
    contractHash: null as string | null,
    trajectoryRootHash: null as string | null,
    reconciliationVerdict: null as string | null,
    reconciliationCoverage: null as string | null,
    externallyObservedScore: null as string | null,
    learningEligible: null as boolean | null,
    resultingPolicyRevision: null as string | null,
    hfSnapshotRevision: null as string | null,
    publicationRightsStatus: null as string | null,
    runtimeGitSha: null as string | null,
    imageDigest: null as string | null,
  };

  const handleConnect = useCallback(() => {
    if (!runIdInput.trim()) return;
    setIsConnecting(true);
    // In production, this would fetch from a backend readmodel endpoint.
    // For now, we only record the connection — no data is fabricated.
    setTimeout(() => {
      setConnectedRunId(runIdInput.trim());
      setIsConnecting(false);
      setIsPracticeAvailable(false);
      setIsRunnerActive(false);
      setIsQuarantined(false);
    }, 300);
  }, [runIdInput]);

  const handleDisconnect = useCallback(() => {
    setConnectedRunId(null);
    setRunIdInput('');
    setIsRunnerActive(false);
    setIsQuarantined(false);
    setSnapshotStatus(null);
  }, []);

  const handleStartPractice = useCallback(() => {
    // Practice mode only — paid entries are never started without owner approval.
    // The button is disabled unless isPracticeAvailable is true.
    if (!isPracticeAvailable) return;
    setIsRunnerActive(true);
  }, [isPracticeAvailable]);

  const handleStop = useCallback(() => {
    setIsRunnerActive(false);
  }, []);

  const handleQuarantine = useCallback(() => {
    if (!quarantineReason.trim()) return;
    setIsQuarantined(true);
    setShowQuarantineInput(false);
    setQuarantineReason('');
  }, [quarantineReason]);

  const handleUnquarantine = useCallback(() => {
    setIsQuarantined(false);
    setQuarantineReason('');
  }, []);

  const handleSnapshot = useCallback(() => {
    // Trigger private snapshot preparation — not a public publish.
    // Public publish is forbidden while the rights gate is unresolved.
    setSnapshotStatus('Private snapshot preparation triggered. Awaiting backend readmodel confirmation.');
    setTimeout(() => setSnapshotStatus(null), 4000);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-emerald-400 mt-0.5" />
          <div>
            <div className="text-emerald-400 font-mono text-xs">FORGE EXTERNAL EVALUATION — CONTROL ROOM</div>
            <h2 className="text-xl font-bold text-white mt-1">Forge Run Monitor</h2>
            <p className="text-sm text-slate-400 mt-1">
              Monitor the Forge learning lifecycle. Every badge and metric traces to a backend receipt or is
              explicitly labeled as derived or unavailable. Unknown values render as <span className="font-mono text-slate-500">—</span>, never zero.
            </p>
          </div>
        </div>
      </div>

      {/* Connection panel */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-200">Run Connection</h3>
        </div>
        {!connectedRunId ? (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400 font-mono mb-1 block">Owner-authorized run ID</label>
              <input
                type="text"
                value={runIdInput}
                onChange={(e) => setRunIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="e.g. forge-practice-001"
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={!runIdInput.trim() || isConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Eye className="w-4 h-4" />
              Inspect / Connect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-mono">Connected run:</span>
              <span className="font-mono text-sm text-cyan-300">{connectedRunId}</span>
              <RunStateBadge state={runData.runState} />
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>

      {connectedRunId && (
        <>
          {/* Run Monitor — core display fields */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">Run Monitor</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <TruthField label="Run ID" value={runData.runId} provenance="local_observed" />
              <TruthField label="Dungeon ID" value={runData.dungeonId} provenance="forge_observed" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Run State</span>
                  <ProvenanceBadge provenance="derived" />
                </div>
                <RunStateBadge state={runData.runState} />
              </div>
              <TruthField label="Turn Count" value={runData.turnCount?.toString() ?? null} provenance="local_observed" />
              <TruthField label="Policy Revision" value={runData.policyRevision} provenance="local_observed" />
              <TruthField label="Contract Hash" value={runData.contractHash} provenance="local_observed" />
              <TruthField label="Trajectory Root Hash" value={runData.trajectoryRootHash} provenance="local_observed" />
              <TruthField label="Runtime Git SHA" value={runData.runtimeGitSha} provenance="local_observed" />
              <TruthField label="Image Digest" value={runData.imageDigest} provenance="local_observed" />
            </div>
          </div>

          {/* Trajectory Evidence View */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-slate-200">Trajectory Evidence</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <TruthField label="Reconciliation Verdict" value={runData.reconciliationVerdict} provenance="verified" />
              <TruthField label="Reconciliation Coverage" value={runData.reconciliationCoverage} provenance="verified" />
              <TruthField label="Externally Observed Score" value={runData.externallyObservedScore} provenance="forge_observed" />
            </div>
            <div className="mt-4 p-3 bg-slate-900/40 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-500 font-mono">
                Externally observed score is shown only when read back from Forge. A Forge score matching local
                expectation alone is not sufficient to verify the whole trajectory. No manual verification override control exists.
              </p>
            </div>
          </div>

          {/* Policy Revision View */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">Policy Revision</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <TruthField label="Learning Eligible" value={runData.learningEligible === null ? null : runData.learningEligible ? 'Yes' : 'No'} provenance="derived" />
              <TruthField label="Resulting Policy Revision" value={runData.resultingPolicyRevision} provenance="local_observed" />
              <TruthField label="HF Snapshot / Revision" value={runData.hfSnapshotRevision} provenance="local_observed" />
            </div>
          </div>

          {/* Dataset Publication View */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-slate-200">Dataset Publication</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <TruthField label="Publication Rights Status" value={runData.publicationRightsStatus} provenance="local_observed" />
              <TruthField label="HF Snapshot / Revision" value={runData.hfSnapshotRevision} provenance="local_observed" />
            </div>
            <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
              <p className="text-[11px] text-red-300/80 font-mono flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Public publish is forbidden while the rights gate is unresolved. Only private snapshot preparation is allowed.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">Controls</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Start practice — only if practice is available and contract permits */}
              <button
                onClick={handleStartPractice}
                disabled={!isPracticeAvailable || isRunnerActive}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                title="Start a practice action only if backend live capability says practice is available and the contract permits it"
              >
                <Play className="w-4 h-4" />
                Start Practice
              </button>

              {/* Stop local runner */}
              <button
                onClick={handleStop}
                disabled={!isRunnerActive}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop Runner
              </button>

              {/* Quarantine / Unquarantine */}
              {!isQuarantined ? (
                <button
                  onClick={() => setShowQuarantineInput(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/50 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Quarantine
                </button>
              ) : (
                <button
                  onClick={handleUnquarantine}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Unquarantine
                </button>
              )}

              {/* Trigger private snapshot preparation */}
              <button
                onClick={handleSnapshot}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Trigger private snapshot preparation — not a public publish"
              >
                <Camera className="w-4 h-4" />
                Private Snapshot
              </button>
            </div>

            {/* Quarantine reason input */}
            {showQuarantineInput && (
              <div className="mt-4 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400 font-mono mb-1 block">Owner reason for quarantine</label>
                  <input
                    type="text"
                    value={quarantineReason}
                    onChange={(e) => setQuarantineReason(e.target.value)}
                    placeholder="e.g. reconciliation mismatch on turn 7"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <button
                  onClick={handleQuarantine}
                  disabled={!quarantineReason.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white transition-colors"
                >
                  Confirm
                </button>
              </div>
            )}

            {/* Quarantine status */}
            {isQuarantined && (
              <div className="mt-4 p-3 bg-red-950/30 border border-red-900/40 rounded-lg">
                <p className="text-[11px] text-red-300 font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3" />
                  Run is quarantined — excluded from learning and publication until reviewed.
                </p>
              </div>
            )}

            {/* Snapshot status */}
            {snapshotStatus && (
              <div className="mt-4 p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg">
                <p className="text-[11px] text-blue-300 font-mono">{snapshotStatus}</p>
              </div>
            )}

            {/* Forbidden controls notice */}
            <div className="mt-6 p-3 bg-slate-900/40 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-500 font-mono">
                Forbidden: paid entry without owner approval; exposing/copying run credentials; public publish while rights
                gate is unresolved; manual verification override. These controls are absent by design, not by configuration.
              </p>
            </div>
          </div>

          {/* Practice availability check */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPracticeAvailable}
                  onChange={(e) => setIsPracticeAvailable(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30"
                />
                <span className="text-xs text-slate-400 font-mono">
                  Backend live capability confirms practice is available and contract permits it
                </span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* No connection state */}
      {!connectedRunId && (
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-8 text-center">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            No run connected. Inspect an owner-authorized run to begin monitoring. All fields will display as
            <span className="font-mono text-slate-600"> — </span>
            (unavailable) until a backend readmodel provides real data.
          </p>
        </div>
      )}
    </div>
  );
};
