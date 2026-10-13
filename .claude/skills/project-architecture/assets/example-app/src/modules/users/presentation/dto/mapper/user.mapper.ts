// Entity -> DTO mapping. The only place that knows both entities and DTOs.
import type { User } from "../../../business/domain/user.js";
import type { UserDto } from "../api/user.dto.js";
import type { UserSummary } from "../internal/user-summary.dto.js";

export const toUserDto = (u: User): UserDto => ({ id: u.id, email: u.email, name: u.name });
export const toUserSummary = (u: User): UserSummary => ({ id: u.id, name: u.name });
