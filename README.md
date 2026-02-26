# Athro Goals

Life-goal pathway app. Users state any goal and when they want to achieve it; the AI conducts a guided conversation, then builds a personalised step-by-step pathway with real data and definite dates.

## Architecture

- **Router** — Classifies goal into domain (Finance, Health, Education, etc.). Haiku, no tools.
- **Domain agent** — Conversational agent with domain-specific tools + RAG retrieval.
- **Pathway builder** — Produces steps with definite dates, costs, and sources.

## Tech stack

- Next.js 16, React 19, Tailwind, Supabase, Anthropic, Prisma
- Direct Anthropic SDK (no LangChain for orchestration)

## Setup

1. Copy `.env.example` to `.env.local`
2. Set `ANTHROPIC_API_KEY`, Supabase vars, `DATABASE_URL`, `DIRECT_URL`
3. `npm install`
4. `npx prisma db push`
5. `npm run dev`

## Env vars

| Variable | Description |
|---------|-------------|
| `ANTHROPIC_API_KEY` | Required for router + domain agent |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `DATABASE_URL` | Postgres connection string |
| `DIRECT_URL` | Direct Postgres URL (for migrations) |
| `STRIPE_SECRET_KEY` | Stripe secret key (for subscriptions) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_EXPLORER_PRICE_ID` | Stripe price ID for Explorer tier |
| `STRIPE_PRO_PRICE_ID` | Stripe price ID for Pro tier |
| `STRIPE_ADVISER_PRICE_ID` | Stripe price ID for Adviser tier |
| `NEXT_PUBLIC_APP_URL` | App URL for redirects (default: localhost:3000) |

## MVP domains

- **Finance** — Mortgage, savings, debt (3 tools + RAG)
- Health, Education, Property, Sport, Lifestyle — coming in Phase 2

## Key files

- `src/agents/router.ts` — Goal classification
- `src/agents/domainAgent.ts` — Domain agent with tools
- `src/agents/tools/finance/` — Mortgage, ISA, debt tools
- `src/lib/rag/` — RAG retrieval (Finance chunks)
- `src/app/api/conversation/route.ts` — Conversation SSE
- `src/app/api/pathway/build/route.ts` — Pathway generation
