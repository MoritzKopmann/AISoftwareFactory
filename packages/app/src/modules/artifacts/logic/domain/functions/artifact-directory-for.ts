export function artifactDirectoryFor(worktreePath: string, artifactId: string): string {
  return `${worktreePath}/.aisf/artifacts/${artifactId}`;
}
