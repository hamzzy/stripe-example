import { describe, expect, it, vi } from "vitest";

// Focused coverage for the module the Stripe pack's migration rule rewrites.
//
// This test exists so the codemod stages have a real signal: after a
// deterministic rule rewrites `subscriptions.del(` to `subscriptions.cancel(`,
// this suite is what the Verifier runs to decide whether the transformation
// held. A migration target with no test is a migration whose success cannot be
// evidenced, which is the situation Principle 5 exists to prevent.

const del = vi.fn().mockResolvedValue({ id: "sub_test", status: "canceled" });
const list = vi.fn().mockResolvedValue({ data: [] });

vi.mock("stripe", () => ({
  default: class {
    subscriptions = { del, list };
  },
}));

describe("subscription cancellation", () => {
  it("cancels a subscription by id", async () => {
    const { cancelSubscription } = await import("../subscriptions.js");
    await expect(cancelSubscription("sub_test")).resolves.toMatchObject({
      status: "canceled",
    });
    expect(del).toHaveBeenCalledWith("sub_test");
  });

  it("cancels a trial without prorating", async () => {
    const { cancelTrial } = await import("../subscriptions.js");
    await cancelTrial("sub_trial");
    expect(del).toHaveBeenCalledWith("sub_trial", {
      invoice_now: false,
      prorate: false,
    });
  });

  it("lists only active subscriptions for a customer", async () => {
    const { listActiveSubscriptions } = await import("../subscriptions.js");
    await listActiveSubscriptions("cus_test");
    expect(list).toHaveBeenCalledWith({ customer: "cus_test", status: "active" });
  });
});
