/**
 * Adds attempted_at to stripe_events: the time of the latest processing claim.
 * The claim uses it to re-claim an event whose handler died mid-processing
 * (status still 'processing' long after the claim). Existing rows take NOW(),
 * so a row stuck before this migration becomes re-claimable once the stale
 * window passes. Requires the stripe_events table to exist.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn('stripe_events', {
    attempted_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumn('stripe_events', 'attempted_at');
};
