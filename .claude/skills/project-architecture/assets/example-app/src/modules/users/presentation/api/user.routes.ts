// The module's HTTP route table. The composition root merges these from every module.
import type { Routes } from "../../../../shared/http.js";
import type { UserController } from "./user.controller.js";

export const userRoutes = (c: UserController): Routes => ({
  "POST /users": c.register,
  "GET /users/:id": c.get,
});
