// INTERNAL API: the contract this module offers to OTHER MODULES (in-process callers).
// Inputs and outputs are internal DTOs or primitives — never entities, never HTTP DTOs.
// Errors: only shared/errors.ts types may escape (or expected absence as null), so callers never
// depend on this module's internal exception types.
import type { UserSummary } from "../dto/internal/user-summary.dto.js";

export interface UsersApi {
  /** Returns null if the user does not exist. */
  getUserSummary(id: string): Promise<UserSummary | null>;
}
