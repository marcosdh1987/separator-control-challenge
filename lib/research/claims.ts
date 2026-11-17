import type { ResearchCampaignSummaryV1, ResearchEnvelopeMapV1, TableJson } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";

/**
 * Documented claims, re-derived from the published data.
 *
 * Every number the Research Lab quotes from the eng_dacs report is stored here
 * with the report section it comes from and the rounding the report used. The
 * page recomputes it from the files it loaded and shows both: a claim that the
 * published data does not reproduce is shown as such, not hidden. Nothing is
 * generated at run time; the statements are curated text.
 */

export type Documented =
  | { kind: "range"; low: number; high: number; decimals: number; unit: string }
  | { kind: "series"; values: readonly number[]; decimals: number; unit: string }
  | { kind: "class"; value: string };

export interface ClaimContext {
  replays: ReadonlyMap<string, Replay>;
  campaign?: ResearchCampaignSummaryV1 | null;
  envelope?: ResearchEnvelopeMapV1 | null;
}

export interface ClaimDefinition {
  id: string;
  section: string;
  documented: Documented;
  /** Recomputes the claim; `null` when the data it needs is not loaded. */
  compute: (context: ClaimContext) => readonly number[] | string | null;
}

export type ClaimStatus = "consistent" | "inconsistent" | "unavailable";

export interface ClaimResult {
  claim: ClaimDefinition;
  status: ClaimStatus;
  computed: readonly number[] | string | null;
}

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function evaluateClaim(claim: ClaimDefinition, context: ClaimContext): ClaimResult {
  let computed: readonly number[] | string | null;
  try {
    computed = claim.compute(context);
  } catch {
    computed = null;
  }
  if (computed === null || (Array.isArray(computed) && computed.length === 0)) {
    return { claim, status: "unavailable", computed: null };
  }
  const documented = claim.documented;
  let ok: boolean;
  if (documented.kind === "class") {
    ok = computed === documented.value;
  } else if (typeof computed === "string") {
    ok = false;
  } else if (documented.kind === "range") {
    ok = computed.every((value) => {
      const rounded = roundTo(value, documented.decimals);
      return Number.isFinite(rounded) && rounded >= documented.low && rounded <= documented.high;
    });
  } else {
    ok = computed.length === documented.values.length
      && computed.every((value, index) => roundTo(value, documented.decimals) === documented.values[index]);
  }
  return { claim, status: ok ? "consistent" : "inconsistent", computed };
}

/* Helpers used by the claim definitions. */

export function tableRows(table: TableJson | undefined): Record<string, unknown>[] {
  if (!table) return [];
  return table.rows.map((row) => Object.fromEntries(table.columns.map((column, index) => [column, row[index]])));
}

export function numbersOf(rows: readonly Record<string, unknown>[], column: string): number[] {
  return rows.map((row) => row[column]).filter((value): value is number => typeof value === "number");
}
