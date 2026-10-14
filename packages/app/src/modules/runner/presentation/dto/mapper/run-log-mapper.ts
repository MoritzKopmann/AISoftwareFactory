import type { RunLog } from '../../../business/domain/types/run-log.js';
import type { RunLogResponse } from '../api/run-log-schemas.js';

export function toRunLogResponse(runLog: RunLog): RunLogResponse {
  return runLog.kind === 'found'
    ? {
        kind: 'found',
        entries: runLog.entries.map(({ summary }) => ({ summary })),
        total: runLog.total,
      }
    : runLog;
}
