import type { SmokeProbeReport } from '../domain/smoke-probe-report.js';

export interface SmokeProbe {
  run(): Promise<SmokeProbeReport>;
}
