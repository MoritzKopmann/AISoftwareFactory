import { UpstreamError } from '../../../../shared/errors.js';

export class UsageReadFailedError extends UpstreamError {
  override readonly name = 'UsageReadFailedError';
}
