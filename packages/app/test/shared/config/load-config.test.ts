import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/shared/config/load-config.js';

describe('loadConfig', () => {
  it('should place the home under the user home directory when AISF_HOME is unset', () => {
    const config = loadConfig({ environment: {}, userHomeDirectory: '/home/someone' });

    expect(config.homeDirectory).toBe('/home/someone/.aisf');
  });

  it('should use AISF_HOME as the home when it is set', () => {
    const config = loadConfig({
      environment: { AISF_HOME: '/tmp/aisf-test' },
      userHomeDirectory: '/home/someone',
    });

    expect(config.homeDirectory).toBe('/tmp/aisf-test');
  });

  it('should put the database file in the home directory when loaded', () => {
    const config = loadConfig({
      environment: { AISF_HOME: '/tmp/aisf-test' },
      userHomeDirectory: '/home/someone',
    });

    expect(config.databasePath).toBe('/tmp/aisf-test/aisf.db');
  });

  it('should put the plugin mirror and the probe directory in the home directory when loaded', () => {
    const config = loadConfig({
      environment: { AISF_HOME: '/tmp/aisf-test' },
      userHomeDirectory: '/home/someone',
    });

    expect(config.pluginMirrorDirectory).toBe('/tmp/aisf-test/plugins/aisf');
    expect(config.skillsProbeDirectory).toBe('/tmp/aisf-test/skills-probe');
  });

  it('should default the port to 4317 when AISF_PORT is unset', () => {
    const config = loadConfig({ environment: {}, userHomeDirectory: '/home/someone' });

    expect(config.port).toBe(4317);
  });

  it('should use AISF_PORT as the port when it is set', () => {
    const config = loadConfig({
      environment: { AISF_PORT: '4399' },
      userHomeDirectory: '/home/someone',
    });

    expect(config.port).toBe(4399);
  });
});
