import type { ArtifactFiles } from '../business/port/file/artifact-files.js';

/** Files keyed by `<directory>/<name>`. */
export class FakeArtifactFiles implements ArtifactFiles {
  readonly files = new Map<string, string>();
  boardShell = '<main>board</main>';

  async hasIndex(directory: string): Promise<boolean> {
    return this.files.has(`${directory}/index.html`);
  }

  async hasDesignIndex(directory: string): Promise<boolean> {
    return this.files.has(`${directory}/index.json`);
  }

  async readBoardShell(): Promise<string> {
    return this.boardShell;
  }

  async readIndex(directory: string): Promise<string | undefined> {
    return this.files.get(`${directory}/index.html`);
  }

  async readAsset(directory: string, relativePath: string): Promise<Uint8Array | undefined> {
    const content = this.files.get(`${directory}/${relativePath}`);
    return content === undefined ? undefined : new TextEncoder().encode(content);
  }

  async listImages(directory: string): Promise<ReadonlyArray<string>> {
    const prefix = `${directory}/`;
    return [...this.files.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter((name) => !name.includes('/') && /.\.(png|jpe?g|webp|svg)$/i.test(name))
      .sort();
  }

  async readUserInputState(directory: string): Promise<string | undefined> {
    return this.files.get(`${directory}/user-input-state.json`);
  }

  async writeUserInputState(directory: string, userInputState: string): Promise<void> {
    this.files.set(`${directory}/user-input-state.json`, userInputState);
  }

  async readDesignRound(directory: string): Promise<number | undefined> {
    const text = this.files.get(`${directory}/index.json`);
    if (text === undefined) {
      return undefined;
    }
    try {
      const round: unknown = (JSON.parse(text) as { round?: unknown } | null)?.round;
      return typeof round === 'number' ? round : undefined;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return undefined;
    }
  }

  async writeDesignRound(directory: string, round: number): Promise<void> {
    const text = this.files.get(`${directory}/index.json`) ?? '{}';
    const index = JSON.parse(text) as Record<string, unknown>;
    this.files.set(`${directory}/index.json`, JSON.stringify({ ...index, round }));
  }
}
