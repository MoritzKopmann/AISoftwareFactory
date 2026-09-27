export type PluginInstallOutcome =
  { readonly state: 'installed' } | { readonly state: 'failed'; readonly reason: string };
