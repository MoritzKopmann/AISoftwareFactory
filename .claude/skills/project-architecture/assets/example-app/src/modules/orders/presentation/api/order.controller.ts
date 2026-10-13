import { type HttpRequest, type HttpResponse, toHttpError } from "../../../../shared/http.js";
import type { OrderService } from "../../business/service/order.service.js";
import { toOrderDto } from "../dto/mapper/order.mapper.js";
import type { PlaceOrderRequest } from "../dto/api/order.dto.js";

export class OrderController {
  constructor(private readonly service: OrderService) {}

  place = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
      const { userId, lines } = (req.body ?? {}) as Partial<PlaceOrderRequest>;
      const order = await this.service.place(userId ?? "", lines ?? []);
      return { status: 201, body: toOrderDto(order) };
    } catch (e) {
      return toHttpError(e);
    }
  };

  listForUser = async (req: HttpRequest): Promise<HttpResponse> => {
    try {
      const orders = await this.service.listForUser(req.params.userId);
      return { status: 200, body: orders.map(toOrderDto) };
    } catch (e) {
      return toHttpError(e);
    }
  };
}
