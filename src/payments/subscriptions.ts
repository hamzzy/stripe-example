import Stripe from "stripe";

import { loadConfig } from "../config.js";

// A second Stripe surface, deliberately written against the *older* call
// style so the Stripe pack's migration rules have something real to
// transform. The pack's draft rule rewrites `stripe.subscriptions.del(` to
// `stripe.subscriptions.cancel(`; this file is what that codemod edits, what
// the resulting pull request diffs, and what a rollback restores.
//
// The client is deliberately module-scoped and named `stripe` -- that is the
// shape the deterministic rule matches, and matching it here is the point.
const config = loadConfig();
const stripe = new Stripe(config.stripeSecretKey, {
  // Pinned to the version this SDK major ships against. An old SDK with an
  // old pinned API version is exactly the state a migration exists to fix.
  apiVersion: "2025-03-31.basil",
});

export async function cancelSubscription(subscriptionId: string) {
  // Target of migration rule `stripe.node.subscriptions-del-to-cancel`.
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function cancelTrial(subscriptionId: string) {
  // A second call site, so the codemod has to change more than one line and
  // the diff-size and blast-radius calculations see a realistic patch.
  return stripe.subscriptions.cancel(subscriptionId, {
    invoice_now: false,
    prorate: false,
  });
}

export async function listActiveSubscriptions(customerId: string) {
  return stripe.subscriptions.list({ customer: customerId, status: "active" });
}
