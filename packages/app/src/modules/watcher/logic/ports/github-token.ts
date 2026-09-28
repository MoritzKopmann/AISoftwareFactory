export interface GitHubToken {
  read(): Promise<string>;
  invalidate(): void;
}
