import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SystemMode,
  TouchAction,
  FrameTelemetry,
  TacticalRule,
  AgentPrediction,
  DeviceConfig,
  GameArchetype,
  PlaystyleProfile,
  DAggerIntervention,
  PolicyArchitectureType,
  TouchEventType,
  LocalProject,
  LocalProjectRun,
} from './types';
import {
  DEFAULT_DEVICE,
  PLAYSTYLE_PROFILES,
  GENRE_KNOWLEDGE_SCHEMAS
} from './constants';
import { synthesizePlaybookRules } from './services/advisoryService';
import { globalNeuralPolicy } from './services/neuralPolicyEngine';
import { globalServerGateway } from './services/serverSyncGateway';
import { createLocalProject, createLocalProjectRun, globalProjectRunStore } from './services/projectRunStore';
import { Navbar } from './components/Navbar';
import { DeviceCanvas } from './components/DeviceCanvas';
import { ObservationRecorder } from './components/ObservationRecorder';
import { GenreKnowledgeMatrix } from './components/GenreKnowledgeMatrix';
import { TacticalMemoryView } from './components/TacticalMemoryView';
import { PolicyTrainingStudio } from './components/PolicyTrainingStudio';
import { DAggerStudio } from './components/DAggerStudio';
import { OperationCorrectionStudio } from './components/OperationCorrectionStudio';
import { AutonomousAgentRunner } from './components/AutonomousAgentRunner';
import { UniversalDatasetServer } from './components/UniversalDatasetServer';
import { RuntimeVerificationStudio } from './components/RuntimeVerificationStudio';
import { PlaystyleProfiler } from './components/PlaystyleProfiler';
import { InteractiveTerminal } from './components/InteractiveTerminal';
import { BenchmarkStudio } from './components/BenchmarkStudio';
import { CodebaseExporter } from './components/CodebaseExporter';
import { ProjectRunMenu } from './components/ProjectRunMenu';
import { AdvisoryRoutePanel } from './components/AdvisoryRoutePanel';

export default function App() {
  const [activeMode, setActiveMode] = useState<SystemMode>(SystemMode.PROJECT_RUNS);
  const [device, setDevice] = useState<DeviceConfig>(DEFAULT_DEVICE);
  const [gameArchetype, setGameArchetype] = useState<GameArchetype>(GameArchetype.FPS);

  // Project runs are browser-local IndexedDB records, never an implied account
  // or server-side tenancy boundary.
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [runs, setRuns] = useState<LocalProjectRun[]>([]);
  const [activeRun, setActiveRun] = useState<LocalProjectRun | null>(null);
  const activeRunRef = useRef<LocalProjectRun | null>(null);
  const [workspacePersistence, setWorkspacePersistence] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  // Real Observation & Telemetry State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTelemetries, setRecordedTelemetries] = useState<FrameTelemetry[]>([]);
  const [latestAction, setLatestAction] = useState<TouchAction | null>(null);
  const [latestFrameSnapshot, setLatestFrameSnapshot] = useState<string | null>(null);
  const [latestVisualFeatures, setLatestVisualFeatures] = useState<number[] | null>(null);
  const [publicationAllowed, setPublicationAllowed] = useState(false);
  const frameCounterRef = useRef(1);
  const sessionIdRef = useRef('');

  // Real-time Vision Detected Metrics from live device screen
  const [, setLiveVisionState] = useState({
    motionIntensity: 0,
  });

  // Tactical Playbook Memory
  const [rules, setRules] = useState<TacticalRule[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // DAgger Interventions Ledger
  const [interventions, setInterventions] = useState<DAggerIntervention[]>([]);
  const [isFineTuningDAgger, setIsFineTuningDAgger] = useState(false);

  // Playstyle Profile
  const [currentPlaystyle, setCurrentPlaystyle] = useState<PlaystyleProfile>(PLAYSTYLE_PROFILES[0]);

  // Autonomous Agent Control Loop State
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [actionBridgeArmed, setActionBridgeArmed] = useState(false);
  const [injectionStatus, setInjectionStatus] = useState<string | null>(null);
  const injectionInFlightRef = useRef(false);
  const [agentPrediction, setAgentPrediction] = useState<AgentPrediction | null>(null);
  const [gamePhase, setGamePhase] = useState<string>('COMBAT');

  const disarmForWorkspaceBoundary = useCallback((reason: string) => {
    setIsRecording(false);
    setIsAgentRunning(false);
    setActionBridgeArmed(false);
    setAgentPrediction(null);
    setInjectionStatus(reason);
  }, []);

  const updateRunList = useCallback((nextRun: LocalProjectRun) => {
    setRuns((previous) => [nextRun, ...previous.filter((run) => run.id !== nextRun.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const restoreRun = useCallback((run: LocalProjectRun, notice: string) => {
    disarmForWorkspaceBoundary('Workspace boundary changed: recording and Android output are off.');
    globalNeuralPolicy.reset(run.policySeed);
    const checkpointLoaded = run.policyCheckpointJson ? globalNeuralPolicy.loadWeightsJSON(run.policyCheckpointJson) : true;
    if (!checkpointLoaded) globalNeuralPolicy.reset(run.policySeed);

    activeRunRef.current = run;
    setActiveRun(run);
    setDevice({ ...run.device });
    setGameArchetype(run.gameArchetype);
    setRecordedTelemetries([...run.recordedTelemetries]);
    setRules([...run.rules]);
    setInterventions([...run.interventions]);
    setPublicationAllowed(run.publicationAllowed);
    setCurrentPlaystyle({ ...run.currentPlaystyle });
    setGamePhase(run.gamePhase);
    setLatestAction(null);
    setLatestFrameSnapshot(null);
    setLatestVisualFeatures(null);
    setLiveVisionState({ motionIntensity: 0 });
    sessionIdRef.current = run.sessionId;
    frameCounterRef.current = Math.max(0, ...run.recordedTelemetries.map((telemetry) => telemetry.frameId)) + 1;
    setWorkspaceMessage(checkpointLoaded ? notice : `${notice} The stored policy checkpoint was invalid, so this run was reset to its deterministic seed.`);
  }, [disarmForWorkspaceBoundary]);

  const makeActiveRunSnapshot = useCallback((overrides: Partial<LocalProjectRun> = {}): LocalProjectRun | null => {
    const base = activeRunRef.current;
    if (!base) return null;
    return {
      ...base,
      ...overrides,
      updatedAt: Date.now(),
      recordedTelemetries: overrides.recordedTelemetries ?? recordedTelemetries,
      rules: overrides.rules ?? rules,
      interventions: overrides.interventions ?? interventions,
      device: overrides.device ?? { ...device },
      gameArchetype: overrides.gameArchetype ?? gameArchetype,
      gamePhase: overrides.gamePhase ?? gamePhase,
      publicationAllowed: overrides.publicationAllowed ?? publicationAllowed,
      currentPlaystyle: overrides.currentPlaystyle ?? { ...currentPlaystyle },
      policyCheckpointJson: overrides.policyCheckpointJson ?? globalNeuralPolicy.exportWeightsJSON(),
      policyTrainedBatches: overrides.policyTrainedBatches ?? globalNeuralPolicy.totalTrainedBatches,
    };
  }, [recordedTelemetries, rules, interventions, device, gameArchetype, gamePhase, publicationAllowed, currentPlaystyle]);

  const persistActiveRun = useCallback(async (overrides: Partial<LocalProjectRun> = {}): Promise<LocalProjectRun | null> => {
    const snapshot = makeActiveRunSnapshot(overrides);
    if (!snapshot) return null;
    try {
      await globalProjectRunStore.saveRun(snapshot);
      updateRunList(snapshot);
      if (activeRunRef.current?.id === snapshot.id) {
        activeRunRef.current = snapshot;
        setActiveRun(snapshot);
      }
      setWorkspacePersistence('ready');
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the local project run.';
      setWorkspacePersistence('error');
      setWorkspaceMessage(`Local persistence failed. Recording and Android output were stopped: ${message}`);
      disarmForWorkspaceBoundary('Local persistence failed; recording and Android output are disarmed.');
      throw error;
    }
  }, [disarmForWorkspaceBoundary, makeActiveRunSnapshot, updateRunList]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const workspace = await globalProjectRunStore.load();
        if (cancelled) return;
        setProjects(workspace.projects);
        setRuns(workspace.runs);
        setWorkspacePersistence(workspace.persistence);
        if (workspace.persistence !== 'ready') {
          setWorkspaceMessage('This browser cannot provide IndexedDB. Create a project only after local persistence is available.');
          return;
        }
        const selectedRun = workspace.activeRunId ? workspace.runs.find((run) => run.id === workspace.activeRunId) : null;
        if (selectedRun) {
          restoreRun(selectedRun, `Restored local run “${selectedRun.name}”. Screen sharing, recording and Android output remain off.`);
          setActiveMode(SystemMode.OBSERVE_RECORD);
        } else {
          setWorkspaceMessage('Create a local project and named run before recording frame/action pairs.');
        }
      } catch (error) {
        if (cancelled) return;
        setWorkspacePersistence('error');
        setWorkspaceMessage(error instanceof Error ? error.message : 'Could not open local project storage.');
      }
    })();
    return () => { cancelled = true; };
  }, [restoreRun]);

  const createProjectAndRun = useCallback(async (projectName: string, runName: string) => {
    if (!globalProjectRunStore.available()) throw new Error('This browser cannot persist project runs safely.');
    const project = createLocalProject(projectName);
    const run = createLocalProjectRun(project.id, runName, {
      device,
      gameArchetype,
      gamePhase,
      publicationAllowed,
      currentPlaystyle,
    });
    await globalProjectRunStore.saveProject(project);
    await globalProjectRunStore.saveRun(run);
    await globalProjectRunStore.setActiveRun(run.id);
    setProjects((previous) => [project, ...previous.filter((item) => item.id !== project.id)]);
    updateRunList(run);
    restoreRun(run, `Created local project “${project.name}” and run “${run.name}”.`);
    setWorkspacePersistence('ready');
    setActiveMode(SystemMode.OBSERVE_RECORD);
  }, [currentPlaystyle, device, gameArchetype, gamePhase, publicationAllowed, restoreRun, updateRunList]);

  const createRun = useCallback(async (projectId: string, runName: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error('The selected project no longer exists locally.');
    await persistActiveRun();
    const run = createLocalProjectRun(projectId, runName, {
      device,
      gameArchetype,
      gamePhase,
      publicationAllowed,
      currentPlaystyle,
    });
    const updatedProject = { ...project, updatedAt: Date.now() };
    await globalProjectRunStore.saveProject(updatedProject);
    await globalProjectRunStore.saveRun(run);
    await globalProjectRunStore.setActiveRun(run.id);
    setProjects((previous) => [updatedProject, ...previous.filter((item) => item.id !== projectId)].sort((a, b) => b.updatedAt - a.updatedAt));
    updateRunList(run);
    restoreRun(run, `Created and opened local run “${run.name}”.`);
    setWorkspacePersistence('ready');
    setActiveMode(SystemMode.OBSERVE_RECORD);
  }, [currentPlaystyle, device, gameArchetype, gamePhase, persistActiveRun, projects, publicationAllowed, restoreRun, updateRunList]);

  const selectRun = useCallback(async (runId: string) => {
    if (activeRunRef.current?.id === runId) return;
    await persistActiveRun();
    const run = await globalProjectRunStore.getRun(runId);
    if (!run) throw new Error('The selected local run was not found.');
    await globalProjectRunStore.setActiveRun(run.id);
    restoreRun(run, `Resumed local run “${run.name}”. Screen sharing, recording and Android output remain off.`);
    setWorkspacePersistence('ready');
    setActiveMode(SystemMode.OBSERVE_RECORD);
  }, [persistActiveRun, restoreRun]);

  const deleteProject = useCallback(async (project: LocalProject) => {
    if (activeRunRef.current?.projectId === project.id) {
      await persistActiveRun();
    }
    await globalProjectRunStore.deleteProject(project.id);
    setProjects((previous) => previous.filter((item) => item.id !== project.id));
    setRuns((previous) => previous.filter((run) => run.projectId !== project.id));
    if (activeRunRef.current?.projectId === project.id) {
      await globalProjectRunStore.setActiveRun(null);
      activeRunRef.current = null;
      setActiveRun(null);
      disarmForWorkspaceBoundary('Active local project deleted: recording and Android output are off.');
      globalNeuralPolicy.reset();
      setRecordedTelemetries([]);
      setRules([]);
      setInterventions([]);
      setLatestAction(null);
      setLatestFrameSnapshot(null);
      setLatestVisualFeatures(null);
      setWorkspaceMessage(`Deleted local project “${project.name}”. It was not a server-side dataset deletion.`);
      setActiveMode(SystemMode.PROJECT_RUNS);
    }
  }, [disarmForWorkspaceBoundary, persistActiveRun]);

  // Global Killswitch listener (ESC key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAgentRunning) {
        setIsAgentRunning(false);
        setActionBridgeArmed(false);
        setInjectionStatus('ADB output disarmed by ESC killswitch.');
        console.warn('EMERGENCY KILLSWITCH TRIGGERED VIA KEYBOARD');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAgentRunning]);

  // Handle DAgger takeover when human touches screen during autonomous control
  const handleDAggerInterventionTriggered = useCallback((agentAction: [number, number], humanAction: TouchAction) => {
    const newIntervention: DAggerIntervention = {
      id: `DAGGER-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      frameSnapshot: latestFrameSnapshot || '',
      agentPredictedAction: agentAction,
      humanCorrectedAction: [humanAction.x, humanAction.y],
      lossDelta: Math.hypot(agentAction[0] - humanAction.x, agentAction[1] - humanAction.y),
      resolved: true,
      notes: `Real Human Takeover in ${gamePhase}: Divergence corrected from [${agentAction[0].toFixed(2)}, ${agentAction[1].toFixed(2)}] to [${humanAction.x.toFixed(2)}, ${humanAction.y.toFixed(2)}]`,
      gamePhase,
      genre: gameArchetype,
    };
    const nextInterventions = [newIntervention, ...interventions];
    setInterventions(nextInterventions);

    // Perform immediate online backpropagation in real neural policy
    if (latestVisualFeatures?.length === 16) {
      globalNeuralPolicy.trainStep(latestVisualFeatures, [humanAction.x, humanAction.y, humanAction.pressure, humanAction.type === TouchEventType.UP ? 0 : 1]);
    }
    void persistActiveRun({
      interventions: nextInterventions,
      policyCheckpointJson: globalNeuralPolicy.exportWeightsJSON(),
      policyTrainedBatches: globalNeuralPolicy.totalTrainedBatches,
    }).catch(() => undefined);
  }, [interventions, latestFrameSnapshot, latestVisualFeatures, gamePhase, gameArchetype, persistActiveRun]);

  // Handle Real Human Touch over screen
  const handleHumanTouch = useCallback((action: TouchAction) => {
    setLatestAction(action);

    if (isAgentRunning) {
      setIsAgentRunning(false);
      setActionBridgeArmed(false);
      setInjectionStatus('ADB output disarmed by human takeover.');
      console.warn('Human touch detected on device screen! Agent disengaged automatically.');
    }

    if (isRecording && latestFrameSnapshot && activeRunRef.current) {
      const featVec = latestVisualFeatures?.length === 16 ? [...latestVisualFeatures] : undefined;

      const telemetry: FrameTelemetry = {
        frameId: frameCounterRef.current++,
        timestamp: Date.now(),
        imageDataUrl: latestFrameSnapshot,
        action,
        gameState: gamePhase,
        hpPercentage: null,
        manaPercentage: null,
        enemiesDetected: null,
        tacticalNote: `Human ${action.type} @ (${action.x.toFixed(2)}, ${action.y.toFixed(2)}) on live screen`,
        genre: gameArchetype,
        clientId: globalServerGateway.getClientUUID(),
        sessionId: sessionIdRef.current,
        featureVector: featVec,
        publicationAllowed,
      };
      const nextTelemetries = [...recordedTelemetries.slice(-99), telemetry];
      setRecordedTelemetries(nextTelemetries);
      void persistActiveRun({ recordedTelemetries: nextTelemetries }).catch(() => {
        setRecordedTelemetries((previous) => previous.filter((item) => item.frameId !== telemetry.frameId));
      });
    }
  }, [isAgentRunning, isRecording, latestFrameSnapshot, latestVisualFeatures, gamePhase, gameArchetype, publicationAllowed, recordedTelemetries, persistActiveRun]);

  // Handle Real Canvas Snapshot & live computed pixel metrics
  const handleFrameSnapshot = useCallback((dataUrl: string, motionIntensity: number, featureVector: number[]) => {
    setLatestFrameSnapshot(dataUrl);
    setLiveVisionState({ motionIntensity });
    setLatestVisualFeatures(featureVector);
  }, []);

  // Real-Time Agent Autonomous Decision Loop powered by NeuralPolicyEngine
  useEffect(() => {
    if (!isAgentRunning || !activeRunRef.current) {
      setAgentPrediction(null);
      return;
    }

    const interval = setInterval(() => {
      const phase = gamePhase;

      if (!latestVisualFeatures || latestVisualFeatures.length !== 16) return;
      const features = latestVisualFeatures;

      const t0 = performance.now();
      const { prediction: rawAction } = globalNeuralPolicy.forward(features);
      const elapsedMs = performance.now() - t0;

      const targetX = Math.max(0.1, Math.min(0.9, rawAction[0]));
      const targetY = Math.max(0.1, Math.min(0.9, rawAction[1]));

      const trajectory = globalNeuralPolicy.generateTrajectory(0.5, 0.5, targetX, targetY, 6);

      const pred: AgentPrediction = {
        targetX,
        targetY,
        isTouch: rawAction[3] > 0.45,
        confidence: Math.max(0, Math.min(1, rawAction[3])),
        actionPhase: phase,
        latencyMs: elapsedMs,
        policyType: PolicyArchitectureType.MLP_LUMINANCE_BASELINE,
        rawOutputVector: rawAction,
        trajectory,
      };

      setAgentPrediction(pred);

      if (actionBridgeArmed && pred.isTouch && pred.confidence >= 0.35 && !injectionInFlightRef.current) {
        injectionInFlightRef.current = true;
        globalServerGateway.injectTap(device, pred.targetX, pred.targetY)
          .then((result) => setInjectionStatus(result.detail))
          .finally(() => { injectionInFlightRef.current = false; });
      } else if (actionBridgeArmed && pred.confidence < 0.35) {
        setInjectionStatus('ADB output blocked: policy confidence below 35%.');
      }
    }, Math.max(60, currentPlaystyle.reactionTimeMs));

    return () => clearInterval(interval);
  }, [isAgentRunning, latestVisualFeatures, gamePhase, actionBridgeArmed, device, currentPlaystyle.reactionTimeMs]);

  // Deploy Genre Rules to Playbook
  const handleDeployGenreRules = (genre: GameArchetype) => {
    const schema = GENRE_KNOWLEDGE_SCHEMAS[genre];
    const newRules: TacticalRule[] = schema.decisionTree.map((ruleStr, idx) => ({
      id: `TR-${genre.slice(0, 3)}-${idx + 1}`,
      condition: ruleStr.split('->')[0].replace('Condition:', '').trim(),
      gamePhase: idx === 0 ? 'RETREAT' : idx === 1 ? 'BOSS_FIGHT' : 'COMBAT',
      actionDirective: ruleStr.split('->')[1]?.replace('Action:', '').trim() || ruleStr,
      confidence: 0,
      timestamp: 'Genre template (not empirical)',
      triggerCount: 0,
      genre: genre,
    }));

    const nextRules = [...newRules, ...rules];
    setRules(nextRules);
    void persistActiveRun({ rules: nextRules }).catch(() => undefined);
    alert(`Loaded ${newRules.length} ${schema.title} template rules as non-empirical candidates.`);
  };

  // AI Playbook Synthesizer Trigger
  const handleSynthesizePlaybook = async () => {
    if (recordedTelemetries.length === 0) return;
    setIsSynthesizing(true);
    try {
      const summary = recordedTelemetries
        .slice(-10)
        .map((t) => `Frame #${t.frameId} [Genre: ${t.genre}]: ${t.gameState} with Touch (${t.action?.x.toFixed(2)}, ${t.action?.y.toFixed(2)})`)
        .join('\n');
      const newRules = await synthesizePlaybookRules(summary, gameArchetype);
      const nextRules = [...newRules, ...rules];
      setRules(nextRules);
      await persistActiveRun({ rules: nextRules });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleRunFineTuneDAgger = () => {
    setIsFineTuningDAgger(true);
    const correctionSamples = recordedTelemetries.filter((t) => t.action?.isCorrection && t.featureVector?.length === 16);
    for (const sample of correctionSamples) {
      globalNeuralPolicy.trainStep(sample.featureVector!, [sample.action!.x, sample.action!.y, sample.action!.pressure, sample.action!.type === TouchEventType.UP ? 0 : 1]);
    }
    setIsFineTuningDAgger(false);
    void persistActiveRun({
      policyCheckpointJson: globalNeuralPolicy.exportWeightsJSON(),
      policyTrainedBatches: globalNeuralPolicy.totalTrainedBatches,
    }).catch(() => undefined);
    alert(correctionSamples.length
      ? `DAgger fine-tune applied ${correctionSamples.length} recorded correction pairs.`
      : 'No frame-bound DAgger correction pairs are available yet. Historical intervention cards are not treated as training evidence.');
  };

  const checkpointPolicy = useCallback(() => {
    void persistActiveRun({
      policyCheckpointJson: globalNeuralPolicy.exportWeightsJSON(),
      policyTrainedBatches: globalNeuralPolicy.totalTrainedBatches,
    }).catch(() => undefined);
  }, [persistActiveRun]);

  const toggleRecording = useCallback(() => {
    if (!isRecording && !activeRunRef.current) {
      setWorkspaceMessage('Create and select a local project run before recording frame/action pairs.');
      setActiveMode(SystemMode.PROJECT_RUNS);
      return;
    }
    setIsRecording((previous) => !previous);
  }, [isRecording]);

  const clearActiveRunTelemetry = useCallback(() => {
    setRecordedTelemetries([]);
    void persistActiveRun({ recordedTelemetries: [] }).catch(() => undefined);
  }, [persistActiveRun]);

  const updateGameArchetype = useCallback((nextGenre: GameArchetype) => {
    setGameArchetype(nextGenre);
    void persistActiveRun({ gameArchetype: nextGenre }).catch(() => undefined);
  }, [persistActiveRun]);

  const updatePublicationAllowed = useCallback((allowed: boolean) => {
    setPublicationAllowed(allowed);
    void persistActiveRun({ publicationAllowed: allowed }).catch(() => undefined);
  }, [persistActiveRun]);

  const updateGamePhase = useCallback((nextPhase: string) => {
    setGamePhase(nextPhase);
    void persistActiveRun({ gamePhase: nextPhase }).catch(() => undefined);
  }, [persistActiveRun]);

  const addRuleToRun = useCallback((rule: TacticalRule) => {
    const nextRules = [{ ...rule, genre: gameArchetype }, ...rules];
    setRules(nextRules);
    void persistActiveRun({ rules: nextRules }).catch(() => undefined);
  }, [gameArchetype, persistActiveRun, rules]);

  const deleteRuleFromRun = useCallback((id: string) => {
    const nextRules = rules.filter((rule) => rule.id !== id);
    setRules(nextRules);
    void persistActiveRun({ rules: nextRules }).catch(() => undefined);
  }, [persistActiveRun, rules]);

  const updateDeviceForRun = useCallback((patch: Partial<DeviceConfig>) => {
    setDevice((previous) => {
      const nextDevice = { ...previous, ...patch };
      void persistActiveRun({ device: nextDevice }).catch(() => undefined);
      return nextDevice;
    });
  }, [persistActiveRun]);

  const updatePlaystyleForRun = useCallback((nextProfile: PlaystyleProfile) => {
    setCurrentPlaystyle(nextProfile);
    void persistActiveRun({ currentPlaystyle: nextProfile }).catch(() => undefined);
  }, [persistActiveRun]);

  const toggleAgent = useCallback(() => {
    if (!activeRunRef.current) {
      setWorkspaceMessage('Select a local project run before starting the learned policy.');
      setActiveMode(SystemMode.PROJECT_RUNS);
      return;
    }
    setIsAgentRunning((previous) => !previous);
  }, []);

  const toggleActionBridge = useCallback(() => {
    if (!activeRunRef.current) {
      setWorkspaceMessage('Select a local project run before arming Android output.');
      setActiveMode(SystemMode.PROJECT_RUNS);
      return;
    }
    setActionBridgeArmed((previous) => !previous);
  }, []);

  const activeProject = activeRun ? projects.find((project) => project.id === activeRun.projectId) || null : null;

  return (
    <div className="signal-shell min-h-screen text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        device={device}
        isAgentRunning={isAgentRunning}
        onTriggerKillswitch={() => {
          setIsAgentRunning(false);
          setActionBridgeArmed(false);
          setInjectionStatus('ADB output disarmed by the killswitch.');
        }}
        recordedFrameCount={recordedTelemetries.length}
        gameArchetype={gameArchetype}
        onSelectGameArchetype={updateGameArchetype}
        activeProjectName={activeProject?.name || null}
        activeRunName={activeRun?.name || null}
        onOpenProjectRuns={() => setActiveMode(SystemMode.PROJECT_RUNS)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Real Phone Screen Canvas Receiver */}
          {activeMode !== SystemMode.OPERATION_CORRECTION_LEARNING && activeMode !== SystemMode.PROJECT_RUNS && activeMode !== SystemMode.MODEL_ROUTING && <div className="lg:col-span-5 flex justify-center sticky top-24">
            <DeviceCanvas
              onHumanTouch={handleHumanTouch}
              isAgentActive={isAgentRunning}
              agentPrediction={agentPrediction}
              onFrameSnapshot={handleFrameSnapshot}
              gamePhase={gamePhase}
              gameArchetype={gameArchetype}
              onDAggerInterventionTriggered={handleDAggerInterventionTriggered}
              projectBoundaryId={activeRun?.id || 'no-active-local-run'}
            />
          </div>}

          {/* Right Column: Mode-Specific Workspace Module */}
          <div className={activeMode === SystemMode.OPERATION_CORRECTION_LEARNING || activeMode === SystemMode.PROJECT_RUNS || activeMode === SystemMode.MODEL_ROUTING ? 'lg:col-span-12' : 'lg:col-span-7'}>
            {activeMode === SystemMode.PROJECT_RUNS && (
              <ProjectRunMenu
                projects={projects}
                runs={runs}
                activeRunId={activeRun?.id || null}
                persistence={workspacePersistence}
                persistenceMessage={workspaceMessage}
                onCreateProject={createProjectAndRun}
                onCreateRun={createRun}
                onSelectRun={selectRun}
                onDeleteProject={deleteProject}
              />
            )}

            {activeMode === SystemMode.OBSERVE_RECORD && (
              <ObservationRecorder
                isRecording={isRecording}
                onToggleRecording={toggleRecording}
                recordedTelemetries={recordedTelemetries}
                onClearTelemetry={clearActiveRunTelemetry}
                latestAction={latestAction}
                onSynthesizePlaybook={handleSynthesizePlaybook}
                isSynthesizing={isSynthesizing}
                publicationAllowed={publicationAllowed}
                onPublicationAllowedChange={updatePublicationAllowed}
                gamePhase={gamePhase}
                onGamePhaseChange={updateGamePhase}
              />
            )}

            {activeMode === SystemMode.GENRE_KNOWLEDGE && (
              <GenreKnowledgeMatrix
                currentGenre={gameArchetype}
                onSelectGenre={updateGameArchetype}
                onDeployGenreRules={handleDeployGenreRules}
              />
            )}

            {activeMode === SystemMode.TACTICAL_MEMORY && (
              <TacticalMemoryView
                rules={rules}
                onAddRule={addRuleToRun}
                onDeleteRule={deleteRuleFromRun}
                latestFrameDataUrl={latestFrameSnapshot}
                genre={gameArchetype}
              />
            )}

            {activeMode === SystemMode.POLICY_TRAINING && (
              <PolicyTrainingStudio telemetries={recordedTelemetries} onPolicyCheckpoint={checkpointPolicy} />
            )}

            {activeMode === SystemMode.DAGGER_ACTIVE_LEARNING && (
              <DAggerStudio
                interventions={interventions}
                onTriggerFineTune={handleRunFineTuneDAgger}
                isFineTuning={isFineTuningDAgger}
                correctionSampleCount={recordedTelemetries.filter((t) => t.action?.isCorrection && t.featureVector?.length === 16).length}
              />
            )}

            {activeMode === SystemMode.OPERATION_CORRECTION_LEARNING && (
              <OperationCorrectionStudio />
            )}

            {activeMode === SystemMode.AUTONOMOUS_AGENT && (
              <AutonomousAgentRunner
                isAgentRunning={isAgentRunning}
                onToggleAgent={toggleAgent}
                prediction={agentPrediction}
                device={device}
                onUpdateDevice={updateDeviceForRun}
                gamePhase={gamePhase}
                actionBridgeArmed={actionBridgeArmed}
                onToggleActionBridge={toggleActionBridge}
                injectionStatus={injectionStatus}
              />
            )}

            {activeMode === SystemMode.RUNTIME_VERIFICATION && (
              <RuntimeVerificationStudio />
            )}

            {activeMode === SystemMode.UNIVERSAL_DATASET_SERVER && (
              <UniversalDatasetServer
                telemetries={recordedTelemetries}
                rules={rules}
                deviceModel={device.model}
              />
            )}

            {activeMode === SystemMode.PLAYSTYLE_PROFILER && (
              <PlaystyleProfiler
                currentProfile={currentPlaystyle}
                onSelectProfile={updatePlaystyleForRun}
                onUpdateProfile={updatePlaystyleForRun}
              />
            )}

            {activeMode === SystemMode.MODEL_ROUTING && (
              <AdvisoryRoutePanel onOpenTacticalMemory={() => setActiveMode(SystemMode.TACTICAL_MEMORY)} />
            )}

            {activeMode === SystemMode.TERMINAL_CLI && (
              <InteractiveTerminal />
            )}

            {activeMode === SystemMode.CALIBRATION_BENCHMARK && (
              <BenchmarkStudio device={device} />
            )}

            {activeMode === SystemMode.CODEBASE_EXPORT && (
              <CodebaseExporter />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
