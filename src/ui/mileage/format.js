/**
 * Display helpers shared by the Mileage screens, so the ledger doesn't have to
 * import from its sibling summary component.
 */

/** A mile count for display: thousands separated, one decimal only when needed. */
export function formatMiles(miles) {
  const n = Number(miles) || 0;
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** "45p" / "25p" for a rate table entry. */
export function rateLabel(pence) {
  return `${pence}p`;
}

/**
 * What to call a claim group's employment on screen. A trip can carry no
 * employer at all (the single-job case), or point at one that has since been
 * deleted — both are still valid claim groups, so both need a name.
 */
export function employerLabel(employerName, employerId) {
  if (employerName) return employerName;
  return employerId == null ? 'No employer' : 'Deleted employer';
}
