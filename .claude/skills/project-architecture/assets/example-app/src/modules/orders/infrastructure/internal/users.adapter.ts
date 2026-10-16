// Adapter to ANOTHER MODULE. Implements orders' UserPort using the users module's internal API.
// Imports the users module only via its index.ts. If users becomes a separate service,
// replace this with an HTTP client in infrastructure/<domain> — business/ is untouched.
import type { UsersApi } from "../../../users/index.js";
import type { UserPort } from "../../business/port/user/user.port.js";

export class UsersAdapter implements UserPort {
  constructor(private readonly users: Pick<UsersApi, "getUserSummary">) {}

  async exists(customerId: string): Promise<boolean> {
    return (await this.users.getUserSummary(customerId)) !== null;
  }
}
