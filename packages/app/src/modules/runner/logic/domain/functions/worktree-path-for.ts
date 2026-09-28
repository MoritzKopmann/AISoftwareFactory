export function worktreePathFor(
  worktreesDirectory: string,
  repositoryName: string,
  ticketNumber: number,
): string {
  return `${worktreesDirectory}/${repositoryName}/${ticketNumber}`;
}
