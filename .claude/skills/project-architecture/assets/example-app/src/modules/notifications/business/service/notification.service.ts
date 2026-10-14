// USE CASES: what to tell whom. Knows nothing about the event bus — it's just called.
import type { Mailer } from "../port/mail/mailer.js";

export class NotificationService {
  constructor(private readonly mailer: Mailer) {}

  welcome(email: string) {
    return this.mailer.send(email, "Welcome!");
  }

  orderConfirmed(orderId: string, total: number) {
    return this.mailer.send(`user-of-order-${orderId.slice(0, 8)}`, `Order confirmed, total ${total.toFixed(2)} EUR`);
  }
}
