import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, LockKeyhole, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import type {
  OperationCorrectionDecision,
  OperationCorrectionReasonCode,
  OperationCorrectionReceipt,
  OperationLearningProjection,
  OperationRiskTier,
} from '../types';
import {
  buildOperationCorrectionDraft,
  type OperationCorrectionDraftInput,
  validateOperationCorrectionDraft,
} from '../services/operationCorrectionCodec';
import { globalOperationCorrectionGateway } from '../services/operationCorrectionGateway';

interface FormState {
  sessionId: string;
  sequenceIndex: number;
  missionId: string;
  attemptId: string;
  proposalId: string;
  operationType: string;
  actionSummary: string;
  targetRef: string;
  parametersSha256: string;
  policyRevisionSha256: string;
  observationEvidenceSha256: string;
  requestedAtEpoch: number;
  riskTier: OperationRiskTier;
  decision: OperationCorrectionDecision;
  reasonCode: OperationCorrectionReasonCode;
  ownerRef: string;
  rationale: string;
  correctedActionSummary: string;
  correctedParametersSha256: string;
  capturedAtEpoch: number;
  learningAllowed: boolean;
}

const initialForm: FormState = {
  sessionId: '',
  sequenceIndex: 0,
  missionId: '',
  attemptId: '',
  proposalId: '',
  operationType: '',
  actionSummary: '',
  targetRef: '',
  parametersSha256: '',
  policyRevisionSha256: '',
  observationEvidenceSha256: '',
  requestedAtEpoch: Date.now(),
  riskTier: 'external',
  decision: 'reject',
  reasonCode: 'MISSING_EVIDENCE',
  ownerRef: '',
  rationale: '',
  correctedActionSummary: '',
  correctedParametersSha256: '',
  capturedAtEpoch: Date.now(),
  learningAllowed: false,
};

const inputClass = 'signal-input w-full border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none';
const labelClass = 'block text-[11px] font-bold tracking-wide text-slate-300 mb-1.5';

function toDraftInput(form: FormState): OperationCorrectionDraftInput {
  return {
    context: {
      sessionId: form.sessionId,
      sequenceIndex: form.sequenceIndex,
      missionId: form.missionId || undefined,
      attemptId: form.attemptId || undefined,
    },
    proposal: {
      proposalId: form.proposalId,
      operationType: form.operationType,
      actionSummary: form.actionSummary,
      targetRef: form.targetRef || undefined,
      parametersSha256: form.parametersSha256,
      policyRevisionSha256: form.policyRevisionSha256,
      observationEvidenceSha256: form.observationEvidenceSha256,
      requestedAtEpoch: form.requestedAtEpoch,
      riskTier: form.riskTier,
    },
    correction: {
      decision: form.decision,
      reasonCode: form.reasonCode,
      ownerRef: form.ownerRef,
      rationale: form.rationale || undefined,
      correctedActionSummary: form.correctedActionSummary || undefined,
      correctedParametersSha256: form.correctedParametersSha256 || undefined,
      capturedAtEpoch: form.capturedAtEpoch,
    },
    learningAllowed: form.learningAllowed,
  };
}

function recordLabel(decision: OperationCorrectionDecision): string {
  if (decision === 'approve') return 'Record approval as feedback only';
  if (decision === 'amend') return 'Record amendment as feedback only';
  return 'Record rejection';
}

export const OperationCorrectionStudio: React.FC = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<OperationCorrectionReceipt | null>(null);
  const [projection, setProjection] = useState<OperationLearningProjection | null>(null);
  const [status, setStatus] = useState<{ tone: 'neutral' | 'success' | 'error'; text: string }>({
    tone: 'neutral',
    text: 'No correction has been sent. Recording feedback never executes the proposed operation.',
  });

  const preflightErrors = useMemo(() => validateOperationCorrectionDraft(toDraftInput(form)), [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const refreshProjection = async () => {
    const result = await globalOperationCorrectionGateway.getCandidates();
    if (!result.success || !result.projection) {
      setStatus({ tone: 'error', text: `Candidate projection unavailable: ${result.error || 'no response'}` });
      return;
    }
    setProjection(result.projection);
    setStatus({ tone: 'neutral', text: `Candidate projection returned by the configured daemon for ledger ${result.projection.source_ledger_sha256}. This view is not a receipt or execution record.` });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateOperationCorrectionDraft(toDraftInput(form));
    setSubmitErrors(errors);
    if (errors.length) {
      setStatus({ tone: 'error', text: 'Nothing was sent. Correct the listed evidence or consent fields first.' });
      return;
    }
    setIsSubmitting(true);
    setStatus({ tone: 'neutral', text: 'Submitting correction evidence to the local append-only ledger…' });
    try {
      const result = await globalOperationCorrectionGateway.push(buildOperationCorrectionDraft(toDraftInput(form)));
      if (!result.success || !result.receipt) {
        setStatus({ tone: 'error', text: `Correction was not accepted: ${result.error || 'missing verified receipt'}` });
        return;
      }
      setReceipt(result.receipt);
      setSubmitErrors([]);
      setStatus({
        tone: 'success',
        text: `Correction evidence accepted: ${result.receipt.accepted_rows} new row(s), ${result.receipt.duplicate_rows} duplicate row(s). No external action was executed.`,
      });
      await refreshProjection();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="operation-correction-title" className="space-y-5">
      <div className="glass-panel rounded-2xl border border-cyan-500/30 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2.5"><ShieldCheck className="h-5 w-5 text-cyan-300" /></div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">SIDE-CHANNEL LEARNING</p>
            <h2 id="operation-correction-title" className="mt-1 text-2xl font-bold text-white">Human Correction for Agent Operations</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Bind an owner&apos;s approval, rejection, or amendment to the exact operation proposal, policy revision, and observation evidence. The ledger records feedback only: it cannot execute an action, grant authority, or change a live runtime policy.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-amber-500/35 p-4" role="note">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div className="text-sm text-amber-100">
            <span className="font-bold">Truth boundary.</span> A correction receipt proves that a local ledger accepted the described feedback. It does not prove that the proposed action happened, is safe to happen, or is authorized to happen later.
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 xl:grid-cols-2">
          <fieldset className="glass-panel rounded-xl border border-slate-800 p-4">
            <legend className="px-1 text-sm font-bold text-white">1. Bound proposal context</legend>
            <p className="mb-4 text-xs leading-5 text-slate-400">Use opaque references and hashes; do not place credentials or raw parameters in this ledger.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={labelClass}>Session reference *</span><input className={inputClass} value={form.sessionId} onChange={(e) => update('sessionId', e.target.value)} placeholder="session-2026-08-23" /></label>
              <label><span className={labelClass}>Sequence index *</span><input className={inputClass} type="number" min="0" value={form.sequenceIndex} onChange={(e) => update('sequenceIndex', Number(e.target.value))} /></label>
              <label><span className={labelClass}>Mission reference</span><input className={inputClass} value={form.missionId} onChange={(e) => update('missionId', e.target.value)} placeholder="mission-123" /></label>
              <label><span className={labelClass}>Attempt reference</span><input className={inputClass} value={form.attemptId} onChange={(e) => update('attemptId', e.target.value)} placeholder="attempt-1" /></label>
              <label><span className={labelClass}>Proposal reference *</span><input className={inputClass} value={form.proposalId} onChange={(e) => update('proposalId', e.target.value)} placeholder="proposal-001" /></label>
              <label><span className={labelClass}>Operation type *</span><input className={inputClass} value={form.operationType} onChange={(e) => update('operationType', e.target.value)} placeholder="agent.route.select" /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Action summary *</span><input className={inputClass} value={form.actionSummary} onChange={(e) => update('actionSummary', e.target.value)} placeholder="Describe exactly what was proposed — without parameters or secrets." /></label>
              <label><span className={labelClass}>Target reference</span><input className={inputClass} value={form.targetRef} onChange={(e) => update('targetRef', e.target.value)} placeholder="resource/ref" /></label>
              <label><span className={labelClass}>Risk tier *</span><select className={inputClass} value={form.riskTier} onChange={(e) => update('riskTier', e.target.value as OperationRiskTier)}><option value="reversible">Reversible</option><option value="external">External effect</option><option value="irreversible">Irreversible</option></select></label>
              <label className="sm:col-span-2"><span className={labelClass}>Parameters SHA-256 *</span><input className={`${inputClass} font-mono text-xs`} value={form.parametersSha256} onChange={(e) => update('parametersSha256', e.target.value)} placeholder="64 lowercase hex characters" /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Policy revision SHA-256 *</span><input className={`${inputClass} font-mono text-xs`} value={form.policyRevisionSha256} onChange={(e) => update('policyRevisionSha256', e.target.value)} placeholder="64 lowercase hex characters" /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Observation-evidence SHA-256 *</span><input className={`${inputClass} font-mono text-xs`} value={form.observationEvidenceSha256} onChange={(e) => update('observationEvidenceSha256', e.target.value)} placeholder="64 lowercase hex characters" /></label>
              <label><span className={labelClass}>Proposal time (epoch ms) *</span><input className={inputClass} type="number" min="0" value={form.requestedAtEpoch} onChange={(e) => update('requestedAtEpoch', Number(e.target.value))} /></label>
              <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2"><span className="block text-[11px] font-bold tracking-wide text-slate-300">Execution state</span><span className="mt-1 block text-sm font-mono text-amber-300">not_executed (fixed)</span></div>
            </div>
          </fieldset>

          <fieldset className="glass-panel rounded-xl border border-slate-800 p-4">
            <legend className="px-1 text-sm font-bold text-white">2. Owner correction and learning consent</legend>
            <p className="mb-4 text-xs leading-5 text-slate-400">The safe default is rejection with learning disabled. An approval here is a label, never permission for the Studio to act.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={labelClass}>Decision *</span><select className={inputClass} value={form.decision} onChange={(e) => update('decision', e.target.value as OperationCorrectionDecision)}><option value="reject">Reject</option><option value="amend">Amend</option><option value="approve">Approve as feedback only</option></select></label>
              <label><span className={labelClass}>Reason *</span><select className={inputClass} value={form.reasonCode} onChange={(e) => update('reasonCode', e.target.value as OperationCorrectionReasonCode)}><option value="MISSING_EVIDENCE">Missing evidence</option><option value="WRONG_TARGET">Wrong target</option><option value="SCOPE_TOO_BROAD">Scope too broad</option><option value="CONSENT_REQUIRED">Consent required</option><option value="UNSAFE_EFFECT">Unsafe effect</option><option value="INCORRECT_ACTION">Incorrect action</option><option value="OTHER">Other</option></select></label>
              <label><span className={labelClass}>Owner reference *</span><input className={inputClass} value={form.ownerRef} onChange={(e) => update('ownerRef', e.target.value)} placeholder="owner-ref" /></label>
              <label><span className={labelClass}>Correction time (epoch ms) *</span><input className={inputClass} type="number" min="0" value={form.capturedAtEpoch} onChange={(e) => update('capturedAtEpoch', Number(e.target.value))} /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Rationale (optional)</span><textarea className={`${inputClass} min-h-20`} value={form.rationale} onChange={(e) => update('rationale', e.target.value)} placeholder="State why the operation was approved, rejected, or amended. Do not paste credentials." /></label>
              {form.decision === 'amend' && <>
                <label className="sm:col-span-2"><span className={labelClass}>Corrected action summary *</span><input className={inputClass} value={form.correctedActionSummary} onChange={(e) => update('correctedActionSummary', e.target.value)} placeholder="Describe the corrected operation without raw parameters." /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Corrected parameters SHA-256 *</span><input className={`${inputClass} font-mono text-xs`} value={form.correctedParametersSha256} onChange={(e) => update('correctedParametersSha256', e.target.value)} placeholder="64 lowercase hex characters" /></label>
              </>}
            </div>

            <fieldset className="mt-5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
              <legend className="px-1 text-sm font-bold text-cyan-100">Offline learning consent</legend>
              <label className="flex cursor-pointer gap-3">
                <input id="operation-learning-consent" type="checkbox" checked={form.learningAllowed} onChange={(e) => update('learningAllowed', e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
                <span className="text-sm text-slate-200">Allow this one correction to appear in a deterministic, non-executing learning-candidate projection.</span>
              </label>
              <p className="mt-2 text-xs leading-5 text-slate-400">Off by default. There is no standing authorization, no automatic retraining, and no future execution grant.</p>
            </fieldset>
          </fieldset>
        </div>

        <div className="glass-panel rounded-xl border border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-cyan-300" /><h3 className="font-bold text-white">Action preview — feedback contract</h3></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-[10px] font-bold tracking-wide text-slate-500">PROPOSED OPERATION</dt><dd className="mt-1 break-words text-slate-200">{form.operationType || 'not specified'}</dd></div>
            <div><dt className="text-[10px] font-bold tracking-wide text-slate-500">TARGET</dt><dd className="mt-1 break-words text-slate-200">{form.targetRef || 'not specified'}</dd></div>
            <div><dt className="text-[10px] font-bold tracking-wide text-slate-500">OWNER LABEL</dt><dd className="mt-1 text-slate-200">{form.decision}</dd></div>
            <div><dt className="text-[10px] font-bold tracking-wide text-slate-500">EXECUTION</dt><dd className="mt-1 font-mono text-amber-300">not_executed</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-400">The request that is shown here is exactly the feedback record submitted to the ledger. Any change to these fields produces a different content identity and requires a new receipt.</p>
        </div>

        {submitErrors.length > 0 && <div className="rounded-xl border border-red-500/35 bg-red-950/30 p-4" role="alert"><p className="font-bold text-red-200">Nothing has been recorded.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-100">{submitErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={isSubmitting} className="signal-action inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />{isSubmitting ? 'Recording feedback…' : recordLabel(form.decision)}</button>
          <button type="button" onClick={refreshProjection} className="glass-panel inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"><RefreshCw className="h-4 w-4" />Read candidate projection</button>
        </div>
      </form>

      <div role="status" aria-live="polite" className={`glass-panel rounded-xl border p-4 text-sm ${status.tone === 'error' ? 'border-red-500/35 text-red-100' : status.tone === 'success' ? 'border-emerald-500/35 text-emerald-100' : 'border-slate-700 text-slate-300'}`}>
        {status.tone === 'success' ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <LockKeyhole className="mr-2 inline h-4 w-4" />}{status.text}
      </div>

      {receipt && <div className="glass-panel rounded-xl border border-emerald-500/30 p-4"><p className="text-sm font-bold text-emerald-200">Verified correction receipt</p><div className="mt-3 grid gap-3 text-xs sm:grid-cols-2"><p><span className="text-slate-400">Accepted / duplicate:</span> <span className="font-mono text-emerald-100">{receipt.accepted_rows} / {receipt.duplicate_rows}</span></p><p><span className="text-slate-400">Ledger SHA-256:</span> <span className="break-all font-mono text-emerald-100">{receipt.ledger_sha256}</span></p><p className="sm:col-span-2"><span className="text-slate-400">Receipt SHA-256:</span> <span className="break-all font-mono text-emerald-100">{receipt.receipt_sha256}</span></p></div></div>}

      {projection && <div className="glass-panel rounded-xl border border-purple-500/30 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-purple-100">Deterministic learning candidates</p><p className="mt-1 text-xs text-slate-400">These are offline review candidates only. They carry no execution authority.</p></div><span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2.5 py-1 text-xs font-mono text-purple-200">{projection.candidate_count} candidate(s)</span></div><div className="mt-4 space-y-3">{projection.candidates.length === 0 ? <p className="text-sm text-slate-400">No owner-consented corrections are in the projection.</p> : projection.candidates.map((candidate) => <div key={candidate.candidate_id} className="rounded-lg border border-slate-700 bg-slate-950/35 p-3 text-sm"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono text-purple-200">{candidate.material.operation_type}</span><span className="text-slate-400">→</span><span className="font-bold text-slate-100">{candidate.material.decision}</span><span className="text-slate-400">({candidate.material.reason_code})</span><span className="ml-auto rounded border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-200">NOT EXECUTABLE</span></div><p className="mt-2 text-xs text-slate-400">{candidate.correction_count} consented correction(s) · candidate <span className="font-mono text-slate-300">{candidate.candidate_id}</span></p></div>)}</div></div>}
    </section>
  );
};
