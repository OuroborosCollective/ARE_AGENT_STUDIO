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
  TouchEventType
} from './types';
import {
  DEFAULT_DEVICE,
  INITIAL_TACTICAL_RULES,
  INITIAL_DAGGER_INTERVENTIONS,
  PLAYSTYLE_PROFILES,
  GENRE_KNOWLEDGE_SCHEMAS
} from './constants';
import { synthesizePlaybookRules } from './services/advisoryService';
import { globalNeuralPolicy } from './services/neuralPolicyEngine';
import { globalServerGateway } from './services/serverSyncGateway';
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

export default function App() {
  const [activeMode, setActiveMode] = useState<SystemMode>(SystemMode.OBSERVE_RECORD);
  const [device, setDevice] = useState<DeviceConfig>(DEFAULT_DEVICE);
  const [gameArchetype, setGameArchetype] = useState<GameArchetype>(GameArchetype.FPS);

  // Real Observation & Telemetry State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedTelemetries, setRecordedTelemetries] = useState<FrameTelemetry[]>([]);
  const [latestAction, setLatestAction] = useState<TouchAction | null>(null);
  const [latestFrameSnapshot, setLatestFrameSnapshot] = useState<string | null>(null);
  const [latestVisualFeatures, setLatestVisualFeatures] = useState<number[] | null>(null);
  const [publicationAllowed, setPublicationAllowed] = useState(false);
  const frameCounterRef = useRef(1);
  const sessionIdRef = useRef(globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`);

  // Real-time Vision Detected Metrics from live device screen
  const [liveVisionState, setLiveVisionState] = useState({
    motionIntensity: 0,
  });

  // Tactical Playbook Memory
  const [rules, setRules] = useState<TacticalRule[]>(INITIAL_TACTICAL_RULES);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // DAgger Interventions Ledger
  const [interventions, setInterventions] = useState<DAggerIntervention[]>(INITIAL_DAGGER_INTERVENTIONS);
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
    setInterventions((prev) => [newIntervention, ...prev]);

    // Perform immediate online backpropagation in real neural policy
    if (latestVisualFeatures?.length === 16) {
      globalNeuralPolicy.trainStep(latestVisualFeatures, [humanAction.x, humanAction.y, humanAction.pressure, humanAction.type === TouchEventType.UP ? 0 : 1]);
    }
  }, [latestFrameSnapshot, latestVisualFeatures, gamePhase, gameArchetype]);

  // Handle Real Human Touch over screen
  const handleHumanTouch = useCallback((action: TouchAction) => {
    setLatestAction(action);

    if (isAgentRunning) {
      setIsAgentRunning(false);
      setActionBridgeArmed(false);
      setInjectionStatus('ADB output disarmed by human takeover.');
      console.warn('Human touch detected on device screen! Agent disengaged automatically.');
    }

    if (isRecording && latestFrameSnapshot) {
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
      setRecordedTelemetries((prev) => [...prev.slice(-100), telemetry]);
    }
  }, [isAgentRunning, isRecording, latestFrameSnapshot, latestVisualFeatures, gamePhase, liveVisionState, gameArchetype, publicationAllowed]);

  // Handle Real Canvas Snapshot & live computed pixel metrics
  const handleFrameSnapshot = useCallback((dataUrl: string, motionIntensity: number, featureVector: number[]) => {
    setLatestFrameSnapshot(dataUrl);
    setLiveVisionState({ motionIntensity });
    setLatestVisualFeatures(featureVector);
  }, []);

  // Real-Time Agent Autonomous Decision Loop powered by NeuralPolicyEngine
  useEffect(() => {
    if (!isAgentRunning) {
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
        policyType: PolicyArchitectureType.CNN_MLP_BASELINE,
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

    setRules((prev) => [...newRules, ...prev]);
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
      setRules((prev) => [
        ...newRules,
        ...prev,
      ]);
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
    alert(correctionSamples.length
      ? `DAgger fine-tune applied ${correctionSamples.length} recorded correction pairs.`
      : 'No frame-bound DAgger correction pairs are available yet. Historical intervention cards are not treated as training evidence.');
  };

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
        onSelectGameArchetype={setGameArchetype}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Real Phone Screen Canvas Receiver */}
          {activeMode !== SystemMode.OPERATION_CORRECTION_LEARNING && <div className="lg:col-span-5 flex justify-center sticky top-24">
            <DeviceCanvas
              onHumanTouch={handleHumanTouch}
              isAgentActive={isAgentRunning}
              agentPrediction={agentPrediction}
              onFrameSnapshot={handleFrameSnapshot}
              gamePhase={gamePhase}
              gameArchetype={gameArchetype}
              onDAggerInterventionTriggered={handleDAggerInterventionTriggered}
            />
          </div>}

          {/* Right Column: Mode-Specific Workspace Module */}
          <div className={activeMode === SystemMode.OPERATION_CORRECTION_LEARNING ? 'lg:col-span-12' : 'lg:col-span-7'}>
            {activeMode === SystemMode.OBSERVE_RECORD && (
              <ObservationRecorder
                isRecording={isRecording}
                onToggleRecording={() => {
                  if (!isRecording) {
                    sessionIdRef.current = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
                    frameCounterRef.current = 1;
                  }
                  setIsRecording((prev) => !prev);
                }}
                recordedTelemetries={recordedTelemetries}
                onClearTelemetry={() => {
                  setRecordedTelemetries([]);
                  sessionIdRef.current = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
                  frameCounterRef.current = 1;
                }}
                latestAction={latestAction}
                onSynthesizePlaybook={handleSynthesizePlaybook}
                isSynthesizing={isSynthesizing}
                publicationAllowed={publicationAllowed}
                onPublicationAllowedChange={setPublicationAllowed}
                gamePhase={gamePhase}
                onGamePhaseChange={setGamePhase}
              />
            )}

            {activeMode === SystemMode.GENRE_KNOWLEDGE && (
              <GenreKnowledgeMatrix
                currentGenre={gameArchetype}
                onSelectGenre={setGameArchetype}
                onDeployGenreRules={handleDeployGenreRules}
              />
            )}

            {activeMode === SystemMode.TACTICAL_MEMORY && (
              <TacticalMemoryView
                rules={rules}
                onAddRule={(rule) => setRules((prev) => [{ ...rule, genre: gameArchetype }, ...prev])}
                onDeleteRule={(id) => setRules((prev) => prev.filter((r) => r.id !== id))}
                latestFrameDataUrl={latestFrameSnapshot}
                genre={gameArchetype}
              />
            )}

            {activeMode === SystemMode.POLICY_TRAINING && (
              <PolicyTrainingStudio telemetries={recordedTelemetries} />
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
                onToggleAgent={() => setIsAgentRunning((prev) => !prev)}
                prediction={agentPrediction}
                device={device}
                onUpdateDevice={(patch) => setDevice((prev) => ({ ...prev, ...patch }))}
                gamePhase={gamePhase}
                actionBridgeArmed={actionBridgeArmed}
                onToggleActionBridge={() => setActionBridgeArmed((prev) => !prev)}
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
                onSelectProfile={setCurrentPlaystyle}
                onUpdateProfile={setCurrentPlaystyle}
              />
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
