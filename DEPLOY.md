# Putting Open Sky Food Park online

The website runs on **Vercel**. The database, sign-in and live order updates run on **Supabase**. The Flutter app talks to the same Supabase project, so web and app share every order.

```
customer phone ──> Vercel (Next.js website + /api/payments) ──┐
Flutter app ───────────────────────────────────────────────────┼──> Supabase (Postgres, Auth, Realtime)
                                     Stripe webhook ──> Vercel ┘
```

Why Supabase for sign-in and not Firebase: our database rules already check the signed-in user (`auth.uid()` in every policy), Supabase Auth does Google, phone and email sign-in, and it has SDKs for both Next.js and Flutter. Firebase would add a second user system that has to be bridged to the database. Vercel does not provide sign-in itself.

Allow about an hour. You need your own accounts at supabase.com, vercel.com and console.cloud.google.com (all have free tiers). Keys you copy go only into Vercel's settings and `web/.env.local`, never into GitHub.

## 1. Supabase: database

1. Create a project at supabase.com (region: West US, close to Milpitas). Save the database password somewhere safe.
2. **SQL Editor → New query**: paste all of `supabase/setup.sql` and run it. It creates the tables, security rules and order functions, and loads both trucks' menus.
3. **Project Settings → API**: note the **Project URL**, the **anon public** key and the **service_role** key (secret).

## 2. Google sign-in (customers, staff and admin)

1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**: External, app name "Open Sky Food Park", your support email, then publish.
2. **Credentials → Create credentials → OAuth client ID** → Web application.
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact one on its Google provider page).
3. Supabase → **Authentication → Sign In / Providers → Google**: turn on, paste the Client ID and Client Secret.
4. Supabase → **Authentication → URL Configuration**:
   - Site URL: your Vercel address, e.g. `https://open-sky-food-park.vercel.app`
   - Redirect URLs: `https://open-sky-food-park.vercel.app/**` and, for local testing, `http://localhost:3001/**`

**Phone sign-in (optional):** Supabase → Providers → Phone needs an SMS provider (Twilio, MessageBird, Vonage); each text costs money. Until that is set up, keep `NEXT_PUBLIC_SIGNIN_METHODS=google` so the phone option is hidden.

## 3. Vercel: website

1. vercel.com → **Add New → Project → Import** `Vimtra/Open-Sky-Food-Park`.
2. **Root Directory: `web`**. Framework: Next.js (detected). Leave "Include files outside the root directory" on: the build copies the menu and photos from `shared/`.
3. **Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
   | `NEXT_PUBLIC_SIGNIN_METHODS` | `google` (or `google,phone` once SMS is set up) |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (when you add payments) |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | from step 5 |

4. **Deploy.** Every push to `main` on GitHub redeploys the site automatically.

Shortcut: Vercel's **Storage → Supabase** integration (Marketplace) can create the Supabase project and fill the two `NEXT_PUBLIC_SUPABASE_*` variables for you. You still run `setup.sql` and set up Google as above.

Without the Supabase variables the site runs in **demo mode** (sample data in each visitor's browser, nothing saved). The yellow "Demo data" bar disappears once they are set.

## 4. Admin and stall accounts

**Admin (you):** sign in once at `https://<your-site>/admin` with **Continue with Google**. You will see "This account is not an admin". Then make yourself admin, either way:

- From this PC: put the three Supabase values in `web/.env.local` (copy `web/.env.example`), then in `web/`:

  ```bash
  npm.cmd run staff:add -- --email you@gmail.com --role admin
  ```

- Or in Supabase → SQL Editor:

  ```sql
  update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'you@gmail.com');
  ```

Sign out and in again at `/admin`.

**Admin with email and password instead of Google:** run the same `staff:add` command with an email that has never signed in. It asks you to choose a password and creates the account.

**Stall staff:** each truck signs in at `/partner` (Google, or an email + password you create):

```bash
npm.cmd run staff:add -- --email cook@example.com --role stall_staff --stall pandemkodi-dhaba
```

Stall ids: `pandemkodi-dhaba`, `desi-desserts` (new stalls get theirs from the admin panel).

## 5. Payments (Stripe), when ready

1. stripe.com → Developers → API keys: copy the test keys into Vercel (table above).
2. Developers → Webhooks → Add endpoint `https://<your-site>/api/payments/webhook`, event `payment_intent.succeeded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Redeploy.
3. Until then, customers can choose **Pay at the stall**.

## 6. Check it works

- Home page loads with no "Demo data" bar.
- Continue with Google → you come back signed in.
- Place a pay-at-stall order → it appears at `/partner` for that truck → Accept → the customer's order page updates by itself.
- `/admin` → Settings: fill in the park email, phone and opening hours.

## Before a real launch

- Replace the placeholder prices (Admin → Menus shows "Price not confirmed").
- Review the draft dish descriptions and "Serves" counts.
- Approve the AI-generated dish photos.
- Set the sales tax rate in Admin → Settings.
- The GitHub repository is **public**: anyone can read the code, menus and photos. Keys are never in it.
