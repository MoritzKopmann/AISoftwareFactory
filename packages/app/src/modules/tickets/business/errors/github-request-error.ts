import { UpstreamError } from '../../../../shared/errors.js';

export class GitHubRequestError extends UpstreamError {
  override readonly name = 'GitHubRequestError';
}
