import express from "express";

import { loadConfig } from "./config.js";
import { beginCheckout } from "./payments/checkout.js";
import { StripeGateway } from "./payments/stripe-client.js";
import { cancelSubscription } from "./payments/subscriptions.js";
import { grossAmount } from "./pricing/tax-rates.js";

export function createApp() {
  const app = express();
  const gateway = new StripeGateway(loadConfig());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    (request, response) => {
      const signature = request.header("stripe-signature");
      if (!signature) {
        response.status(400).json({ error: "Missing Stripe signature" });
        return;
      }

      try {
        const event = gateway.constructWebhookEvent(request.body, signature);
        response.json({ received: true, eventType: event.type });
      } catch {
        response.status(400).json({ error: "Invalid Stripe webhook" });
      }
    },
  );

  app.use(express.json());
  app.post("/checkout", async (request, response, next) => {
    try {
      const email = String(request.body?.email ?? "");
      response.status(201).json(await beginCheckout(gateway, email));
    } catch (error) {
      next(error);
    }
  });

  // Reaches the subscription module the Stripe pack's migration rule targets,
  // so the codemod edits code that is genuinely referenced rather than dead.
  app.delete("/subscriptions/:id", async (request, response, next) => {
    try {
      response.json(await cancelSubscription(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  // Reaches the protected path, so a planner has a real reason to want to
  // touch src/pricing/** and the policy gate has a real refusal to make.
  app.get("/quote", (request, response) => {
    const net = Number(request.query.net ?? "0");
    const jurisdiction = String(request.query.jurisdiction ?? "US-CA");
    response.json({ gross: grossAmount(net, jurisdiction) });
  });

  return app;
}
