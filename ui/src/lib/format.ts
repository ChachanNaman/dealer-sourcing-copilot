// The one money-formatting module. Prices are in lakh everywhere upstream;
// convert to rupees only here. Never print 1.9700000000000002, never mix
// lakh and rupee in the same visual row.

/** 1.97 -> "₹1.97L" */
export const lakh = (v: number): string => `₹${v.toFixed(2)}L`;

/** 22464 -> "₹22,464" (expects a rupee amount) */
export const rupee = (v: number): string =>
  `₹${Math.round(v).toLocaleString("en-IN")}`;

/** 0.22 (lakh) -> "₹22,000" — for margins/headroom shown in rupees */
export const rupeeFromLakh = (vLakh: number): string => rupee(vLakh * 100_000);

/** 11.235 -> "11.2%" */
export const pct = (v: number): string => `${v.toFixed(1)}%`;

/** 96060 -> "96,060 km" */
export const km = (v: number): string => `${v.toLocaleString("en-IN")} km`;
