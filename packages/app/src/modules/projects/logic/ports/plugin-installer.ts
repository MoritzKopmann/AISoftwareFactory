import type { PluginInstallResult } from '../domain/plugin-install-result.js';

export interface PluginInstaller {
  install(checkoutPath: string): Promise<PluginInstallResult>;
}
