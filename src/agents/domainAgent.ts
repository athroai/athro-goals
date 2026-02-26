/**
 * Athro Goals — Domain Agent
 *
 * Adaptive pipeline: branches on grounding type.
 * FACTUAL: tools + RAG, cite sources
 * REASONING: no tools, no RAG, honest feedback
 * MIXED: tools + RAG for facts, reasoning for feasibility
 */

import Anthropic from "@anthropic-ai/sdk";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { GoalDomain, GroundingType } from "./router";
import { mortgageAffordabilityTool, isaTool, debtTool } from "./tools/finance";
import { createRetrieveKnowledgeTool } from "./tools/retrieveKnowledgeTool";
import { FINANCE_DOMAIN_PROMPT } from "@/prompts/financeDomain";
import { LIFESTYLE_DOMAIN_PROMPT } from "@/prompts/lifestyleDomain";
import { REASONING_DOMAIN_PROMPT } from "@/prompts/reasoningDomain";
import { MIXED_DOMAIN_PROMPT } from "@/prompts/mixedDomain";

function getToolsForDomain(
  domain: GoalDomain,
  groundingType: GroundingType
): StructuredToolInterface[] {
  if (groundingType === "REASONING") return [];
  if (domain === "FINANCE") {
    return [mortgageAffordabilityTool, isaTool, debtTool];
  }
  return [];
}

function getPromptForDomain(
  domain: GoalDomain,
  groundingType: GroundingType
): string {
  if (groundingType === "REASONING") return REASONING_DOMAIN_PROMPT;
  if (groundingType === "MIXED") return MIXED_DOMAIN_PROMPT;
  if (domain === "FINANCE") return FINANCE_DOMAIN_PROMPT;
  if (domain === "LIFESTYLE") return LIFESTYLE_DOMAIN_PROMPT;
  return `You are Athro Goals. ${LIFESTYLE_DOMAIN_PROMPT}`;
}

export interface DomainAgentCallbacks {
  onToolStart: (toolName: string, input: string) => void;
  onToolEnd: (toolName: string, output: string) => void;
}

export interface DomainAgentOutput {
  output: string;
  readyToGenerate: boolean;
  offerBuild: boolean;
  inputLocked: boolean;
  targetDate?: string;
  targetAge?: number;
  goalExtracted?: string;
}

export async function invokeDomainAgent(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  domain: GoalDomain,
  groundingType: GroundingType,
  callbacks: DomainAgentCallbacks
): Promise<DomainAgentOutput> {
  const baseTools = getToolsForDomain(domain, groundingType);
  const useRAG = groundingType !== "REASONING";

  let retrievalCount = { perConversation: 0, perTurn: 0 };
  const retrieveTool = createRetrieveKnowledgeTool(
    domain,
    () => retrievalCount,
    () => {
      retrievalCount.perConversation++;
      retrievalCount.perTurn++;
    }
  );

  const toolMap = new Map<string, StructuredToolInterface>();
  const toolsToUse = useRAG ? [...baseTools, retrieveTool] : baseTools;
  toolsToUse.forEach((t) => toolMap.set(t.name, t));

  const hasFinanceTools =
    groundingType !== "REASONING" && domain === "FINANCE";
  const ANTHROPIC_TOOLS: Anthropic.Messages.Tool[] =
    hasFinanceTools
      ? [
          {
            name: "mortgage_affordability",
            description: mortgageAffordabilityTool.description,
            input_schema: {
              type: "object" as const,
              properties: {
                income: { type: "number", description: "Annual income in GBP" },
                deposit: { type: "number", description: "Deposit amount in GBP" },
                propertyPrice: { type: "number", description: "Property price in GBP" },
              },
              required: [],
            },
          },
          {
            name: "isa_lisa_rules",
            description: isaTool.description,
            input_schema: {
              type: "object" as const,
              properties: {
                query: {
                  type: "string",
                  enum: ["isa_allowance", "lisa_rules", "lisa_first_time_buyer"],
                  description: "Specific query",
                },
              },
              required: [],
            },
          },
          {
            name: "debt_management",
            description: debtTool.description,
            input_schema: {
              type: "object" as const,
              properties: {
                debtAmount: { type: "number", description: "Approximate total debt in GBP" },
                query: { type: "string", description: "Specific query e.g. IVA, DRO" },
              },
              required: [],
            },
          },
          {
            name: "retrieve_knowledge",
            description: retrieveTool.description,
            input_schema: {
              type: "object" as const,
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          },
        ]
      : [];

  const recentHistory = chatHistory.slice(-12);
  const messages: Anthropic.Messages.MessageParam[] = [
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const userMessageCount = chatHistory.filter((m) => m.role === "user").length + 1;
  const responseNumber = userMessageCount;
  const MAX_USER_MESSAGES = 10;
  const isLastTurn = responseNumber >= MAX_USER_MESSAGES;

  const FORMAT_RULE = `FORMAT: Use **bold** for key terms. Use short bullet lists. Keep paragraphs short.`;

  let pacingDirective: string;
  if (isLastTurn) {
    pacingDirective = `TURN ${responseNumber}/10 — PHASE 3 (FINAL): No more questions. Summarise goal, target, situation. Include [OFFER_BUILD].\n${FORMAT_RULE}`;
  } else if (responseNumber >= 5) {
    pacingDirective = `TURN ${responseNumber}/10 — PHASE 3: Stop asking. Summarise what you know. Include [OFFER_BUILD].\n${FORMAT_RULE}`;
  } else if (responseNumber >= 3) {
    pacingDirective = `TURN ${responseNumber}/10 — PHASE 2: If you have goal + target + situation → include [OFFER_BUILD]. Else ask ONE focused question.\n${FORMAT_RULE}`;
  } else {
    pacingDirective = `TURN ${responseNumber}/10 — PHASE 1: Get goal + target date/age. Do NOT include [OFFER_BUILD]. Ask for target if missing.\n${FORMAT_RULE}`;
  }

  const systemPrompt = `${pacingDirective}\n\n${getPromptForDomain(domain, groundingType)}`;
  const useTools = responseNumber >= 3 && !isLastTurn && toolsToUse.length > 0;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const TOOL_TIMEOUT_MS = 8000;

  let fullResponse = "";
  let iterations = 0;
  const MAX_ITERATIONS = useTools ? 2 : 1;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    retrievalCount.perTurn = 0;

    const createParams: Anthropic.Messages.MessageCreateParams = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: systemPrompt,
      messages,
    };
    if (useTools && iterations === 1) {
      createParams.tools = ANTHROPIC_TOOLS;
    }

    const response = await client.messages.create(createParams);
    let hasToolUse = false;
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        fullResponse += block.text;
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        callbacks.onToolStart(block.name, JSON.stringify(block.input));

        const tool = toolMap.get(block.name);
        let result: string;
        if (tool) {
          try {
            const out = await Promise.race([
              tool.invoke(block.input as Record<string, unknown>),
              new Promise<never>((_, rej) =>
                setTimeout(() => rej(new Error("Tool timeout")), TOOL_TIMEOUT_MS)
              ),
            ]);
            result = typeof out === "string" ? out : JSON.stringify(out);
          } catch (err) {
            result = JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${block.name}` });
        }

        callbacks.onToolEnd(block.name, result.substring(0, 300));
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

  if (!fullResponse.trim()) {
    fullResponse =
      "I ran into a hiccup — could you try again? Sometimes it just needs a second go.";
  }

  const offerBuild = fullResponse.includes("[OFFER_BUILD]");
  const readyToGenerate = fullResponse.includes("[READY_TO_GENERATE]");
  const cleanOutput = fullResponse
    .replace("[OFFER_BUILD]", "")
    .replace("[READY_TO_GENERATE]", "")
    .trim();

  // Extract target date/age if mentioned (simple heuristics for pathway builder)
  const targetDateMatch = cleanOutput.match(/by\s+(\w+\s+\d{4})/i) ||
    cleanOutput.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  const targetAgeMatch = cleanOutput.match(/by\s+(?:the\s+time\s+I'm\s+)?(\d+)/i) ||
    cleanOutput.match(/age\s+(\d+)/i);

  return {
    output: cleanOutput,
    readyToGenerate,
    offerBuild,
    inputLocked: isLastTurn,
    targetDate: targetDateMatch?.[1],
    targetAge: targetAgeMatch ? parseInt(targetAgeMatch[1], 10) : undefined,
    goalExtracted: undefined,
  };
}
