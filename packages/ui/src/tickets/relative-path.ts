/** Posix only. A path that is not absolute, or no root, leaves the path as given. */
export function relativePath(root: string | undefined, path: string): string {
  if (root === undefined || !path.startsWith('/')) return path;
  const rootParts = segments(root);
  const pathParts = segments(path);
  let shared = 0;
  while (
    shared < rootParts.length &&
    shared < pathParts.length &&
    rootParts[shared] === pathParts[shared]
  ) {
    shared += 1;
  }
  const parts = [...rootParts.slice(shared).map(() => '..'), ...pathParts.slice(shared)];
  return parts.length === 0 ? '.' : parts.join('/');
}

function segments(path: string): string[] {
  return path.split('/').filter((part) => part !== '');
}
