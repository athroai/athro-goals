/**
 * Tavily Search API — live web search for pathway research.
 * Use for flight costs, airlines, destinations, current prices.
 * Requires TAVILY_API_KEY. Free tier: 1000 searches/month.
 */

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  answer?: string;
}

export async function tavilySearch(
  query: string,
  options?: { maxResults?: number; searchDepth?: "basic" | "advanced" }
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      results: [],
      answer: "Web search unavailable (TAVILY_API_KEY not set).",
    };
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: options?.maxResults ?? 5,
        search_depth: options?.searchDepth ?? "basic",
        include_answer: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tavily API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      results?: TavilyResult[];
      answer?: string;
    };
    return {
      results: data.results ?? [],
      answer: data.answer,
    };
  } catch (err) {
    console.warn("Tavily search failed:", err);
    return {
      results: [],
      answer: err instanceof Error ? err.message : "Search failed",
    };
  }
}
