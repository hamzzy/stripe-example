import { describe, expect, it, vi } from "vitest";

import { beginCheckout } from "../checkout.js";
import type { StripeGateway } from "../stripe-client.js";

describe("beginCheckout", () => {
  it("returns the session identity and URL", async () => {
    const gateway = {
      createCheckoutSession: vi.fn().mockResolvedValue({
        id: "cs_test_demo",
        url: "https://checkout.stripe.com/test/demo",
      }),
    } as unknown as StripeGateway;

    await expect(beginCheckout(gateway, "buyer@example.com")).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/test/demo",
      sessionId: "cs_test_demo",
    });
  });
});
