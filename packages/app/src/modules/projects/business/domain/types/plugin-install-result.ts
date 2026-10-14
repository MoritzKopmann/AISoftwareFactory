export type PluginInstallResult =
  { readonly state: 'installed' } | { readonly state: 'failed'; readonly reason: string };
