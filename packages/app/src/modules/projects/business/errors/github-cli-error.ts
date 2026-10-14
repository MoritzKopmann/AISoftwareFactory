import { UpstreamError } from '../../../../shared/errors.js';

export class GitHubCliError extends UpstreamError {
  override readonly name = 'GitHubCliError';
}
