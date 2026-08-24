import type {
  DeviceConfig,
  GameArchetype,
  LocalProject,
  LocalProjectRun,
  PlaystyleProfile,
} from '../types';

const DATABASE_NAME = 'are-agent-studio-project-runs-v1';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';
const RUN_STORE = 'runs';
const ACTIVE_RUN_KEY = 'are-agent-studio-active-run-v1';
const MAX_NAME_LENGTH = 80;
let fallbackIdCounter = 0;

export class WorkspaceStorageError extends Error {
  public readonly code: 'PERSISTENCE_UNAVAILABLE' | 'INVALID_WORKSPACE_RECORD' | 'PERSISTENCE_WRITE_FAILED';

  constructor(code: WorkspaceStorageError['code'], message: string) {
    super(message);
    this.name = 'WorkspaceStorageError';
    this.code = code;
  }
}

export interface WorkspaceRunSeed {
  device: DeviceConfig;
  gameArchetype: GameArchetype;
  gamePhase: string;
  publicationAllowed: boolean;
  currentPlaystyle: PlaystyleProfile;
}

export interface LocalWorkspaceSnapshot {
  projects: LocalProject[];
  runs: LocalProjectRun[];
  activeRunId: string | null;
  persistence: 'ready' | 'unavailable';
}

export function normalizeWorkspaceName(value: string, field = 'Name'): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > MAX_NAME_LENGTH) {
    throw new WorkspaceStorageError('INVALID_WORKSPACE_RECORD', `${field} must contain 1–${MAX_NAME_LENGTH} visible characters.`);
  }
  return normalized;
}

export function createLocalId(prefix: 'project' | 'run' | 'session', randomUUID?: () => string): string {
  const token = randomUUID?.() || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${++fallbackIdCounter}`;
  return `${prefix}-${token}`;
}

export function createLocalProject(name: string, now = Date.now(), id = createLocalId('project')): LocalProject {
  return {
    schemaVersion: 'are-agent-project.v1',
    id,
    name: normalizeWorkspaceName(name, 'Project name'),
    createdAt: now,
    updatedAt: now,
  };
}

export function createLocalProjectRun(
  projectId: string,
  name: string,
  seed: WorkspaceRunSeed,
  now = Date.now(),
  ids: { runId?: string; sessionId?: string } = {},
): LocalProjectRun {
  if (!projectId || typeof projectId !== 'string') {
    throw new WorkspaceStorageError('INVALID_WORKSPACE_RECORD', 'A run must belong to a local project.');
  }
  const runId = ids.runId || createLocalId('run');
  return {
    schemaVersion: 'are-agent-project-run.v1',
    id: runId,
    projectId,
    name: normalizeWorkspaceName(name, 'Run name'),
    sessionId: ids.sessionId || createLocalId('session'),
    policySeed: `are-policy-${runId}`,
    createdAt: now,
    updatedAt: now,
    recordedTelemetries: [],
    rules: [],
    interventions: [],
    device: { ...seed.device },
    gameArchetype: seed.gameArchetype,
    gamePhase: seed.gamePhase,
    publicationAllowed: seed.publicationAllowed,
    currentPlaystyle: { ...seed.currentPlaystyle },
    policyCheckpointJson: null,
    policyTrainedBatches: 0,
  };
}

function cloneRun(run: LocalProjectRun): LocalProjectRun {
  return JSON.parse(JSON.stringify(run)) as LocalProjectRun;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function readActiveRunId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_RUN_KEY);
  } catch {
    return null;
  }
}

function writeActiveRunId(runId: string | null): void {
  try {
    if (runId) localStorage.setItem(ACTIVE_RUN_KEY, runId);
    else localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // IndexedDB still holds the actual records. Failing to remember a UI selection is not data loss.
  }
}

/**
 * Browser-local project/run storage. Frames are kept in IndexedDB, never in
 * localStorage. This is intentionally not an account or multi-user boundary.
 */
export class ProjectRunStore {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private writeQueues = new Map<string, Promise<void>>();

  public available(): boolean {
    return isIndexedDbAvailable();
  }

  private async database(): Promise<IDBDatabase> {
    if (!isIndexedDbAvailable()) {
      throw new WorkspaceStorageError('PERSISTENCE_UNAVAILABLE', 'This browser does not provide IndexedDB. Project runs cannot be saved safely here.');
    }
    if (!this.databasePromise) {
      this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(PROJECT_STORE)) database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(RUN_STORE)) {
            const runs = database.createObjectStore(RUN_STORE, { keyPath: 'id' });
            runs.createIndex('projectId', 'projectId', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new WorkspaceStorageError('PERSISTENCE_UNAVAILABLE', request.error?.message || 'Could not open browser project storage.'));
      });
    }
    return this.databasePromise;
  }

  public async load(): Promise<LocalWorkspaceSnapshot> {
    if (!this.available()) return { projects: [], runs: [], activeRunId: null, persistence: 'unavailable' };
    try {
      const database = await this.database();
      const transaction = database.transaction([PROJECT_STORE, RUN_STORE], 'readonly');
      const projects = await requestResult(transaction.objectStore(PROJECT_STORE).getAll()) as LocalProject[];
      const runs = await requestResult(transaction.objectStore(RUN_STORE).getAll()) as LocalProjectRun[];
      await transactionDone(transaction);
      const projectIds = new Set(projects.map((project) => project.id));
      const safeRuns = runs.filter((run) => run?.schemaVersion === 'are-agent-project-run.v1' && projectIds.has(run.projectId));
      const requestedActiveRunId = readActiveRunId();
      return {
        projects: projects.filter((project) => project?.schemaVersion === 'are-agent-project.v1').sort((a, b) => b.updatedAt - a.updatedAt),
        runs: safeRuns.sort((a, b) => b.updatedAt - a.updatedAt),
        activeRunId: safeRuns.some((run) => run.id === requestedActiveRunId) ? requestedActiveRunId : null,
        persistence: 'ready',
      };
    } catch (error) {
      throw error instanceof WorkspaceStorageError
        ? error
        : new WorkspaceStorageError('PERSISTENCE_UNAVAILABLE', 'Could not read browser project storage.');
    }
  }

  public async saveProject(project: LocalProject): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    transaction.objectStore(PROJECT_STORE).put({ ...project, name: normalizeWorkspaceName(project.name, 'Project name'), updatedAt: Date.now() });
    try {
      await transactionDone(transaction);
    } catch (error) {
      throw new WorkspaceStorageError('PERSISTENCE_WRITE_FAILED', error instanceof Error ? error.message : 'Could not save local project.');
    }
  }

  public async saveRun(run: LocalProjectRun): Promise<void> {
    const snapshot = cloneRun({ ...run, name: normalizeWorkspaceName(run.name, 'Run name'), updatedAt: Date.now() });
    const previous = this.writeQueues.get(snapshot.id) || Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      const database = await this.database();
      const transaction = database.transaction(RUN_STORE, 'readwrite');
      transaction.objectStore(RUN_STORE).put(snapshot);
      await transactionDone(transaction);
    });
    this.writeQueues.set(snapshot.id, queued);
    try {
      await queued;
    } catch (error) {
      throw new WorkspaceStorageError('PERSISTENCE_WRITE_FAILED', error instanceof Error ? error.message : 'Could not save the local run.');
    } finally {
      if (this.writeQueues.get(snapshot.id) === queued) this.writeQueues.delete(snapshot.id);
    }
  }

  public async setActiveRun(runId: string | null): Promise<void> {
    if (runId) {
      const database = await this.database();
      const transaction = database.transaction(RUN_STORE, 'readonly');
      const selected = await requestResult(transaction.objectStore(RUN_STORE).get(runId)) as LocalProjectRun | undefined;
      await transactionDone(transaction);
      if (!selected) throw new WorkspaceStorageError('INVALID_WORKSPACE_RECORD', 'The selected local run does not exist.');
    }
    writeActiveRunId(runId);
  }

  public async getRun(runId: string): Promise<LocalProjectRun | null> {
    const database = await this.database();
    const transaction = database.transaction(RUN_STORE, 'readonly');
    const run = await requestResult(transaction.objectStore(RUN_STORE).get(runId)) as LocalProjectRun | undefined;
    await transactionDone(transaction);
    return run ? cloneRun(run) : null;
  }

  public async deleteProject(projectId: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction([PROJECT_STORE, RUN_STORE], 'readwrite');
    const projects = transaction.objectStore(PROJECT_STORE);
    const runs = transaction.objectStore(RUN_STORE);
    const projectRuns = await requestResult(runs.index('projectId').getAllKeys(projectId));
    projectRuns.forEach((runId) => runs.delete(runId));
    projects.delete(projectId);
    try {
      await transactionDone(transaction);
    } catch (error) {
      throw new WorkspaceStorageError('PERSISTENCE_WRITE_FAILED', error instanceof Error ? error.message : 'Could not delete local project.');
    }
  }
}

export const globalProjectRunStore = new ProjectRunStore();
