// HTTP inbound adapter: parse request -> call service -> map entity to DTO -> status code.
import { type HttpRequest, type HttpResponse, toHttpError } from "../../../../shared/http.js";
import type { UserService } from "../../business/service/user.service.js";
import { toUserDto } from "../dto/mapper/user.mapper.js";
import type { RegisterUserRequest } from "../dto/api/user.dto.js";

export class UserController {
  constructor(private readonly service: UserService) {}

  register = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
      const { email, name } = (req.body ?? {}) as Partial<RegisterUserRequest>;
      const user = await this.service.register({ email: email ?? "", name: name ?? "" });
      return { status: 201, body: toUserDto(user) };
    } catch (e) {
      return toHttpError(e);
    }
  };

  get = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
      return { status: 200, body: toUserDto(await this.service.getById(req.params.id)) };
    } catch (e) {
      return toHttpError(e);
    }
  };
}
