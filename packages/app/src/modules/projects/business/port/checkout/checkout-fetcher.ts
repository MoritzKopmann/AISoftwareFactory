export interface CheckoutFetcher {
  /** Brings `origin` and `origin/HEAD` of the checkout up to date. Throws `GitHubCliError` on failure. */
  fetch(checkoutPath: string): Promise<void>;
}
