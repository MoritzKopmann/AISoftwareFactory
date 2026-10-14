export interface MarketplaceRegistry {
  registeredPath(): Promise<string | undefined>;
  register(path: string): Promise<void>;
}
