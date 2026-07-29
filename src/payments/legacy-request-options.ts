import Stripe from "stripe";

import { loadConfig } from "../config.js";

// Deliberate Stripe 9 request-option forms. Stripe removed these five aliases
// in stripe-node 11.0.0, so each call gives Nomos a separate, source-backed
// maintenance case to discover, plan, patch, verify, and present for review.
const config = loadConfig();
const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: "2020-08-27",
});

export function retrieveCustomerWithLegacyApiKey(customerId: string) {
  return stripe.customers.retrieve(customerId, {
    apiKey: config.stripeSecretKey,
  });
}

export function createCustomerWithLegacyIdempotencyKey(
  email: string,
  requestKey: string,
) {
  return stripe.customers.create(
    { email },
    {
      idempotency_key: requestKey,
    },
  );
}

export function retrieveConnectedAccount(accountId: string) {
  return stripe.accounts.retrieve(accountId, {
    stripe_account: accountId,
  });
}

export function retrievePlatformBalance() {
  return stripe.balance.retrieve({
    apiVersion: "2020-08-27",
  });
}

export function retrievePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    stripeVersion: "2020-08-27",
  });
}
