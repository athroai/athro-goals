# Discovery Flow — Testing Guide

Use this when testing locally. The agent should progress through these phases in order.

---

## Phase 1 — Goal + Target (Turns 1–2)

**What the agent does:**
- Confirms the goal clearly
- Asks for target date OR age
- Does NOT ask about income, savings, or other context yet
- Does NOT offer to build

**Example flow:**
```
User: I want to get a mortgage
Agent: So your goal is to get a mortgage. By when do you want to achieve this? 
       A specific date (e.g. December 2028) or an age (e.g. by the time I'm 30)?
User: By the time I'm 30
Agent: By the time you're 30 — that gives us a clear timeline. [moves to Phase 2]
```

---

## Phase 2 — Context (Turns 3–4)

**What the agent does:**
- Asks ONE focused question per turn
- Finance: income, savings, deposit, debt, first-time buyer
- Reasoning (e.g. sport): current level, experience, constraints
- Lifestyle: budget, savings
- Tools available from Turn 3 (finance only)
- May include [OFFER_BUILD] if it has enough context

**Example flow (finance):**
```
User: I earn £45k, have £15k saved, first-time buyer
Agent: [Uses tools if needed] Based on that... One more thing — any existing debt?
User: No
Agent: [Summarises] Ready to build your pathway? [OFFER_BUILD]
```

---

## Phase 3 — Offer Build (Turn 5+)

**What the agent does:**
- Stops asking new questions
- Summarises: goal, target, situation
- Offers to build pathway
- Includes [OFFER_BUILD]

---

## Turn-by-turn pacing (in code)

| Turn | Phase | Agent behaviour |
|------|-------|-----------------|
| 1 | 1 | Get goal + target. No [OFFER_BUILD]. |
| 2 | 1 | Get goal + target. No [OFFER_BUILD]. |
| 3 | 2 | Tools available. One question OR [OFFER_BUILD] if ready. |
| 4 | 2 | One question OR [OFFER_BUILD] if ready. |
| 5+ | 3 | Summarise. [OFFER_BUILD]. Stop asking. |
| 10 | 3 | Final. Summarise. [OFFER_BUILD]. |

---

## Grounding types (router)

- **FACTUAL** — Mortgage, LISA, debt. Tools + RAG. Cite sources.
- **REASONING** — "Play for NY Knicks", aspirational. No tools. Honest feedback.
- **MIXED** — Marathon, MacBook. Tools for facts, reasoning for feasibility.

---

## Intake form → chat

When the user comes from the intake form, the conversation is seeded with:
- User: "My goal is X. I want to achieve it by Y. I hope to get: A, B, C."
- Assistant: "I've got your goal... To build a pathway that fits you, I need to understand where you're at and how you hope to get there. Tell me about your situation."

The agent must NOT offer build at this point. It must explore: background, means, constraints, what they've tried. Build button only appears when the agent returns offerBuild after gathering context.

---

## Automated E2E test

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/e2e-test.ts
```

Tests: router (FACTUAL/REASONING), domain agent Phase 1, Phase 2 with tools, pathway prompts.

---

## Local testing checklist

1. [ ] Phase 1: Agent asks for target before anything else (when starting from scratch)
2. [ ] Phase 2: Agent asks one question per turn (not multiple)
3. [ ] Phase 3: Agent offers build, stops asking
4. [ ] FACTUAL goal (mortgage): Tools used, sources cited
5. [ ] REASONING goal (play for NBA): No tools, honest feedback
6. [ ] Intake form → chat: Goal + target pre-filled, agent doesn't re-ask
