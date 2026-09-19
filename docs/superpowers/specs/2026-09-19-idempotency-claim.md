# Idempotency claim: in-flight claim, release on failure, bind a key to one request

**Ticket:** IAN-130
**Source:** audit finding 2 (P0) in `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`; target behaviour from `template-fastapi-nuxt` criteria B-17, B-18, and B-40.
**Tier:** standard

## Problem

`apps/server/src/middleware/idempotencyMiddleware.ts` makes a retried `POST` or `PUT` carrying an `Idempotency-Key` header safe to repeat, but it has four defects. It stores every `res.json` body, including 500 responses, so a retry after a transient failure replays the error for 24 hours. It has no in-flight claim, so two concurrent requests with the same key both run the handler. It binds a key only to `(key, user_id)`, so a key reused on another route or with another body replays the first response. And a key older than 24 hours can never be stored again, because the insert conflicts with the expired row on the primary key.

## Domain vocabulary

- **Idempotency key**: the client-supplied `Idempotency-Key` header value that makes one `POST` or `PUT` safe to retry, stored in `idempotency_keys` and scoped to one user.
- **Claim**: the row a request inserts before its handler runs, in status `in_progress`; holding the claim is what lets that request run the handler.
- **Request fingerprint**: the request method, the request path (`req.originalUrl`), and the SHA-256 hex of `JSON.stringify(req.body ?? {})` (computed with `hashToken` from `app/services/hashService.js`), stored with the claim.
- **Replay**: answering a retried request from the stored status and body without running the handler.
- **Release**: deleting a claim whose request failed, so the next retry runs the handler again.

## Behaviour

The middleware applies only to `POST` and `PUT` requests carrying an `Idempotency-Key` header from an authenticated user (`req.user` set). Any other request passes through untouched, as today.

For a request it applies to:

1. It tries to claim the key with the request fingerprint. The claim succeeds when no row exists for `(key, user_id)`, or when the existing row is older than 24 hours (the expired row is reset to the new claim). On success the handler runs.
2. When the claim does not succeed, it reads the existing row:
   - A fingerprint that differs in method, path, or body hash answers **422** with `IDEMPOTENCY_KEY_REUSED`; the handler does not run.
   - A matching fingerprint whose row is still `in_progress` answers **409** with `IDEMPOTENCY_REQUEST_IN_PROGRESS`; the handler does not run.
   - A matching fingerprint whose row is `completed` is replayed: the stored status code with the stored JSON body, or with an empty body when none was stored (for example a 204); the handler does not run.
3. When the handler's response finishes:
   - A status below 500 completes the claim: the status code and the JSON body sent (or null when the response had no JSON body) are stored, and the row becomes `completed`.
   - A status of 500 or above, or a connection that closes before the response finishes, releases the claim, so the client's retry runs the handler again.

Error bodies use the existing `{ code, error }` envelope built with `createErrorResponse`.

## Acceptance criteria

- **I-1**: A repeated `POST` with the same key, method, path, and body within 24 hours replays the stored status and body, and the handler runs once in total.
- **I-2**: A request whose handler answers 5xx (or throws into the error handler) releases its claim: a retry with the same key runs the handler again and can succeed.
- **I-3**: While a first request with a key is still running, a second request with the same key and fingerprint answers 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS`, and the handler has run only for the first.
- **I-4**: Reusing a key with a different path, a different method, or a different body answers 422 `IDEMPOTENCY_KEY_REUSED`, and the handler does not run.
- **I-5**: A key whose row is older than 24 hours is treated as new: the handler runs, and the new response is what later retries replay.
- **I-6**: Two requests with the same new key arriving at the same moment result in exactly one handler run; the other answers 409 or a replay, never a second run.
- **I-7**: A 4xx response (for example a validation error) completes the claim and is replayed, since retrying the same invalid request gives the same answer.
- **I-8**: A completed 204 response is replayed as 204 with an empty body.
- **I-9**: Requests without the header, without a user, or with another method are untouched, as today.

Added after the pre-merge review (numbers stay stable):

- **I-10**: A request ended by the 30-second request timeout (408 `SERVER_REQUEST_TIMEOUT` from the timeout middleware in `app.ts`, which then destroys the request) releases its claim like a 5xx, so the client's retry runs the handler again instead of replaying the 408.
- **I-11**: A client that disconnects while the claim is still being written still has the claim released once the claim resolves, so the key does not stay `in_progress`.
- **I-12**: When storing the completed response fails, the middleware releases the claim instead, and every settle failure is logged with the key, the user ID, and the request ID (`req.id`), never the email.
- **I-13**: A 2xx response whose JSON body is `null` is replayed as JSON `null`, not as an empty body; the middleware tracks whether a JSON body was sent separately from its value.
- **I-14**: A retry sent immediately after the first response arrives, with no wait, is replayed (the claim is completed before the response is flushed), never answered 409.
- **I-15**: When the row holding the key disappears between a failed claim and the read (a failing request released it), the middleware claims the key again once instead of answering 409.
- **I-16**: An `Idempotency-Key` longer than 255 characters answers 400 `INPUT_VALIDATION_ERROR` before any claim.
- **I-17**: The down migration succeeds on a table holding completed 204 rows (null `response_body`): rows that cannot satisfy the restored `NOT NULL` constraints are deleted first.

Accepted without change: a row stored before this migration has no fingerprint (null method, path, and hash) and matches any request for the rest of its 24-hour life. The template has no deployment carrying such rows.

## Interface

These names are fixed so tests can be written before the implementation.

- `ERROR_CODES.IDEMPOTENCY.KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED'` and `ERROR_CODES.IDEMPOTENCY.REQUEST_IN_PROGRESS = 'IDEMPOTENCY_REQUEST_IN_PROGRESS'` in `app/constants/errorCodesConstants.js`.
- `HTTP.STATUS.UNPROCESSABLE_ENTITY = 422` in `app/constants/httpConstants.js` (409 is `HTTP.STATUS.CONFLICT`).
- A new migration adds `request_method text`, `request_path text`, `request_body_hash text`, and `status text NOT NULL DEFAULT 'completed'` with `CHECK (status IN ('in_progress', 'completed'))` to `idempotency_keys`, and makes `status_code` and `response_body` nullable. The table keeps its name and its `(key, user_id)` primary key.
- `createIdempotencyRepo({ query, withTransaction })` from `app/repositories/idempotencyRepository.js` returns:
  - `claimKey(input: { key: string; requestBodyHash: string; requestMethod: string; requestPath: string; userId: string }): Promise<boolean>`: true when the request now holds the claim (a new row, or an expired row reset to this request).
  - `findKey(key: string, userId: string): Promise<StoredIdempotencyKey | null>`, where `StoredIdempotencyKey` is `{ requestBodyHash: string | null; requestMethod: string | null; requestPath: string | null; responseBody: unknown; status: 'completed' | 'in_progress'; statusCode: number | null }`.
  - `completeKey(key: string, userId: string, statusCode: number, responseBody: unknown): Promise<void>`.
  - `releaseKey(key: string, userId: string): Promise<void>`: deletes the row only while it is `in_progress`.
- `createIdempotencyMiddleware(idempotencyRepo)` from `app/middleware/idempotencyMiddleware.js` keeps its signature.
- `IDEMPOTENCY_KEY_MAX_LENGTH = 255` is exported from `app/constants/idempotencyConstants.js`.

## Tests

- `src/__tests__/middleware/idempotencyMiddleware.test.ts`: unit tests with a fake repository object implementing the interface above (no module mocking), mounting the middleware on a minimal Express app that injects `req.user`, covering the decision logic of I-1 to I-4 and I-7 to I-9.
- `src/__tests__/repositories/idempotencyRepository.test.ts`: unit tests with a fake `query`, only where they assert behaviour (row mapping, null handling), not SQL text.
- `src/__tests__/integration/idempotency-flow.test.ts`: against the real database through `createIdempotencyRepo({ query, withTransaction })` from `app/database/databasePool.js` and a minimal Express app with test routes whose handlers the test controls (one that fails on its first call, one that waits on a promise the test resolves), covering I-1 to I-6 and I-8 end to end; setup, migrations, and truncation come from `src/__tests__/integration/setup.ts`. The existing case asserting that a different payload replays the first response encodes the old behaviour and changes to expect 422.

## Out of scope

Renaming the table (R-334, P3 in `docs/todos`), request-body canonicalization beyond `JSON.stringify`, and idempotency for methods other than `POST` and `PUT`.
