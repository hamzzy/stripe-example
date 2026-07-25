# Expected Nomos results

Exact counts grow as the scanner improves. What must not change is the
*category* of evidence produced, and — more importantly — the things Nomos
must refuse to claim. The second table is the one worth checking first: a
scan that over-claims is a worse failure than one that finds too little.

## Customer Facts (Milestone 2)

| Category | Expected evidence | Source file |
| --- | --- | --- |
| SDK dependency | `stripe` pinned to `9.16.0` | `package.json`, `package-lock.json` |
| SDK dependency (Python) | `stripe==9.12.0` pinned | `services/billing-reconciler/pyproject.toml` |
| SDK import | `import Stripe from "stripe"` | `src/payments/stripe-client.ts` |
| SDK import (Python) | `import stripe` | `services/billing-reconciler/reconcile.py` |
| SDK constructor | `new Stripe(...)` | `stripe-client.ts`, `subscriptions.ts` |
| API version | `2020-08-27` (pinned, pre-migration) | `stripe-client.ts`, `subscriptions.ts`, ConfigMap, `reconcile.py` |
| Configuration | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION` | `config.ts`, `.env.example`, manifest |
| Webhook route | `POST /webhooks/stripe` | `src/app.ts` |
| Direct HTTP hostname | `https://api.stripe.com/v1/customers` | `stripe-client.ts`, `reconcile.py` |
| Operations | Checkout session, customer retrieve, subscription cancel, invoice list, webhook construct | `payments/`, `reconcile.py` |
| Likely wrapper | Exported `StripeGateway` | `src/payments/stripe-client.ts` |
| Test inventory | Vitest suite | `src/payments/__tests__/` |
| CI inventory | GitHub Actions workflow | `.github/workflows/ci.yml` |
| Ownership | Five owned paths, `src/app.ts` unowned | `.github/CODEOWNERS` |
| Mapping unknown | Dynamic import | `src/payments/provider-loader.ts` |

## Tier 0.5 — infrastructure-as-code

| Category | Expected evidence | Source file |
| --- | --- | --- |
| Terraform provider | `stripe` | `infra/main.tf` |
| Terraform resources | `stripe_webhook_endpoint`, `stripe_price` | `infra/main.tf` |
| Terraform data source | `aws_secretsmanager_secret` | `infra/main.tf` |
| Terraform variables | `stripe_secret_key`, `aws_region` | `infra/main.tf` |
| Kubernetes kinds | `Deployment`, `ConfigMap` | `deploy/k8s/checkout-deployment.yaml` |
| Container image | `ghcr.io/example/checkout:1.4.2` | same |
| Environment variable names | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION`, `PORT` | same |
| Secret reference | `stripe-credentials` (name only) | same |
| Config reference | `checkout-config` (name only) | same |

This section matters because it is an integration that exists in
infrastructure **before** it exists in application code. A repository with only
the Terraform would still be integrated with Stripe.

## What Nomos must refuse to claim

| Must not | Why |
| --- | --- |
| Report coverage as complete | Runtime facts (Tier 3) are not collected here. Coverage must say `not_collected`, not 100%. |
| Store any secret *value* | Only names and structural references. Config detection records `STRIPE_SECRET_KEY` exists, never what it holds. |
| Auto-confirm the wrapper | `StripeGateway` is a likely wrapper, not a confirmed one, until a human says so. |
| Resolve the dynamic import | `provider-loader.ts` must surface as a mapping unknown, not a silent assumption. |
| Report ownership as 100% | `src/app.ts` has no CODEOWNERS rule; the gap must be visible. |
| Execute repository code | The scan is read-only and commit-pinned. |
| Edit `src/pricing/**` | Forbidden path in `nomos-policy.example.yml`. A PR touching it is a policy-engine defect. |
| Merge anything | `auto_merge: false`. Every repository write waits for a human. |

## Migration targets (Milestones 4–5)

These call sites exist so a codemod has something real to transform:

| Rule | Target | File |
| --- | --- | --- |
| `stripe.node.subscriptions-del-to-cancel` | `stripe.subscriptions.del(` ×2 | `src/payments/subscriptions.ts` |
| `stripe.python.subscription-delete-to-cancel` | `stripe.Subscription.delete(` ×1 | `services/billing-reconciler/reconcile.py` |

Both rules ship as `status: "draft"` in `packs/stripe/migration-rules.json` and
**will not produce a transformation until a pack owner verifies them against
Stripe's own changelog and flips them to `verified`.** That is deliberate: see
`packages/vendors/migration_rules.py`. Until then, expect the planner to route
these to `human_required` or an AI-residual path, not to a deterministic edit.

The fixture is pinned to **Stripe 9.16.0** (TypeScript) and **9.12.0** (Python)
on purpose. `subscriptions.del()` exists in Stripe 9 and was replaced by
`cancel()` in later majors — a fixture already on Stripe 18 has nothing left to
migrate, because the rename has already happened there. If you bump these pins,
the migration targets stop compiling and the codemod stages become untestable.

## Rescan experiments

Each produces a new commit, so each exercises webhook-triggered incremental
analysis and SHA-keyed facts.

1. **Version applicability** — change `stripe` in `package.json` and the
   lockfile together; confirm the SDK version fact follows.
2. **API version applicability** — change `2024-06-20` in `stripe-client.ts`;
   confirm impact assessment for a dated change flips between applicable and
   irrelevant.
3. **New operation** — add `stripe.subscriptions.create(...)`; confirm it
   appears as a new usage without a full rescan being required.
4. **Wrapper re-matching** — `git mv src/payments/stripe-client.ts
   src/billing/stripe-client.ts`. After the rescan the human confirmation must
   **carry forward to the new path**, not be re-raised as a fresh unknown.
   This is the §5.2.2 rule and it is the easiest one to regress.
5. **Unknown disappears** — delete `provider-loader.ts`; confirm the dynamic
   import unknown resolves rather than lingering.
6. **Ownership coverage** — delete a CODEOWNERS line; confirm coverage drops
   and the newly-unowned path is named.
7. **Infra-only integration** — delete every `src/payments/**` file but keep
   `infra/main.tf`; confirm Stripe is still detected from Tier 0.5 alone.
8. **Webhook liveness** — push with the Nomos webhook temporarily disabled in
   the GitHub App, then wait for the scheduled sweep. It must alert on SHA
   drift, not silently fall back to polling.
