/**
 * Adds claim_attempt to stripe_events: a counter the claim increments each time
 * a delivery takes the event, used as a fencing token. Completion writes match
 * on (event_id, claim_attempt), so a slow handler whose stale claim was taken
 * over cannot overwrite the newer attempt's status. Existing rows start at 1.
 * Requires the stripe_events table to exist.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn('stripe_events', {
    claim_attempt: { default: 1, notNull: true, type: 'integer' },
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumn('stripe_events', 'claim_attempt');
};
