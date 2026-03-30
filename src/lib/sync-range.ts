/** Only sync events from now through this many days ahead (OAuth + ICS). */
export const SYNC_FORWARD_DAYS = 30;

export function getSyncRange() {
  const rangeStart = new Date();
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + SYNC_FORWARD_DAYS);
  return { rangeStart, rangeEnd };
}
