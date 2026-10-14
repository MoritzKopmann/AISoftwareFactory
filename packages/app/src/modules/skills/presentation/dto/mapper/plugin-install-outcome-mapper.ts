import type { PluginInstallOutcome } from '../../../business/domain/types/plugin-install-outcome.js';
import type { PluginInstallOutcomeDto } from '../internal/plugin-install-outcome-dto.js';

export function toPluginInstallOutcomeDto(outcome: PluginInstallOutcome): PluginInstallOutcomeDto {
  return outcome.state === 'failed'
    ? { state: 'failed', reason: outcome.reason }
    : { state: 'installed' };
}
