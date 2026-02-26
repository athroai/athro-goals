/**
 * Pathway Build Agent — pre-fetch research, then generate in one API call.
 * Gathers RAG + web search data first, injects it into the prompt,
 * then makes a single Anthropic call. No multi-turn tool loop.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GoalDomain } from "./router";
import { retrieveKnowledge } from "@/lib/rag/retrieve";
import { tavilySearch } from "@/lib/tavily";
import { getPathwayBuildPrompt } from "@/prompts/pathwayBuild";

const MAX_CONVERSATION_CHARS = 4000;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function extractSearchQueries(conversation: string, goal: string): string[] {
  const queries: string[] = [];
  const goalLower = goal.toLowerCase();

  if (/travel|visit|trip|holiday|fly|flight/i.test(goalLower)) {
    queries.push(`flights cost ${goal}`);
    queries.push(`best time to visit ${goal} travel budget`);
  } else if (/mortgage|house|property|buy/i.test(goalLower)) {
    queries.push(`${goal} UK costs timeline`);
    queries.push(`first time buyer mortgage UK`);
  } else if (/business|startup|company/i.test(goalLower)) {
    queries.push(`${goal} costs funding UK`);
    queries.push(`startup business plan ${goal}`);
  } else {
    queries.push(`${goal} costs timeline UK`);
    queries.push(`how to ${goal} step by step`);
  }

  const places = conversation.match(/\b(?:to|in|visit|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
  if (places && places.length > 0) {
    const destination = places[0].replace(/^(?:to|in|visit|from)\s+/i, "");
    if (!queries.some((q) => q.includes(destination))) {
      queries.push(`${destination} travel costs recommendations`);
    }
  }

  return queries.slice(0, 3);
}

export interface PathwayBuildAgentCallbacks {
  onResearchStart?: () => void;
  onResearchEnd?: (sources: number) => void;
}

export async function invokePathwayBuildAgent(
  conversationSummary: string,
  domain: GoalDomain,
  groundingType: "FACTUAL" | "REASONING" | "MIXED",
  callbacks: PathwayBuildAgentCallbacks = {}
): Promise<{ json: Record<string, unknown>; rawText: string }> {
  const trimmedConversation = truncate(conversationSummary, MAX_CONVERSATION_CHARS);
  const goal = trimmedConversation.split("\n")[0].replace(/^USER:\s*/i, "").trim();

  callbacks.onResearchStart?.();

  const ragChunks = retrieveKnowledge(goal, domain, {
    perConversation: 0,
    perTurn: 0,
  });

  const searchQueries = extractSearchQueries(trimmedConversation, goal);
  const webResults: Array<{ title: string; url: string; snippet: string }> = [];
  let webAnswer = "";

  if (process.env.TAVILY_API_KEY) {
    const searches = await Promise.allSettled(
      searchQueries.map((q) => tavilySearch(q, { maxResults: 3 }))
    );
    for (const result of searches) {
      if (result.status === "fulfilled") {
        for (const r of result.value.results) {
          webResults.push({
            title: r.title,
            url: r.url,
            snippet: truncate(r.content, 300),
          });
        }
        if (result.value.answer && !webAnswer) {
          webAnswer = truncate(result.value.answer, 500);
        }
      }
    }
  }

  const totalSources = ragChunks.chunks.length + webResults.length;
  callbacks.onResearchEnd?.(totalSources);

  let researchBlock = "";
  if (ragChunks.chunks.length > 0) {
    researchBlock += "\n\n## KNOWLEDGE BASE DATA\n";
    for (const chunk of ragChunks.chunks) {
      researchBlock += `\n[${chunk.source}${chunk.sourceUrl ? ` — ${chunk.sourceUrl}` : ""}]\n${truncate(chunk.content, 500)}\n`;
    }
  }
  if (webResults.length > 0) {
    researchBlock += "\n\n## LIVE WEB RESEARCH\n";
    if (webAnswer) researchBlock += `Summary: ${webAnswer}\n`;
    for (const r of webResults.slice(0, 8)) {
      researchBlock += `\n[${r.title}](${r.url})\n${r.snippet}\n`;
    }
  }

  const buildPrompt = getPathwayBuildPrompt(groundingType);
  const systemPrompt = researchBlock
    ? `${buildPrompt}\n\n## RESEARCH DATA (use this to personalise the pathway — cite sources, include specific costs, airlines, places, providers)\n${researchBlock}`
    : buildPrompt;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Conversation:\n\n${trimmedConversation}\n\nBuild the pathway using the research data above. Include specific costs, recommendations, and savings targets. Output ONLY valid JSON.`,
      },
    ],
  });

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
  if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error("Pathway has no steps");
  }

  return { json: parsed, rawText: fullResponse };
}
