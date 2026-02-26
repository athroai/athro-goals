/**
 * POST /api/conversation
 *
 * Flow: Route goal -> Domain agent -> SSE response
 * SSE events: pathwayId, tool_start, tool_end, text, done, error
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { checkPathwayLimit } from "@/lib/limit";
import { routeGoal } from "@/agents/router";
import { invokeDomainAgent } from "@/agents/domainAgent";
import { GoalDomain } from "@prisma/client";

interface ConversationRequest {
  pathwayId?: string;
  message: string;
}

function parseTargetDate(s: string): Date | null {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const yearMatch = s.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  let month = 11;
  const monthName = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (monthName) month = months[monthName[1].toLowerCase().slice(0, 3)] ?? 11;
  else {
    const slash = s.match(/(\d{1,2})\/(\d{4})/);
    if (slash) month = parseInt(slash[1], 10) - 1;
  }
  const d = new Date(year, month, 1);
  return isNaN(d.getTime()) ? null : d;
}

function extractTargetFromMessage(msg: string): { targetDate?: string; targetAge?: number } {
  const result: { targetDate?: string; targetAge?: number } = {};
  const dateMatch = msg.match(/by\s+(\w+\s+\d{4})/i) || msg.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ||
    msg.match(/(\w+\s+\d{4})/i);
  if (dateMatch?.[1]) result.targetDate = dateMatch[1].trim();
  const ageMatch = msg.match(/by\s+(?:the\s+time\s+I'm\s+)?(\d+)/i) || msg.match(/age\s+(\d+)/i) ||
    msg.match(/(\d+)\s*(?:years?\s+old|by\s+the\s+time)/i);
  if (ageMatch?.[1]) result.targetAge = parseInt(ageMatch[1], 10);
  return result;
}

const DOMAIN_MAP: Record<string, GoalDomain> = {
  FINANCE: "FINANCE",
  HEALTH: "HEALTH",
  EDUCATION: "EDUCATION",
  PROPERTY: "PROPERTY",
  SPORT: "SPORT",
  LIFESTYLE: "LIFESTYLE",
  OTHER: "OTHER",
};

export async function POST(req: NextRequest) {
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

    const body = (await req.json()) as ConversationRequest;
    const { message } = body;
    let { pathwayId } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let domain: GoalDomain = "OTHER";
    let groundingType: "FACTUAL" | "REASONING" | "MIXED" = "MIXED";

    if (pathwayId) {
      const pathway = await prisma.pathway.findUnique({
        where: { id: pathwayId },
      });
      if (!pathway || pathway.userId !== user.id) {
        return new Response(JSON.stringify({ error: "Pathway not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      domain = pathway.domain ?? "OTHER";
      groundingType =
        (pathway.groundingType as "FACTUAL" | "REASONING" | "MIXED") ?? "MIXED";
    } else {
      // First message: route the goal
      const routerOutput = await routeGoal(message);
      domain = DOMAIN_MAP[routerOutput.domain] ?? "OTHER";
      groundingType = routerOutput.groundingType;

      const pathway = await prisma.pathway.create({
        data: {
          userId: user.id,
          goal: message.length > 200 ? message.substring(0, 200) + "..." : message,
          domain,
          groundingType,
          status: "INTAKE",
        },
      });
      pathwayId = pathway.id;
    }

    await prisma.chatMessage.create({
      data: {
        pathwayId: pathwayId!,
        userId: user.id,
        role: "user",
        content: message,
      },
    });

    const history = await prisma.chatMessage.findMany({
      where: { pathwayId },
      orderBy: { createdAt: "asc" },
    });

    const chatHistory = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // Controller may be closed
          }
        };

        const heartbeat = setInterval(() => {
          sendEvent("heartbeat", { ts: Date.now() });
        }, 3000);

        try {
          sendEvent("pathwayId", { pathwayId });

          const { output, offerBuild, inputLocked, targetDate, targetAge, goalExtracted } =
            await invokeDomainAgent(
            message,
            chatHistory,
            domain,
            groundingType,
            {
              onToolStart(toolName: string, input: string) {
                sendEvent("tool_start", { tool: toolName, input });
              },
              onToolEnd(_toolName: string, summary: string) {
                sendEvent("tool_end", { summary });
              },
            }
          );

          const responseText =
            output ||
            "Sorry, I couldn't put that together. Could you try again?";

          sendEvent("text", { text: responseText });

          // Store goal + target in pathway — from agent output or user message
          const pathwayUpdate: { goal?: string; targetDate?: Date; targetAge?: number } = {};
          if (goalExtracted) pathwayUpdate.goal = goalExtracted;
          if (targetDate) {
            const d = parseTargetDate(targetDate);
            if (d) pathwayUpdate.targetDate = d;
          }
          if (targetAge != null) pathwayUpdate.targetAge = targetAge;
          const fromUser = extractTargetFromMessage(message);
          if (!pathwayUpdate.targetDate && fromUser.targetDate) {
            const d = parseTargetDate(fromUser.targetDate);
            if (d) pathwayUpdate.targetDate = d;
          }
          if (pathwayUpdate.targetAge == null && fromUser.targetAge != null) {
            pathwayUpdate.targetAge = fromUser.targetAge;
          }
          if (Object.keys(pathwayUpdate).length > 0) {
            await prisma.pathway.update({
              where: { id: pathwayId },
              data: pathwayUpdate,
            });
          }

          sendEvent("pathway", {
            pathwayId,
            goal: goalExtracted ?? undefined,
            targetDate: targetDate ?? fromUser.targetDate ?? undefined,
            targetAge: targetAge ?? fromUser.targetAge ?? undefined,
          });

          await prisma.chatMessage.create({
            data: {
              pathwayId: pathwayId!,
              userId: user.id,
              role: "assistant",
              content: responseText,
            },
          });

          const userMsgCount =
            chatHistory.filter((m) => m.role === "user").length + 1;
          const shouldOfferBuild =
            (offerBuild && userMsgCount >= 3) || inputLocked;

          clearInterval(heartbeat);
          sendEvent("done", {
            pathwayId,
            offerBuild: shouldOfferBuild,
            inputLocked,
          });
          controller.close();
        } catch (err) {
          clearInterval(heartbeat);
          const msg = err instanceof Error ? err.message : String(err);
          console.error("Conversation stream error:", msg, err);
          sendEvent("error", { error: "Something went wrong. Please try again." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Conversation error:", msg, error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
