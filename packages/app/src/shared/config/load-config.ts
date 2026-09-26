import { join } from 'node:path';

const defaultPort = 4317;

export type Config = {
  readonly homeDirectory: string;
  readonly databasePath: string;
  readonly pluginMirrorDirectory: string;
  readonly skillsProbeDirectory: string;
  readonly port: number;
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
    port: Number(options.environment['AISF_PORT'] ?? defaultPort),
  };
}
