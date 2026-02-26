/**
 * POST /api/pathway/build
 *
 * Generates pathway from conversation. SSE: progress, complete, error.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import Anthropic from "@anthropic-ai/sdk";
import { invokePathwayBuildAgent } from "@/agents/pathwayBuildAgent";
import { getPathwayBuildPrompt } from "@/prompts/pathwayBuild";
import type { GoalDomain } from "@/agents/router";

export async function POST(req: NextRequest) {
  let pathwayId: string;
  let userId: string;
  let conversationSummary: string;
  let pathwayDomain: GoalDomain | null = null;
  let groundingType: "FACTUAL" | "REASONING" | "MIXED" = "MIXED";

  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getOrCreateUser(authUser);
    const body = await req.json();
    pathwayId = body.pathwayId;

    const pathway = await prisma.pathway.findFirst({
      where: { id: pathwayId, userId: user.id, status: "GENERATING" },
    });
    if (!pathway) {
      return new Response(
        JSON.stringify({ error: "Pathway not found or not in GENERATING state" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    userId = user.id;

    const chatMessages = await prisma.chatMessage.findMany({
      where: { pathwayId },
      orderBy: { createdAt: "asc" },
    });

    conversationSummary =
      chatMessages.length > 0
        ? chatMessages
            .map((m) => `${m.role === "user" ? "USER" : "ADVISOR"}: ${m.content}`)
            .join("\n\n")
        : `USER: ${pathway.goal}\nNo further conversation.`;
    groundingType =
      (pathway.groundingType as "FACTUAL" | "REASONING" | "MIXED") ?? "MIXED";
    pathwayDomain = pathway.domain as GoalDomain | null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Pathway build setup error:", msg, error);
    return new Response(
      JSON.stringify({ error: `Build setup error: ${msg}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* ignore */
        }
      };

      const heartbeat = setInterval(() => {
        sendEvent("progress", { message: "Building..." });
      }, 4000);

      try {
        sendEvent("progress", { message: "Generating your pathway..." });

        await generatePathway(
          pathwayId,
          userId,
          conversationSummary,
          pathwayDomain,
          groundingType,
          sendEvent
        );

        clearInterval(heartbeat);
        sendEvent("complete", { pathwayId });
      } catch (err) {
        clearInterval(heartbeat);
        const raw = err instanceof Error ? err.message : String(err);
        console.error("Pathway build error:", raw, err);
        const userMsg =
          /input stream|moderation|content policy|invalid_request/i.test(raw)
            ? "Pathway generation failed. Please try rephrasing your goal and try again."
            : raw.length > 120
              ? "Pathway generation failed. Please try again."
              : raw;
        try {
          await prisma.pathway.update({
            where: { id: pathwayId },
            data: { status: "ERROR" },
          });
        } catch {
          /* ignore */
        }
        sendEvent("error", { error: userMsg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function generatePathwayOneShot(
  conversationSummary: string,
  groundingType: "FACTUAL" | "REASONING" | "MIXED"
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const buildPrompt = getPathwayBuildPrompt(groundingType);
  const abortController = new AbortController();
  const apiTimeout = setTimeout(() => abortController.abort(), 50_000);

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: buildPrompt,
        messages: [
          {
            role: "user",
            content: `Conversation:\n\n${conversationSummary}\n\nBuild the pathway. Output ONLY valid JSON.`,
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

  try {
    const parsed = JSON.parse(parsedStr) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid pathway structure");
    }
    return parsed;
  } catch (e) {
    throw new Error(`Pathway JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function generatePathway(
  pathwayId: string,
  userId: string,
  conversationSummary: string,
  domain: GoalDomain | null,
  groundingType: "FACTUAL" | "REASONING" | "MIXED",
  sendEvent: (event: string, data: unknown) => void
) {
  try {
    await prisma.pathwayStep.deleteMany({ where: { pathwayId } });

    const effectiveDomain = domain ?? "OTHER";

    sendEvent("progress", { message: "Researching steps, timelines, and costs..." });

    let parsed: Record<string, unknown>;
    try {
      const result = await invokePathwayBuildAgent(
        conversationSummary,
        effectiveDomain,
        groundingType,
        {
          onResearchStart: () => sendEvent("progress", { message: "Researching costs, timelines, and recommendations..." }),
          onResearchEnd: (n) => sendEvent("progress", { message: `Found ${n} sources. Generating pathway...` }),
        }
      );
      parsed = result.json;
    } catch (agentErr) {
      console.warn("Pathway agent failed, falling back to one-shot:", agentErr);
      sendEvent("progress", { message: "Generating pathway..." });
      parsed = await generatePathwayOneShot(conversationSummary, groundingType);
    }

    sendEvent("progress", { message: "Saving your pathway..." });

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];

    if (steps.length > 0) {
      await prisma.pathwayStep.createMany({
        data: steps.map((step: Record<string, unknown>, i: number) => ({
          pathwayId,
          stepOrder: (step.stepOrder as number) ?? i + 1,
          title: String(step.title ?? `Step ${i + 1}`),
          description: String(step.description ?? ""),
          stageLabel: String(step.stageLabel ?? ""),
          definiteDate:
            typeof step.definiteDate === "string" ? step.definiteDate : null,
          definiteDateIso:
            typeof step.definiteDateIso === "string" ? step.definiteDateIso : null,
          timelineMonths:
            typeof step.timelineMonths === "number" ? step.timelineMonths : null,
          estimatedCost:
            typeof step.estimatedCost === "number" ? step.estimatedCost : null,
          costBreakdown: Array.isArray(step.costBreakdown)
            ? (step.costBreakdown as object)
            : undefined,
          sources: (() => {
            const src = step.sources;
            const st = step.sourceType;
            if (st != null)
              return {
                sourceType: st,
                names: Array.isArray(src) ? src : src ? [String(src)] : [],
              } as object;
            return (src as object) ?? undefined;
          })(),
          tips: Array.isArray(step.tips)
            ? (step.tips as string[]).join("\n")
            : typeof step.tips === "string"
              ? step.tips
              : null,
          checklist: Array.isArray(step.checklist)
            ? (step.checklist as string[]).filter((x): x is string => typeof x === "string")
            : undefined,
        })),
      });
    }

    await prisma.pathway.update({
      where: { id: pathwayId },
      data: {
        status: "COMPLETE",
        goal: String(parsed.goal ?? ""),
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

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const now = new Date();
    if (dbUser && (!dbUser.pathwaysResetDate || now > dbUser.pathwaysResetDate)) {
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { pathwaysUsedThisMonth: 1, pathwaysResetDate: resetDate },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { pathwaysUsedThisMonth: { increment: 1 } },
      });
    }
  } catch (error) {
    console.error("Pathway generation error:", error);
    try {
      await prisma.pathway.update({
        where: { id: pathwayId },
        data: { status: "ERROR" },
      });
    } catch {
      /* ignore */
    }
    throw error;
  }
}
