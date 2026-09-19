# Idempotency claim: in-flight 409, release on failure, and bind a key to one request

Branch: `fix/idempotency-claim`
Ticket: IAN-130 (audit finding 2, P0, in `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`); follow-up IAN-150
Timing: the spec was committed at 16:54 local time, the first implementation at 17:06, and the last fix at 17:44; this document was written at 17:50, six minutes after the last behavior-changing commit, per `git log` and `date`.

## Summary

The idempotency middleware made a retried `POST` or `PUT` carrying an `Idempotency-Key` header safe to repeat, but four defects undermined it. It stored every JSON response, including 500s, so a retry after a transient failure replayed the error for 24 hours. It had no in-flight claim, so two concurrent retries both ran the handler, which for checkout meant two Stripe sessions. It bound a key only to the user, so a key reused on another route or with another body replayed the first response. And a key older than 24 hours could never be stored again, because the insert conflicted with the expired row.

A request now claims its key, with a fingerprint of its method, path, and body hash, before the handler runs. A retry of a completed request is replayed without running the handler, a retry while the first request is still running answers 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS`, and a key reused on a different request answers 422 `IDEMPOTENCY_KEY_REUSED`. A response of 500 or above, a request timeout, or a dropped connection releases the claim, so the next retry runs the handler again.

## What changed

- Migration `1771879388553`: `idempotency_keys` gains `request_method`, `request_path`, `request_body_hash`, `status` (`in_progress` or `completed`), and `has_json_body`; `status_code` and `response_body` become nullable. The down migration deletes rows that cannot satisfy the restored `NOT NULL` constraints first.
- `idempotencyRepository.ts`: four operations replace `findByKey` and `store`. `claimKey` inserts an `in_progress` row or resets one older than 24 hours in a single `ON CONFLICT ... DO UPDATE ... WHERE` statement, so two simultaneous requests can never both claim; `findKey`, `completeKey`, and `releaseKey` read, complete, and delete a claim.
- `idempotencyMiddleware.ts`: claims before the handler, answers held keys (replay, 409, or 422), rejects keys over 255 characters with 400, and settles the claim before any response bytes are flushed by holding the first `res.json` or `res.end` until the claim is completed or released.
- `errorCodesConstants.ts`, `httpConstants.ts`, and the new `idempotencyConstants.ts`: the two error codes, `UNPROCESSABLE_ENTITY`, and `IDEMPOTENCY_KEY_MAX_LENGTH`.
- Tests: middleware unit tests against a fake repository, repository unit tests, an integration flow against real Postgres (including a real two-request race and ten-iteration immediate-retry loops), and an integration test of the down migration.

## Acceptance criteria

The spec (`docs/superpowers/specs/2026-09-19-idempotency-claim.md`, deleted in this PR's last commit because the code is the spec once it ships, and readable at commit `b9cfa50`) grew to twenty criteria across three review rounds:

- I-1 to I-9, the original behavior: replay, release on 5xx, 409 while running, 422 on a different request, reset after 24 hours, one handler run under a race, replay of 4xx and 204, and untouched requests without the header, a user, or a replayable method.
- I-10 to I-17, from review round one: a 408 timeout releases, a disconnect during the claim releases, a failed completion falls back to release and logs the key, user ID, and request ID, a JSON `null` replays as `null`, an immediate retry is replayed rather than answered 409, a vanished row is claimed again, keys over 255 characters are rejected, and the down migration succeeds on stored 204 rows.
- I-18 to I-20, from round two: a response without a JSON body replays empty (tracked by `has_json_body`, since a nullable `jsonb` column cannot tell SQL NULL from JSON `null`), `res.end` is held like `res.json` so an immediate retry after a 204 is replayed, and a timeout that fires during the hold gives the client the 408 while the retry replays the handler's real result.

## Architectural decisions

- **Claim before the handler, not store after it.** The alternative was to keep store-after-response and add a lock. Claiming first is what makes the in-flight 409 and the single handler run under a race possible at all, and one `ON CONFLICT` statement gives the lock for free.
- **Hold the response until the claim settles.** Settling on `finish` left a window in which a client that retried the instant it received a response found the row still `in_progress` and received 409. Holding the first `res.json` or `res.end` until the claim is written closes that window at the cost of `res.json` no longer sending synchronously; I-20 pins down the one case where that is visible.
- **Watch `close` from before the claim, not `req.destroyed`.** Node destroys the request stream as soon as its body has been read, so `req.destroyed` made every claimed request look disconnected; the first version hung every claimed request because of it.
- **A stored `has_json_body` flag.** Without it, "no body" and JSON `null` read back identically, and one of them always replayed wrong.

## Testing

- Tests were written first by the `test-author` agent, the R-907 fallback because Codex had hit its usage limit; every round was confirmed failing for assertion or missing-interface reasons before the implementation.
- Final state at `b9cfa50`: unit 228 of 228 (three consecutive runs), integration 38 of 38 on a freshly created database, the idempotency integration file 17 of 17 twice; `tsc`, ESLint, Prettier, and every lefthook gate pass.
- Gap: CI does not yet run `test:integration` (IAN-135), so the race, expiry, and migration tests guard locally until that job exists.

## Codex review

Reviewer: Claude subagent (Fable), fallback: Codex usage limit reached (reset 18:00 local). Three rounds, each on the latest behavior-changing range.

- Round 1 (`origin/main...09bc5cc`), nine findings. HIGH: a 408 timeout was stored and replayed (fixed, I-10); HIGH: a disconnect during the claim left the key `in_progress` (fixed, I-11). MEDIUM: a failed completion left a dead key with an untraceable log (fixed, I-12); MEDIUM: the down migration failed on stored 204 rows (fixed, I-17). LOW: a vanished row answered 409 (fixed, I-15); rows from before the migration match any request (accepted and documented; no deployment carries such rows); JSON `null` replayed empty (fixed, I-13); no immediate-retry test (fixed, I-14); inline column list (fixed); unbounded key length (fixed, I-16).
- Round 2 (`09bc5cc..b2896fc`), five findings. MEDIUM: an immediate retry after a 204 still answered 409 (fixed, I-19); MEDIUM: non-JSON responses replayed as JSON `null`, a regression from the I-13 fix (fixed, I-18). LOW: the asynchronous `res.json` contract was untested (specified and tested, I-20); the I-10 test accepted a hang-up (fixed); the early-disconnect release logged a fabricated 408 (fixed).
- Round 3 (`b2896fc..b9cfa50`), four findings, all LOW, all answered rather than fixed. None is reachable from a route this template ships, since every `Idempotency-Key` route answers JSON: a redirect replays without its `Location` header (IAN-150); a handler that flushes headers after `res.json` produces an unhandled rejection (IAN-150); a handler that calls `res.end` twice bypasses the hold (IAN-150); migration `1771879388553` was edited in place on this branch, so any database that ran an earlier version of it must be recreated before running this branch (no shared or deployed database has).

## Reflection

The first implementation passed all nine original criteria and was still wrong in two HIGH ways, both about responses that do not end the normal way: a timeout that answers 408 and a client that leaves early. The tests did not cover them because the spec did not name them, and the spec did not name them because I wrote it from the audit finding rather than from the request lifecycle in `app.ts`. The second lesson was local: replacing a status-based replay rule with a stored flag came one round late, after the reviewer showed the regression the rule caused. Both corrections came from an independent reviewer reading the diff against the code it runs inside, which is the case R-517 exists for.
