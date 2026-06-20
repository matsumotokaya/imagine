# Cross-subdomain SSO (Gallery <-> IMAGINE) — dev verification

## What this is

`whatif-ep.xyz` (Gallery, Next.js) and `app.whatif-ep.xyz` (IMAGINE, Vite SPA)
are different subdomains and do not share Supabase sessions by default.

A single shared cookie `wf-sso-token` (JSON `{access_token, refresh_token}`,
URI-encoded, optionally chunked as `wf-sso-token.0/.1/...`) is written under the
parent domain `.whatif-ep.xyz` so IMAGINE can adopt a session created in
Gallery without re-login.

- Gallery: writer. `src/context/AuthContext.tsx` syncs the cookie on
  `INITIAL_SESSION` / `SIGNED_IN` / `TOKEN_REFRESHED`, clears on `SIGNED_OUT`.
- IMAGINE: reader + writer. `src/contexts/AuthContext.tsx` `bootstrapAuth`
  calls `setSession()` from the cookie only when `getSession()` has no local
  session. It also keeps the cookie in sync on `SIGNED_IN` / `TOKEN_REFRESHED`
  and clears it on `SIGNED_OUT` and in `signOut()`.

Shared utilities (must stay byte-identical in logic between repos):
- IMAGINE: `src/utils/ssoCookie.ts`
- Gallery: `src/lib/ssoCookie.ts`

## Why plain localhost is not enough

`localhost:5173` and `localhost:3710` are the same host on different ports.
A cookie cannot be scoped to a parent domain across them, so the SSO sharing
cannot be reproduced. Use fake subdomains via `/etc/hosts`.

## hosts setup

Add to `/etc/hosts` (requires sudo):

```
127.0.0.1 whatif-ep.local
127.0.0.1 app.whatif-ep.local
```

## env for the dev run

Set the cookie Domain to the shared parent `.whatif-ep.local` in BOTH apps:

- Gallery (`whatif-ep-xyz/.env.local`): `NEXT_PUBLIC_SSO_COOKIE_DOMAIN=.whatif-ep.local`
- IMAGINE (`imagine/.env`): `VITE_SSO_COOKIE_DOMAIN=.whatif-ep.local`

Note: the cookie is written without `Secure` over http, so plain-http dev works.

## run

- Gallery: `npm run dev` -> open `http://whatif-ep.local:3710`
- IMAGINE: `npm run dev` -> open `http://app.whatif-ep.local:5173`

(Both dev servers already bind to all interfaces / fixed ports.)

## verify (email/password first; OAuth needs redirect URL registration)

1. Open `http://whatif-ep.local:3710`, log in with email/password.
2. In DevTools > Application > Cookies, confirm `wf-sso-token` exists with
   Domain `.whatif-ep.local`.
3. Open `http://app.whatif-ep.local:5173` in the same browser. IMAGINE should
   load already logged in (no manual login).
4. Sign out in either app -> confirm `wf-sso-token` is removed and the other
   app shows logged-out after reload.

OAuth (Google/Apple) is not part of this first verification because the
provider redirect URLs would need the `.local` origins registered in Supabase.
Validate with email/password, which fully exercises the cookie path.

## production

Set `NEXT_PUBLIC_SSO_COOKIE_DOMAIN=.whatif-ep.xyz` (Vercel, Gallery) and
`VITE_SSO_COOKIE_DOMAIN=.whatif-ep.xyz` (IMAGINE production build env). The
cookie gets `Secure` automatically over https.
