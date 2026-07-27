// How figures are presented across the app.
//
// The rule: never state a number more precisely than we can support. Tuition
// varies by course, level and year, so a single figure per university is
// either the cheapest course quoted as if it covered all of them, or an
// average matching nothing. Where a range is known it is shown as a range,
// and every figure carries whether it is sourced or merely estimated.

export function formatGbp(value) {
  if (value == null) return null;
  return `£${Number(value).toLocaleString()}`;
}

/** "£17,000–£26,000" when a real spread is known, otherwise "£17,000". */
export function formatTuition(uni) {
  const { tuition_min_gbp: min, tuition_max_gbp: max, annual_tuition_gbp: single } = uni || {};
  if (min != null && max != null && max > min) {
    return `${formatGbp(min)}–${formatGbp(max)}`;
  }
  return formatGbp(min ?? single) ?? "—";
}

/** The citation behind a field, or null when it's an unverified estimate. */
export function sourceFor(uni, field) {
  const entry = uni?.field_sources?.[field];
  if (!entry || !entry.quote) return null;
  return entry;
}

export function isVerified(uni, field) {
  return sourceFor(uni, field) != null;
}

/** "12 Jun 2026" from an ISO date, for "checked on" labels. */
export function formatCheckedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
