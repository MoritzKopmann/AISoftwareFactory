import { UpstreamError } from '../../../../shared/errors.js';

export class PluginInstallFailedError extends UpstreamError {
  override readonly name = 'PluginInstallFailedError';
}
