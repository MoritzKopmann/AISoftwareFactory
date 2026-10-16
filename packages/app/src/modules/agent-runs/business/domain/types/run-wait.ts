import type { RunEnding } from './run-ending.js';

export type RunWait = Extract<RunEnding, { kind: 'checkpoint' | 'permission-needed' }>;
