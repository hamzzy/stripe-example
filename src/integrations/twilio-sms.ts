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

// Twilio deprecated region-only API hostnames and documents api.twilio.com as
// the US1 replacement. This is never called; it is a deterministic scan and
// maintenance target without storing or transmitting credentials.
export async function fetchLegacyRegionMessage(
  messageSid: string,
  authorization: string,
) {
  return fetch(
    `https://api.ie1.twilio.com/2010-04-01/Accounts/example/Messages/${messageSid}.json`,
    { headers: { Authorization: authorization } },
  );
}
