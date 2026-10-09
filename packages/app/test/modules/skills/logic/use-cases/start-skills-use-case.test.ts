import { describe, expect, it } from 'vitest';
import { SkillsSetupError } from '../../../../../src/modules/skills/logic/errors/skills-setup-error.js';
import { StartSkillsUseCase } from '../../../../../src/modules/skills/logic/use-cases/start-skills-use-case.js';
import { InMemorySkillsStatusStore } from '../../../../../src/modules/skills/infra/integrations/in-memory-skills-status-store.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  FakeCredentialSource,
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSmokeProbe,
} from '../../fakes/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';

function createSubject(currentMarketplacePath: string | undefined) {
  const pluginMirror = new FakePluginMirror();
  const marketplaceRegistry = new FakeMarketplaceRegistry(currentMarketplacePath);
  const smokeProbe = new FakeSmokeProbe();
  const credentialSource = new FakeCredentialSource();
  const statusStore = new InMemorySkillsStatusStore();
  const events = new FakeEventPublisher();
  const statusesAtEmit: Array<ReturnType<InMemorySkillsStatusStore['status']>> = [];
  const useCase = new StartSkillsUseCase({
    pluginMirror,
    marketplaceRegistry,
    smokeProbe,
    mirrorDirectory,
    credentialSource,
    statusStore,
    events: {
      emit: (...emitted) => {
        events.emit(...emitted);
        statusesAtEmit.push(statusStore.status());
      },
    },
  });
  return {
    useCase,
    pluginMirror,
    marketplaceRegistry,
    smokeProbe,
    credentialSource,
    statusStore,
    events,
    statusesAtEmit,
  };
}

describe('StartSkillsUseCase', () => {
  describe('execute', () => {
    it('should pass when the mirror, the marketplace and the probe are all healthy', async () => {
      const { useCase, pluginMirror, statusStore } = createSubject(mirrorDirectory);

      await useCase.execute();

      expect(statusStore.status()).toEqual({ state: 'passed' });
      expect(pluginMirror.replaceCount).toBe(1);
    });

    it('should register the marketplace at the mirror when it points elsewhere', async () => {
      const { useCase, marketplaceRegistry } = createSubject('/home/user/repo/packages/plugin');

      await useCase.execute();

      expect(marketplaceRegistry.registeredPaths).toEqual([mirrorDirectory]);
    });

    it('should register the marketplace at the mirror when none is registered', async () => {
      const { useCase, marketplaceRegistry } = createSubject(undefined);

      await useCase.execute();

      expect(marketplaceRegistry.registeredPaths).toEqual([mirrorDirectory]);
    });

    it('should leave the marketplace alone when it already points at the mirror', async () => {
      const { useCase, marketplaceRegistry } = createSubject(mirrorDirectory);

      await useCase.execute();

      expect(marketplaceRegistry.registeredPaths).toEqual([]);
    });

    it('should fail with the evaluation reason when the probe report is unhealthy', async () => {
      const { useCase, smokeProbe, statusStore } = createSubject(mirrorDirectory);
      smokeProbe.report = { claudeCodeVersion: '2.1.283', skillNames: ['aisf:commit'] };

      await useCase.execute();

      expect(statusStore.status()).toEqual({
        state: 'failed',
        reason: 'No project-* skill resolved by its bare name',
      });
    });

    it('should fail with the error message when the probe cannot run', async () => {
      const { useCase, smokeProbe, statusStore } = createSubject(mirrorDirectory);
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await useCase.execute();

      expect(statusStore.status()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });

    it('should fail without probing when the mirror cannot be written', async () => {
      const { useCase, pluginMirror, smokeProbe, statusStore } = createSubject(mirrorDirectory);
      pluginMirror.failure = new SkillsSetupError('Cannot write the plugin mirror');

      await useCase.execute();

      expect(statusStore.status()).toEqual({
        state: 'failed',
        reason: 'Cannot write the plugin mirror',
      });
      expect(smokeProbe.runCount).toBe(0);
    });

    it('should store the credentials when the start finishes', async () => {
      const { useCase, credentialSource, statusStore } = createSubject(mirrorDirectory);
      credentialSource.snapshot = {
        setEnvironmentVariables: ['ANTHROPIC_API_KEY'],
        apiKeyHelperFiles: [],
      };

      await useCase.execute();

      expect(statusStore.credentials()).toEqual(credentialSource.snapshot);
    });

    it('should emit skills.status-changed once with the final status stored when both reads finish', async () => {
      const { useCase, credentialSource, events, statusesAtEmit } = createSubject(mirrorDirectory);
      let releaseCredentials: () => void = () => {};
      credentialSource.blocker = new Promise((resolve) => {
        releaseCredentials = resolve;
      });

      const started = useCase.execute();
      await new Promise((resolve) => setImmediate(resolve));
      expect(events.emittedEvents).toEqual([]);

      releaseCredentials();
      await started;

      expect(events.emittedEvents).toEqual([{ name: 'skills.status-changed', payload: {} }]);
      expect(statusesAtEmit).toEqual([{ state: 'passed' }]);
    });

    it('should keep the status pending and emit nothing while both reads are running', () => {
      const { useCase, pluginMirror, credentialSource, statusStore, events } =
        createSubject(mirrorDirectory);
      pluginMirror.blocker = new Promise(() => {});
      credentialSource.blocker = new Promise(() => {});

      void useCase.execute();

      expect(statusStore.status()).toEqual({ state: 'pending' });
      expect(events.emittedEvents).toEqual([]);
    });
  });
});
