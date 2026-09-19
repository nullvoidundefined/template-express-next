# Billing: return Stripe customers to the dashboard, take the price from the server, and add billing actions

Branch: `fix/billing-redirects`
Ticket: IAN-131 (audit finding 3, P1, in `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`)
Timing: the spec was committed at 19:10 local time, the implementation at 19:19, and the last change at 19:44; this document was written a few minutes after the last commit, per `git log` and `date`.

## Summary

Stripe Checkout and the billing portal sent every returning customer to `/settings`, a page that does not exist, and the web client had no way to start a checkout or open the portal at all. Checkout also took the Stripe price from the request body, so any signed-in user could subscribe to any price in the account, including a test or discounted one.

Stripe now returns customers to the dashboard (`?checkout=success`, `?checkout=canceled`, or `?portal=returned`), checkout sells only the server's `STRIPE_PRICE_ID`, and the dashboard has Upgrade and Manage billing buttons with pending, error, and return-banner states.

## What changed

- Server: `billingHandler.ts` reads the price from `env.STRIPE_PRICE_ID` (validated as `price_...` at startup), answers 503 `BILLING_NOT_CONFIGURED` without one, and uses the dashboard return URLs; `portalHandler.ts` returns to `/dashboard?portal=returned`; `createCheckoutSchema` is a strict empty object, so any body field answers 400.
- Web: `useBilling` (TanStack mutations returning the Stripe URL), `BillingActions` (the two buttons, a synchronous in-flight guard, a hold through the redirect, and a focused error alert), `BillingStatusBanner` (the checkout-outcome message), and the dashboard page reading `searchParams.checkout`; the dead `/settings` rule is gone from the Next.js middleware.
- Design token: `--error` is now `#b91c1c`. The previous `#ef4444` measured 3.76:1 on white, below WCAG AA for text; the change also fixes the auth pages' error text, which failed the same check on its `#fef2f2` box.
- Product docs (R-607): a Billing section and an updated dashboard and idempotency row in `docs/feature-list/features.md`, `docs/user-stories/billing.md` (US-BILLING-001 to 003), `e2e/billing.spec.ts`, and the OpenAPI checkout operation (empty body, 503, `BILLING_NOT_CONFIGURED`).

## Acceptance criteria

The spec (`docs/superpowers/specs/2026-09-19-billing-redirects.md`, deleted in this PR because the code is the spec once it ships, readable at `17348f2`) has server criteria B-1 to B-5 and web criteria C-1 to C-9. C-8 (the second-request guard must not depend on a re-render, and the buttons stay disabled through the redirect) and C-9 (focus moves to the error alert) were added after the first review round.

## Architectural decisions

- **The server chooses the price.** The alternatives were a client env var (no API change, but any user can post another price) and a plan-key allowlist (more code than one price needs). The owner chose the server env var; the checkout body is now validated as empty so a stale client cannot smuggle a price back in.
- **Return to the dashboard, not a new settings page.** The dashboard already exists behind the auth gate, and a query flag carries the outcome; a settings page would add a route with nothing else on it yet.
- **A ref for the in-flight guard.** TanStack reports a mutation as pending through a `setTimeout(0)`, so a guard read from render state lets a second click through in that window and creates two Checkout sessions. A ref set synchronously on activation closes it; a `redirectingTo` state keeps the buttons disabled while the browser navigates away.

## Testing

- Tests were written first by the `test-author` agent, the R-907 fallback because Codex is out of quota until 2026-09-21; each round was confirmed failing before implementation.
- Server unit 241 of 241; web unit 64 of 64 (twice); `tsc`, ESLint, Prettier, and every lefthook gate pass. The e2e spec compiles (`playwright test --list`) and runs in CI against the full stack, with the API and Stripe URLs intercepted.
- Not done here: `apps/server/.env.example` should list `STRIPE_PRICE_ID` (and the other two Stripe variables, which it has never listed), but the harness blocks edits to `.env*` files, so the owner applies it.

## Reflection

The first implementation passed every criterion and still let a fast double click create two Checkout sessions, because the guard trusted render state that TanStack updates a macrotask later, and the test's stand-in hook updated synchronously, so it could not see the gap. The reviewer found it by reading the library's scheduler, not the component. I also claimed in a commit message that the first token change fixed the auth pages' contrast without measuring it against their tinted background; it did not, and the second change is measured on every background the token is used on.
