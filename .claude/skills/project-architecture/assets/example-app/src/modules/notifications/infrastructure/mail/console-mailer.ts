// Mail implementation. Swap for SMTP/SES without touching business/.
import type { Mailer } from "../../business/mail/mailer.js";

export class ConsoleMailer implements Mailer {
  async send(to: string, subject: string) {
    console.log(`  [mail] -> ${to}: ${subject}`);
  }
}
