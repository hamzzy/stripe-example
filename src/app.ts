import express from "express";

import { loadConfig } from "./config.js";
import {
  draftReplyViaOpenAiRest,
  SupportReplyGenerator,
} from "./integrations/openai-client.js";
import { SlackNotifier } from "./integrations/slack-notifier.js";
import { sendReceiptViaTwilioRest } from "./integrations/twilio-rest.js";
import { ReceiptMessenger } from "./integrations/twilio-sms.js";
import { beginCheckout } from "./payments/checkout.js";
import { StripeGateway } from "./payments/stripe-client.js";
import { cancelSubscription } from "./payments/subscriptions.js";
import { grossAmount } from "./pricing/tax-rates.js";

export function createApp() {
  const app = express();
  const config = loadConfig();
  const gateway = new StripeGateway(config);
  const supportReplies = new SupportReplyGenerator(config);
  const slack = new SlackNotifier(config);
  const receipts = new ReceiptMessenger(config);

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
  app.post("/support/draft-reply", async (request, response, next) => {
    try {
      response.json({
        reply: await supportReplies.draftReply(String(request.body?.message ?? "")),
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/support/draft-reply-rest", async (request, response, next) => {
    try {
      response.json({
        reply: await draftReplyViaOpenAiRest(
          config,
          String(request.body?.message ?? ""),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/payments/:id/notify", async (request, response, next) => {
    try {
      await slack.notifyPaymentSucceeded(
        String(request.body?.channel ?? "#payments"),
        request.params.id,
      );
      await receipts.sendReceipt(
        String(request.body?.phone ?? "+15005550006"),
        request.params.id,
      );
      response.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });
  app.post("/payments/:id/notify-rest", async (request, response, next) => {
    try {
      const receipt = await sendReceiptViaTwilioRest(
        config,
        String(request.body?.phone ?? "+15005550006"),
        request.params.id,
      );
      response.status(202).json({ accepted: true, receipt });
    } catch (error) {
      next(error);
    }
  });
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
