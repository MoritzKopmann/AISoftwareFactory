import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import { evaluateSmokeProbe } from '../domain/functions/evaluate-smoke-probe.js';
import type { SmokeTestResult } from '../domain/types/skills-status.js';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import type { CredentialSource } from '../ports/credential-source.js';
import type { MarketplaceRegistry } from '../ports/marketplace-registry.js';
import type { PluginMirror } from '../ports/plugin-mirror.js';
import type { SkillsStatusStore } from '../ports/skills-status-store.js';
import type { SmokeProbe } from '../ports/smoke-probe.js';

export type StartSkillsDependencies = {
  readonly pluginMirror: PluginMirror;
  readonly marketplaceRegistry: MarketplaceRegistry;
  readonly smokeProbe: SmokeProbe;
  readonly mirrorDirectory: string;
  readonly credentialSource: CredentialSource;
  readonly statusStore: SkillsStatusStore;
  readonly events: EventPublisher;
};

export class StartSkillsUseCase {
  constructor(private readonly dependencies: StartSkillsDependencies) {}

  async execute(): Promise<void> {
    const { credentialSource, statusStore, events } = this.dependencies;
    const [status, credentials] = await Promise.all([this.runSmokeTest(), credentialSource.read()]);
    statusStore.save(status, credentials);
    events.emit('skills.status-changed', {});
  }

  private async runSmokeTest(): Promise<SmokeTestResult> {
    const { pluginMirror, marketplaceRegistry, smokeProbe, mirrorDirectory } = this.dependencies;
    try {
      await pluginMirror.replace();
      if ((await marketplaceRegistry.registeredPath()) !== mirrorDirectory) {
        await marketplaceRegistry.register(mirrorDirectory);
      }
      return evaluateSmokeProbe(await smokeProbe.run());
    } catch (error) {
      if (error instanceof SkillsSetupError) {
        return { state: 'failed', reason: error.message };
      }
      throw error;
    }
  }
}
