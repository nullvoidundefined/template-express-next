/**
 * Schedule hourly cleanup of expired sessions and stale idempotency keys via
 * pg_cron. The whole block is wrapped in EXCEPTION handling so it silently skips
 * where pg_cron is unavailable (e.g. local dev, Neon without the extension).
 * This complements the in-process setInterval session cleanup; it is not the
 * only line of defense.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        -- cron.schedule upserts by job name, so re-running just updates the job.
        PERFORM cron.schedule(
            'cleanup-expired-sessions',
            '0 * * * *',
            $sql$DELETE FROM sessions WHERE expires_at < now()$sql$
        );

        PERFORM cron.schedule(
            'cleanup-expired-idempotency-keys',
            '0 * * * *',
            $sql$DELETE FROM idempotency_keys WHERE created_at < now() - INTERVAL '24 hours'$sql$
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron not available -- skipping cleanup schedule';
    END
    $$;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
        PERFORM cron.unschedule('cleanup-expired-sessions');
        PERFORM cron.unschedule('cleanup-expired-idempotency-keys');
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron not available -- skipping unschedule';
    END
    $$;
  `);
};
