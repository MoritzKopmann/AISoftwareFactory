// USE CASES. Pure rules; works with entities, knows nothing about DTOs or transports.
import { randomUUID } from "node:crypto";
import type { EventBus } from "../../../../shared/event-bus.js";
import { NotFoundError, ValidationError } from "../../../../shared/errors.js";
import type { User } from "../domain/user.js";
import type { UserRepository } from "../port/repository/user.repository.js";

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly bus: EventBus,
  ) {}

  async register(input: { email: string; name: string }): Promise<User> {
    if (!input.email?.includes("@")) throw new ValidationError("Invalid email");
    if (!input.name?.trim()) throw new ValidationError("Name required");
    if (await this.users.findByEmail(input.email)) throw new ValidationError("Email already registered");

    const user: User = { id: randomUUID(), email: input.email, name: input.name.trim() };
    await this.users.save(user);
    await this.bus.publish("user.registered", { userId: user.id, email: user.email });
    return user;
  }

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  }
}
