import { describe, expect, it } from 'vitest';
import { SkillsSetupError } from '../../../../../src/modules/skills/logic/errors/skills-setup-error.js';
import { InstallPluginLocallyUseCase } from '../../../../../src/modules/skills/logic/use-cases/install-plugin-locally-use-case.js';
import { FakeLocalPluginInstaller } from '../../fakes/fake-skills-ports.js';

const checkoutPath = '/home/user/repo';

function createSubject() {
  const localPluginInstaller = new FakeLocalPluginInstaller();
  const useCase = new InstallPluginLocallyUseCase({ localPluginInstaller });
  return { useCase, localPluginInstaller };
}

describe('InstallPluginLocallyUseCase', () => {
  describe('execute', () => {
    it('should return installed when the installer succeeds', async () => {
      const { useCase, localPluginInstaller } = createSubject();

      expect(await useCase.execute(checkoutPath)).toEqual({ state: 'installed' });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should return failed with the reason when the installer throws a setup error', async () => {
      const { useCase, localPluginInstaller } = createSubject();
      localPluginInstaller.failure = new SkillsSetupError('claude plugin install failed: exit 1');

      expect(await useCase.execute(checkoutPath)).toEqual({
        state: 'failed',
        reason: 'claude plugin install failed: exit 1',
      });
    });

    it('should propagate an error that is not a setup error', async () => {
      const { useCase, localPluginInstaller } = createSubject();
      localPluginInstaller.failure = new Error('unexpected');

      await expect(useCase.execute(checkoutPath)).rejects.toThrow('unexpected');
    });
  });
});
