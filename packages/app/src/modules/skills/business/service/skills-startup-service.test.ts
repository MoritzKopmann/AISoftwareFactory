import { describe, expect, it } from 'vitest';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import { SkillsStartupService } from './skills-startup-service.js';
import type { SkillsStatus } from '../domain/types/skills-status.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import {
  FakeCredentialSource,
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSkillsStatusRepository,
  FakeSmokeProbe,
} from '../../testing/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';

function createSubject(currentMarketplacePath: string | undefined) {
  const pluginMirror = new FakePluginMirror();
  const marketplaceRegistry = new FakeMarketplaceRegistry(currentMarketplacePath);
  const smokeProbe = new FakeSmokeProbe();
  const credentialSource = new FakeCredentialSource();
  const statusRepository = new FakeSkillsStatusRepository();
  const events = new FakeEventPublisher();
  const statusesAtEmit: SkillsStatus[] = [];
  const service = new SkillsStartupService({
    pluginMirror,
    marketplaceRegistry,
    smokeProbe,
    mirrorDirectory,
    credentialSource,
    statusRepository,
    events: {
      emit: (...emitted) => {
        events.emit(...emitted);
        statusesAtEmit.push(statusRepository.status());
      },
    },
  });
  return {
    service,
    pluginMirror,
    marketplaceRegistry,
    smokeProbe,
    credentialSource,
    statusRepository,
    events,
    statusesAtEmit,
  };
}

describe('SkillsStartupService', () => {
  describe('start', () => {
    it('should pass when the mirror, the marketplace and the probe are all healthy', async () => {
      const { service, pluginMirror, statusRepository } = createSubject(mirrorDirectory);

      await service.start();

      expect(statusRepository.status()).toEqual({ state: 'passed' });
      expect(pluginMirror.replaceCount).toBe(1);
    });

    it('should register the marketplace at the mirror when it points elsewhere', async () => {
      const { service, marketplaceRegistry } = createSubject('/home/user/repo/packages/plugin');

      await service.start();

      expect(marketplaceRegistry.registeredPaths).toEqual([mirrorDirectory]);
    });

    it('should register the marketplace at the mirror when none is registered', async () => {
      const { service, marketplaceRegistry } = createSubject(undefined);

      await service.start();

      expect(marketplaceRegistry.registeredPaths).toEqual([mirrorDirectory]);
    });

    it('should leave the marketplace alone when it already points at the mirror', async () => {
      const { service, marketplaceRegistry } = createSubject(mirrorDirectory);

      await service.start();

      expect(marketplaceRegistry.registeredPaths).toEqual([]);
    });

    it('should fail with the evaluation reason when the probe report is unhealthy', async () => {
      const { service, smokeProbe, statusRepository } = createSubject(mirrorDirectory);
      smokeProbe.report = { claudeCodeVersion: '2.1.283', skillNames: ['aisf:commit'] };

      await service.start();

      expect(statusRepository.status()).toEqual({
        state: 'failed',
        reason: 'No project-* skill resolved by its bare name',
      });
    });

    it('should fail with the error message when the probe cannot run', async () => {
      const { service, smokeProbe, statusRepository } = createSubject(mirrorDirectory);
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await service.start();

      expect(statusRepository.status()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });

    it('should fail without probing when the mirror cannot be written', async () => {
      const { service, pluginMirror, smokeProbe, statusRepository } =
        createSubject(mirrorDirectory);
      pluginMirror.failure = new SkillsSetupError('Cannot write the plugin mirror');

      await service.start();

      expect(statusRepository.status()).toEqual({
        state: 'failed',
        reason: 'Cannot write the plugin mirror',
      });
      expect(smokeProbe.runCount).toBe(0);
    });

    it('should store the credentials when the start finishes', async () => {
      const { service, credentialSource, statusRepository } = createSubject(mirrorDirectory);
      credentialSource.snapshot = {
        setEnvironmentVariables: ['ANTHROPIC_API_KEY'],
        apiKeyHelperFiles: [],
      };

      await service.start();

      expect(statusRepository.credentials()).toEqual(credentialSource.snapshot);
    });

    it('should emit skills.status-changed once with the final status stored when both reads finish', async () => {
      const { service, credentialSource, events, statusesAtEmit } = createSubject(mirrorDirectory);
      let releaseCredentials: () => void = () => {};
      credentialSource.blocker = new Promise((resolve) => {
        releaseCredentials = resolve;
      });

      const started = service.start();
      await new Promise((resolve) => setImmediate(resolve));
      expect(events.emittedEvents).toEqual([]);

      releaseCredentials();
      await started;

      expect(events.emittedEvents).toEqual([{ name: 'skills.status-changed', payload: {} }]);
      expect(statusesAtEmit).toEqual([{ state: 'passed' }]);
    });

    it('should keep the status pending and emit nothing while both reads are running', () => {
      const { service, pluginMirror, credentialSource, statusRepository, events } =
        createSubject(mirrorDirectory);
      pluginMirror.blocker = new Promise(() => {});
      credentialSource.blocker = new Promise(() => {});

      void service.start();

      expect(statusRepository.status()).toEqual({ state: 'pending' });
      expect(events.emittedEvents).toEqual([]);
    });
  });
});
