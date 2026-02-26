/**
 * Pathway Build Agent — agentic pathway generation with tools.
 * Uses retrieve_knowledge (RAG) + web_search (Tavily) for real, personalised data.
 * Replaces one-shot static prompt with research-first workflow.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { GoalDomain } from "./router";
import { retrieveKnowledge } from "@/lib/rag/retrieve";
import { tavilySearch } from "@/lib/tavily";
import { getPathwayBuildPrompt } from "@/prompts/pathwayBuild";

const MAX_ITERATIONS = 4;
const RETRIEVAL_PER_PATHWAY = 8;
const WEB_SEARCH_PER_PATHWAY = 4;

function createPathwayRetrieveTool(
  domain: GoalDomain,
  retrievalCount: { perConversation: number; perTurn: number },
  increment: () => void
): StructuredToolInterface {
  return new DynamicStructuredTool({
    name: "retrieve_knowledge",
    description: `Search the knowledge base for facts, costs, timelines, and how-to info. Use for: rules (mortgage, LISA, visa), typical costs, timelines, destinations, airlines, fares. Domain: ${domain}. Call 2-4 times with different queries to gather what you need.`,
    schema: z.object({
      query: z.string().describe("Search query e.g. 'flights UK New Zealand cost' or 'LISA first time buyer rules'"),
    }),
    func: async ({ query }) => {
      const { chunks, ok } = retrieveKnowledge(query, domain, retrievalCount);
      if (!ok) {
        return JSON.stringify({ error: "Retrieval limit reached.", chunks: [] });
      }
      increment();
      return JSON.stringify({
        chunks: chunks.map((c) => ({ content: c.content, source: c.source, sourceUrl: c.sourceUrl })),
        note: "Use only information from these chunks. Cite sources in your pathway.",
      });
    },
  });
}

function createPathwayWebSearchTool(
  getCount: () => number,
  increment: () => void
): StructuredToolInterface | null {
  if (!process.env.TAVILY_API_KEY) return null;

  return new DynamicStructuredTool({
    name: "web_search",
    description:
      "Search the web for live data: flight prices, airline deals, current costs, destinations, visa rules, accommodation. Use when retrieve_knowledge doesn't have recent or specific enough data. Call 1-3 times with focused queries.",
    schema: z.object({
      query: z.string().describe("Search query e.g. 'cheapest flights London Auckland 2025' or 'best airlines UK New Zealand'"),
    }),
    func: async ({ query }) => {
      if (getCount() >= WEB_SEARCH_PER_PATHWAY) {
        return JSON.stringify({ error: "Web search limit reached.", results: [] });
      }
      increment();
      const { results, answer } = await tavilySearch(query, { maxResults: 5 });
      return JSON.stringify({
        results: results.map((r) => ({ title: r.title, url: r.url, content: r.content })),
        answer: answer ?? null,
        note: "Use this live data to personalise costs, airlines, and recommendations. Cite URLs when possible.",
      });
    },
  });
}

export interface PathwayBuildAgentCallbacks {
  onToolStart?: (toolName: string, input: string) => void;
  onToolEnd?: (toolName: string, output: string) => void;
}

export async function invokePathwayBuildAgent(
  conversationSummary: string,
  domain: GoalDomain,
  groundingType: "FACTUAL" | "REASONING" | "MIXED",
  callbacks: PathwayBuildAgentCallbacks = {}
): Promise<{ json: Record<string, unknown>; rawText: string }> {
  const retrievalCount = { perConversation: 0, perTurn: 0 };
  const webSearchCount = { count: 0 };

  const retrieveTool = createPathwayRetrieveTool(
    domain,
    retrievalCount,
    () => {
      retrievalCount.perConversation++;
      retrievalCount.perTurn++;
    }
  );
  const webSearchTool = createPathwayWebSearchTool(
    () => webSearchCount.count,
    () => { webSearchCount.count++; }
  );

  const tools: StructuredToolInterface[] = [retrieveTool];
  if (webSearchTool) tools.push(webSearchTool);

  const toolMap = new Map<string, StructuredToolInterface>();
  tools.forEach((t) => toolMap.set(t.name, t));

  const ANTHROPIC_TOOLS: Anthropic.Messages.Tool[] = [
    {
      name: "retrieve_knowledge",
      description: retrieveTool.description,
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
    },
    ...(webSearchTool
      ? [
          {
            name: "web_search",
            description: webSearchTool.description,
            input_schema: {
              type: "object" as const,
              properties: { query: { type: "string", description: "Search query" } },
              required: ["query"],
            },
          } as Anthropic.Messages.Tool,
        ]
      : []),
  ];

  const buildPrompt = getPathwayBuildPrompt(groundingType);
  const agentSystemPrompt = `${buildPrompt}

## AGENTIC MODE — RESEARCH FIRST
You have tools. USE THEM before outputting the pathway.
1. Call retrieve_knowledge 2-4 times with queries tailored to the user's goal (costs, rules, timelines, destinations, airlines, fares).
2. If web_search is available, use it for live data (flight prices, current deals, specific destinations).
3. Synthesise the retrieved data into a personalised pathway. Include specific numbers, airlines, places, savings targets when you found them.
4. When you have enough, output the pathway as valid JSON only (no markdown, no explanation).

If no tools are available or you hit limits, use your knowledge but prefer citing what you retrieved.`;

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Conversation:\n\n${conversationSummary}\n\nResearch using your tools, then build the pathway. Output ONLY valid JSON.`,
    },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  let fullResponse = "";
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    retrievalCount.perTurn = 0;

    const createParams: Anthropic.Messages.MessageCreateParams = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: agentSystemPrompt,
      messages,
      tools: ANTHROPIC_TOOLS,
    };

    const response = await client.messages.create(createParams);
    let hasToolUse = false;
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        fullResponse += block.text;
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        callbacks.onToolStart?.(block.name, JSON.stringify(block.input));

        const tool = toolMap.get(block.name);
        let result: string;
        if (tool) {
          try {
            const out = await tool.invoke(block.input as Record<string, unknown>);
            result = typeof out === "string" ? out : JSON.stringify(out);
          } catch (err) {
            result = JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${block.name}` });
        }

        callbacks.onToolEnd?.(block.name, result.substring(0, 500));
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    if (hasToolUse && toolResults.length > 0) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }

  const jsonStr = fullResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  const parsedStr = jsonMatch ? jsonMatch[0] : jsonStr || "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(parsedStr) as Record<string, unknown>;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(`Pathway JSON parse failed: ${msg}. Raw (first 600 chars): ${fullResponse.substring(0, 600)}`);
  }

  if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error(`Pathway has no steps. Raw: ${fullResponse.substring(0, 400)}`);
  }

  return { json: parsed, rawText: fullResponse };
}
