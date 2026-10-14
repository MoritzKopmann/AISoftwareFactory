import { UpstreamError } from '../../../../shared/errors.js';

export class GitHubAuthError extends UpstreamError {
  override readonly name = 'GitHubAuthError';
}
