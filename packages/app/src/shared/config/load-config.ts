import { join } from 'node:path';

const defaultPort = 4317;

export type Config = {
  readonly homeDirectory: string;
  readonly databasePath: string;
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
    port: Number(options.environment['AISF_PORT'] ?? defaultPort),
  };
}
