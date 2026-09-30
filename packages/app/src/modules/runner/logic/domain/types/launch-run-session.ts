import type { Run } from './run.js';
import type { SessionLaunch } from './session-launch.js';

export type LaunchRunSession = (run: Run, launch: SessionLaunch) => void;
