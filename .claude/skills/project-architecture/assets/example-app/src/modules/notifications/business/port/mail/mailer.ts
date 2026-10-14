// What notifications needs for sending mail. Implemented in infrastructure/mail.
export interface Mailer {
  send(to: string, subject: string): Promise<void>;
}
