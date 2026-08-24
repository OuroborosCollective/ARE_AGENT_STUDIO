import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArchiveRestore, ChevronRight, Database, FolderKanban, LockKeyhole, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';
import type { LocalProject, LocalProjectRun } from '../types';

interface ProjectRunMenuProps {
  projects: LocalProject[];
  runs: LocalProjectRun[];
  activeRunId: string | null;
  persistence: 'loading' | 'ready' | 'unavailable' | 'error';
  persistenceMessage: string | null;
  onCreateProject: (projectName: string, firstRunName: string) => Promise<void>;
  onCreateRun: (projectId: string, runName: string) => Promise<void>;
  onSelectRun: (runId: string) => Promise<void>;
  onDeleteProject: (project: LocalProject) => Promise<void>;
}

function shortId(value: string): string {
  return value.replace(/^(project|run|session)-/, '').slice(0, 8) || value.slice(0, 8);
}

export const ProjectRunMenu: React.FC<ProjectRunMenuProps> = ({
  projects,
  runs,
  activeRunId,
  persistence,
  persistenceMessage,
  onCreateProject,
  onCreateRun,
  onSelectRun,
  onDeleteProject,
}) => {
  const [projectName, setProjectName] = useState('');
  const [firstRunName, setFirstRunName] = useState('Run 01');
  const [newRunProjectId, setNewRunProjectId] = useState<string | null>(null);
  const [newRunName, setNewRunName] = useState('Run 02');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<LocalProject | null>(null);
  const [deletionName, setDeletionName] = useState('');
  const deletionDialogRef = useRef<HTMLDivElement | null>(null);
  const cancelDeletionRef = useRef<HTMLButtonElement | null>(null);

  const runsByProject = useMemo(() => {
    const grouped = new Map<string, LocalProjectRun[]>();
    for (const run of runs) grouped.set(run.projectId, [...(grouped.get(run.projectId) || []), run]);
    return grouped;
  }, [runs]);

  useEffect(() => {
    if (!deletionTarget) return;
    cancelDeletionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDeletionTarget(null);
        setDeletionName('');
        return;
      }
      if (event.key === 'Tab') {
        const dialog = deletionDialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
        event.preventDefault();
        focusable[nextIndex].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deletionTarget]);

  const submitProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onCreateProject(projectName, firstRunName);
      setProjectName('');
      setFirstRunName('Run 01');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the local project.');
    } finally {
      setBusy(false);
    }
  };

  const submitRun = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRunProjectId) return;
    setBusy(true);
    setFormError(null);
    try {
      await onCreateRun(newRunProjectId, newRunName);
      setNewRunProjectId(null);
      setNewRunName('Run 02');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the local run.');
    } finally {
      setBusy(false);
    }
  };

  const selectRun = async (runId: string) => {
    setBusy(true);
    setFormError(null);
    try {
      await onSelectRun(runId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not resume the local run.');
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!deletionTarget || deletionName !== deletionTarget.name) return;
    setBusy(true);
    setFormError(null);
    try {
      await onDeleteProject(deletionTarget);
      setDeletionTarget(null);
      setDeletionName('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not delete the local project.');
    } finally {
      setBusy(false);
    }
  };

  const storageReady = persistence === 'ready';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-cyber-border bg-cyber-card p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-300"><FolderKanban className="w-4 h-4" /> LOCAL PROJECT RUNS</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Keep learning runs separate and resumable.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Each run has isolated frames, rules, DAgger interventions and a policy checkpoint. Storage is local to this browser profile; it is not a login, cloud backup or server-side tenant boundary.</p>
          </div>
          <div className={`shrink-0 rounded-xl border px-4 py-3 text-xs font-mono ${storageReady ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200' : 'border-amber-500/30 bg-amber-950/20 text-amber-100'}`}>
            <div className="flex items-center gap-2"><Save className="w-4 h-4" /><span>{persistence === 'loading' ? 'Opening local storage…' : storageReady ? 'IndexedDB: local persistence ready' : 'Local persistence unavailable'}</span></div>
            {persistenceMessage && <p className="mt-1 max-w-xs text-[10px] leading-relaxed opacity-80">{persistenceMessage}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={submitProject} className="rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-6">
          <div className="flex items-center gap-3"><span className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300"><Plus className="w-5 h-5" /></span><div><p className="font-mono text-[10px] font-bold tracking-wider text-cyan-300">NEW LOCAL PROJECT</p><h3 className="font-bold text-white">Name the learning effort first</h3></div></div>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-mono text-slate-300"><span className="mb-1.5 block text-slate-400">Project name</span><input required maxLength={80} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Arena navigation" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400" /></label>
            <label className="block text-xs font-mono text-slate-300"><span className="mb-1.5 block text-slate-400">First run name</span><input required maxLength={80} value={firstRunName} onChange={(event) => setFirstRunName(event.target.value)} placeholder="Run 01" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400" /></label>
            <button disabled={!storageReady || busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="w-4 h-4" /> Create project & run</button>
          </div>
        </form>

        <div className="rounded-2xl border border-cyber-border bg-cyber-card p-6">
          <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 w-5 h-5 shrink-0 text-emerald-300" /><div><h3 className="font-bold text-white">What is — and is not — restored</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">A restored run loads only its saved local learning state. Screen share, active recording, ADB output and provider credentials always start off and must be explicitly re-enabled by the operator.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><Database className="mb-2 w-4 h-4 text-cyan-300" /><strong className="block text-slate-100">Separated data</strong><span className="mt-1 block text-slate-500">Frames, rules and corrections.</span></div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><ArchiveRestore className="mb-2 w-4 h-4 text-purple-300" /><strong className="block text-slate-100">Checkpointed policy</strong><span className="mt-1 block text-slate-500">Weights and optimizer state per run.</span></div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><ShieldAlert className="mb-2 w-4 h-4 text-amber-300" /><strong className="block text-slate-100">No server account</strong><span className="mt-1 block text-slate-500">Browser-local, not multi-user auth.</span></div>
          </div>
        </div>
      </section>

      {formError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">{formError}</p>}

      <section className="rounded-2xl border border-cyber-border bg-cyber-card p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[10px] font-bold tracking-wider text-slate-400">SAVED PROJECTS</p><h3 className="mt-1 font-bold text-white">{projects.length ? `${projects.length} local project${projects.length === 1 ? '' : 's'}` : 'No local projects yet'}</h3></div><span className="font-mono text-xs text-slate-500">{runs.length} saved run{runs.length === 1 ? '' : 's'}</span></div>
        {!projects.length ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-8 text-center text-sm text-slate-400">Create a named project before recording. The first frame/action pair will remain inside its first run.</div>
        ) : (
          <div className="mt-5 space-y-4">
            {projects.map((project) => {
              const projectRuns = runsByProject.get(project.id) || [];
              return <article key={project.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><FolderKanban className="w-4 h-4 text-emerald-300" /><h4 className="font-bold text-white">{project.name}</h4></div><p className="mt-1 font-mono text-[10px] text-slate-500">local project · {projectRuns.length} run{projectRuns.length === 1 ? '' : 's'} · updated {new Date(project.updatedAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setNewRunProjectId(project.id); setNewRunName(`Run ${String(projectRuns.length + 1).padStart(2, '0')}`); }} disabled={!storageReady || busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> New run</button><button onClick={() => { setDeletionTarget(project); setDeletionName(''); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200 hover:bg-red-950/40 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete local</button></div></div>
                {newRunProjectId === project.id && <form onSubmit={submitRun} className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">New run name</span><input autoFocus required maxLength={80} value={newRunName} onChange={(event) => setNewRunName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" /></label><button disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Create & open</button><button type="button" onClick={() => setNewRunProjectId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Cancel</button></form>}
                <div className="mt-4 grid gap-2">
                  {projectRuns.length ? projectRuns.map((run) => <button key={run.id} onClick={() => void selectRun(run.id)} disabled={busy} aria-current={run.id === activeRunId ? 'page' : undefined} className={`flex w-full items-center justify-between gap-4 rounded-xl border px-3 py-3 text-left transition disabled:opacity-50 ${run.id === activeRunId ? 'border-cyan-400/50 bg-cyan-950/30' : 'border-slate-800 bg-black/20 hover:border-slate-600'}`}><span><span className="block text-sm font-semibold text-white">{run.name}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">run {shortId(run.id)} · session {shortId(run.sessionId)} · {run.recordedTelemetries.length} stored samples · {run.policyTrainedBatches} model steps</span></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-mono text-cyan-300">{run.id === activeRunId ? 'ACTIVE' : 'Resume'} <ChevronRight className="w-4 h-4" /></span></button>) : <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">No runs in this project yet.</p>}
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {deletionTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
          <div ref={deletionDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-lg rounded-2xl border border-red-400/40 bg-[#0b1019] p-6 shadow-2xl shadow-red-950/40">
            <div className="flex items-start gap-3"><span className="rounded-xl border border-red-500/30 bg-red-950/50 p-2 text-red-200"><Trash2 className="w-5 h-5" /></span><div><h3 id="delete-project-title" className="font-bold text-white">Delete local project?</h3><p className="mt-1 text-sm leading-relaxed text-slate-300">This permanently deletes the project’s {runsByProject.get(deletionTarget.id)?.length || 0} local run(s), saved frames, rules, corrections and policy checkpoints from this browser. It does not delete any separately accepted server receipt.</p></div></div>
            <label className="mt-5 block text-xs font-mono text-slate-300"><span className="mb-2 block text-slate-400">Type <strong className="text-white">{deletionTarget.name}</strong> to confirm</span><input value={deletionName} onChange={(event) => setDeletionName(event.target.value)} className="w-full rounded-xl border border-red-500/30 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400" /></label>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><button ref={cancelDeletionRef} onClick={() => { setDeletionTarget(null); setDeletionName(''); }} disabled={busy} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800">Cancel — keep local project</button><button onClick={() => void deleteProject()} disabled={busy || deletionName !== deletionTarget.name} className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">Delete local data</button></div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
