import { GENRE_KNOWLEDGE_SCHEMAS } from '../constants';
import type { FrameTelemetry, HuggingFaceVLARow, TacticalRule } from '../types';

export const VLA_DATASET_SCHEMA_VERSION = 'are-agent-vla.v1';

export function telemetryToDatasetRows(
  telemetries: FrameTelemetry[],
  rules: TacticalRule[],
  deviceModel: string,
): HuggingFaceVLARow[] {
  return telemetries
    .filter((t) => Boolean(t.action) && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(t.imageDataUrl))
    .map((t) => {
      const action = t.action!;
      const schema = GENRE_KNOWLEDGE_SCHEMAS[t.genre];
      return {
        schema_version: VLA_DATASET_SCHEMA_VERSION,
        sample_id: `${t.clientId || 'client'}:${t.frameId}:${t.timestamp}`,
        source: t.isIntervention || action.isCorrection ? 'dagger_correction' : 'human_demo',
        instruction: `Observe the Android game screen and reproduce the demonstrated normalized touch action for ${schema.title}.`,
        input_frame_base64: t.imageDataUrl,
        genre: t.genre,
        genre_criteria: schema.criteria,
        state_vector: [
          t.hpPercentage == null ? 0 : t.hpPercentage / 100,
          t.manaPercentage == null ? 0 : t.manaPercentage / 100,
          t.enemiesDetected == null ? 0 : t.enemiesDetected / 5,
          t.gameState === 'RETREAT' ? 1 : 0,
          t.gameState === 'COMBAT' ? 1 : 0,
          t.gameState === 'BOSS_FIGHT' ? 1 : 0,
        ],
        state_mask: [t.hpPercentage == null ? 0 : 1, t.manaPercentage == null ? 0 : 1, t.enemiesDetected == null ? 0 : 1, 1, 1, 1],
        observation_metadata: {
          hp_source: t.hpPercentage == null ? 'unknown' : 'detector',
          mana_source: t.manaPercentage == null ? 'unknown' : 'detector',
          enemies_source: t.enemiesDetected == null ? 'unknown' : 'detector',
        },
        publication: {
          allowed: Boolean(t.publicationAllowed),
          basis: t.publicationAllowed ? 'user_confirmed' : 'unreviewed',
        },
        target_action_chunk: [[action.x, action.y, action.pressure, action.type === 'TOUCH_UP' ? 0 : 1]],
        tactical_reasoning: '',
        feature_vector: t.featureVector?.length === 16 ? [...t.featureVector] : undefined,
        action_metadata: {
          event_type: action.type,
          duration_ms: action.durationMs,
          is_correction: Boolean(action.isCorrection),
        },
        client_metadata: {
          client_id: t.clientId,
          device_model: deviceModel,
          timestamp_epoch: t.timestamp,
          frame_id: t.frameId,
          session_id: t.sessionId,
          sequence_index: t.frameId,
        },
      };
    });
}

export function datasetRowsToJsonl(rows: HuggingFaceVLARow[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}
