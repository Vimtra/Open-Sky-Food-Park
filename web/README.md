# Open Sky Food Park · web

Next.js app with three surfaces:

| Path | Who it is for |
|---|---|
| `/` , `/stall/…`, `/search`, `/cart`, `/orders`, `/account` | Customers ordering at the park |
| `/partner` | Stall staff: incoming orders, status, sold-out switches |
| `/admin` | Park management: orders, menus and prices, stalls, promos, settings |
| `/api/payments/*` | Stripe endpoints, also called by the Flutter app |

Read `../COLLAB.md` first: two Claude Code accounts work in this repository and it says who owns what.

## Run it

```bash
npm install
```

```bash
npm run dev -- --port 3001
```

`dev` and `build` first copy `../shared/seed/catalog.json` and `../shared/img/` into this app (`scripts/sync-shared.mjs`). Edit those in `shared/`, never the copies here.

Checks:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

## Demo mode (default)

With no Supabase keys in `.env.local` the app runs entirely in the browser:

- Menus come from the seed catalog.
- Orders, sign-ins and admin edits are kept in `localStorage` and shared between tabs, so you can order in one tab and accept the order at `/partner` in another.
- Sign-in accepts any 10-digit number and any 6-digit code. `/partner` and `/admin` open with one tap.
- "Pay now" shows a simulated payment. No card is charged.
- Admin → Settings → Demo data wipes it back to the seed.

## Connect the real backend

1. Create a Supabase project. In its SQL editor run `../supabase/migrations/0001_init.sql`, then `../supabase/seed.sql`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and service-role key.
3. Supabase → Authentication → Providers: turn on **Phone** (needs an SMS provider such as Twilio) for customers, and **Email** for staff.
4. Create staff accounts in Supabase → Authentication → Users (email + password), then in the SQL editor:

   ```sql
   -- make someone the park admin
   update public.profiles set role = 'admin' where id = '<user id>';

   -- make someone staff of a stall
   update public.profiles set role = 'stall_staff' where id = '<user id>';
   insert into public.stall_staff (stall_id, user_id) values ('pandemkodi-dhaba', '<user id>');
   ```

5. Stripe: add the publishable key, secret key and webhook secret to `.env.local`. Point a Stripe webhook at `<site>/api/payments/webhook` for the event `payment_intent.succeeded`.

The database rules are covered by `npm run db:test` in the repository root (runs the migration on an in-memory Postgres). They have not yet been run against a hosted Supabase project, and the Stripe routes have not been exercised with real keys.

## Layout

```
src/app/(customer)/     customer pages (thin; each renders a screen component)
src/app/partner, admin  staff pages
src/app/api/payments/   Stripe intent + webhook
src/components/         screens and UI parts
src/lib/types.ts        row types, mirroring the database contract
src/lib/backend/        one interface, two implementations: demo.ts and supabase.ts
src/lib/cart.ts         cart store (persisted) and cart view joined with the catalog
src/lib/hooks.ts        data hooks with live refresh
src/lib/format.ts       money, bill preview, status wording, error messages
```

All data access goes through `backend()` in `src/lib/backend`. Screens never talk to Supabase directly, which is what lets demo mode and the real database share every screen.

## Things to know

- This Next.js version has Cache Components on. Anything that reads the URL (`params`, `useSearchParams`, `usePathname` on dynamic routes) must sit under `<Suspense>`, or the build fails. See `AGENTS.md`.
- Streamed content is revealed on an animation frame, so a page opened by direct URL in a hidden browser tab stays on its skeleton until the tab is shown. Client-side navigation is not affected.
- Money is integer cents everywhere. The bill shown in the cart is a preview; the server recomputes it in `place_order`.
