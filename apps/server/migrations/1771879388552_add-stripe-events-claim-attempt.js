/**
 * Adds claim_attempt to stripe_events: a counter the claim increments each time
 * a delivery takes the event, used as a fencing token. Completion writes match
 * on (event_id, claim_attempt), so a slow handler whose stale claim was taken
 * over cannot overwrite the newer attempt's status. Existing rows start at 1.
 * Requires the stripe_events table to exist.
 *
 * Rollout: during a rolling deploy, instances of the previous release still
 * complete with an UPDATE matched on event_id alone. That write can only
 * collide with a newer attempt if an old handler is still running more than
 * the ten-minute stale window after its own claim, since only then can a new
 * instance take the claim over. Keep deploy overlap well under ten minutes, or
 * drain webhook traffic across the deploy, and the old writes cannot land on a
 * newer attempt.
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
