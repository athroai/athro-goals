# Deploy Athro Goals to Netlify

## Prerequisites

- Supabase project (auth + database)
- Netlify account
- Git repo with Athro Goals code

---

## 1. Netlify site

1. Go to [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect your Git provider and select the Athro Goals repo
3. Build settings (from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node version:** 20 (set via `NODE_VERSION` in netlify.toml)
4. Deploy. The first build may fail without env vars — that’s expected.
5. Note your site URL (e.g. `https://athro-goals.netlify.app`)

---

## 2. Environment variables

In Netlify: **Site configuration** → **Environment variables** → **Add a variable** (or **Add from .env**).

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for AI |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `DATABASE_URL` | Yes | Postgres connection string (Supabase) |
| `DIRECT_URL` | Yes | Direct Postgres URL (Supabase) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your Netlify site URL, e.g. `https://athro-goals.netlify.app` |
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For payments | Stripe webhook signing secret |
| `STRIPE_EXPLORER_PRICE_ID` | For payments | Stripe price ID for Explorer tier |
| `STRIPE_PRO_PRICE_ID` | For payments | Stripe price ID for Pro tier |
| `STRIPE_ADVISER_PRICE_ID` | For payments | Stripe price ID for Adviser tier |

---

## 3. Supabase Auth redirect URLs

In Supabase: **Authentication** → **URL configuration**

- **Site URL:** your Netlify URL (e.g. `https://athro-goals.netlify.app`)
- **Redirect URLs:** add:
  - `https://athro-goals.netlify.app/**`
  - `https://athro-goals.netlify.app/api/auth/callback`

---

## 4. Database

Tables are managed by Prisma. Run migrations locally against your Supabase DB:

```bash
npx dotenv-cli -e .env.local -- npx prisma migrate deploy
```

Or if using `db push` for dev:

```bash
npx dotenv-cli -e .env.local -- npx prisma db push
```

---

## 5. Stripe webhook (when using payments)

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint: `https://athro-goals.netlify.app/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET` in Netlify

---

## Checklist

- [ ] Netlify site connected to repo
- [ ] Env vars set in Netlify (Supabase, Anthropic, DB, `NEXT_PUBLIC_APP_URL`)
- [ ] Supabase Auth redirect URLs include Netlify URL
- [ ] Database migrated (`prisma migrate deploy` or `db push`)
- [ ] New deploy triggered after adding env vars
- [ ] (Optional) Stripe webhook configured
