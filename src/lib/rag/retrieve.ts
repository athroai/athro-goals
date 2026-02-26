/**
 * RAG retrieval — returns top-k chunks for a domain.
 * Uses ingested gov.uk chunks (trusted) + static finance chunks.
 * Production: Voyage embeddings + pgvector.
 */

import type { GoalDomain } from "@/agents/router";
import { FINANCE_CHUNKS } from "./financeChunks";
import { INGESTED_GOVUK_CHUNKS } from "./ingestedChunks";

const MAX_CHUNKS = 5;
const MAX_RETRIEVALS_PER_CONVERSATION = 6;
const MAX_RETRIEVALS_PER_TURN = 2;

type ChunkInput = { content: string; source: string; sourceUrl?: string };

// Merge ingested gov.uk chunks with static chunks (ingested first for trust)
const ALL_FINANCE_CHUNKS: ChunkInput[] = [
  ...INGESTED_GOVUK_CHUNKS.map((c) => ({
    content: c.content,
    source: c.source,
    sourceUrl: c.sourceUrl,
  })),
  ...FINANCE_CHUNKS,
];

// Simple keyword scoring for MVP (no embeddings)
function scoreChunk(content: string, query: string): number {
  const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const c = content.toLowerCase();
  let score = 0;
  for (const word of q) {
    if (c.includes(word)) score += 1;
  }
  return score;
}

export function retrieveKnowledge(
  query: string,
  domain: GoalDomain,
  retrievalCount: { perConversation: number; perTurn: number }
): { chunks: Array<{ content: string; source: string; sourceUrl?: string }>; ok: boolean } {
  if (retrievalCount.perTurn >= MAX_RETRIEVALS_PER_TURN) {
    return { chunks: [], ok: false };
  }
  if (retrievalCount.perConversation >= MAX_RETRIEVALS_PER_CONVERSATION) {
    return { chunks: [], ok: false };
  }

  let chunks: Array<{ content: string; source: string; sourceUrl?: string }> = [];

  if (domain === "FINANCE") {
    const scored = ALL_FINANCE_CHUNKS.map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk.content, query),
    }));
    scored.sort((a, b) => b.score - a.score);
    chunks = scored
      .filter((c) => c.score > 0)
      .slice(0, MAX_CHUNKS)
      .map(({ content, source, sourceUrl }) => ({ content, source, sourceUrl }));
    // If no keyword match, return top 2 chunks by default
    if (chunks.length === 0) {
      chunks = ALL_FINANCE_CHUNKS.slice(0, 2).map((c) => ({
        content: c.content,
        source: c.source,
        sourceUrl: c.sourceUrl,
      }));
    }
  }

  return { chunks, ok: true };
}
