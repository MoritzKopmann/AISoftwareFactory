export type RunWait = {
  readonly kind: 'checkpoint';
  readonly request: string;
  readonly artifactId?: string;
};
