import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CredentialSnapshot } from '../../logic/domain/types/credential-snapshot.js';
import type { CredentialSource } from '../../logic/ports/credential-source.js';

export type EnvironmentCredentialSourceOptions = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly projectDirectory: string;
};

const settingsFileName = /^settings.*\.json$/;

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function definesApiKeyHelper(settingsText: string): boolean {
  try {
    const settings: unknown = JSON.parse(settingsText);
    return typeof settings === 'object' && settings !== null && 'apiKeyHelper' in settings;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}

export class EnvironmentCredentialSource implements CredentialSource {
  constructor(private readonly options: EnvironmentCredentialSourceOptions) {}

  async read(): Promise<CredentialSnapshot> {
    return {
      setEnvironmentVariables: Object.entries(this.options.environment)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([variableName]) => variableName),
      apiKeyHelperFiles: await this.findApiKeyHelperFiles(),
    };
  }

  private async findApiKeyHelperFiles(): Promise<string[]> {
    const settingsDirectory = join(this.options.projectDirectory, '.claude');
    let fileNames: string[];
    try {
      fileNames = await readdir(settingsDirectory);
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return [];
      }
      throw error;
    }
    const apiKeyHelperFiles: string[] = [];
    for (const fileName of fileNames.filter((name) => settingsFileName.test(name)).sort()) {
      const settingsText = await readFile(join(settingsDirectory, fileName), 'utf8');
      if (definesApiKeyHelper(settingsText)) {
        apiKeyHelperFiles.push(`.claude/${fileName}`);
      }
    }
    return apiKeyHelperFiles;
  }
}
