export function resolvePath(path: string, baseDirectory: string): string {
  const absolutePath = path.startsWith('/') ? path : `${baseDirectory}/${path}`;
  const segments: string[] = [];
  for (const segment of absolutePath.split('/')) {
    if (segment === '..') {
      segments.pop();
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment);
    }
  }
  return `/${segments.join('/')}`;
}
