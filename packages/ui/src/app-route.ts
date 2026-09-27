export type AppRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'add-project' }
  | { readonly kind: 'project'; readonly id: string };

const projectRoutePattern = /^#\/projects\/([^/]+)\/([^/]+)$/;

export function parseAppRoute(hash: string): AppRoute {
  if (hash === '#/projects/new') {
    return { kind: 'add-project' };
  }
  const match = projectRoutePattern.exec(hash);
  if (match !== null) {
    const [, owner, name] = match;
    return { kind: 'project', id: `${owner}/${name}` };
  }
  return { kind: 'home' };
}
