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
    api_key: config.stripeSecretKey,
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

export function updateBalanceSettlementDelay(accountId: string) {
  // The PRD 72 live fixture intentionally uses the pre-2025-07-30 preview
  // parameter so Nomos has a real field-level migration to detect and apply.
  // Keep this call in the acceptance scan corpus until the migration is published.
  // Revision marker: 2026-08-12T14:55:09Z -- each live proof uses a new commit so the webhook starts a fresh scan.
  // @ts-expect-error Stripe 9 predates the Balance Settings preview surface.
  return stripe.balanceSettings.update(
    { settlement_timing: { delay_days: 3 } },
    { stripeAccount: accountId },
  );
}
