/**
 * POST /api/pathway/build
 *
 * Phase 1 of parallel generation: produces a lightweight pathway SKELETON
 * (titles, dates, stages, costs). Returns JSON — no SSE.
 * ~10-15s, well within Netlify's 60s limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import Anthropic from "@anthropic-ai/sdk";
import { getStructurePrompt } from "@/prompts/pathwayBuild";

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
  const { pathwayId } = body;

  const pathway = await prisma.pathway.findFirst({
    where: { id: pathwayId, userId: user.id, status: "GENERATING" },
  });
  if (!pathway) {
    return NextResponse.json(
      { error: "Pathway not found or not in GENERATING state" },
      { status: 404 }
    );
  }

  const chatMessages = await prisma.chatMessage.findMany({
    where: { pathwayId },
    orderBy: { createdAt: "asc" },
  });

  let conversationSummary =
    chatMessages.length > 0
      ? chatMessages
          .map((m) => `${m.role === "user" ? "USER" : "ADVISOR"}: ${m.content}`)
          .join("\n\n")
      : `USER: ${pathway.goal}\nNo further conversation.`;

  if (conversationSummary.length > 4000) {
    conversationSummary = conversationSummary.slice(0, 4000) + "…";
  }
  conversationSummary = sanitize(conversationSummary);

  const groundingType =
    (pathway.groundingType as "FACTUAL" | "REASONING" | "MIXED") ?? "MIXED";

  try {
    await prisma.pathwayStep.deleteMany({ where: { pathwayId } });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const structurePrompt = getStructurePrompt(groundingType);
    const abortController = new AbortController();
    const apiTimeout = setTimeout(() => abortController.abort(), 45_000);

    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: structurePrompt,
          messages: [
            {
              role: "user",
              content: `Conversation:\n\n${conversationSummary}\n\nBuild the pathway structure. Output ONLY valid JSON.`,
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
    const parsed = JSON.parse(parsedStr) as Record<string, unknown>;

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    if (steps.length === 0) throw new Error("Pathway has no steps");

    const createdSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as Record<string, unknown>;
      const created = await prisma.pathwayStep.create({
        data: {
          pathwayId,
          stepOrder: (step.stepOrder as number) ?? i + 1,
          title: String(step.title ?? `Step ${i + 1}`),
          description: "",
          stageLabel: String(step.stageLabel ?? ""),
          definiteDate:
            typeof step.definiteDate === "string" ? step.definiteDate : null,
          definiteDateIso:
            typeof step.definiteDateIso === "string"
              ? step.definiteDateIso
              : null,
          timelineMonths:
            typeof step.timelineMonths === "number"
              ? step.timelineMonths
              : null,
          estimatedCost:
            typeof step.estimatedCost === "number" ? step.estimatedCost : null,
        },
      });
      createdSteps.push({
        id: created.id,
        stepOrder: created.stepOrder,
        title: created.title,
        stageLabel: created.stageLabel,
        definiteDate: created.definiteDate,
        definiteDateIso: created.definiteDateIso,
        estimatedCost: created.estimatedCost,
      });
    }

    await prisma.pathway.update({
      where: { id: pathwayId },
      data: {
        goal: String(parsed.goal ?? pathway.goal ?? ""),
        goalNormalised: (parsed.goalNormalised as string) ?? null,
        pathwayData: parsed as object,
        summaryText: String(parsed.summary ?? ""),
        totalSteps: steps.length,
        estimatedYears:
          typeof parsed.totalEstimatedYears === "number"
            ? parsed.totalEstimatedYears
            : null,
        estimatedTotalCost:
          typeof parsed.totalEstimatedCost === "number"
            ? parsed.totalEstimatedCost
            : null,
      },
    });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const now = new Date();
    if (dbUser && (!dbUser.pathwaysResetDate || now > dbUser.pathwaysResetDate)) {
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await prisma.user.update({
        where: { id: user.id },
        data: { pathwaysUsedThisMonth: 1, pathwaysResetDate: resetDate },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { pathwaysUsedThisMonth: { increment: 1 } },
      });
    }

    return NextResponse.json({
      pathwayId,
      goal: String(parsed.goal ?? ""),
      summary: String(parsed.summary ?? ""),
      groundingType,
      conversationSummary,
      pathwayData: parsed,
      steps: createdSteps,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("Structure generation error:", raw, err);

    try {
      await prisma.pathway.update({
        where: { id: pathwayId },
        data: { status: "ERROR" },
      });
    } catch {
      /* ignore */
    }

    const userMsg =
      /input stream|moderation|content policy|invalid_request/i.test(raw)
        ? "Pathway generation failed. Please try rephrasing your goal and try again."
        : raw.length > 120
          ? "Pathway generation failed. Please try again."
          : raw;

    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
