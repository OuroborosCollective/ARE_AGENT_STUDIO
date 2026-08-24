import type { GameArchetype, TacticalRule } from '../types';
import { globalServerGateway } from './serverSyncGateway';

export interface VisionAnalysisResult {
  gameState: 'COMBAT' | 'FARMING' | 'RETREAT' | 'MENU' | 'BOSS_FIGHT';
  hpEstimated: number;
  manaEstimated: number;
  enemiesCount: number;
  strategicNote: string;
  recommendedDirective: string;
  suggestedTouchTarget: { x: number; y: number; label: string };
}

function cleanJson(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function ensureFiniteRange(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Advisory response has invalid ${field}`);
  return value;
}

function validateVisionResult(value: any): VisionAnalysisResult {
  const phases = ['COMBAT', 'FARMING', 'RETREAT', 'MENU', 'BOSS_FIGHT'];
  if (!value || !phases.includes(value.gameState)) throw new Error('Advisory response has invalid gameState');
  if (typeof value.strategicNote !== 'string' || typeof value.recommendedDirective !== 'string') throw new Error('Advisory response has incomplete tactical text');
  const target = value.suggestedTouchTarget;
  if (!target || typeof target.label !== 'string') throw new Error('Advisory response has invalid touch target');
  return {
    gameState: value.gameState,
    hpEstimated: ensureFiniteRange(value.hpEstimated, 0, 100, 'hpEstimated'),
    manaEstimated: ensureFiniteRange(value.manaEstimated, 0, 100, 'manaEstimated'),
    enemiesCount: ensureFiniteRange(value.enemiesCount, 0, 1000, 'enemiesCount'),
    strategicNote: value.strategicNote,
    recommendedDirective: value.recommendedDirective,
    suggestedTouchTarget: {
      x: ensureFiniteRange(target.x, 0, 1, 'suggestedTouchTarget.x'),
      y: ensureFiniteRange(target.y, 0, 1, 'suggestedTouchTarget.y'),
      label: target.label,
    },
  };
}

async function complete(prompt: string, imageDataUrl?: string): Promise<string> {
  const config = globalServerGateway.getConfig();
  const endpoint = globalServerGateway.getEndpoint('/api/v1/advisory/complete');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ prompt, image_data_url: imageDataUrl }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || typeof payload?.result?.text !== 'string') {
    throw new Error(payload?.error || `Advisory gateway failed with HTTP ${response.status}`);
  }
  return payload.result.text;
}

export async function analyzeGameplayFrameWithAdvisory(imageDataUrl: string, humanActionContext?: string): Promise<VisionAnalysisResult> {
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(imageDataUrl) || imageDataUrl.includes('...')) throw new Error('A complete captured frame is required for advisory analysis');
  const prompt = `Analyze this Android gameplay frame as an advisory VLA observer. Human context: ${humanActionContext || 'none'}.
Return STRICT JSON only with: gameState (COMBAT|FARMING|RETREAT|MENU|BOSS_FIGHT), hpEstimated 0-100, manaEstimated 0-100, enemiesCount, strategicNote, recommendedDirective, suggestedTouchTarget {x 0-1,y 0-1,label}. Do not invent certainty. This advisory never constitutes device or dataset evidence.`;
  return validateVisionResult(JSON.parse(cleanJson(await complete(prompt, imageDataUrl))));
}

export async function synthesizePlaybookRules(recordedEventsSummary: string, genre: GameArchetype): Promise<TacticalRule[]> {
  if (!recordedEventsSummary.trim()) return [];
  const prompt = `Extract 3-4 candidate tactical rules from ONLY this recorded human gameplay telemetry:\n${recordedEventsSummary}\nReturn JSON array only. Each item: id, condition, gamePhase (COMBAT|FARMING|RETREAT|MENU|BOSS_FIGHT), actionDirective, confidence 0-1. Confidence is model-reported advisory metadata, not runtime evidence.`;
  const parsed = JSON.parse(cleanJson(await complete(prompt)));
  if (!Array.isArray(parsed)) throw new Error('Advisory playbook response was not an array');
  const phases = new Set(['COMBAT', 'FARMING', 'RETREAT', 'MENU', 'BOSS_FIGHT']);
  return parsed.map((item, idx) => {
    if (!item || typeof item.condition !== 'string' || typeof item.actionDirective !== 'string' || !phases.has(item.gamePhase)) throw new Error(`Invalid advisory rule at index ${idx}`);
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `advisory-${Date.now()}-${idx}`,
      condition: item.condition,
      gamePhase: item.gamePhase,
      actionDirective: item.actionDirective,
      confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0,
      timestamp: 'Advisory candidate; not runtime evidence',
      triggerCount: 0,
      genre,
    };
  });
}
