import Stripe from "stripe";

import type { AppConfig } from "../config.js";

export class StripeGateway {
  readonly client: Stripe;

  constructor(private readonly config: AppConfig) {
    // The pinned API version is the fact that makes a dated vendor change
    // either applicable to this service or irrelevant to it. Without a pin,
    // applicability is a guess.
    this.client = new Stripe(config.stripeSecretKey, {
      apiVersion: config.stripeApiVersion as Stripe.LatestApiVersion,
    });
  }

  createCheckoutSession(customerEmail: string) {
    return this.client.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Nomos demo plan" },
            unit_amount: 1500,
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    });
  }

  retrieveCustomer(customerId: string) {
    return this.client.customers.retrieve(customerId);
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.config.stripeWebhookSecret,
    );
  }
}

// Deliberate direct-host evidence for the repository scanner. It is not called.
export async function fetchCustomerDirectly(customerId: string, apiKey: string) {
  return fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
