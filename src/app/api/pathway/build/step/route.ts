/**
 * POST /api/pathway/build/step
 *
 * Phase 2 of parallel generation: enriches a SINGLE step with full detail
 * (description, checklist, recommendations, tips, costs).
 * Called once per step, all in parallel from the client.
 * ~10-20s per step, well within Netlify's 60s limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import Anthropic from "@anthropic-ai/sdk";
import { getStepEnrichmentPrompt } from "@/prompts/pathwayBuild";

function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFFFD/g, "");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateUser(authUser);
  const body = await req.json();
  const {
    stepId,
    goal,
    conversationSummary,
    stepTitle,
    stepDate,
    stepStage,
    estimatedCost,
    groundingType,
  } = body as {
    stepId: string;
    goal: string;
    conversationSummary: string;
    stepTitle: string;
    stepDate: string;
    stepStage: string;
    estimatedCost: number | null;
    groundingType: "FACTUAL" | "REASONING" | "MIXED";
  };

  const step = await prisma.pathwayStep.findUnique({
    where: { id: stepId },
    include: { pathway: { select: { userId: true } } },
  });

  if (!step || step.pathway.userId !== user.id) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const enrichPrompt = getStepEnrichmentPrompt(groundingType ?? "MIXED");
    const cleanSummary = sanitize(conversationSummary ?? "");

    const abortController = new AbortController();
    const apiTimeout = setTimeout(() => abortController.abort(), 45_000);

    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: enrichPrompt,
          messages: [
            {
              role: "user",
              content: `Goal: ${goal}\n\nConversation context:\n${cleanSummary}\n\nStep to enrich:\n- Title: ${stepTitle}\n- Target date: ${stepDate}\n- Stage: ${stepStage}\n- Estimated cost: ${estimatedCost != null ? `£${estimatedCost}` : "Not applicable"}\n\nProvide rich, personalised detail for this step. Output ONLY valid JSON.`,
            },
          ],
        },
        { signal: abortController.signal }
      );
    } finally {
      clearTimeout(apiTimeout);
    }

    let fullResponse = "";
    for (const block of response.content) {
      if (block.type === "text") fullResponse += block.text;
    }

    const jsonStr = fullResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    const parsedStr = jsonMatch ? jsonMatch[0] : jsonStr;
    const enriched = JSON.parse(parsedStr) as Record<string, unknown>;

    await prisma.pathwayStep.update({
      where: { id: stepId },
      data: {
        description: String(enriched.description ?? ""),
        costBreakdown: Array.isArray(enriched.costBreakdown)
          ? (enriched.costBreakdown as object)
          : undefined,
        sources: (() => {
          const src = enriched.sources;
          const st = enriched.sourceType;
          if (st != null)
            return {
              sourceType: st,
              names: Array.isArray(src)
                ? src
                : src
                  ? [String(src)]
                  : [],
            } as object;
          return (src as object) ?? undefined;
        })(),
        tips: Array.isArray(enriched.tips)
          ? (enriched.tips as string[]).join("\n")
          : typeof enriched.tips === "string"
            ? enriched.tips
            : null,
        checklist: Array.isArray(enriched.checklist)
          ? (enriched.checklist as string[]).filter(
              (x): x is string => typeof x === "string"
            )
          : undefined,
      },
    });

    return NextResponse.json({
      stepId,
      description: enriched.description,
      checklist: enriched.checklist,
      costBreakdown: enriched.costBreakdown,
      costNote: enriched.costNote,
      savingsTarget: enriched.savingsTarget,
      recommendations: enriched.recommendations,
      tips: enriched.tips,
      sources: enriched.sources,
      sourceType: enriched.sourceType,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`Step enrichment error (${stepId}):`, raw, err);

    const userMsg =
      raw.length > 120 ? "Step enrichment failed." : raw;

    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
