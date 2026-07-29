# Acceptance matrix

This fixture has two jobs:

1. fail quickly when the deterministic detector contract changes; and
2. exercise the real GitHub → webhook → Temporal → Redis → scan → impact →
   maintenance flow in a disposable repository.

One test cannot prove both. Use the three layers below.

| Layer | Command / action | What it proves |
| --- | --- | --- |
| Fixture contract | `cd nomo-backend && uv run pytest -q tests/acceptance/test_stripe_example_fixture.py` | Tiers 0/0.5/1 evidence, Tier 2 ambiguity, Tier 3 `not_collected`, ownership gaps, no repository execution, migration targets, and protected paths |
| Service acceptance | `uv run pytest -m acceptance tests/acceptance/test_milestone2_design_partner.py` | Real installation selection, signed GitHub webhook, Temporal worker, Redis leases/rate state, commit-pinned scan, persisted inventory |
| Full service workflow | `cd nomo-backend && uv run pytest -m acceptance tests/acceptance/test_full_workflow.py` | Real vendor source, scan, impact assessment, maintenance evidence, review, PR lifecycle, CI truth, and rollback when its environment is configured |
| Authenticated browser pipeline | `cd web && npm run test:e2e -- e2e/design-partner-pipeline.spec.ts` | Signed GitHub webhook → Temporal/Redis-backed scan → authenticated Repositories UI → impact evaluation → Changes UI |
| Manual destructive checks | Stages 5–11 in `WORKFLOW.md` | Permission escalation, CI truth, conflicts, merge, rollback proposal, and withdrawn-pack blast radius |

## Decision coverage from `milestone-fix.md`

| Decision | Covered here | Expected result |
| --- | --- | --- |
| App-based observation, no workflow in M1–M3 | Fixture contract + real acceptance | Baseline and push scans run; no `nomos-maintenance.yml` is present |
| Tier 0 package/version evidence | Fixture contract | Node `9.16.0` and Python `9.12.0` are found |
| Tier 0.5 config/hostname/webhook/IaC | Fixture contract | Stripe structural evidence and name-only secret references are found |
| Tier 1 call-site evidence | Fixture contract | Stripe operations are represented in syntax usages |
| Tier 2 wrapper inference | Fixture contract + Stage 3 | Wrapper remains a candidate until confirmed; confirmation survives a move |
| Tier 3 runtime evidence | Fixture contract | `runtime.state == not_collected`; coverage is not complete |
| SHA-keyed incremental facts | Real acceptance + rescan experiments | A push produces a scan for that exact commit |
| Deterministic planner gates | Stages 4 and 6 | Draft rules route to `human_required`; forbidden paths are refused |
| Exact pack version on jobs | Stage 6/full workflow | Evidence names the producing pack version |
| CI is authoritative | Stages 7–8 | Cancelled/unavailable never appears green |
| Human-controlled writes | Stages 5–10 | Workflow and code changes arrive by PR; rollback is also a PR |

## Gates this repository cannot satisfy by itself

- The Stripe corpus now has **40 immutable source records**, but all 40 still
  require a named primary labeler and a different second reviewer. Collection
  is complete; Milestone 1 quality remains gated on human approval and replay.
- The migration rules are still draft until a named pack owner verifies them
  against authoritative Stripe changelog entries.
- One repository cannot prove multi-repository blast radius, fleet trust decay,
  or execution-minute ceilings. Use multiple installed repositories for those
  acceptance cases.
