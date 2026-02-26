/**
 * ISA / LISA rules — fetches live guidance from gov.uk Content API.
 * Source: gov.uk lifetime-isa (trusted, official).
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchGovUkForTool } from "@/lib/ingestion/govukFetch";

export const isaTool = new DynamicStructuredTool({
  name: "isa_lisa_rules",
  description: `Get ISA and Lifetime ISA (LISA) rules: allowances, bonuses, first-time buyer use.
  Use when user discusses savings, first-time buyer, or LISA for mortgage. Fetches from gov.uk (trusted source).`,
  schema: z.object({
    query: z.enum(["isa_allowance", "lisa_rules", "lisa_first_time_buyer"]).optional(),
  }),
  func: async () => {
    const { title, content, sourceUrl, ok } = await fetchGovUkForTool("lifetime-isa");
    if (!ok || !content) {
      return JSON.stringify({
        source: "gov.uk",
        sourceUrl: "https://www.gov.uk/lifetime-isa",
        note: "This is information, not financial advice.",
        fallback: {
          lisa: { maxContribution: "£4,000/year", bonus: "25%", firstTimeBuyer: "Up to £450k" },
          url: "https://www.gov.uk/lifetime-isa",
        },
      });
    }
    return JSON.stringify({
      source: `gov.uk — ${title}`,
      sourceUrl,
      note: "This is information, not financial advice.",
      guidance: content.slice(0, 3000),
    });
  },
});
