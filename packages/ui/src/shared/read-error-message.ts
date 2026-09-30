export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { readonly message?: unknown };
    return typeof body.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
}
