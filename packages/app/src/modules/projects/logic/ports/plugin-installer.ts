import type { PluginInstallResult } from '../domain/types/plugin-install-result.js';

export interface PluginInstaller {
  install(checkoutPath: string): Promise<PluginInstallResult>;
}
