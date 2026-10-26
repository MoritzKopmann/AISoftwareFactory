export interface ArtifactFiles {
  hasIndex(directory: string): Promise<boolean>;
  /** True when `index.json` exists. */
  hasDesignIndex(directory: string): Promise<boolean>;
  /** The app's `assets/kit/board.html`. */
  readBoardShell(): Promise<string>;
  readIndex(directory: string): Promise<string | undefined>;
  /** Undefined when the path leaves the directory, even through a symlink, or is no file. */
  readAsset(directory: string, relativePath: string): Promise<Uint8Array | undefined>;
  /** Names of the image files directly in the directory, sorted. Empty when the directory is missing. */
  listImages(directory: string): Promise<ReadonlyArray<string>>;
  readUserInputState(directory: string): Promise<string | undefined>;
  writeUserInputState(directory: string, userInputState: string): Promise<void>;
}
