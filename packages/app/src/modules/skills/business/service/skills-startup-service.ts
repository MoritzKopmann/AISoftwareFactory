import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { CredentialSource } from '../port/credential/credential-source.js';
import { evaluateSmokeProbe } from '../domain/functions/evaluate-smoke-probe.js';
import { determineRunsBlocked } from '../domain/functions/determine-runs-blocked.js';
import type { RunsBlocked, SkillsStatus, SmokeTestResult } from '../domain/types/skills-status.js';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import type { MarketplaceRegistry } from '../port/plugin/marketplace-registry.js';
import type { PluginMirror } from '../port/plugin/plugin-mirror.js';
import type { SkillsStatusRepository } from '../port/repository/skills-status-repository.js';
import type { SmokeProbe } from '../port/smoke/smoke-probe.js';

export type SkillsStartupServiceDependencies = {
  readonly pluginMirror: PluginMirror;
  readonly marketplaceRegistry: MarketplaceRegistry;
  readonly smokeProbe: SmokeProbe;
  readonly mirrorDirectory: string;
  readonly credentialSource: CredentialSource;
  readonly statusRepository: SkillsStatusRepository;
  readonly events: EventPublisher;
};

export class SkillsStartupService {
  private startPromise: Promise<void> | undefined;

  constructor(private readonly dependencies: SkillsStartupServiceDependencies) {}

  start(): Promise<void> {
    this.startPromise = this.runStartUpChecks();
    return this.startPromise;
  }

  /** Resolves when the start-up checks, if they were started, have finished. */
  async waitForStart(): Promise<void> {
    if (this.startPromise !== undefined) {
      await this.startPromise;
    }
  }

  readStatus(): SkillsStatus {
    return this.dependencies.statusRepository.status();
  }

  readRunsBlocked(): RunsBlocked {
    const { statusRepository } = this.dependencies;
    return determineRunsBlocked(statusRepository.status(), statusRepository.credentials());
  }

  private async runStartUpChecks(): Promise<void> {
    const { credentialSource, statusRepository, events } = this.dependencies;
    const [status, credentials] = await Promise.all([this.runSmokeTest(), credentialSource.read()]);
    statusRepository.save(status, credentials);
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
