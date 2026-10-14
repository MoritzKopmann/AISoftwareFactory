import { describe, expect, it } from 'vitest';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import { ProjectOnboardingService } from './project-onboarding-service.js';
import { FakeLocalPluginInstaller, FakeSlotReader } from '../../testing/fake-skills-ports.js';

const checkoutPath = '/home/user/repo';

function createService(
  overrides: Partial<ConstructorParameters<typeof ProjectOnboardingService>[0]> = {},
) {
  return new ProjectOnboardingService({
    slotReader: new FakeSlotReader(),
    localPluginInstaller: new FakeLocalPluginInstaller(),
    startupService: { waitForStart: () => Promise.resolve() },
    ...overrides,
  });
}

describe('ProjectOnboardingService', () => {
  describe('contractPreflight', () => {
    it('should report every required slot as missing when the checkout has none of them', async () => {
      const service = createService({ slotReader: new FakeSlotReader() });

      const report = await service.contractPreflight(checkoutPath);

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual([
        'project-architecture',
        'code-rules',
        'project-testing',
        'project-toolchain',
      ]);
    });

    it('should report code-rules as missing when only that slot is absent', async () => {
      const slotReader = new FakeSlotReader();
      slotReader.setSlotText(checkoutPath, 'project-architecture', 'any shape');
      slotReader.setSlotText(checkoutPath, 'project-testing', 'any shape');
      slotReader.setSlotText(
        checkoutPath,
        'project-toolchain',
        [
          '```yaml aisf-toolchain',
          'format: a',
          'analyze: a',
          'test: a',
          'test_file: a',
          'manifests: a',
          'registry: a',
          'platforms: a',
          '```',
        ].join('\n'),
      );
      const service = createService({ slotReader });

      const report = await service.contractPreflight(checkoutPath);

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual(['code-rules']);
    });

    it('should pass when the checkout has every slot and toolchain key', async () => {
      const slotReader = new FakeSlotReader();
      slotReader.setSlotText(checkoutPath, 'project-architecture', 'any shape');
      slotReader.setSlotText(checkoutPath, 'code-rules', 'any shape');
      slotReader.setSlotText(checkoutPath, 'project-testing', 'any shape');
      slotReader.setSlotText(
        checkoutPath,
        'project-toolchain',
        [
          '```yaml aisf-toolchain',
          'format: npm run format',
          'analyze: npm run analyze',
          'test: npm test',
          'test_file: npm run test:file -- {file}',
          'manifests: [package.json]',
          'registry: npmjs.com',
          'platforms: [linux]',
          '```',
        ].join('\n'),
      );
      const service = createService({ slotReader });

      expect(await service.contractPreflight(checkoutPath)).toEqual({
        passed: true,
        missingSlots: [],
        missingKeys: [],
      });
    });

    it('should fail with only project-testing missing when that slot is absent', async () => {
      const slotReader = new FakeSlotReader();
      slotReader.setSlotText(checkoutPath, 'project-architecture', 'any shape');
      slotReader.setSlotText(checkoutPath, 'code-rules', 'any shape');
      slotReader.setSlotText(
        checkoutPath,
        'project-toolchain',
        [
          '```yaml aisf-toolchain',
          'format: a',
          'analyze: a',
          'test: a',
          'test_file: a',
          'manifests: a',
          'registry: a',
          'platforms: a',
          '```',
        ].join('\n'),
      );
      const service = createService({ slotReader });

      const report = await service.contractPreflight(checkoutPath);

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual(['project-testing']);
    });
  });

  describe('installPluginLocally', () => {
    it('should return installed when the installer succeeds', async () => {
      const localPluginInstaller = new FakeLocalPluginInstaller();
      const service = createService({ localPluginInstaller });

      expect(await service.installPluginLocally(checkoutPath)).toEqual({ state: 'installed' });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should return failed with the reason when the installer throws a setup error', async () => {
      const localPluginInstaller = new FakeLocalPluginInstaller();
      const service = createService({ localPluginInstaller });
      localPluginInstaller.failure = new SkillsSetupError('claude plugin install failed: exit 1');

      expect(await service.installPluginLocally(checkoutPath)).toEqual({
        state: 'failed',
        reason: 'claude plugin install failed: exit 1',
      });
    });

    it('should propagate an error that is not a setup error', async () => {
      const localPluginInstaller = new FakeLocalPluginInstaller();
      const service = createService({ localPluginInstaller });
      localPluginInstaller.failure = new Error('unexpected');

      await expect(service.installPluginLocally(checkoutPath)).rejects.toThrow('unexpected');
    });
  });
});
