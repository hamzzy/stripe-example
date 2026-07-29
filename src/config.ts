export interface AppConfig {
  port: number;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  /** Pinned Stripe API version — the input to version applicability. */
  stripeApiVersion: string;
  openAiApiKey: string;
  slackBotToken: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "3000"),
    stripeSecretKey:
      process.env.STRIPE_SECRET_KEY ?? "replace-with-stripe-secret-key",
    stripeWebhookSecret:
      process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder",
    stripeApiVersion: process.env.STRIPE_API_VERSION ?? "2020-08-27",
    openAiApiKey: process.env.OPENAI_API_KEY ?? "replace-with-openai-api-key",
    slackBotToken: process.env.SLACK_BOT_TOKEN ?? "xoxb-placeholder",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "ACplaceholder",
    twilioAuthToken:
      process.env.TWILIO_AUTH_TOKEN ?? "replace-with-twilio-auth-token",
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "+15005550006",
  };
}
