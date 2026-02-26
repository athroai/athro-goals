/**
 * Mortgage affordability — fetches live guidance from gov.uk Content API.
 * Source: gov.uk buying-a-home (trusted, official).
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchGovUkForTool } from "@/lib/ingestion/govukFetch";

export const mortgageAffordabilityTool = new DynamicStructuredTool({
  name: "mortgage_affordability",
  description: `Get mortgage affordability guidance: income multiples, stress-test rules, deposit requirements.
  Use when user discusses mortgage, buying a home, or deposit. Fetches from gov.uk (trusted source).`,
  schema: z.object({
    income: z.number().optional().describe("Annual income in GBP"),
    deposit: z.number().optional().describe("Deposit amount in GBP"),
    propertyPrice: z.number().optional().describe("Property price in GBP"),
  }),
  func: async () => {
    const { title, content, sourceUrl, ok } = await fetchGovUkForTool("buying-a-home");
    if (!ok || !content) {
      return JSON.stringify({
        source: "gov.uk",
        sourceUrl: "https://www.gov.uk/buying-a-home",
        note: "Could not fetch live content. See gov.uk/buying-a-home for mortgage guidance.",
        fallback: {
          incomeMultiple: "Lenders typically lend 4-4.5x annual income",
          deposit: "Minimum 5% deposit. First-time buyers: consider LISA (25% bonus).",
          url: "https://www.gov.uk/buying-a-home",
        },
      });
    }
    // Return overview + preparing-to-buy (most relevant for affordability)
    const sections = content.split(/\n\n+/);
    const relevant = sections.slice(0, 8).join("\n\n");
    return JSON.stringify({
      source: `gov.uk — ${title}`,
      sourceUrl,
      note: "This is information, not financial advice. Speak to a mortgage adviser.",
      guidance: relevant.slice(0, 2500),
      moneyHelper: "Work out how much you can afford: https://www.moneyhelper.org.uk/en/homes/buying-a-home/how-much-can-you-afford-to-borrow-for-a-mortgage",
    });
  },
});
