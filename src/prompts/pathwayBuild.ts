/**
 * Pathway build prompts — split into structure + step enrichment.
 * Structure: lightweight skeleton (titles, dates, stages, costs)
 * Step: full detail per step (description, checklist, recommendations, tips)
 */

const today = new Date();
const CURRENT_DATE = today.toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const COST_RULES = `
## COSTS — CRITICAL

**When costs apply** (mortgage, business, purchase, debt payoff): Only include costs when the conversation gives you real context (income, savings, loan amount, budget). For each cost:
- costNote: Explain what the user can expect to pay, what it covers, how to fund it (savings/loan/revenue), and what they get in return
- totalEstimatedCost: Only if you have real numbers from the conversation
- costContext: At pathway level, explain what the user can expect to pay overall, how they can fund it, and what they can expect in return
Never invent arbitrary numbers. If no context, use null for estimatedCost and omit costContext.

**When costs do NOT apply** (happy life, learn to walk again, family recover from grief, sobriety, resilience): Use null for estimatedCost. Omit costBreakdown, costNote, costContext, totalEstimatedCost. These goals are about time, support, and process — not money.
`;

const FACTUAL_RULES = `
## ANTI-HALLUCINATION — CRITICAL
Only use information from the conversation and cited sources. Never guess. Cite gov.uk, MoneyHelper, StepChange when applicable.
## SOURCE ATTRIBUTION — REQUIRED
Each step's sources array MUST include actual sources. Set sourceType to "factual" when citing official sources.
${COST_RULES}
`;

const REASONING_RULES = `
## REASONING-BASED PATHWAY
This goal type has no official sources. Use your general knowledge and judgment. Be honest about feasibility.
Set sourceType to "reasoning" for each step. Use empty sources [] — do NOT show "general guidance" or similar.
${COST_RULES}
`;

const MIXED_RULES = `
## MIXED — FACTS + REASONING
For steps with cited rules/timelines: sourceType "factual", include sources. For feasibility/alternatives: sourceType "reasoning".
${COST_RULES}
`;

function getRules(groundingType: "FACTUAL" | "REASONING" | "MIXED"): string {
  if (groundingType === "FACTUAL") return FACTUAL_RULES;
  if (groundingType === "REASONING") return REASONING_RULES;
  return MIXED_RULES;
}

/* ── STRUCTURE PROMPT ── */

const STRUCTURE_SCHEMA = `
{
  "goal": "User's stated goal",
  "goalNormalised": "Standardised goal title",
  "summary": "2-3 paragraph overview personalised to their situation",
  "totalEstimatedYears": 2.5,
  "totalEstimatedCost": 15000,
  "costContext": "Optional: what user can expect to pay overall",
  "steps": [
    {
      "stepOrder": 1,
      "title": "Clear actionable step title",
      "stageLabel": "e.g. Preparation, Application, Completion",
      "definiteDate": "March 2027",
      "definiteDateIso": "2027-03-01",
      "timelineMonths": 6,
      "estimatedCost": 2000
    }
  ]
}
`;

export function getStructurePrompt(
  groundingType: "FACTUAL" | "REASONING" | "MIXED"
): string {
  return `You are Athro Goals building a step-by-step pathway STRUCTURE for a life goal.

**Today's date is ${CURRENT_DATE}.** All dates must be in the future.

${getRules(groundingType)}

## OUTPUT FORMAT
Output ONLY valid JSON (no markdown):
${STRUCTURE_SCHEMA}

## RULES
- 5-8 steps. Each step: title, stageLabel, definiteDate, definiteDateIso, estimatedCost (or null).
- summary: 2-3 paragraphs personalised to the user's situation and goal.
- Do NOT include description, checklist, tips, sources, recommendations — those come later.
- Output valid JSON only.`;
}

/* ── STEP ENRICHMENT PROMPT ── */

export function getStepEnrichmentPrompt(
  groundingType: "FACTUAL" | "REASONING" | "MIXED"
): string {
  return `You are Athro Goals enriching a single step of a life goal pathway.

**Today's date is ${CURRENT_DATE}.**

${getRules(groundingType)}

## YOUR TASK
Given a goal, conversation context, and a step outline (title, date, stage), produce RICH detail for that step.

## OUTPUT FORMAT
Output ONLY valid JSON (no markdown):
{
  "description": "Detailed description. 3-5 paragraphs. Personalised to the user's situation. Include specific advice, not generic.",
  "checklist": ["Action 1", "Action 2", "Action 3", "Action 4"],
  "costBreakdown": [{"item": "Fee name", "amount": 1500}],
  "costNote": "What this costs, how to fund it, what the user gets",
  "savingsTarget": "Save £X by [date] — money needed by this step",
  "recommendations": ["Specific airline/provider/place", "Another recommendation", "A third"],
  "tips": ["Practical tip 1", "Practical tip 2"],
  "sources": ["source-url-or-name"],
  "sourceType": "factual"
}

## RULES
- checklist: REQUIRED. 3-5 concrete actions the user can tick off.
- description: REQUIRED. 3-5 paragraphs. Be specific to the user, not generic.
- recommendations: When relevant (travel, purchases, services), include specific providers, airlines, places, fares. Never generic.
- savingsTarget: When costs apply, tell the user exactly how much to save by when.
- tips: 1-3 practical tips specific to this step.
- sources: Cite real sources when available. sourceType "factual" or "reasoning".
- Output valid JSON only.`;
}

/* ── LEGACY: full one-shot prompt (kept for backward compat) ── */

const FULL_OUTPUT_SCHEMA = `
{
  "goal": "User's stated goal",
  "goalNormalised": "Standardised goal title",
  "summary": "2-3 paragraph overview personalised to their situation",
  "totalEstimatedYears": 2.5,
  "totalEstimatedCost": 15000,
  "costContext": "Optional: what user can expect to pay, how to fund it, expected return — only when relevant",
  "steps": [
    {
      "stepOrder": 1,
      "title": "Clear actionable step",
      "description": "Detailed description. 2-4 paragraphs.",
      "stageLabel": "e.g. Preparation, Application, Completion",
      "definiteDate": "March 2027",
      "definiteDateIso": "2027-03-01",
      "timelineMonths": 6,
      "estimatedCost": 2000,
      "costBreakdown": [{"item": "Fee", "amount": 1500}],
      "costNote": "Optional: how to fund this, what it covers, expected return",
      "savingsTarget": "Optional: e.g. 'Save £3,000 by March 2027'",
      "recommendations": ["Optional: specific airlines, fares, places, providers"],
      "sources": ["gov.uk/buying-a-home"],
      "sourceType": "factual",
      "tips": ["Practical tip"],
      "checklist": ["Action 1 to complete", "Action 2", "Action 3"]
    }
  ]
}
`;

export function getPathwayBuildPrompt(
  groundingType: "FACTUAL" | "REASONING" | "MIXED"
): string {
  return `You are Athro Goals building a step-by-step pathway for a life goal.

**Today's date is ${CURRENT_DATE}.** All dates must be in the future.

${getRules(groundingType)}

## OUTPUT FORMAT
Output ONLY valid JSON (no markdown):
${FULL_OUTPUT_SCHEMA}

## RULES
- Each step MUST have definiteDate (e.g. "March 2027") and definiteDateIso (YYYY-MM-DD for the first day of that month).
- sourceType: "factual" (cited) or "reasoning" (judgment). Required.
- checklist: REQUIRED for every step. 2-5 concrete actions the user can tick off.
- When costs apply: include savingsTarget per step (e.g. "Save £X by [date]").
- 5-8 steps minimum. Output valid JSON only.`;
}

export const PATHWAY_BUILD_PROMPT = getPathwayBuildPrompt("MIXED");
