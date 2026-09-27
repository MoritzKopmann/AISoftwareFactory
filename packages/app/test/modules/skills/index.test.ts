import { describe, expect, it } from 'vitest';
import { createSkillsModule } from '../../../src/modules/skills/index.js';
import { SkillsSetupError } from '../../../src/modules/skills/logic/errors/skills-setup-error.js';
import {
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSmokeProbe,
} from './fakes/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';

function createSubject() {
  const smokeProbe = new FakeSmokeProbe();
  const skills = createSkillsModule({
    pluginMirror: new FakePluginMirror(),
    marketplaceRegistry: new FakeMarketplaceRegistry(mirrorDirectory),
    smokeProbe,
    mirrorDirectory,
  });
  return { skills, smokeProbe };
}

describe('createSkillsModule', () => {
  describe('runsBlocked', () => {
    it('should block runs when start-up has not finished', () => {
      const { skills } = createSubject();

      expect(skills.runsBlocked()).toEqual({
        blocked: true,
        reason: 'Skills start-up checks have not finished',
      });
    });

    it('should not block runs when the smoke test passed', async () => {
      const { skills } = createSubject();

      await skills.start();

      expect(skills.runsBlocked()).toEqual({ blocked: false });
    });

    it('should block runs with the reason when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await skills.start();

      expect(skills.runsBlocked()).toEqual({ blocked: true, reason: 'claude exited with code 1' });
    });
  });

  describe('status', () => {
    it('should report pending when start-up has not finished', () => {
      const { skills } = createSubject();

      expect(skills.status()).toEqual({ state: 'pending' });
    });

    it('should report the failure reason when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');
      await skills.start();

      expect(skills.status()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });
  });
});
