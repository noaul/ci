/**
 * One formatter for every count printed on the site.
 *
 * Grouping is fixed to en-US so a build machine's locale cannot turn 3,508 into
 * 3.508 or 3 508 — the digits sit inside Chinese sentences, where a comma is
 * the separator readers expect and the only one the numeral styling is tuned
 * for. Everything that prints a number goes through here, so no page can drift
 * to a hard-coded total.
 */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
