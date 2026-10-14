// Repository interface, owned by business. Implemented in infrastructure/repository.
import type { User } from "../../domain/user.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
