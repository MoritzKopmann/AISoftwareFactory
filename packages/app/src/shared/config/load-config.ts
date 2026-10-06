import { join } from 'node:path';

const defaultPort = 4317;
const defaultWatcherPollIntervalMilliseconds = 30_000;
const defaultWatcherSnapshotIntervalMilliseconds = 300_000;
const defaultLiveAnswerWindowMilliseconds = 3_600_000;

export type Config = {
  readonly homeDirectory: string;
  readonly databasePath: string;
  readonly pluginMirrorDirectory: string;
  readonly skillsProbeDirectory: string;
  readonly worktreesDirectory: string;
  readonly port: number;
  readonly watcherPollIntervalMilliseconds: number;
  readonly watcherSnapshotIntervalMilliseconds: number;
  readonly liveAnswerWindowMilliseconds: number;
};

export type LoadConfigOptions = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly userHomeDirectory: string;
};

export function loadConfig(options: LoadConfigOptions): Config {
  const homeDirectory =
    options.environment['AISF_HOME'] ?? join(options.userHomeDirectory, '.aisf');

  return {
    homeDirectory,
    databasePath: join(homeDirectory, 'aisf.db'),
    pluginMirrorDirectory: join(homeDirectory, 'plugins', 'aisf'),
    skillsProbeDirectory: join(homeDirectory, 'skills-probe'),
    worktreesDirectory: join(homeDirectory, 'worktrees'),
    port: Number(options.environment['AISF_PORT'] ?? defaultPort),
    watcherPollIntervalMilliseconds: Number(
      options.environment['AISF_WATCHER_POLL_INTERVAL_MILLISECONDS'] ??
        defaultWatcherPollIntervalMilliseconds,
    ),
    watcherSnapshotIntervalMilliseconds: Number(
      options.environment['AISF_WATCHER_SNAPSHOT_INTERVAL_MILLISECONDS'] ??
        defaultWatcherSnapshotIntervalMilliseconds,
    ),
    liveAnswerWindowMilliseconds: Number(
      options.environment['AISF_LIVE_ANSWER_WINDOW_MILLISECONDS'] ??
        defaultLiveAnswerWindowMilliseconds,
    ),
  };
}
