import { UpstreamError } from '../../../../shared/errors.js';

export class CommandLabelFailedError extends UpstreamError {
  override readonly name = 'CommandLabelFailedError';
}
