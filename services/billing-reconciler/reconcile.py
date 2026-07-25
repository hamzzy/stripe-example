"""Nightly billing reconciliation.

A second language in the same repository, so the Python analyzer path is
exercised rather than assumed: package manifest, imports, symbols, calls,
HTTP client usage, configuration reads, and framework routes all have Python
evidence here, not only TypeScript.

This is also the target of the Stripe pack's Python migration rule, which
rewrites `stripe.Subscription.delete(` to `stripe.Subscription.cancel(`.
"""

import os

import stripe

# Configuration by name. The value comes from the environment at runtime and
# is never committed; the scanner records that STRIPE_SECRET_KEY is read here.
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "sk_test_placeholder")
stripe.api_version = os.environ.get("STRIPE_API_VERSION", "2020-08-27")

STRIPE_CUSTOMERS_ENDPOINT = "https://api.stripe.com/v1/customers"


def cancel_delinquent_subscription(subscription_id: str) -> object:
    """Target of migration rule `stripe.python.subscription-delete-to-cancel`."""
    return stripe.Subscription.delete(subscription_id)


def retrieve_customer(customer_id: str) -> object:
    return stripe.Customer.retrieve(customer_id)


def list_open_invoices(customer_id: str) -> object:
    return stripe.Invoice.list(customer=customer_id, status="open")


def reconcile(customer_id: str) -> dict[str, object]:
    """Compare Stripe's view of a customer against the local ledger."""
    customer = retrieve_customer(customer_id)
    invoices = list_open_invoices(customer_id)
    return {"customer": customer, "open_invoices": invoices}
