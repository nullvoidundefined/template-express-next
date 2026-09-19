# Billing redirects and dashboard billing actions

**Ticket:** IAN-131
**Source:** audit finding 3 (P1) in `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`
**Tier:** standard

## Problem

Stripe Checkout's `success_url` and `cancel_url`, and the billing portal's `return_url`, all point at `${CLIENT_URL}/settings`, a page that does not exist, so every customer returning from Stripe lands on a 404. The web client also has no way to start a checkout or open the portal: the dashboard is an empty heading. Checkout takes the Stripe price ID from the request body, so any signed-in user can post any `price_` ID from the account (a cheaper or test price) and subscribe to it.

## Domain vocabulary

- **Checkout**: a Stripe Checkout session that starts a subscription; the server creates it and answers its URL.
- **Portal**: a Stripe billing portal session where a customer manages an existing subscription.
- **Price**: the one Stripe price the template sells, configured on the server as `STRIPE_PRICE_ID`, never chosen by the client.
- **Checkout status**: the outcome Stripe reports by redirecting back, carried in the dashboard URL as `?checkout=success` or `?checkout=canceled`.

## Acceptance criteria

Server:

- **B-1**: `POST /v1/billing/checkout` creates the Checkout session with `success_url` `${CLIENT_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}` and `cancel_url` `${CLIENT_URL}/dashboard?checkout=canceled`.
- **B-2**: `POST /v1/billing/portal` creates the portal session with `return_url` `${CLIENT_URL}/dashboard?portal=returned`.
- **B-3**: Checkout uses the price from the server's `STRIPE_PRICE_ID`; the request body must be an empty JSON object, and a body carrying any field (including `priceId`) answers 400 `INPUT_VALIDATION_ERROR` without calling Stripe.
- **B-4**: When `STRIPE_PRICE_ID` is unset, checkout answers 503 `BILLING_NOT_CONFIGURED` without calling Stripe.
- **B-5**: `STRIPE_PRICE_ID`, when set, must match `^price_[A-Za-z0-9]+$`; the server refuses to start with any other value.

Web client:

- **C-1**: The dashboard shows an "Upgrade" button. Activating it posts `{}` to `/billing/checkout` and sends the browser to the returned URL.
- **C-2**: The dashboard shows a "Manage billing" button. Activating it posts to `/billing/portal` and sends the browser to the returned URL.
- **C-3**: While either request is pending, both buttons are disabled and the activated one reads "Redirecting"; a second activation sends no second request.
- **C-4**: When the portal answers 400 `BILLING_NO_ACCOUNT`, the dashboard shows "You don't have a billing account yet. Upgrade to create one." in an element with `role="alert"`, and the buttons are enabled again. Any other failure of either request shows "Something went wrong. Please try again." in the same way.
- **C-5**: `/dashboard?checkout=success` shows "Thanks, your checkout is complete." and `/dashboard?checkout=canceled` shows "Checkout canceled. You have not been charged." in an element with `role="status"`; any other value, or none, shows no banner. `?portal=returned` shows no banner.
- **C-6**: The Next.js middleware no longer lists the nonexistent `/settings` route.
- **C-8** (added after review): The guard against a second request does not depend on React having re-rendered: two activations dispatched before any re-render (the real TanStack hook reports pending only on a later macrotask) still send exactly one request. Once the browser is being sent to Stripe, both buttons stay disabled and the activated one keeps reading "Redirecting" until the page unloads, so no click during the navigation starts a second session.
- **C-9** (added after review): When a request fails, keyboard focus moves to the error alert (which is focusable with `tabIndex={-1}`), so a keyboard user whose focused button was disabled is not left on the page body.
- **C-7**: Both buttons are keyboard operable, have accessible names, and the banner and error messages are announced (the roles above); the dashboard keeps exactly one `<h1>`.

## Interface

These names are fixed so tests can be written before the implementation.

Server:

- `env.STRIPE_PRICE_ID?: string` in `app/config/envConfig.js`, validated by the pattern in B-5.
- `createCheckoutSchema` in `app/schemas/billingSchema.js` becomes a strict empty object (`z.object({}).strict()`), still applied through `validate(createCheckoutSchema)`; `CreateCheckoutInput` is removed or becomes `Record<string, never>`.
- `ERROR_CODES.BILLING.NOT_CONFIGURED = 'BILLING_NOT_CONFIGURED'`; 503 is `HTTP.STATUS.SERVICE_UNAVAILABLE`.
- `createCheckoutHandler({ getStripe })` and `createPortalHandler({ billingRepo, getStripe })` keep their signatures and read `env.STRIPE_PRICE_ID` and `env.CLIENT_URL` from the env module, as today.

Web client:

- `useBilling()` from `@/state/useBillingHook` returns `{ isCheckoutPending: boolean; isPortalPending: boolean; startCheckout: () => Promise<string>; openPortal: () => Promise<string> }`; each function resolves to the Stripe URL from `{ data: { url } }` and rejects with the `ApiError` from `@/services/apiService` on failure.
- `BillingActions` from `@/components/BillingActions/BillingActions` (no props) renders the two buttons and the error message, and redirects with `window.location.assign(url)`.
- `BillingStatusBanner` from `@/components/BillingStatusBanner/BillingStatusBanner` takes `{ checkoutStatus: string | undefined }` and renders the C-5 banner or nothing.
- The dashboard page reads `searchParams.checkout` and renders the `<h1>`, `BillingStatusBanner`, and `BillingActions`.

## Tests

- Server unit: `src/__tests__/handlers/billing/redirectUrls.test.ts` (B-1, B-2; its current `/settings` assertions encode the bug and change), a checkout handler test for B-3 and B-4, and `src/__tests__/services/envConfig.test.ts` for B-5.
- Web unit (Vitest and Testing Library): `src/__tests__/state/useBillingHook.test.ts` with the API service mocked (`vi.mock('@/services/apiService')`), `src/__tests__/components/BillingActions/BillingActions.test.tsx` with `useBilling` mocked and `window.location.assign` stubbed (C-1 to C-4, C-7), `src/__tests__/components/BillingStatusBanner/BillingStatusBanner.test.tsx` (C-5).
- E2E: `e2e/billing.spec.ts` (Playwright), signed in through registration, with the checkout and portal API responses and the Stripe URLs intercepted by `page.route` (no real Stripe in CI): Upgrade leads to the returned checkout URL, the canceled banner shows on `/dashboard?checkout=canceled`, and a portal call answering 400 `BILLING_NO_ACCOUNT` shows the alert.

## Product docs (R-607)

A Billing section in `docs/feature-list/features.md`, a user story file `docs/user-stories/billing.md` with stories `US-BILLING-001` (upgrade), `US-BILLING-002` (manage billing), and `US-BILLING-003` (return from Stripe), and the e2e spec above; the OpenAPI checkout operation drops `priceId` from its request body and documents the 503.

## Out of scope

Showing the current subscription on the dashboard (no read endpoint exists yet), reusing a Stripe customer across checkouts, several prices or plans, and the same-origin API path (IAN-132).
