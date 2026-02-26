/**
 * POST /api/pathway — Create pathway from intake form
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { checkPathwayLimit } from "@/lib/limit";
import { routeGoal } from "@/agents/router";
import { GoalDomain } from "@prisma/client";

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

    const body = (await req.json()) as {
      goal: string;
      targetDate?: string;
      targetAge?: number;
      attainments?: string[];
    };

    const { goal, targetDate, targetAge, attainments } = body;
    if (!goal?.trim()) {
      return new Response(JSON.stringify({ error: "Goal is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const routerOutput = await routeGoal(goal);
    const domain = DOMAIN_MAP[routerOutput.domain] ?? "OTHER";

    const pathway = await prisma.pathway.create({
      data: {
        userId: user.id,
        goal: goal.trim(),
        domain,
        groundingType: routerOutput.groundingType,
        targetDate: targetDate ? parseTargetDate(targetDate) : null,
        targetAge: targetAge ?? null,
        attainments: Array.isArray(attainments) && attainments.length > 0 ? attainments : undefined,
        status: "INTAKE",
      },
    });

    // Seed conversation from intake
    const targetStr = targetDate
      ? `by ${targetDate}`
      : targetAge != null
        ? `by the time I'm ${targetAge}`
        : "";
    const attainmentStr =
      Array.isArray(attainments) && attainments.length > 0
        ? ` I hope to get: ${attainments.filter(Boolean).join(", ")}.`
        : "";
    const summary = `My goal is ${goal.trim()}. I want to achieve it ${targetStr}.${attainmentStr}`;

    await prisma.chatMessage.createMany({
      data: [
        { pathwayId: pathway.id, userId: user.id, role: "user", content: summary },
        {
          pathwayId: pathway.id,
          userId: user.id,
          role: "assistant",
          content: `I've got your goal: **${goal.trim()}**. Target: ${targetStr || "not set"}.${attainmentStr ? ` What you hope to get: ${attainments!.filter(Boolean).join(", ")}.` : ""}\n\nTo build a pathway that actually fits you, I need to understand **where you're at** and **how you hope to get there**. Every person's situation is different — your background, means, and constraints matter.\n\n**Tell me a bit about your situation.** For example: where you're starting from, what you've tried, what's in your way, or how you're thinking of achieving this.`,
        },
      ],
    });

    return new Response(JSON.stringify({ pathwayId: pathway.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Pathway create error:", msg, error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
