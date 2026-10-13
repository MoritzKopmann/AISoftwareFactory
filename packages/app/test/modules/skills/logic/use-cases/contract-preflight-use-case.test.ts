import { describe, expect, it } from 'vitest';
import { FileSystemSlotReader } from '../../../../../src/modules/skills/infra/integrations/file-system-slot-reader.js';
import { ContractPreflightUseCase } from '../../../../../src/modules/skills/logic/use-cases/contract-preflight-use-case.js';
import { FakeSlotReader } from '../../fakes/fake-skills-ports.js';

const checkoutPath = '/home/user/repo';

describe('ContractPreflightUseCase', () => {
  describe('execute', () => {
    it('should report every required slot as missing when the checkout has none of them', async () => {
      const useCase = new ContractPreflightUseCase({ slotReader: new FakeSlotReader() });

      const report = await useCase.execute(checkoutPath);

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
      const useCase = new ContractPreflightUseCase({ slotReader });

      const report = await useCase.execute(checkoutPath);

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
      const useCase = new ContractPreflightUseCase({ slotReader });

      expect(await useCase.execute(checkoutPath)).toEqual({
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
      const useCase = new ContractPreflightUseCase({ slotReader });

      const report = await useCase.execute(checkoutPath);

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual(['project-testing']);
    });

    it("should pass for this repository's own checkout", async () => {
      const useCase = new ContractPreflightUseCase({ slotReader: new FileSystemSlotReader() });

      expect(await useCase.execute(process.cwd())).toEqual({
        passed: true,
        missingSlots: [],
        missingKeys: [],
      });
    });
  });
});
