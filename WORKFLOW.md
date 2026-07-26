# Driving the whole Nomos workflow with this fixture

This is the runbook for taking one repository from "GitHub App installed" to
"verified pull request merged and reverted", using this example as the
customer repository. Each stage says what to do, what should happen, and what
it proves. Stages depend on the ones before them.

Read the "Before you start" section first — most of the workflow cannot run
until the GitHub App is configured correctly, and the failure mode of a missing
permission is a confusing 403 several stages later.

---

## Before you start — what is needed

### 1. A disposable GitHub repository

Push this directory to a repository you do not mind Nomos writing to. From
stage 5 onward Nomos creates branches and opens pull requests against it.

```bash
cp -r examples/stripe-checkout-demo /tmp/nomos-fixture
cd /tmp/nomos-fixture && git init && git add -A
git commit -m "Nomos workflow fixture"
git remote add origin git@github.com:<you>/nomos-fixture.git
git push -u origin main
```

### 2. GitHub App permissions

Milestones 1–3 need **read only**. Do not grant write until stage 5 — the
whole point of the observation/execution split is that observation never needs
it, and granting early hides whether that is true.

| Scope | M1–M3 | M4–M5 |
| --- | --- | --- |
| Repository metadata | read | read |
| Contents | read | **write** |
| Pull requests | read | **write** |
| Checks (or Commit statuses) | read | **write** |
| Workflow runs | read | read |
| Deployments | read | read |

Nomos refuses any write permission outside those three scopes. Granting
`administration` write, in particular, will be rejected — it would let Nomos
alter the branch protection you rely on to review its own pull requests.

### 3. Webhook subscriptions

`installation`, `installation_repositories`, `push`, `pull_request`,
`check_run`, `check_suite`, `workflow_run`.

The last four are new at Milestone 5. Without them, merges and CI results are
never observed and jobs sit in `pr_open` forever.

### 4. Nomos configuration

| Setting | Value | Notes |
| --- | --- | --- |
| `MAINTENANCE_EXECUTOR` | `github-actions` | `cloud` skips stages 5–6 entirely |
| `EXECUTION_API_PUBLIC_URL` | your API's public URL | the Action calls back to it |
| `EXECUTION_ACTION_REF` | `owner/repo@<40-char SHA>` | production refuses a floating tag or the placeholder |

### 5. Workspace policy

Copy `nomos-policy.example.yml` into the workspace policy. It is written so the
policy engine has something to refuse; a permissive policy proves nothing.

### 6. What is still missing, and blocks full completion

Two things are not code and cannot be worked around here:

- **The ground-truth corpus is awaiting human review.**
  `packs/stripe/fixtures/ground_truth_corpus/` now contains 40 immutable
  official-source records and hash-bound worksheets. They remain `unlabeled`
  until a named primary labeler and a different reviewer approve them, so the
  replay evaluator correctly refuses to declare Milestone 1 quality passed.
- **The Stripe migration rules are unverified drafts.** They will not produce a
  deterministic transformation until a pack owner confirms them against
  Stripe's changelog. Stage 6 will route to `human_required` or the AI-residual
  path until then. This is enforced, not incidental.

---

## Stage 1 — Vendor Intelligence (Milestone 1)

**Do:** register Stripe as a vendor with at least two sources — the changelog
(`https://docs.stripe.com/changelog`) and a package registry
(`https://registry.npmjs.org/stripe`). Trigger a source refresh, twice, with a
gap.

**Expect:** an immutable snapshot per fetch; extracted changes on the Runway
with provenance. The second registry fetch produces change candidates for
versions published *since the first* — not the package's entire history. A
major version bump is flagged `breaking` and `requires_review: true`; a minor
bump is recorded as `unclassified`.

**Proves:** package-registry diffing and docs-structural diffing; a first
observation correctly reports nothing rather than flooding the Runway.

## Stage 2 — Observation (Milestone 2)

**Do:** install the App on the fixture repository, select it, let the baseline
scan run. Then push a commit and let the webhook drive an incremental scan.

**Expect:** everything in `EXPECTED_SCAN.md`. **No workflow file is added to
your repository at this stage** — if one appears, the observation/execution
split has regressed.

**Proves:** App-based observation with no CI dependency; SHA-keyed facts.

## Stage 3 — Human confirmation

**Do:** open the Unknowns Queue. Confirm `StripeGateway` as a Stripe wrapper.
Leave the `provider-loader.ts` dynamic import unresolved.

**Then run experiment 4 from `EXPECTED_SCAN.md`:** move `stripe-client.ts` to
`src/billing/`, push, and rescan.

**Expect:** the confirmation follows the file to its new path. It must **not**
reappear as a fresh unknown asking you to re-confirm something you already
confirmed.

**Proves:** the wrapper re-matching rule (§5.2.2).

## Stage 4 — Impact (Milestone 3)

**Do:** take a real Stripe change from stage 1 and evaluate it against the
workspace.

**Expect:** an impact assessment naming both halves of its reasoning — the
vendor change and the repository evidence. Now change the pinned API version in
`stripe-client.ts`, push, and re-evaluate: applicability should flip.

**Proves:** deterministic version applicability and integration matching.

## Stage 5 — Enable execution (Milestone 4)

**Do:** grant the three write permissions. Enable pull-request mode on the
installation. Enable Suggest/PR mode for the repository.

**Expect:** Nomos opens a pull request adding
`.github/workflows/nomos-maintenance.yml`. Asking again returns the *same* PR.
Review the workflow before merging — least privilege, `id-token: write`, a
pinned Action SHA, and a payload carrying only a job id. Merge it.

**Proves:** workflow provisioning by PR; the disclosure moment for "automated
fixes will run in your CI"; provisioning idempotency.

## Stage 6 — Suggest a migration (Milestone 4)

**Do:** create a Maintenance Job from the stage 4 assessment.

**Expect:** the job dispatches to your Actions runner, executes, verifies, and
reaches `ready_for_review` with a diff and a complete evidence package
including the exact pack version. If the pack rules are still drafts, expect
`human_required` instead — that is correct behaviour, not a failure.

**Also try:** a job that would touch `src/pricing/tax-rates.ts`. It must be
refused. If Nomos proposes an edit there, that is a policy-engine defect.

**Proves:** the Executor/Verifier contract; protected-path validation;
pack-version recording.

## Stage 7 — Verified pull request (Milestone 5)

**Do:** open the pull request from the reviewed job. Then click it again.

**Expect:** one pull request, not two. It carries the evidence report and a
`Nomos maintenance verification` check. If any verification was `unavailable`,
the check is **neutral, never green** — a green check must mean checks ran.

**Proves:** the no-duplicate-PRs criterion; the unavailable-is-not-passed rule.

## Stage 8 — CI is ground truth

**Do:** let your CI run. Then cancel a run deliberately and re-trigger it.

**Expect:** the cancelled run is recorded as `unavailable`, **not** as passed.
A genuine failure after Nomos's own checks passed is flagged as a
contradiction on the job.

**Proves:** the customer's CI decides, and ambiguous conclusions never read as
success.

## Stage 9 — Merge and roll back

**Do:** merge the pull request. Then request a rollback with a reason.

**Expect:** the job moves to `merged`, the Nomos branch is cleaned up, and the
rollback opens a **revert pull request** — it does not revert anything by
itself. The revert body leads with your reason, links the original PR and
merge commit, and lists restored files. Any file it could not restore is named
under "Needs manual attention".

**Proves:** merge observation; rollback as a proposal, not an action.

## Stage 10 — Conflict handling

**Do:** open a job, get a pull request, then push a conflicting change to
`main` on the same lines.

**Expect:** Nomos marks the PR conflicted and comments. It does **not** rebase,
regenerate, or close it — regenerating would replace a diff you may already
have reviewed.

**Proves:** Open Question 9's recorded answer.

## Stage 11 — Emergency fleet rollback

**Do:** as a platform admin, withdraw the pack version that produced the merged
change, with a reason.

**Expect:** queued jobs referencing it are halted, new jobs against it are
refused, and the response **lists the merged pull requests it already
produced** — including the one from stage 9. Nomos does not auto-revert them.

**Proves:** Section 7's blocking requirement — knowing the blast radius of a
bad pack after it has already shipped code.

---

## What this fixture cannot prove

- **Milestone-level detection quality.** Collection has reached 40 records, but
  the required primary labels, second-person approvals, and replay baseline
  are still needed before claiming the quality gate.
- **Multi-repository blast radius.** One repository, so the integration graph
  is trivial.
- **Trust decay and execution-minute ceilings.** Open Questions 4 and 5 need
  fleet data over time, not one repository once.
- **Tier 2 wrapper inference.** Off by default; `provider-loader.ts` stays an
  unknown, which is the intended behaviour with Tier 2 disabled.
