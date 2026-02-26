# Prompt: Parallel Pathway Generation for Athro Careers

## Context

Athro Careers (`/Users/grom/projects/careers`) currently generates career pathways in a single Anthropic API call via `/api/pathway/build/route.ts`. This call uses `claude-sonnet-4-20250514` with `max_tokens: 4096` and returns an SSE stream. On Netlify (60s function timeout), this frequently times out or produces "Error in input stream" failures, especially for complex careers with 6-8 detailed steps.

**Athro Goals has already solved this problem.** The solution: split generation into a lightweight structure call + parallel per-step enrichment calls, all orchestrated from the client. Each call is fast (~10-20s), well within the 60s limit. The total output is 2x+ richer because each step gets its own 1500-token budget instead of sharing 4096 across all steps.

**You must implement the same pattern for Athro Careers.** Study the working implementation in Athro Goals at `/Users/grom/athro-goals` (specifically the files listed below), then apply the same architecture to Careers. Do NOT modify Athro Goals — it is your reference.

---

## Reference Implementation (Athro Goals — READ ONLY)

Study these files to understand the pattern:

- **`/Users/grom/athro-goals/src/prompts/pathwayBuild.ts`** — `getStructurePrompt()` and `getStepEnrichmentPrompt()` — two separate prompts: one for skeleton, one for per-step detail
- **`/Users/grom/athro-goals/src/app/api/pathway/build/route.ts`** — Structure endpoint: returns JSON (not SSE), saves skeleton steps to DB, returns step IDs + pathwayData to client
- **`/Users/grom/athro-goals/src/app/api/pathway/build/step/route.ts`** — Step enrichment endpoint: receives one stepId + context, calls Anthropic, updates PathwayStep in DB, returns enriched JSON
- **`/Users/grom/athro-goals/src/app/api/pathway/[id]/route.ts`** — PUT endpoint: accepts `status: "COMPLETE"` and `pathwayData` to finalize after enrichment
- **`/Users/grom/athro-goals/src/components/chat/ConversationChat.tsx`** — `handleBuildPathway()`: calls structure → `Promise.all()` for parallel step enrichment → PUT to finalize → navigate. Also the progress UI with step-by-step checkmarks.

---

## What You Must Build (in Athro Careers)

### 1. Split the pathway build prompt (`src/prompts/pathwayBuild.ts`)

Create two new exported functions alongside the existing `PATHWAY_BUILD_PROMPT` (keep the original for backward compat):

**`getCareerStructurePrompt()`** — Lightweight skeleton prompt. Output schema:

```json
{
  "dreamJob": "...",
  "dreamJobNormalised": "...",
  "socCode": "...",
  "currentLevel": "...",
  "summary": "2-3 paragraph overview",
  "totalEstimatedYears": 3,
  "totalEstimatedCost": 15000,
  "steps": [
    {
      "stepOrder": 1,
      "title": "Clear step title",
      "stageLabel": "Foundation / Training / Qualification / Employment",
      "timelineMonths": 12,
      "estimatedCost": 2000,
      "qualificationName": "e.g. Level 2 Food Hygiene Certificate"
    }
  ]
}
```

Rules: 5-8 steps. No descriptions, no tips, no application details, no Wales-specific, no alternative routes. Just the skeleton. `max_tokens: 1500`.

**`getCareerStepEnrichmentPrompt()`** — Per-step enrichment prompt. Output schema:

```json
{
  "description": "2-4 paragraphs, personalised, detailed",
  "qualification": {
    "name": "...",
    "level": "RQF/CQFW level",
    "specific": "Details"
  },
  "grades": [{ "subject": "Maths", "minimumGrade": "C/4", "recommended": "B/5" }],
  "ucasPoints": null,
  "costs": {
    "total": 2000,
    "breakdown": [{ "item": "Course fee", "amount": 1500 }],
    "fundingOptions": ["Student Finance Wales"]
  },
  "application": {
    "process": "Specific steps to apply",
    "keyDeadlines": [{ "deadline": "January 2027", "description": "UCAS deadline" }],
    "whereToApply": ["UCAS", "direct to institution"]
  },
  "professionalBody": { "name": "NMC", "membershipType": "Registration", "cost": 120 },
  "workExperience": {
    "recommended": "What experience is needed",
    "howToFind": "How to get it",
    "duration": "2 weeks minimum"
  },
  "alternativeRoutes": [{ "name": "...", "description": "...", "pros": [], "cons": [] }],
  "specialRequirements": [{ "type": "DBS Check", "details": "Enhanced DBS required" }],
  "tips": ["Practical specific tip 1", "Tip 2"],
  "walesSpecific": {
    "welshMediumAvailable": false,
    "welshProviders": ["Cardiff Met"],
    "welshFunding": "Student Finance Wales details"
  }
}
```

Rules: `max_tokens: 1500`. Be specific to the user's situation. Include Wales-specific data. Cite real institutions, real costs, real deadlines.

### 2. Rewrite the build endpoint (`src/app/api/pathway/build/route.ts`)

Change from SSE stream to a **JSON response** (like Goals does). The endpoint:

1. Authenticates user, loads pathway + conversation
2. Deletes existing steps
3. Calls Anthropic with `getCareerStructurePrompt()`, `max_tokens: 1500`, 45s abort timeout
4. Parses JSON response
5. Saves skeleton steps to DB using `prisma.pathwayStep.create()` (one at a time, to get IDs back)
6. Updates pathway record (dreamJob, summary, totalSteps, etc.) — but does NOT set status to COMPLETE yet
7. Increments usage count
8. Returns JSON: `{ pathwayId, dreamJob, summary, conversationSummary, pathwayData, steps: [{ id, stepOrder, title, stageLabel, timelineMonths, estimatedCost, qualificationName }] }`

On error: sets pathway status to ERROR, returns JSON error.

**Important:** The response must include `conversationSummary` (the conversation text) so the client can pass it to each step enrichment call.

### 3. Create step enrichment endpoint (`src/app/api/pathway/build/step/route.ts`)

New file. Accepts POST with:

```typescript
{
  stepId: string;
  dreamJob: string;
  conversationSummary: string;
  stepTitle: string;
  stepStage: string;
  timelineMonths: number | null;
  estimatedCost: number | null;
  qualificationName: string | null;
}
```

The endpoint:

1. Authenticates user, verifies step belongs to user's pathway
2. Calls Anthropic with `getCareerStepEnrichmentPrompt()`, `max_tokens: 1500`, 45s abort timeout
3. Parses JSON response
4. Updates the PathwayStep record in DB with: description, qualificationRequired, specificSubjects, gradesNeeded, ucasPoints, costBreakdown, applicationProcess, applicationDeadlines, professionalBody, workExperience, alternativeRoutes, specialRequirements, tips, walesSpecific
5. Returns the enriched JSON to the client (all fields from the Anthropic response)

Map the enriched JSON fields to the PathwayStep DB columns using the same logic as the existing `generatePathway` function (e.g., `strFromNested`, `numFromNested`, `objFromNested` helpers — or inline equivalents).

### 4. Update the PUT endpoint (`src/app/api/pathway/[id]/route.ts`)

Currently `allowedStatuses` only includes `["ARCHIVED", "GENERATING"]`. Add `"COMPLETE"` to the allowed list. Also accept an optional `pathwayData` field in the request body and update it on the pathway record if provided. This lets the client finalize the pathway after parallel enrichment by sending `{ status: "COMPLETE", pathwayData: mergedData }`.

### 5. Rewrite `handleBuildPathway` in `ConversationChat.tsx`

Replace the current flow (PUT → call background function → poll) with client-side parallel orchestration:

```
1. PUT /api/pathway/${pathwayId} { status: "GENERATING" }  (existing — limit check)
2. POST /api/pathway/build → get skeleton JSON back (NOT SSE anymore)
3. Show progress UI: "Planning your pathway structure..."
4. Promise.all() — one POST /api/pathway/build/step per step
5. Update progress as each step completes: "Enriching step 2 of 7..."
6. Merge enrichment results into pathwayData.steps[]
7. PUT /api/pathway/${pathwayId} { status: "COMPLETE", pathwayData: merged }
8. router.push(`/pathway/${pathwayId}`)
```

Add state for build progress:

```typescript
const [buildProgress, setBuildProgress] = useState<{
  phase: "structure" | "enriching" | "finalizing";
  totalSteps: number;
  completedSteps: number;
  stepTitles: string[];
} | null>(null);
```

Update the `generating` screen to show:
- A progress bar (0-100%)
- Current phase label ("Planning structure..." → "Enriching step 3 of 7" → "Saving...")
- Step titles with checkmarks as each completes and a pulsing dot for the active one

Remove the polling `useEffect` for background function — it's no longer needed since the client orchestrates everything directly.

Remove the call to `/.netlify/functions/build-pathway-background` — it's replaced by the direct `/api/pathway/build` JSON call.

### 6. Clean up

- The background function at `/.netlify/functions/build-pathway-background` can be removed (or left dormant). The parallel approach replaces it entirely.
- Keep `PATHWAY_BUILD_PROMPT` as a legacy export in the prompts file for backward compatibility (the `/api/pathway/generate` endpoint still uses a different prompt via `PATHWAY_SYSTEM_PROMPT`).

---

## Architecture Diagram

```
Client (ConversationChat.tsx)
  │
  ├── PUT /api/pathway/:id { status: "GENERATING" }
  │
  ├── POST /api/pathway/build  ──→  JSON skeleton (~10-15s)
  │     (saves steps to DB, returns step IDs)
  │
  ├── Promise.all([
  │     POST /api/pathway/build/step { stepId: "abc", ... }  (~10-20s)
  │     POST /api/pathway/build/step { stepId: "def", ... }  (~10-20s)
  │     POST /api/pathway/build/step { stepId: "ghi", ... }  (~10-20s)
  │     ...all in parallel
  │   ])
  │
  ├── PUT /api/pathway/:id { status: "COMPLETE", pathwayData: merged }
  │
  └── router.push(`/pathway/:id`)
```

Total wall-clock: ~20-30s (structure + all steps in parallel).
No single call exceeds ~20s — well within Netlify's 60s limit.
Total output: ~10,500+ tokens across all steps vs 4096 today.

---

## Key Differences from Goals

The Careers `PathwayStep` model has more fields than Goals. The step enrichment response must include Careers-specific data:

- `qualification` (name, level, specific)
- `grades` (per-subject minimums)
- `ucasPoints`
- `costs` (total, breakdown, fundingOptions)
- `application` (process, keyDeadlines, whereToApply)
- `professionalBody` (name, membershipType, cost, website)
- `workExperience` (recommended, howToFind, duration)
- `alternativeRoutes` (name, description, pros, cons)
- `specialRequirements` (type, details)
- `walesSpecific` (welshMediumAvailable, welshProviders, welshFunding)

The structure prompt and step enrichment prompt must reflect this richer schema. Study the existing `PATHWAY_BUILD_PROMPT` in Careers for the full output format — split it into structure fields vs enrichment fields.

---

## Files to Change (Careers)

| File | Action |
|------|--------|
| `src/prompts/pathwayBuild.ts` | Add `getCareerStructurePrompt()` and `getCareerStepEnrichmentPrompt()`. Keep `PATHWAY_BUILD_PROMPT`. |
| `src/app/api/pathway/build/route.ts` | Rewrite: JSON response, structure-only, save skeleton, return step IDs |
| `src/app/api/pathway/build/step/route.ts` | **New file**: per-step enrichment endpoint |
| `src/app/api/pathway/[id]/route.ts` | Add "COMPLETE" to allowedStatuses, accept pathwayData in PUT |
| `src/components/chat/ConversationChat.tsx` | Rewrite `handleBuildPathway()` with parallel orchestration + progress UI |

---

## Testing

After implementation:

1. Start a new conversation in Careers (any dream job)
2. Complete the conversation until the "Build my pathway" button appears
3. Click build — you should see step-by-step progress with checkmarks
4. Verify the pathway page loads with full detail (descriptions, costs, application info, tips, Wales data)
5. Check Netlify function logs — no single function should exceed ~25s
6. Test with a complex career (e.g. "become a surgeon") that previously timed out

---

## Chat Lock After Limit Reached (Same as Athro Goals)

When a user hits their pathway limit (e.g. tries to build and gets 429), the chat must be **locked** until they upgrade — not just show an error message while still allowing them to type. Athro Goals does this; Careers must match.

### Backend changes

**`/api/conversation/route.ts`** — Add a limit check at the start (before processing any message):

```typescript
const user = await getOrCreateUser(authUser);
const { limitReached, pathwayLimit } = checkPathwayLimit(user);
if (limitReached) {
  return new Response(
    JSON.stringify({
      error: "limit_reached",
      message: `You've used your ${pathwayLimit} pathway${pathwayLimit === 1 ? "" : "s"} for this month. Upgrade to continue.`,
    }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
```

You need a `checkPathwayLimit` helper. In Goals it lives in `src/lib/limit.ts`. Careers may have equivalent logic elsewhere — find it or create it. The function should return `{ limitReached: boolean, pathwayLimit: number }` based on user's subscription tier and `pathwaysUsedThisMonth` / `pathwaysResetDate`.

### Frontend changes

**`ConversationChat.tsx`** — When the conversation API or pathway PUT returns 429 with `error: "limit_reached"`:

1. Set `setShowUpgrade(true)` (or equivalent state)
2. Derive `limitReached = showUpgrade || (initialLimitReached ?? false)`
3. When `limitReached`:
   - In the message area: show a box with "You've used your pathway allowance" and "Upgrade to continue building pathways and return to this one."
   - In the bottom input area: replace the input with "Chat locked until you upgrade" and an upgrade button
4. Upgrade link: `pathwayId ? \`/upgrade?returnTo=\${encodeURIComponent(\`/goal/new?resume=\${pathwayId}\`)}\` : "/upgrade"` (adjust paths for Careers, e.g. `/career/new?resume=...` or equivalent)

**Page that renders the chat** — Pass `initialLimitReached` from the server (from `checkPathwayLimit(dbUser).limitReached`) so the chat knows the limit on first load without needing to hit the API.

### Pathway PUT (build flow)

When the user clicks "Build my pathway", the client first sends `PUT /api/pathway/[id]` with `{ status: "GENERATING" }`. That endpoint must also check `checkPathwayLimit` and return 429 with `error: "limit_reached"` if the limit is reached. The client should handle 429 from this PUT by calling `setShowUpgrade(true)` before returning (same as Goals).

### Resulting behavior

- User has used their free pathway
- User tries to build → gets 429 from pathway PUT → client sets `showUpgrade(true)` → `limitReached` becomes true
- Input area is replaced with "Chat locked until you upgrade" + upgrade button
- User cannot send any more messages until they upgrade
- If they try to send a message, the conversation API also returns 429 → client sets `showUpgrade(true)` there too

---

## Do Not

- Do NOT modify Athro Goals (`/Users/grom/athro-goals`)
- Do NOT change the conversation agent or domain routing — only the pathway BUILD flow
- Do NOT remove the `/api/pathway/generate` endpoint — it's used by a different flow
- Do NOT change the Prisma schema — the existing PathwayStep model already has all needed fields
