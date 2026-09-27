export type AppRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'add-project' }
  | { readonly kind: 'project'; readonly id: string };

const projectRoutePattern = /^#\/projects\/([^/]+\/[^/]+)$/;

export function parseAppRoute(hash: string): AppRoute {
  if (hash === '#/projects/new') {
    return { kind: 'add-project' };
  }
  const match = projectRoutePattern.exec(hash);
  const id = match?.[1];
  if (id !== undefined) {
    return { kind: 'project', id };
  }
  return { kind: 'home' };
}
