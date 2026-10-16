// What orders needs from the users module — in ORDERS' vocabulary.
// Business doesn't know this is answered by the users module; infrastructure/internal adapts it.
export interface UserPort {
  exists(customerId: string): Promise<boolean>;
}
