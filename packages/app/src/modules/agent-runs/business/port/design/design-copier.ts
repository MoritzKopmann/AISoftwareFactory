export interface DesignCopier {
  /** Copies the folder `from` to `to`, keeping relative paths. Both paths are absolute. Does nothing when `from` is missing or `to` exists. */
  copy(paths: { readonly from: string; readonly to: string }): Promise<void>;
}
