import type { OperationCorrectionReceipt, OperationCorrectionRecord, OperationLearningProjection } from '../types';
import { globalServerGateway } from './serverSyncGateway';
import { verifyOperationCorrectionReceipt } from './receiptVerifier';

export interface OperationCorrectionPushResult {
  success: boolean;
  endpoint: string;
  receipt?: OperationCorrectionReceipt;
  error?: string;
}

export class OperationCorrectionGateway {
  public async push(record: OperationCorrectionRecord): Promise<OperationCorrectionPushResult> {
    const endpoint = globalServerGateway.getEndpoint('/api/v1/operation-corrections/push');
    try {
      const config = globalServerGateway.getConfig();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-UUID': globalServerGateway.getClientUUID(),
      };
      if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`;
      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(record) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.receipt) return { success: false, endpoint, error: payload?.error || `HTTP ${response.status}` };
      const receipt = await verifyOperationCorrectionReceipt(payload.receipt, 1);
      return { success: true, endpoint, receipt };
    } catch (error) {
      return { success: false, endpoint, error: error instanceof Error ? error.message : 'operation correction daemon unreachable' };
    }
  }

  public async getCandidates(): Promise<{ success: boolean; projection?: OperationLearningProjection; error?: string }> {
    const endpoint = globalServerGateway.getEndpoint('/api/v1/operation-corrections/candidates');
    try {
      const config = globalServerGateway.getConfig();
      const headers: Record<string, string> = {};
      if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`;
      const response = await fetch(endpoint, { headers });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.schema_version !== 'are-agent-operation-learning-projection.v1' || !Array.isArray(payload.candidates)) {
        return { success: false, error: payload?.error || `HTTP ${response.status}` };
      }
      return { success: true, projection: payload as OperationLearningProjection };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'operation correction daemon unreachable' };
    }
  }
}

export const globalOperationCorrectionGateway = new OperationCorrectionGateway();
