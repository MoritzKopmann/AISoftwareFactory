export interface DesignWatcher {
  /** `file` is relative to `directory`, e.g. `boards/home.html`. Returns a stop function. */
  watch(directory: string, onChange: (file: string) => void): () => void;
}
