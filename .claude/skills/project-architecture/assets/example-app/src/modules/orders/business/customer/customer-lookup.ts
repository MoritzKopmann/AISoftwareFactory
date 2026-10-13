// What orders needs to know about customers — in ORDERS' vocabulary.
// Business doesn't know this is answered by the users module; infrastructure/internal adapts it.
export interface CustomerLookup {
  exists(customerId: string): Promise<boolean>;
}
