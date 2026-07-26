# Nomos Multi-vendor Checkout Demo

A small polyglot service that acts as the **customer repository** for testing
Nomos end to end — from vendor-change detection through a verified pull request
and its rollback.

It is deliberately not a clean codebase. Every awkward thing in it is here to
give some part of Nomos something real to decide about.

| What's in it | What it exercises |
| --- | --- |
| `stripe` dependency, import, constructor, pinned API version | SDK detection, version applicability |
| OpenAI, Slack, and Twilio SDK dependencies plus direct client wrappers | multi-vendor inventory and direct SDK evidence |
| `OPENAI_*`, `SLACK_*`, and `TWILIO_*` configuration | configuration discovery without shipping credentials |
| Support reply and payment-notification routes | reachable OpenAI, Slack, and Twilio call paths |
| Checkout, customer, subscription, invoice, webhook calls | operation-level usage evidence |
| `STRIPE_*` env vars, `api.stripe.com`, `/webhooks/stripe` | Tier 0.5 config, hostname, and webhook detection |
| `StripeGateway` wrapper | human wrapper confirmation, and re-matching when it moves |
| `provider-loader.ts` dynamic import | a mapping unknown that must stay unresolved |
| `infra/main.tf`, `deploy/k8s/` | infrastructure-as-code detection — an integration that exists before the code does |
| `services/billing-reconciler/` | the Python analyzer path, and a second pinned SDK version |
| `src/payments/subscriptions.ts`, `reconcile.py` | call sites a migration rule can actually transform |
| `src/pricing/tax-rates.ts` | a protected path the policy engine must refuse to edit |
| `nomos-policy.example.yml` | a policy with real refusals in it |
| unowned `src/app.ts` | ownership coverage below 100%, visibly |

No real credentials are included. The service uses fake values by default and
does not call Stripe, OpenAI, Slack, or Twilio unless you explicitly start it
with valid credentials and make the corresponding request.

## Where to start

- **[`WORKFLOW.md`](WORKFLOW.md)** — the runbook. Eleven stages from App
  installation to emergency fleet rollback, what each proves, what is needed
  before you begin, and what this fixture *cannot* prove.
- **[`EXPECTED_SCAN.md`](EXPECTED_SCAN.md)** — what a scan should find, what
  Nomos must **refuse** to claim, and eight rescan experiments.
- **[`ACCEPTANCE_MATRIX.md`](ACCEPTANCE_MATRIX.md)** — the exact automated and
  manual checks that map this repository to the decisions in
  `milestone-fix.md`.

Quick version:

1. Copy this directory into a new Git repository you don't mind Nomos writing to.
2. Push it somewhere your Nomos GitHub App can reach.
3. Grant **read-only** permissions first — observation must work without write.
4. Connect the installation, select the repository, and enable the Stripe,
   OpenAI, Slack, and Twilio detector packs.
5. Run the baseline scan, then confirm the high-confidence candidates in Nomos.
6. Follow `WORKFLOW.md` from stage 2 onward.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

The health endpoint is `GET http://localhost:3000/health`.

For a real Stripe request, replace the placeholder values in `.env`. Never
commit that file.

## Verify

```bash
npm test
npm run typecheck

# From the Nomos repository root:
cd nomo-backend
uv run pytest -q tests/acceptance/test_stripe_example_fixture.py
```

The fixture test is the fast detector contract. It does not replace the real
authenticated GitHub acceptance tests; configure and run those using
`ACCEPTANCE_MATRIX.md`.

## Resetting the fixture

Create new commits when testing webhook-triggered or commit-pinned rescans. For
example, change the Stripe SDK version, add another SDK operation, or remove the
dynamic import and compare the resulting scan.
