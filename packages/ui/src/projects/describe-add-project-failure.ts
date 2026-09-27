function readMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body as { readonly message: unknown };
    if (typeof message === 'string') {
      return message;
    }
  }
  return undefined;
}

export function describeAddProjectFailure(status: number | undefined, body: unknown): string {
  if (status === undefined) {
    return 'The app could not be reached';
  }

  const message = readMessage(body);
  if (message !== undefined) {
    return message;
  }
  return `Adding the project failed (HTTP ${status})`;
}
