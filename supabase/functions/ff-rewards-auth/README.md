# ff-rewards-auth

Passwordless email-code login + account creation for Fyxx Rewards on the Friday
site. Ported from Fyxx Cup 2026. Deployed to the **Project Pulse** Supabase
project (the same project the Friday site uses). The web app talks to it through
`src/lib/rewards-auth.ts`.

## Actions (POST JSON `{ action, ... }`)

- `lookup` `{ email }` -> `{ exists, firstName, lastName }` (Shopify customer check)
- `send` `{ email }` -> `{ ok }` (emails a 6-digit code via Resend)
- `verify` `{ email, code, firstName?, lastName?, acceptsMarketing? }` ->
  `{ ok, token_hash, type, isNew, shopify }`. The web app then calls
  `supabase.auth.verifyOtp({ token_hash, type })` to set the session.
- `_scopes` -> debug: which Shopify Admin scopes the token carries.

## Storage

`public.email_otps` (Project Pulse): stores only an HMAC hash of each code plus
an expiry. RLS denies all client access; only the service role (this function)
reads/writes it. 10-minute expiry, max 5 attempts per code, max 3 sends per
15 minutes per email.

## Secrets it reads (already set in Project Pulse)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (DB + auth admin; also the HMAC key)
- `SHOPIFY_STORE`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` (Admin API via
  client-credentials, same as the other Pulse Shopify functions)
- `RESEND_API_KEY` (code email; sender is `Fyxx <info@myfyxx.com>`)

## Shopify scope note

Customer **lookup** needs `read_customers` (present). Creating a brand-new
customer needs **`write_customers`**, which must be added to the Shopify app's
Admin API scopes. Until then, existing-member sign-in works; a brand-new person
still gets a Friday account and is enrolled in Fyxx Rewards when they check out
with the same email.
