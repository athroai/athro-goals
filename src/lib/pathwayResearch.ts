/**
 * Pathway research — Tavily web search for structure generation.
 * Extracts goal-specific queries and fetches live data (costs, providers, etc).
 * 5s timeout; proceeds without web data on failure.
 */

import { tavilySearch } from "@/lib/tavily";

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function extractSearchQueries(conversation: string, goal: string): string[] {
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

  const places = conversation.match(
    /\b(?:to|in|visit|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  );
  if (places && places.length > 0) {
    const destination = places[0].replace(/^(?:to|in|visit|from)\s+/i, "");
    if (!queries.some((q) => q.includes(destination))) {
      queries.push(`${destination} travel costs recommendations`);
    }
  }

  return queries.slice(0, 3);
}

export interface WebResearchResult {
  webResults: Array<{ title: string; url: string; snippet: string }>;
  webAnswer: string;
}

export async function fetchPathwayWebResearch(
  conversationSummary: string,
  goal: string
): Promise<WebResearchResult> {
  const searchQueries = extractSearchQueries(conversationSummary, goal);
  const webResults: Array<{ title: string; url: string; snippet: string }> = [];
  let webAnswer = "";

  if (process.env.TAVILY_API_KEY) {
    try {
      const tavilyTimeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Tavily timeout")), 5000)
      );
      const searches = await Promise.race([
        Promise.allSettled(
          searchQueries.map((q) => tavilySearch(q, { maxResults: 3 }))
        ),
        tavilyTimeout,
      ]) as PromiseSettledResult<Awaited<ReturnType<typeof tavilySearch>>>[];
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
    } catch {
      console.warn("Tavily search timed out, proceeding without web data");
    }
  }

  return { webResults, webAnswer };
}

export function buildResearchBlock(webResults: WebResearchResult): string {
  const { webResults: results, webAnswer } = webResults;
  if (results.length === 0) return "";

  let block = "\n\n## LIVE WEB RESEARCH\n";
  if (webAnswer) block += `Summary: ${webAnswer}\n`;
  for (const r of results.slice(0, 8)) {
    block += `\n[${r.title}](${r.url})\n${r.snippet}\n`;
  }
  return block;
}
