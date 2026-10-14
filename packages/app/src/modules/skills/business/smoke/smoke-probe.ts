import type { SmokeProbeReport } from '../domain/types/smoke-probe-report.js';

export interface SmokeProbe {
  run(): Promise<SmokeProbeReport>;
}
