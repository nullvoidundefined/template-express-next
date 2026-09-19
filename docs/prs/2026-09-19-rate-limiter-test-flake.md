# Make the rate limiter test deterministic and prove the limit is enforced

Ticket: IAN-151. Branch: `fix/rate-limiter-test-flake`. Addresses audit finding 14 in `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md` (the test half; the `REDIS_URL` half is left for a follow-up).

## Summary

`apps/server/src/__tests__/middleware/rateLimiterMiddleware.test.ts` failed once with "socket hang up" under the turn-end verification gate and then passed on every rerun. Running the file 96 times in batches of eight, with six busy-loop processes competing for the CPU, reproduced the failure in 6 of the 96 runs: two runs failed with "socket hang up" and four timed out at 5000 ms. After this change the same 96-run loop under the same load fails 0 times.

The file also had a coverage problem that the audit had already named. The shipped limiters are configured with `skip: () => isTest`, so most of the old tests only proved that the limiter is skipped under test, and the two tests that did see a 429 built their own `rateLimit(...)` straight from the library. Those two tests proved that express-rate-limit works, not that this module's limiter is configured correctly. The new tests exercise the module's own configuration and still prove the skip.

## What changed

- `apps/server/src/middleware/rateLimiterMiddleware.ts` now exports a `createRateLimiter({ max, prefix, shouldSkip })` factory. The shipped `rateLimiter` and `authRateLimiter` are both built from it, so they share one definition of the error envelope, the header policy, the 15-minute window, and the Redis store. `shouldSkip` defaults to skipping under `NODE_ENV=test`, which keeps route tests unthrottled exactly as before. The module also exports `GLOBAL_RATE_LIMIT_MAX` (100) and `AUTH_RATE_LIMIT_MAX` (10), which the shipped limiters are built with and which the tests read.
- `apps/server/src/__tests__/middleware/rateLimiterMiddleware.test.ts` is rewritten. Every test starts one HTTP server listening on `127.0.0.1:0`, sends its requests to that server one after another with `request(server)`, and closes the server in `afterEach`. No test fires a concurrent burst. The seven tests prove the following: a factory limiter with `max: 2` answers 200, 200, then 429; the 429 carries the shipped `{ code: 'RATE_LIMIT_EXCEEDED', error }` body; `RateLimit-Limit` and `RateLimit-Remaining` count down while `X-RateLimit-*` never appears; two factory calls keep separate counters; the shipped global and auth limiters let `max + 1` requests through under test; and a factory limiter skips under test when no `shouldSkip` is passed.
- A second round of tests (B-2, added after review) proves the shipped limiters' own wiring. The file mocks the Redis client to `null`, so no test ever reaches a real Redis even when `REDIS_URL` is exported in the shell. It also forces `isTest` to false through an `importOriginal` mock of `envConfig` and re-imports the module, so the real `rateLimiter` and `authRateLimiter` enforce. The global limiter allows 100 requests with `RateLimit-Policy: 100;w=900` and answers the 101st with the 429 envelope. The auth limiter does the same at 10, and exhausting one limiter leaves the other untouched. The legacy-header check now covers `X-RateLimit-Limit`, `-Remaining`, and `-Reset`.

Production behavior is unchanged. The shipped limiters keep the same limit, window, message, headers, store prefix (`rl:global:` and `rl:auth:`), and skip rule.

## Architectural decisions

- **Root cause of the flake.** When supertest is given a bare Express app, each `request(app)` call starts a new HTTP server on an ephemeral port and closes it after the response arrives. The old "does not throttle" test sent 110 of these at once with `Promise.all`, which meant 110 servers and 110 client sockets being opened and torn down simultaneously. Under CPU contention some of those requests did not finish inside Vitest's 5000 ms timeout, and the teardown spilled into the next test, which then saw its connection reset ("socket hang up"). The fix removes the pattern rather than the symptom: one server per test and sequential requests. A higher timeout or a retry would have hidden the same race.
- **An injectable factory rather than a test-only limiter.** The alternative was to keep building limiters in the test from `rateLimit(...)` and copy the shipped options into them, which is what the old enforcement tests did. That duplicates the configuration, so a change to the shipped message or header policy would not fail any test. With the factory, the configuration under test is the one production uses, and only `max` and the skip rule differ.
- **The skip stays the default.** Route and integration tests mount the real app and would start receiving 429s if the limiter enforced under test. Keeping `skip under test` as the factory default means no other test changes, which the audit had flagged as a question to confirm.
- **The Redis branch stays untested here.** The factory attaches the Redis store when `REDIS_URL` is set. Unit tests run without Redis, so they exercise the in-memory store only, and `rateLimiterMiddleware.ts` remains in the coverage exclusion list for that reason.

## Testing

- Codex wrote the tests from a behavior brief that contained the interface but no implementation (R-907). The session that implemented the factory did not edit the test file beyond running Prettier over it.
- RED: before the implementation, all seven tests failed, five with `createRateLimiter is not a function` and two with `expected undefined to be 100` and `expected undefined to be 10`.
- GREEN: `pnpm --filter ./apps/server test` passes 28 files and 197 tests after both rounds. The rate limiter file runs in well under a second.
- The B-2 tests were written by the `test-author` subagent (fallback: Codex usage limit reached, resets 2026-09-21). They pass against the existing implementation because they cover behavior the factory already had, so their value was checked by mutation instead of by a RED run: changing the global limit to 10 fails 2 tests, a 1-second window fails 2 tests, and dropping the `message` option fails 3 tests. Production code was restored from git after each mutation.
- Load reproduction: the same script (12 rounds of 8 parallel runs of the file, with 6 busy-loop processes) failed 6 of 96 runs before the change, and 0 of 96 after B-1 and again after B-2.
- Harness gap: `~/.claude/enforce/tdd.sh` runs Vitest from the git root without a config, so it cannot load a test from `apps/server` in this pnpm workspace (`Cannot find package 'app/...'`). With the owner's approval, the slice lock was closed and the RED, GREEN, and commit steps were run by hand with `apps/server`'s own Vitest. The harness fix is tracked as a separate task.

## Codex review

Codex could not run the review because the ChatGPT plan's usage limit was reached (it resets on 2026-09-21), so a separate Claude reviewer on the same model reviewed the diff against the acceptance criteria instead, as R-517 allows.

The reviewer found no blockers and no production behavior change, and confirmed by editing the module that a factory ignoring `max`, `message`, or the skip, or sharing one store between calls, fails the B-1 tests. Its findings and their dispositions:

1. Should-fix: the shipped wiring was not proven. Pointing the global limiter at the auth limit, the auth prefix, or a 1-second window still passed all seven tests. Fixed in B-2 for the limit and the window (see Testing). The prefix remains unproven: with Redis mocked out, the prefix only affects `RedisStore` keys, and each in-memory limiter already has its own store. Proving it would take a fake Redis that records commands, which is more machinery than one string warrants; it is noted here as residual risk.
2. Should-fix: with `REDIS_URL` exported in the shell, factory limiters shared the `rl:test:` Redis keys for 15 minutes, so the independent-counters test and reruns would fail. Fixed in B-2 by mocking the Redis client to `null`; the file passes with `REDIS_URL` pointed at an unused port.
3. Nit: the legacy-header check covered only `X-RateLimit-Limit`. Fixed in B-2.

## Reflection

What I understand now is that the flake and the audit finding had the same origin: the test file was written against the library's behaviour rather than the module's, and the one test that tried to exercise the module's own limiter could only do it by overwhelming it with requests, because the module gave the test no way to lower the limit. Making the limit injectable is what made a small, sequential test possible, and the determinism followed from that.

What I got wrong first was the reproduction. The first attempt ran inside the command sandbox, where binding any port is denied, so every run failed with `listen EPERM` and the results said nothing about the flake; the second attempt waited on its own CPU-load processes and never finished. Only the third attempt, outside the sandbox with explicit process IDs, produced a usable 6-of-96 baseline.

The first round of tests also under-proved the change in the way the reviewer found: a test that the shipped limiters skip under test says nothing about what they would do when they do not skip, and that was exactly the production behavior the audit asked about.

Time from the first implementation commit (11:35 UTC) to this document: about 7 minutes.
