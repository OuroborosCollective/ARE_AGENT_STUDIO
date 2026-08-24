import type { DatasetReceipt, DeviceConfig, FrameTelemetry, ServerSyncConfig, TacticalRule } from '../types';
import { datasetRowsToJsonl, telemetryToDatasetRows } from './datasetCodec';
import { verifyDatasetReceipt } from './receiptVerifier';

export interface DatasetPushResult {
  success: boolean;
  rowsUploaded: number;
  duplicateRows: number;
  endpoint: string;
  receipt?: DatasetReceipt;
  error?: string;
}

export class ServerSyncGateway {
  private config: ServerSyncConfig = {
    serverHost: typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname) ? window.location.origin : 'http://127.0.0.1',
    port: typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname) ? 0 : 8080,
    authToken: '',
    targetRepository: 'HuggingFace',
    repoName: 'ARE-Agent-Studio-VLA-Dataset',
    activeClientNodes: 1,
    totalSyncedSamples: 0,
    autoSyncEnabled: true,
    compression: 'raw',
  };

  private clientUUID: string;

  constructor(clientUUID?: string) {
    this.clientUUID = clientUUID || globalThis.crypto?.randomUUID?.() || `client-${Date.now()}`;
  }

  public getClientUUID(): string { return this.clientUUID; }
  public getConfig(): ServerSyncConfig { return { ...this.config }; }
  public updateConfig(newCfg: Partial<ServerSyncConfig>) { this.config = { ...this.config, ...newCfg }; }

  public getEndpoint(path: string): string {
    const host = this.config.serverHost.replace(/\/$/, '');
    const base = this.config.port > 0 ? `${host}:${this.config.port}` : host;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  public formatHuggingFaceDataset(telemetries: FrameTelemetry[], rules: TacticalRule[], deviceModel: string): string {
    return datasetRowsToJsonl(telemetryToDatasetRows(telemetries, rules, deviceModel));
  }

  public async pushBatchToServer(telemetries: FrameTelemetry[], rules: TacticalRule[], deviceModel: string): Promise<DatasetPushResult> {
    const rows = telemetryToDatasetRows(telemetries, rules, deviceModel);
    const endpoint = this.getEndpoint('/api/v1/telemetry/push');
    if (rows.length === 0) return { success: false, rowsUploaded: 0, duplicateRows: 0, endpoint, error: 'No complete observed action/frame pairs are available.' };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/jsonl',
        'X-Client-UUID': this.clientUUID,
      };
      if (this.config.authToken) headers.Authorization = `Bearer ${this.config.authToken}`;
      const response = await fetch(endpoint, { method: 'POST', headers, body: datasetRowsToJsonl(rows) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.receipt) {
        return { success: false, rowsUploaded: 0, duplicateRows: 0, endpoint, error: payload?.error || `HTTP ${response.status}` };
      }
      const receipt = await verifyDatasetReceipt(payload.receipt, rows.length);
      this.config.totalSyncedSamples += receipt.accepted_rows;
      return {
        success: true,
        rowsUploaded: receipt.accepted_rows,
        duplicateRows: receipt.duplicate_rows,
        endpoint,
        receipt,
      };
    } catch (error) {
      return { success: false, rowsUploaded: 0, duplicateRows: 0, endpoint, error: error instanceof Error ? error.message : 'dataset daemon unreachable' };
    }
  }
  public async injectTap(device: DeviceConfig, x: number, y: number): Promise<{ success: boolean; detail: string }> {
    const endpoint = this.getEndpoint('/api/v1/device/tap');
    if (!device.serial || !device.connected) return { success: false, detail: 'No configured connected Android target.' };
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.authToken) headers.Authorization = `Bearer ${this.config.authToken}`;
      const response = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({ serial: device.serial, x, y, width: device.resolutionWidth, height: device.resolutionHeight }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return { success: false, detail: payload?.error || `HTTP ${response.status}` };
      return { success: true, detail: `ADB tap acknowledged at ${payload.result.px_x},${payload.result.px_y} in ${payload.result.latency_ms}ms` };
    } catch (error) {
      return { success: false, detail: error instanceof Error ? error.message : 'device bridge unreachable' };
    }
  }

}

export const globalServerGateway = new ServerSyncGateway();
