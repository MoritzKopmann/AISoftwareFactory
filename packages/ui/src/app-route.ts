export type AppRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'add-project' }
  | { readonly kind: 'usage' }
  | { readonly kind: 'project'; readonly id: string }
  | { readonly kind: 'settings'; readonly id: string }
  | { readonly kind: 'ticket'; readonly id: string; readonly number: number };

const projectRoutePattern = /^#\/projects\/([^/]+\/[^/]+)$/;
const settingsRoutePattern = /^#\/projects\/([^/]+\/[^/]+)\/settings$/;
const ticketRoutePattern = /^#\/projects\/([^/]+\/[^/]+)\/tickets\/([1-9]\d*)$/;

export function parseAppRoute(hash: string): AppRoute {
  if (hash === '#/projects/new') {
    return { kind: 'add-project' };
  }
  if (hash === '#/usage') {
    return { kind: 'usage' };
  }
  const ticketMatch = ticketRoutePattern.exec(hash);
  const ticketProjectId = ticketMatch?.[1];
  const ticketNumber = ticketMatch?.[2];
  if (ticketProjectId !== undefined && ticketNumber !== undefined) {
    return { kind: 'ticket', id: ticketProjectId, number: Number(ticketNumber) };
  }
  const settingsId = settingsRoutePattern.exec(hash)?.[1];
  if (settingsId !== undefined) {
    return { kind: 'settings', id: settingsId };
  }
  const match = projectRoutePattern.exec(hash);
  const id = match?.[1];
  if (id !== undefined) {
    return { kind: 'project', id };
  }
  return { kind: 'home' };
}
