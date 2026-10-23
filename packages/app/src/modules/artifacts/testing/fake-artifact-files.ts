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

  async readUserInputState(directory: string): Promise<string | undefined> {
    return this.files.get(`${directory}/user-input-state.json`);
  }

  async writeUserInputState(directory: string, userInputState: string): Promise<void> {
    this.files.set(`${directory}/user-input-state.json`, userInputState);
  }
}
