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

  async openSocketModeConnection() {
    // Model the pre-v7 optional signature while retaining the current SDK in
    // the fixture. Both the legacy call and the migrated `{}` call typecheck.
    const slack = this.client as unknown as {
      apps: {
        connections: {
          open(options?: Record<string, never>): Promise<unknown>;
        };
      };
    };
    return slack.apps.connections.open();
  }
}
