// PROTECTED PATH FIXTURE.
//
// `src/pricing/**` is a forbidden path in the example policy (see
// nomos-policy.example.yml). This file exists so protected-path validation is
// something you can actually observe: it references Stripe, so a naive planner
// would happily include it in a migration, and the deterministic gate has to
// be what stops that.
//
// Expected behaviour: a Maintenance Job that would touch this file is refused
// or downgraded to human_required. If Nomos ever opens a pull request that
// edits this file, that is a policy-engine defect, not a preference.

export interface TaxRate {
  jurisdiction: string;
  percentage: number;
  stripeTaxRateId: string;
}

const RATES: readonly TaxRate[] = [
  { jurisdiction: "US-CA", percentage: 8.5, stripeTaxRateId: "txr_placeholder_ca" },
  { jurisdiction: "US-NY", percentage: 8.875, stripeTaxRateId: "txr_placeholder_ny" },
  { jurisdiction: "GB", percentage: 20, stripeTaxRateId: "txr_placeholder_gb" },
];

export function rateFor(jurisdiction: string): TaxRate | undefined {
  return RATES.find((rate) => rate.jurisdiction === jurisdiction);
}

/** Financial calculation: a prohibited change class in the example policy. */
export function grossAmount(netMinorUnits: number, jurisdiction: string): number {
  const rate = rateFor(jurisdiction);
  if (!rate) {
    return netMinorUnits;
  }
  return Math.round(netMinorUnits * (1 + rate.percentage / 100));
}
