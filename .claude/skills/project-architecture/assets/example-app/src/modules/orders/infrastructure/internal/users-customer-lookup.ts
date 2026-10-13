// Adapter to ANOTHER MODULE. Implements orders' CustomerLookup using the users module's internal API.
// Imports the users module only via its index.ts. If users becomes a separate service,
// replace this with an HTTP client in infrastructure/<domain> — business/ is untouched.
import type { UsersApi } from "../../../users/index.js";
import type { CustomerLookup } from "../../business/customer/customer-lookup.js";

export class UsersCustomerLookup implements CustomerLookup {
  constructor(private readonly users: UsersApi) {}

  async exists(customerId: string): Promise<boolean> {
    return (await this.users.getUserSummary(customerId)) !== null;
  }
}
