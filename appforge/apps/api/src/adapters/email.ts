import { env } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

/** Console adapter for development; swap for an SMTP/provider adapter in production. */
class ConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[email] to=${message.to} from=${env.EMAIL_FROM} subject="${message.subject}"\n${message.text}`);
  }
}

let adapter: EmailAdapter | null = null;
export function getEmailAdapter(): EmailAdapter {
  if (!adapter) adapter = new ConsoleEmailAdapter();
  return adapter;
}
