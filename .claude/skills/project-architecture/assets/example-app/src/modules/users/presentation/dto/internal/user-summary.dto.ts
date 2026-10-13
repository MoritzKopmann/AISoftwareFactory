// INTERNAL DTOs: what OTHER MODULES get through presentation/internal.
// Separate from the HTTP DTOs even when similar — they evolve for different consumers.
// Plain readonly data: no classes, no methods, no entity references. Rich types (Date) are allowed
// because nothing is serialized, but keep them serializable-in-principle so the module could become a
// remote service without changing the contract.

export interface UserSummary {
  readonly id: string;
  readonly name: string;
}
