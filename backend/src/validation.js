import crypto from 'node:crypto';

export const DATASET_SCHEMA_VERSION = 'are-agent-vla.v1';
const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateDataImageUrl(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(DATA_URL_RE);
  if (!match) return false;
  try {
    const bytes = Buffer.from(match[2], 'base64');
    return bytes.length >= 16 && bytes.toString('base64').replace(/=+$/, '') === match[2].replace(/=+$/, '');
  } catch {
    return false;
  }
}

function finite01(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateDatasetRow(row) {
  const errors = [];
  if (!row || typeof row !== 'object' || Array.isArray(row)) return ['row must be an object'];
  if (row.schema_version !== DATASET_SCHEMA_VERSION) errors.push(`schema_version must equal ${DATASET_SCHEMA_VERSION}`);
  if (!row.sample_id || typeof row.sample_id !== 'string') errors.push('sample_id is required');
  if (!['human_demo', 'dagger_correction'].includes(row.source)) errors.push('source must be human_demo or dagger_correction');
  if (!validateDataImageUrl(row.input_frame_base64)) errors.push('input_frame_base64 must be a complete image data URL with valid base64');
  if (!Array.isArray(row.state_vector) || row.state_vector.length < 6 || !row.state_vector.every(Number.isFinite)) errors.push('state_vector must contain at least six finite numbers');
  if (row.state_mask !== undefined && (!Array.isArray(row.state_mask) || row.state_mask.length !== row.state_vector?.length || !row.state_mask.every((value) => value === 0 || value === 1))) errors.push('state_mask must contain one 0/1 flag per state_vector entry');
  if (!Array.isArray(row.target_action_chunk) || row.target_action_chunk.length < 1) {
    errors.push('target_action_chunk must contain at least one observed action');
  } else {
    row.target_action_chunk.forEach((action, index) => {
      if (!Array.isArray(action) || action.length !== 4 || !action.every(finite01)) errors.push(`target_action_chunk[${index}] must be [x,y,pressure,touch] in [0,1]`);
    });
  }
  if (!row.client_metadata || typeof row.client_metadata !== 'object') errors.push('client_metadata is required');
  if (!Number.isFinite(row?.client_metadata?.timestamp_epoch)) errors.push('client_metadata.timestamp_epoch is required');
  if (typeof row?.client_metadata?.session_id !== 'string' || !row.client_metadata.session_id.trim()) errors.push('client_metadata.session_id is required');
  if (!Number.isInteger(row?.client_metadata?.sequence_index) || row.client_metadata.sequence_index < 0) errors.push('client_metadata.sequence_index must be a non-negative integer');
  if (!row.publication || typeof row.publication.allowed !== 'boolean' || !['unreviewed', 'user_confirmed'].includes(row.publication.basis)) errors.push('publication metadata is required');
  else if (row.publication.allowed && row.publication.basis !== 'user_confirmed') errors.push('publication.allowed=true requires basis=user_confirmed');
  if (row.feature_vector !== undefined && (!Array.isArray(row.feature_vector) || row.feature_vector.length !== 16 || !row.feature_vector.every(Number.isFinite))) {
    errors.push('feature_vector must contain exactly 16 finite numbers when present');
  }
  return errors;
}

export function deriveSampleId(row) {
  const frameHash = sha256Hex(row.input_frame_base64);
  const identity = {
    schema_version: row.schema_version,
    source: row.source,
    frame_hash: frameHash,
    action: row.target_action_chunk,
    timestamp_epoch: row.client_metadata?.timestamp_epoch,
    client_id: row.client_metadata?.client_id,
    session_id: row.client_metadata?.session_id,
    sequence_index: row.client_metadata?.sequence_index,
  };
  return sha256Hex(canonicalJson(identity));
}
