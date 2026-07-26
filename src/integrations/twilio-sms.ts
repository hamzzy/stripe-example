import twilio from "twilio";

import type { AppConfig } from "../config.js";

/** Sends payment-receipt SMS messages through Twilio's Node SDK. */
export class ReceiptMessenger {
  private readonly client: ReturnType<typeof twilio>;
  private readonly from: string;

  constructor(config: AppConfig) {
    this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.from = config.twilioFromNumber;
  }

  async sendReceipt(to: string, paymentId: string) {
    return this.client.messages.create({
      to,
      from: this.from,
      body: `Your payment ${paymentId} was received.`,
    });
  }
}
