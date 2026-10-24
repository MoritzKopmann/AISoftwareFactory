import type { RunStage } from '../types/run-stage.js';

export const stageModels: Readonly<Record<RunStage, string>> = {
  implement: 'sonnet',
  spike: 'opus',
  onboard: 'opus',
  create: 'sonnet',
  plan: 'opus',
  design: 'opus',
};
