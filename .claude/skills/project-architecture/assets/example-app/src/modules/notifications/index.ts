// MODULE ENTRY for notifications: no routes, no internal API — it only reacts to events.
import type { EventBus } from "../../shared/event-bus.js";
import type { Mailer } from "./business/port/mail/mailer.js";
import { NotificationService } from "./business/service/notification.service.js";
import { ConsoleMailer } from "./infrastructure/mail/console-mailer.js";
import { registerEventHandlers } from "./presentation/bus/event-handlers.js";

export interface NotificationsModuleDeps {
  bus: EventBus;
  mailer?: Mailer;
}

export function createNotificationsModule(deps: NotificationsModuleDeps) {
  registerEventHandlers(deps.bus, new NotificationService(deps.mailer ?? new ConsoleMailer()));
  return { routes: {}, jobs: {}, internal: {} };
}
