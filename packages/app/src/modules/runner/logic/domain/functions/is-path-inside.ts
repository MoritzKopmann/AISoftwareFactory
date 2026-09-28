export function isPathInside(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}
