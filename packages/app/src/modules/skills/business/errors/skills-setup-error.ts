import { UpstreamError } from '../../../../shared/errors.js';

export class SkillsSetupError extends UpstreamError {
  override readonly name = 'SkillsSetupError';
}
