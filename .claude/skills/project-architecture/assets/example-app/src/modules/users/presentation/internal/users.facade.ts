// Internal inbound adapter: same job as a controller, but for other modules instead of HTTP.
// Goes through UserService (never the repository) so the same rules apply as for HTTP callers.
import { NotFoundError } from "../../../../shared/errors.js";
import type { UserService } from "../../business/service/user.service.js";
import { toUserSummary } from "../dto/mapper/user.mapper.js";
import type { UserSummary } from "../dto/internal/user-summary.dto.js";
import type { UsersApi } from "./users.api.js";

export class UsersFacade implements UsersApi {
  constructor(private readonly service: UserService) {}

  async getUserSummary(id: string): Promise<UserSummary | null> {
    try {
      return toUserSummary(await this.service.getById(id));
    } catch (e) {
      if (e instanceof NotFoundError) return null;
      throw e;
    }
  }
}
