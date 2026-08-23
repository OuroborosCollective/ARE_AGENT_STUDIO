export enum SystemMode {
  OBSERVE_RECORD = 'OBSERVE_RECORD',
  GENRE_KNOWLEDGE = 'GENRE_KNOWLEDGE',
  TACTICAL_MEMORY = 'TACTICAL_MEMORY',
  POLICY_TRAINING = 'POLICY_TRAINING',
  DAGGER_ACTIVE_LEARNING = 'DAGGER_ACTIVE_LEARNING',
  OPERATION_CORRECTION_LEARNING = 'OPERATION_CORRECTION_LEARNING',
  AUTONOMOUS_AGENT = 'AUTONOMOUS_AGENT',
  UNIVERSAL_DATASET_SERVER = 'UNIVERSAL_DATASET_SERVER',
  RUNTIME_VERIFICATION = 'RUNTIME_VERIFICATION',
  PLAYSTYLE_PROFILER = 'PLAYSTYLE_PROFILER',
  CALIBRATION_BENCHMARK = 'CALIBRATION_BENCHMARK',
  TERMINAL_CLI = 'TERMINAL_CLI',
  CODEBASE_EXPORT = 'CODEBASE_EXPORT',
}

export enum GameArchetype {
  FPS = 'FPS',                             // Ego-Shooter
  SIM_MANAGEMENT = 'SIM_MANAGEMENT',       // Simulations- & Aufbauspiele
  ACTION_RPG = 'ACTION_RPG',               // Action-Rollenspiel / ARPG
  MMORPG = 'MMORPG',                       // Massively Multiplayer Online RPG
  PUZZLE_MATCH = 'PUZZLE_MATCH',           // Puzzle- & Match-Spiele
  MOBA_ARENA = 'MOBA_ARENA',               // MOBA / Lane Strategy
}

export enum PolicyArchitectureType {
  ACT_TRANSFORMER = 'ACT_TRANSFORMER',
  DIFFUSION_POLICY = 'DIFFUSION_POLICY',
  DECISION_TRANSFORMER = 'DECISION_TRANSFORMER',
  CNN_MLP_BASELINE = 'CNN_MLP_BASELINE',
}

export enum TouchEventType {
  DOWN = 'TOUCH_DOWN',
  MOVE = 'TOUCH_MOVE',
  UP = 'TOUCH_UP',
}

export interface TouchAction {
  id: string;
  timestamp: number;
  x: number; // Normalized [0, 1]
  y: number; // Normalized [0, 1]
  type: TouchEventType;
  pressure: number;
  durationMs: number;
  buttonTarget?: string;
  isCorrection?: boolean;
}

export interface FrameTelemetry {
  frameId: number;
  timestamp: number;
  imageDataUrl: string;
  action: TouchAction | null;
  gameState: string;
  hpPercentage: number | null;
  manaPercentage: number | null;
  enemiesDetected: number | null;
  tacticalNote?: string;
  isIntervention?: boolean;
  genre: GameArchetype;
  clientId: string;
  sessionId: string;
  featureVector?: number[];
  publicationAllowed?: boolean;
}

export interface GenreStructuralCriteria {
  cameraPerspective: string;
  coreObjective: string;
  coreControls: string;
  primaryGameplayLoop: string;
  secondaryActions: string[];
  differentiationBoundary: string;
  dominantLoopShareMinPercent: number;
}

export interface GenreControlPrimitive {
  id: string;
  name: string;
  inputCategory: 'JOYSTICK_MOVE' | 'AIM_FIRE' | 'SKILL_COMBO' | 'MENU_NAV' | 'MICRO_STEP' | 'SLIDE_DODGE' | 'GRID_SWAP' | 'BUILD_PLACE';
  normalizedZone: { xMin: number; xMax: number; yMin: number; yMax: number };
  activationRule: string;
  expectedLatencyMs: number;
  recoveryCadenceMs: number;
}

export interface GenreKnowledgeSchema {
  genre: GameArchetype;
  title: string;
  shortCode: string;
  description: string;
  criteria: GenreStructuralCriteria;
  visualHUDTaxonomy: string[];
  movementLogic: string;
  decisionTree: string[];
  controlPrimitives: GenreControlPrimitive[];
}

export interface TacticalRule {
  id: string;
  condition: string;
  gamePhase: 'COMBAT' | 'FARMING' | 'RETREAT' | 'MENU' | 'BOSS_FIGHT' | 'LOOTING' | 'POSITIONING' | 'BUILDING' | 'PUZZLE_SOLVE';
  actionDirective: string;
  confidence: number;
  timestamp: string;
  triggerCount: number;
  genre: GameArchetype;
  vectorEmbedding?: [number, number];
}

export interface TrainingMetric {
  epoch: number;
  loss: number;
  coordMse: number;
  touchStateBce: number;
  trajectoryAccuracy: number;
  learningRate: number;
}

export interface PlaystyleProfile {
  name: string;
  archetype: 'Hyper-Aggressive' | 'Tactical Kiter' | 'Calculated Burst' | 'Speedrunner';
  reactionTimeMs: number;
  tapJitterVariance: number;
  riskTolerance: number;
  cameraPanCadence: 'Snap' | 'Smooth Curve' | 'Flick';
  skillComboPacingMs: number;
}

export interface DAggerIntervention {
  id: string;
  timestamp: number;
  frameSnapshot: string;
  agentPredictedAction: [number, number];
  humanCorrectedAction: [number, number];
  lossDelta: number;
  resolved: boolean;
  notes: string;
  gamePhase: string;
  genre: GameArchetype;
}

export interface DeviceConfig {
  serial: string;
  brand: string;
  model: string;
  resolutionWidth: number;
  resolutionHeight: number;
  densityDpi: number;
  framerateFps: number;
  connectionProtocol: 'scrcpy_h264' | 'adb_screencap' | 'uinput_usb';
  latencyMs: number;
  connected: boolean;
  batteryLevel: number;
}

export interface AgentPrediction {
  targetX: number;
  targetY: number;
  isTouch: boolean;
  confidence: number;
  actionPhase: string;
  latencyMs: number;
  trajectory: { x: number; y: number }[];
  policyType: PolicyArchitectureType;
  rawOutputVector: [number, number, number, number];
}

export interface ServerSyncConfig {
  serverHost: string;
  port: number;
  authToken: string;
  targetRepository: 'HuggingFace' | 'GoogleCloudVertex' | 'LocalSQLite' | 'CustomS3';
  repoName: string;
  activeClientNodes: number;
  totalSyncedSamples: number;
  autoSyncEnabled: boolean;
  compression: 'gzip' | 'zstd' | 'raw';
}

export interface HuggingFaceVLARow {
  schema_version: 'are-agent-vla.v1';
  sample_id: string;
  source: 'human_demo' | 'dagger_correction';
  instruction: string;
  input_frame_base64: string;
  genre: string;
  genre_criteria: GenreStructuralCriteria;
  state_vector: number[];
  state_mask: number[];
  observation_metadata: {
    hp_source: 'unknown' | 'detector';
    mana_source: 'unknown' | 'detector';
    enemies_source: 'unknown' | 'advisory' | 'detector';
  };
  publication: {
    allowed: boolean;
    basis: 'unreviewed' | 'user_confirmed';
  };
  target_action_chunk: number[][];
  tactical_reasoning: string;
  feature_vector?: number[];
  action_metadata: {
    event_type: TouchEventType;
    duration_ms: number;
    is_correction: boolean;
  };
  client_metadata: {
    client_id: string;
    device_model: string;
    timestamp_epoch: number;
    frame_id: number;
    session_id: string;
    sequence_index: number;
  };
}

export interface DatasetReceipt {
  receipt_version: 'are-agent-receipt.v1';
  accepted_at: string;
  client_id: string | null;
  requested_rows: number;
  accepted_rows: number;
  duplicate_rows: number;
  accepted_sample_ids: string[];
  ledger_sha256: string;
  receipt_sha256: string;
}

export type OperationRiskTier = 'reversible' | 'external' | 'irreversible';
export type OperationCorrectionDecision = 'approve' | 'reject' | 'amend';
export type OperationCorrectionReasonCode =
  | 'WRONG_TARGET'
  | 'SCOPE_TOO_BROAD'
  | 'MISSING_EVIDENCE'
  | 'CONSENT_REQUIRED'
  | 'UNSAFE_EFFECT'
  | 'INCORRECT_ACTION'
  | 'OTHER';

export interface OperationCorrectionContext {
  session_id: string;
  sequence_index: number;
  mission_id?: string | null;
  attempt_id?: string | null;
}

export interface OperationProposal {
  proposal_id: string;
  operation_type: string;
  action_summary: string;
  target_ref?: string | null;
  parameters_sha256: string;
  policy_revision_sha256: string;
  observation_evidence_sha256: string;
  requested_at_epoch: number;
  risk_tier: OperationRiskTier;
  execution_state: 'not_executed';
  proposal_sha256?: string;
}

export interface OperationCorrection {
  decision: OperationCorrectionDecision;
  reason_code: OperationCorrectionReasonCode;
  owner_ref: string;
  rationale?: string | null;
  corrected_action_summary?: string;
  corrected_parameters_sha256?: string;
  captured_at_epoch: number;
}

export interface OperationLearningConsent {
  allowed: boolean;
  basis: 'unreviewed' | 'owner_confirmed';
}

export interface OperationCorrectionRecord {
  schema_version: 'are-agent-operation-correction.v1';
  correction_id: string;
  context: OperationCorrectionContext;
  proposal: OperationProposal;
  correction: OperationCorrection;
  learning: OperationLearningConsent;
}

export interface OperationCorrectionReceipt {
  receipt_version: 'are-agent-operation-correction-receipt.v1';
  accepted_at: string;
  client_id: string | null;
  requested_rows: number;
  accepted_rows: number;
  duplicate_rows: number;
  accepted_correction_ids: string[];
  ledger_sha256: string;
  receipt_sha256: string;
}

export interface OperationLearningCandidate {
  schema_version: 'are-agent-operation-learning-candidate.v1';
  candidate_id: string;
  source_ledger_sha256: string;
  material: {
    operation_type: string;
    risk_tier: OperationRiskTier;
    decision: OperationCorrectionDecision;
    reason_code: OperationCorrectionReasonCode;
    corrected_action_summary: string | null;
    corrected_parameters_sha256: string | null;
  };
  correction_count: number;
  correction_ids: string[];
  execution_authority: 'none';
  status: 'candidate_only';
}

export interface OperationLearningProjection {
  schema_version: 'are-agent-operation-learning-projection.v1';
  source_ledger_sha256: string;
  candidate_count: number;
  candidates: OperationLearningCandidate[];
}

export interface TestCaseResult {
  id: string;
  title: string;
  category: 'NEURAL_FORWARD' | 'GRADIENT_BACKPROP' | 'DETERMINISM' | 'TELEMETRY_INTEGRITY' | 'VLA_SERIALIZATION' | 'LATENCY_SLA' | 'RUNTIME_READBACK';
  status: 'PASSED' | 'FAILED' | 'RUNNING' | 'PENDING';
  durationMs: number;
  assertionsPassed: number;
  assertionsTotal: number;
  details: string;
  timestamp: number;
}

export interface BenchmarkResult {
  metric: string;
  target: string;
  measured: string;
  status: 'optimal' | 'warning' | 'critical';
  details: string;
}
