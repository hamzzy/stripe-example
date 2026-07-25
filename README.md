# Stripe Checkout Demo

A small polyglot service that acts as the **customer repository** for testing
Nomos end to end — from vendor-change detection through a verified pull request
and its rollback.

It is deliberately not a clean codebase. Every awkward thing in it is here to
give some part of Nomos something real to decide about.

| What's in it | What it exercises |
| --- | --- |
| `stripe` dependency, import, constructor, pinned API version | SDK detection, version applicability |
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
does not call Stripe unless you explicitly start it with valid credentials and
make a request.

## Where to start

- **[`WORKFLOW.md`](WORKFLOW.md)** — the runbook. Eleven stages from App
  installation to emergency fleet rollback, what each proves, what is needed
  before you begin, and what this fixture *cannot* prove.
- **[`EXPECTED_SCAN.md`](EXPECTED_SCAN.md)** — what a scan should find, what
  Nomos must **refuse** to claim, and eight rescan experiments.

Quick version:

1. Copy this directory into a new Git repository you don't mind Nomos writing to.
2. Push it somewhere your Nomos GitHub App can reach.
3. Grant **read-only** permissions first — observation must work without write.
4. Connect the installation, select the repository, let the baseline scan run.
5. Follow `WORKFLOW.md` from stage 2 onward.

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
```

## Resetting the fixture

Create new commits when testing webhook-triggered or commit-pinned rescans. For
example, change the Stripe SDK version, add another SDK operation, or remove the
dynamic import and compare the resulting scan.
