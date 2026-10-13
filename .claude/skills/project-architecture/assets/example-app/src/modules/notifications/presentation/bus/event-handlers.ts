// Event-bus inbound adapter: translate an incoming event into a business call, like a controller does for HTTP.
import type { EventBus } from "../../../../shared/event-bus.js";
import type { NotificationService } from "../../business/service/notification.service.js";

export function registerEventHandlers(bus: EventBus, service: NotificationService) {
  bus.subscribe("user.registered", ({ email }) => service.welcome(email));
  bus.subscribe("order.placed", ({ orderId, total }) => service.orderConfirmed(orderId, total));
}
