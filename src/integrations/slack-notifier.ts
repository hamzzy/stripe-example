import { WebClient } from "@slack/web-api";

import type { AppConfig } from "../config.js";

/** Posts operational payment notifications through Slack's Web API. */
export class SlackNotifier {
  private readonly client: WebClient;

  constructor(config: AppConfig) {
    this.client = new WebClient(config.slackBotToken);
  }

  async notifyPaymentSucceeded(channel: string, paymentId: string) {
    return this.client.chat.postMessage({
      channel,
      text: `Payment ${paymentId} succeeded.`,
    });
  }
}
