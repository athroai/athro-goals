/**
 * Athro Goals — Router Agent
 *
 * Classifies the user's goal into one domain. One cheap LLM call, no tools.
 * Uses Haiku for cost efficiency (~£0.002 per call).
 */

import Anthropic from "@anthropic-ai/sdk";

export type GoalDomain =
  | "FINANCE"
  | "HEALTH"
  | "EDUCATION"
  | "PROPERTY"
  | "SPORT"
  | "LIFESTYLE"
  | "OTHER";

/** How much the goal depends on external facts vs AI reasoning */
export type GroundingType = "FACTUAL" | "REASONING" | "MIXED";

export interface RouterOutput {
  domain: GoalDomain;
  groundingType: GroundingType;
  confidence: number; // 0-1
  reasoning?: string;
}

const DOMAINS: GoalDomain[] = [
  "FINANCE",
  "HEALTH",
  "EDUCATION",
  "PROPERTY",
  "SPORT",
  "LIFESTYLE",
  "OTHER",
];

const ROUTER_SYSTEM_PROMPT = `You are a goal classifier for Athro Goals. Classify the user's goal into (1) domain and (2) grounding type.

Domains:
- FINANCE: Mortgage, savings, debt, investment, wealth, ISA, pension, getting out of debt
- HEALTH: Quit smoking, lose weight, mental health, fitness, addiction, wellbeing
- EDUCATION: Pass exams, get qualifications, learn skills, GCSEs, A-levels, degrees
- PROPERTY: Buy house, renovation, energy efficiency, home improvements
- SPORT: Play for Wales/NBA, run marathon, compete at county level, athletic goals
- LIFESTYLE: Get a dog, start a family, buy a car, own a MacBook, personal goals
- OTHER: Goals that don't clearly fit above

Grounding types (CRITICAL — determines how we help):
- FACTUAL: Goal depends on rules, thresholds, timelines from official sources (mortgage, LISA, debt, tax, benefits). We must cite gov.uk, MoneyHelper, etc.
- REASONING: Goal needs feasibility assessment, honest feedback, alternatives (e.g. "play for NY Knicks" when 4'10", "become a pilot" with no experience). No official docs — we use judgment and world knowledge.
- MIXED: Both (e.g. "buy a house" + user has unusual constraints — facts for rules, reasoning for feasibility).

Examples:
- "Get a mortgage by 30" → FACTUAL (LISA rules, affordability)
- "Play for the NY Knicks" (no context) → REASONING (feasibility, alternatives)
- "Run a marathon" → MIXED (training plans exist, but personal feasibility matters)
- "Own a MacBook Pro" → MIXED (costs are factual, savings plan is reasoning)

Output valid JSON only, no markdown:
{"domain": "FINANCE", "groundingType": "FACTUAL", "confidence": 0.95, "reasoning": "Mortgage rules from gov.uk"}

Confidence: 0.9+ = clear fit, 0.7-0.9 = likely fit, <0.6 = prefer OTHER.`;

export async function routeGoal(userMessage: string): Promise<RouterOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: ROUTER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify this goal: "${userMessage}"`,
      },
    ],
  });

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { domain: "OTHER", groundingType: "MIXED", confidence: 0.3, reasoning: "Parse failed" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      domain?: string;
      groundingType?: string;
      confidence?: number;
      reasoning?: string;
    };
    const domain = parsed.domain?.toUpperCase();
    const validDomain = DOMAINS.includes(domain as GoalDomain)
      ? (domain as GoalDomain)
      : "OTHER";
    const gt = parsed.groundingType?.toUpperCase();
    const validGrounding: GroundingType =
      gt === "FACTUAL" || gt === "REASONING" || gt === "MIXED" ? gt : "MIXED";
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) ?? 0.5));
    return {
      domain: validDomain,
      groundingType: validGrounding,
      confidence,
      reasoning: parsed.reasoning,
    };
  } catch {
    return { domain: "OTHER", groundingType: "MIXED", confidence: 0.3, reasoning: "Parse error" };
  }
}
