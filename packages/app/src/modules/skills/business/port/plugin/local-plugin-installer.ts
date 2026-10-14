export interface LocalPluginInstaller {
  install(checkoutPath: string): Promise<void>;
}
