export type StartRunOutcome =
  | { readonly kind: 'started' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { readonly message?: unknown };
    return typeof body.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
}

export async function startTicketRun(
  projectId: string,
  number: number,
  request: (url: string, requestInit: RequestInit) => Promise<Response>,
): Promise<StartRunOutcome> {
  let response: Response;
  try {
    response = await request(`/api/projects/${projectId}/tickets/${number}/runs`, {
      method: 'POST',
    });
  } catch {
    return { kind: 'failed', message: "Can't reach aisf." };
  }
  if (response.ok) {
    return { kind: 'started' };
  }
  return { kind: 'failed', message: await readMessage(response), status: response.status };
}
