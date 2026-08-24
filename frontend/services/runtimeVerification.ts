import type { TestCaseResult } from '../types';
import { GameArchetype, TouchEventType } from '../types';
import { GENRE_KNOWLEDGE_SCHEMAS } from '../constants';
import { NeuralPolicyEngine, globalNeuralPolicy } from './neuralPolicyEngine';
import { globalServerGateway } from './serverSyncGateway';
import { telemetryToDatasetRows } from './datasetCodec';

function result(id: string, title: string, category: TestCaseResult['category'], assertionsPassed: number, assertionsTotal: number, details: string, started: number): TestCaseResult {
  return {
    id, title, category,
    status: assertionsPassed === assertionsTotal ? 'PASSED' : 'FAILED',
    durationMs: Number((performance.now() - started).toFixed(3)),
    assertionsPassed, assertionsTotal, details, timestamp: Date.now(),
  };
}

export class RuntimeVerificationSuite {
  public async runFullSuite(): Promise<TestCaseResult[]> {
    return [
      this.testSeedReplay(),
      this.testIsolatedTraining(),
      this.testGenreMatrixCompleteness(),
      this.testDatasetSerializationFixture(),
      await this.testDatasetDaemonReadback(),
      this.testInferenceBenchmark(),
    ];
  }

  private testSeedReplay(): TestCaseResult {
    const t0 = performance.now();
    const a = new NeuralPolicyEngine('verification-seed', false);
    const b = new NeuralPolicyEngine('verification-seed', false);
    const features = new Array(16).fill(0.5);
    const sameWeights = a.exportWeightsJSON() === b.exportWeightsJSON();
    const samePrediction = JSON.stringify(a.forward(features).prediction) === JSON.stringify(b.forward(features).prediction);
    return result('TC-01', 'Seed replay determinism', 'DETERMINISM', Number(sameWeights) + Number(samePrediction), 2, `Same seed produced ${sameWeights ? 'identical' : 'different'} initial weights and ${samePrediction ? 'identical' : 'different'} forward outputs.`, t0);
  }

  private testIsolatedTraining(): TestCaseResult {
    const t0 = performance.now();
    const policy = new NeuralPolicyEngine('training-self-test', false);
    const features = policy.extractStructuredFeatures(0.4, 0.6, 2, 0.7, 0.8, 1);
    const target: [number, number, number, number] = [0.8, 0.2, 0.9, 1];
    const initial = policy.trainStep(features, target).loss;
    let final = initial;
    for (let i = 0; i < 20; i++) final = policy.trainStep(features, target).loss;
    const passed = Number(Number.isFinite(initial)) + Number(Number.isFinite(final)) + Number(final < initial);
    return result('TC-02', 'Isolated optimizer convergence fixture', 'GRADIENT_BACKPROP', passed, 3, `Self-test fixture loss ${initial.toFixed(5)} → ${final.toFixed(5)}. This is a regression fixture, not gameplay evidence.`, t0);
  }

  private testGenreMatrixCompleteness(): TestCaseResult {
    const t0 = performance.now();
    const schemas = Object.values(GENRE_KNOWLEDGE_SCHEMAS);
    const allHaveControls = schemas.every((schema) => schema.controlPrimitives.length > 0);
    const allHaveCriteria = schemas.every((schema) => schema.criteria?.primaryGameplayLoop && schema.criteria?.coreObjective);
    return result('TC-03', 'Genre schema structural completeness', 'TELEMETRY_INTEGRITY', Number(schemas.length === Object.values(GameArchetype).length) + Number(allHaveControls) + Number(Boolean(allHaveCriteria)), 3, `${schemas.length} genre schemas checked for criteria and control primitives.`, t0);
  }

  private testDatasetSerializationFixture(): TestCaseResult {
    const t0 = performance.now();
    const frame = `data:image/png;base64,${btoa('0123456789abcdef0123456789abcdef')}`;
    const rows = telemetryToDatasetRows([{
      frameId: 1, timestamp: 123, imageDataUrl: frame,
      action: { id: 'fixture-touch', timestamp: 123, x: 0.2, y: 0.8, type: TouchEventType.DOWN, pressure: 0.7, durationMs: 50 },
      gameState: 'COMBAT', hpPercentage: 80, manaPercentage: 60, enemiesDetected: 1,
      genre: GameArchetype.FPS, clientId: 'fixture', sessionId: 'fixture-session', featureVector: new Array(16).fill(0.5),
    }], [], 'fixture-device');
    const row = rows[0];
    const checks = [rows.length === 1, row.input_frame_base64 === frame, row.target_action_chunk.length === 1, row.feature_vector?.length === 16];
    return result('TC-04', 'VLA serializer fixture contract', 'VLA_SERIALIZATION', checks.filter(Boolean).length, checks.length, 'Fixture verifies full-frame preservation and one observed action without fabricated future steps. Fixture data is not counted as corpus evidence.', t0);
  }

  private async testDatasetDaemonReadback(): Promise<TestCaseResult> {
    const t0 = performance.now();
    const endpoint = globalServerGateway.getEndpoint('/api/v1/health');
    try {
      const response = await fetch(endpoint);
      const body = await response.json();
      const checks = [response.ok, body?.ok === true, body?.service === 'are-agent-studio-dataset', /^[a-f0-9]{64}$/.test(body?.ledger_sha256 || '')];
      return result('TC-05', 'Dataset daemon live readback', 'RUNTIME_READBACK', checks.filter(Boolean).length, checks.length, `Live GET ${endpoint}: ${body?.unique_samples ?? '?'} unique samples, ledger ${body?.ledger_sha256 || 'missing hash'}.`, t0);
    } catch (error) {
      return result('TC-05', 'Dataset daemon live readback', 'RUNTIME_READBACK', 0, 4, `No verified daemon response from ${endpoint}: ${error instanceof Error ? error.message : 'unreachable'}`, t0);
    }
  }

  private testInferenceBenchmark(): TestCaseResult {
    const t0 = performance.now();
    const features = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1,0.5,0.5,0.5,0.5,0.5,1];
    const iterations = 500;
    const bench = performance.now();
    for (let i = 0; i < iterations; i++) globalNeuralPolicy.forward(features);
    const avg = (performance.now() - bench) / iterations;
    const finite = Number(Number.isFinite(avg));
    const under15 = Number(avg < 15);
    return result('TC-06', 'Browser policy forward benchmark', 'LATENCY_SLA', finite + under15, 2, `Measured ${iterations} real browser-policy forwards: ${avg.toFixed(4)} ms average. This excludes capture, network and ADB latency.`, t0);
  }
}

export const globalVerificationSuite = new RuntimeVerificationSuite();
