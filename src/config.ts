export interface AppConfig {
  port: number;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  /** Pinned Stripe API version — the input to version applicability. */
  stripeApiVersion: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? "3000"),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder",
    stripeWebhookSecret:
      process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder",
    stripeApiVersion: process.env.STRIPE_API_VERSION ?? "2020-08-27",
  };
}
