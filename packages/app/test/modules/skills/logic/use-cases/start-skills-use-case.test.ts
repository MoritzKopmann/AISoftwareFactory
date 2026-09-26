import { describe, expect, it } from 'vitest';
import { SkillsSetupError } from '../../../../../src/modules/skills/logic/errors/skills-setup-error.js';
import { StartSkillsUseCase } from '../../../../../src/modules/skills/logic/use-cases/start-skills-use-case.js';
import {
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSmokeProbe,
} from '../../fakes/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';

function createSubject(currentMarketplacePath: string | undefined) {
  const pluginMirror = new FakePluginMirror();
  const marketplaceRegistry = new FakeMarketplaceRegistry(currentMarketplacePath);
  const smokeProbe = new FakeSmokeProbe();
  const useCase = new StartSkillsUseCase({
    pluginMirror,
    marketplaceRegistry,
    smokeProbe,
    mirrorDirectory,
  });
  return { useCase, pluginMirror, marketplaceRegistry, smokeProbe };
}

describe('StartSkillsUseCase', () => {
  describe('execute', () => {
    it('should pass when the mirror, the marketplace and the probe are all healthy', async () => {
      const { useCase, pluginMirror } = createSubject(mirrorDirectory);

      expect(await useCase.execute()).toEqual({ state: 'passed' });
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
      const { useCase, smokeProbe } = createSubject(mirrorDirectory);
      smokeProbe.report = { claudeCodeVersion: '2.1.283', skillNames: ['aisf:commit'] };

      expect(await useCase.execute()).toEqual({
        state: 'failed',
        reason: 'No project-* skill resolved by its bare name',
      });
    });

    it('should fail with the error message when the probe cannot run', async () => {
      const { useCase, smokeProbe } = createSubject(mirrorDirectory);
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      expect(await useCase.execute()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });

    it('should fail without probing when the mirror cannot be written', async () => {
      const { useCase, pluginMirror, smokeProbe } = createSubject(mirrorDirectory);
      pluginMirror.failure = new SkillsSetupError('Cannot write the plugin mirror');

      expect(await useCase.execute()).toEqual({
        state: 'failed',
        reason: 'Cannot write the plugin mirror',
      });
      expect(smokeProbe.runCount).toBe(0);
    });
  });
});
