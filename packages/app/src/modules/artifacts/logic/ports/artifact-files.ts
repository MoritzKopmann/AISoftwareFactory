export interface ArtifactFiles {
  hasIndex(directory: string): Promise<boolean>;
  readIndex(directory: string): Promise<string | undefined>;
  /** Undefined when the path leaves the directory, even through a symlink, or is no file. */
  readAsset(directory: string, relativePath: string): Promise<Uint8Array | undefined>;
  readUserInputState(directory: string): Promise<string | undefined>;
  writeUserInputState(directory: string, userInputState: string): Promise<void>;
}
