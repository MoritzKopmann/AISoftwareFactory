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
        'project-testing',
        'project-toolchain',
      ]);
    });

    it('should pass when the checkout has every slot, heading and toolchain key', async () => {
      const slotReader = new FakeSlotReader();
      slotReader.setSlotText(
        checkoutPath,
        'project-architecture',
        [
          '## Stack',
          '## Module layout',
          '## Placement rules',
          '## Hard bans',
          '## Plan vocabulary',
          '## UI',
          '## Easy-to-miss wiring',
          '## Load also',
        ].join('\n'),
      );
      slotReader.setSlotText(
        checkoutPath,
        'project-testing',
        ['## Mechanics', '## Layout and naming', '## Fakes and fixtures', '## Load also'].join(
          '\n',
        ),
      );
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
        missingHeadings: [],
        missingKeys: [],
      });
    });

    it("should pass for this repository's own checkout", async () => {
      const useCase = new ContractPreflightUseCase({ slotReader: new FileSystemSlotReader() });

      expect(await useCase.execute(process.cwd())).toEqual({
        passed: true,
        missingSlots: [],
        missingHeadings: [],
        missingKeys: [],
      });
    });
  });
});
