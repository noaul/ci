import { formatCount } from "@/lib/format";

/**
 * A count set to sit inside Chinese text without breaking the line.
 *
 * The span carries no size, weight, colour or leading of its own, so an inline
 * count takes exactly the type of the sentence around it and the digits keep
 * the surrounding font's baseline instead of dropping onto a fallback serif's.
 * `ci-numeral` only asks for lining figures; `tabular` adds fixed-advance
 * figures, which is what keeps the statistics columns on a common axis when
 * 3,508 sits above 22.
 */
export function Numeral({
  value,
  tabular = false,
}: {
  value: number;
  tabular?: boolean;
}) {
  return (
    <span className={tabular ? "ci-numeral ci-numeral-tabular" : "ci-numeral"}>
      {formatCount(value)}
    </span>
  );
}
