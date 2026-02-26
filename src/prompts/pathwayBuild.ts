/**
 * Pathway build prompts — vary by grounding type.
 * FACTUAL: cite sources, no guessing
 * REASONING: general knowledge, honest feasibility
 * MIXED: both
 */

const today = new Date();
const CURRENT_DATE = today.toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const OUTPUT_SCHEMA = `
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
      "sources": ["gov.uk/buying-a-home"],
      "sourceType": "factual",
      "tips": ["Practical tip"],
      "checklist": ["Action 1 to complete", "Action 2", "Action 3"]
    }
  ]
}
`;

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

export function getPathwayBuildPrompt(
  groundingType: "FACTUAL" | "REASONING" | "MIXED"
): string {
  const rules =
    groundingType === "FACTUAL"
      ? FACTUAL_RULES
      : groundingType === "REASONING"
        ? REASONING_RULES
        : MIXED_RULES;

  return `You are Athro Goals building a step-by-step pathway for a life goal.

**Today's date is ${CURRENT_DATE}.** All dates must be in the future.

${rules}

## OUTPUT FORMAT
Output ONLY valid JSON (no markdown):
${OUTPUT_SCHEMA}

## RULES
- Each step MUST have definiteDate (e.g. "March 2027") and definiteDateIso (YYYY-MM-DD for the first day of that month).
- sourceType: "factual" (cited) or "reasoning" (judgment). Required.
- checklist: 2-5 concrete actions the user can tick off. Include only when useful (most steps). Examples: "Set up savings account", "Apply for visa", "Book health check". Make each item a single clear action.
- 5-8 steps minimum. Output valid JSON only.`;
}

/** Legacy export for backward compat */
export const PATHWAY_BUILD_PROMPT = getPathwayBuildPrompt("MIXED");
