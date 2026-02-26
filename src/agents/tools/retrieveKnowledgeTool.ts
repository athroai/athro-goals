/**
 * retrieve_knowledge — RAG tool for domain agents.
 * Max 2 calls per turn, 6 per conversation. ~£0.001 per call.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieveKnowledge } from "@/lib/rag/retrieve";
import type { GoalDomain } from "@/agents/router";

export function createRetrieveKnowledgeTool(
  domain: GoalDomain,
  getRetrievalCount: () => { perConversation: number; perTurn: number },
  incrementRetrieval: () => void
) {
  return new DynamicStructuredTool({
    name: "retrieve_knowledge",
    description: `Search the knowledge base for guidelines, regulations, and how-to information about ${domain.toLowerCase()} goals. Use when you need specific facts, steps, or rules. Do NOT use for live data (use other tools). Max 2 calls per turn.`,
    schema: z.object({
      query: z.string().describe("Search query e.g. 'mortgage affordability rules' or 'LISA first time buyer'"),
    }),
    func: async ({ query }) => {
      const count = getRetrievalCount();
      const { chunks, ok } = retrieveKnowledge(query, domain, count);
      if (!ok) {
        return JSON.stringify({
          error: "Retrieval limit reached for this conversation.",
          chunks: [],
        });
      }
      incrementRetrieval();
      return JSON.stringify({
        chunks: chunks.map((c) => ({
          content: c.content,
          source: c.source,
          sourceUrl: c.sourceUrl,
        })),
        note: "Only use information from these chunks. If a chunk doesn't answer the question, say you don't have specific data.",
      });
    },
  });
}
