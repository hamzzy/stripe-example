import type { StripeGateway } from "./stripe-client.js";

export async function beginCheckout(
  gateway: StripeGateway,
  customerEmail: string,
) {
  const session = await gateway.createCheckoutSession(customerEmail);
  return { checkoutUrl: session.url, sessionId: session.id };
}
