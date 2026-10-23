import type { DesignWatcher } from '../business/port/watch/design-watcher.js';

/** Records watches; `emit` fires the callbacks of the live watches on a directory. */
export class FakeDesignWatcher implements DesignWatcher {
  readonly watched: Array<{ directory: string; onChange: (file: string) => void }> = [];
  stopped = 0;

  watch(directory: string, onChange: (file: string) => void): () => void {
    const entry = { directory, onChange };
    this.watched.push(entry);
    return () => {
      const index = this.watched.indexOf(entry);
      if (index >= 0) {
        this.stopped += 1;
        this.watched.splice(index, 1);
      }
    };
  }

  emit(directory: string, file: string): void {
    this.watched
      .filter((entry) => entry.directory === directory)
      .forEach((entry) => entry.onChange(file));
  }
}
