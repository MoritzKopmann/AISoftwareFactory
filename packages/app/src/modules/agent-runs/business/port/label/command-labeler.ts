export interface CommandLabeler {
  /** Resolves the raw answer. Rejects with CommandLabelFailedError on any failure, timeout included. */
  label(command: string): Promise<string>;
}
