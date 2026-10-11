import { worktreePathFor } from './worktree-path-for.js';

export function authoringWorktreePathFor(
  worktreesDirectory: string,
  repositoryName: string,
  ticketNumber: number,
): string {
  return `${worktreePathFor(worktreesDirectory, repositoryName, ticketNumber)}-authoring`;
}
