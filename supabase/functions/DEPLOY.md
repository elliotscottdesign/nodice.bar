# Deploying the Stripe Edge Functions (paste-and-deploy)

You don't have Node/npm/Terminal set up locally, so we deploy via the
Supabase Dashboard's built-in editor. Same flow as your Apps Script
files — select all, paste, save, deploy.

There are **four** Edge Functions to deploy:

| # | Function name (exact)        | Source file                                                |
|---|------------------------------|------------------------------------------------------------|
| 1 | `create-payment-intent`      | `supabase/functions/create-payment-intent/index.ts`        |
| 2 | `stripe-webhook`             | `supabase/functions/stripe-webhook/index.ts`               |
| 3 | `get-booking`                | `supabase/functions/get-booking/index.ts`                  |
| 4 | `send-booking-confirmation`  | `supabase/functions/send-booking-confirmation/index.ts`    |

The function names must match exactly — the website (and the
`stripe-webhook` function itself) calls them by name.

---

## One-time pre-flight

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**,
confirm these are set:

| Secret name              | Value                                                |
|--------------------------|------------------------------------------------------|
| `STRIPE_SECRET_KEY`      | `sk_test_…` from Stripe (test mode for now)          |
| `STRIPE_WEBHOOK_SECRET`  | We'll add this **after** step 2 below                |
| `SMTP_USERNAME`          | `bookings@plonkgolf.co.uk`                           |
| `SMTP_PASSWORD`          | 16-char Google App Password for that account         |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by
Supabase — you don't add them.

---

## Deploying a function (general steps — repeat for each of the three)

1. Open **Supabase Dashboard → Edge Functions** (left sidebar).
2. Click **"Deploy a new function"** (or "Create a new function" — naming
   varies by dashboard version).
3. Name it exactly as listed in the table above — lowercase, with the
   hyphens. **No typos**, or the site can't find it.
4. **IMPORTANT — for `stripe-webhook` only:** in the deploy dialog,
   **uncheck** "Verify JWT with legacy secret" (or "Enforce JWT
   verification", wording varies). Stripe calls this endpoint
   server-to-server without an anon key, so JWT verification must be off
   — otherwise Stripe's webhooks get rejected with a 401. For the other
   three functions (`create-payment-intent`, `get-booking`,
   `send-booking-confirmation`), leave JWT verification **on** — the
   browser (or `stripe-webhook`) sends a valid key in the
   `Authorization` header, which Supabase accepts as a valid JWT.
5. The dashboard opens a code editor with a "Hello world" template.
6. **Select all** in the editor (Cmd+A) → **Delete** → **Paste** the entire
   contents of the matching `index.ts` file from this repo (you can grab the
   raw file from GitHub: open the file in GitHub → click the "Raw" button →
   select-all → copy).
7. Click **Deploy** (or "Save and deploy").
8. Wait until you see "Deployment successful".

Repeat for all three.

---

## After step 2 (`stripe-webhook`) — register the webhook with Stripe

You need to tell Stripe where to send the "payment succeeded" pings,
then save the secret it gives you back into Supabase.

1. **Copy your webhook URL** from the Supabase dashboard:
   `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
   (Supabase shows the full URL on the function's detail page — copy it
   from there.)

2. In **Stripe Dashboard (Test mode)** → **Developers → Webhooks** →
   **Add endpoint**:
   - **Endpoint URL:** paste the URL above.
   - **Events to send:** click "Select events" → search for and select:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
   - Click **Add endpoint**.

3. After Stripe creates the endpoint, click into it. You'll see a
   **"Signing secret"** that starts with `whsec_…`. Click **"Reveal"** and
   copy it.

4. Back in **Supabase Dashboard → Project Settings → Edge Functions →
   Secrets**:
   - Click **"+ New secret"**.
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** the `whsec_…` you copied.
   - Save.

5. **Redeploy the `stripe-webhook` function** so it picks up the new
   secret (Dashboard → Edge Functions → `stripe-webhook` → click
   **Deploy** again with the same code).

---

## Verifying end-to-end

1. Open the live site, start a booking, fill in fake details (use email
   `test@plonkgolf.co.uk`).
2. On the payment screen use Stripe's test card:
   `4242 4242 4242 4242` with any future expiry, any CVC, any postcode.
3. Click Pay. You should bounce to `/book/success/` and see the booking
   reference + venue + slots.
4. In **Supabase Dashboard → Table editor → bookings**, find the row —
   `status` should be `confirmed` (within a couple of seconds of paying).
5. In **Stripe Dashboard → Payments**, you should see a £-amount in GBP
   with status "Succeeded" and the booking reference in the description.

If `status` is stuck on `pending` for more than 10 seconds, the webhook
isn't reaching Supabase — check Stripe Dashboard → Webhooks → your
endpoint → "Recent deliveries" for the failure reason.

6. **Confirmation email:** within a few seconds of step 4 you should
   also receive a `Booking confirmed — …` email from
   `bookings@plonkgolf.co.uk` at the email address you used in step 1.
   If you don't, the most common cause is the Gmail App Password — see
   "Verifying the email setup" below.

---

## Verifying the email setup

If the booking confirms in the DB but no email lands:

1. **Supabase Dashboard → Edge Functions → `send-booking-confirmation` → Logs.**
   Recent invocations will show one of three things:
   - `"SMTP_USERNAME / SMTP_PASSWORD not configured"` — secrets aren't
     set, or this function wasn't redeployed after you set them.
   - `"SMTP send failed: …authentication failed…"` — the App Password
     is wrong, was revoked, or 2-Step Verification got disabled. Make a
     new App Password and update `SMTP_PASSWORD`, then redeploy this
     function.
   - `"Confirmation email sent for booking PLNK-…"` — email left
     Supabase successfully; if the customer didn't receive it, check
     the recipient's spam folder.

2. **Gmail Sent folder** of `bookings@plonkgolf.co.uk` will also show a
   copy of every email this function sends — handy as a sanity check.

---

## Going live (later — not now)

When Stripe verifies the Plonk Golf Ltd business and you're ready to
take real money:

1. Switch Stripe Dashboard to **Live mode** (top-right toggle).
2. Get a **new** publishable key (`pk_live_…`) and secret key
   (`sk_live_…`).
3. Update `STRIPE_SECRET_KEY` in Supabase to the live secret.
4. Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the website's
   `lib/stripe.ts` to the live publishable key (or set it as a GitHub
   Actions repo secret + reference it in `.github/workflows/deploy.yml`
   — cleaner long-term).
5. Repeat the webhook setup in Live mode (it's a separate webhook with
   its own `whsec_…`) and update `STRIPE_WEBHOOK_SECRET` accordingly.
6. Redeploy all four Edge Functions.
