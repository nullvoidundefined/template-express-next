# User Stories: Billing

Billing sells one subscription price through Stripe. The server chooses the price (`STRIPE_PRICE_ID`); the web client only asks to start a checkout or to open the billing portal, and Stripe sends the customer back to the dashboard.

## US-BILLING-001: Upgrade

**As** a signed-in user, **I want to** upgrade from the dashboard, **so that** I can subscribe without leaving the app's flow.

- [ ] The dashboard shows an "Upgrade" button that is keyboard operable and has an accessible name.
- [ ] Activating it sends the browser to a Stripe Checkout page for the server's configured price; the client never sends a price.
- [ ] While the request is pending, both billing buttons are disabled and the activated one reads "Redirecting", and a second activation sends no second request.
- [ ] If the request fails, "Something went wrong. Please try again." is announced in an alert and the buttons are enabled again.
- [ ] With no price configured on the server, checkout answers 503 `BILLING_NOT_CONFIGURED`.

## US-BILLING-002: Manage billing

**As** a subscribed user, **I want to** open the billing portal from the dashboard, **so that** I can update my payment method or cancel.

- [ ] The dashboard shows a "Manage billing" button that is keyboard operable and has an accessible name.
- [ ] Activating it sends the browser to the Stripe billing portal.
- [ ] A user with no Stripe customer sees "You don't have a billing account yet. Upgrade to create one." in an alert.

## US-BILLING-003: Return from Stripe

**As** a user returning from Stripe, **I want to** land on a real page that tells me what happened, **so that** I know whether I was charged.

- [ ] Checkout returns to `/dashboard?checkout=success` and shows "Thanks, your checkout is complete." in a status message.
- [ ] A canceled checkout returns to `/dashboard?checkout=canceled` and shows "Checkout canceled. You have not been charged."
- [ ] The portal returns to `/dashboard?portal=returned`, with no banner.

## Coverage

- Server unit: `apps/server/src/__tests__/handlers/billing/billingHandler.test.ts`, `redirectUrls.test.ts`, `services/envConfig.test.ts`.
- Web unit: `apps/client/web/src/__tests__/state/useBillingHook.test.ts`, `components/BillingActions/BillingActions.test.tsx`, `components/BillingStatusBanner/BillingStatusBanner.test.tsx`.
- E2E: `e2e/billing.spec.ts`.
