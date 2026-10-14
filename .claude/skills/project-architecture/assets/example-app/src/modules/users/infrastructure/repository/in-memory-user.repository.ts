// Repository implementation. Swap for Postgres without touching business/.
import type { User } from "../../business/domain/user.js";
import type { UserRepository } from "../../business/port/repository/user.repository.js";

export class InMemoryUserRepository implements UserRepository {
  private rows = new Map<string, User>();

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...this.rows.values()].find((u) => u.email === email) ?? null;
  }
  async save(user: User) {
    this.rows.set(user.id, { ...user });
  }
}
