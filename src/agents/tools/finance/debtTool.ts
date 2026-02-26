/**
 * Debt management — StepChange, IVA, DRO, breathing space.
 * Sources: StepChange (free advice), MoneyHelper, gov.uk. No gov.uk Content API for debt pages;
 * guidance is curated from trusted charities and official sources.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const DEBT_SOURCES = {
  stepChange: "https://www.stepchange.org/",
  moneyHelper: "https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt",
  govUkBreathing: "https://www.gov.uk/breathing-space",
  govUkDro: "https://www.gov.uk/government/publications/debt-relief-orders",
};

export const debtTool = new DynamicStructuredTool({
  name: "debt_management",
  description: `Get debt management options: StepChange, IVA, DRO, breathing space.
  Use when user discusses debt, getting out of debt, or debt solutions.`,
  schema: z.object({
    debtAmount: z.number().optional().describe("Approximate total debt in GBP"),
    query: z.string().optional().describe("Specific query e.g. IVA, DRO, breathing space"),
  }),
  func: async () => {
    return JSON.stringify({
      source: "StepChange, MoneyHelper, gov.uk",
      sourceUrls: DEBT_SOURCES,
      note: "Free debt advice: StepChange 0800 138 1111. This is information, not advice.",
      options: {
        breathingSpace: "60-day pause on interest and enforcement. Free. Apply via debt adviser. Source: gov.uk/breathing-space",
        debtManagementPlan: "Informal arrangement. Pay what you can afford. Free via StepChange.",
        IVA: "Individual Voluntary Arrangement. Formal, 5 years typically. Writes off remaining debt. Fees apply.",
        DRO: "Debt Relief Order. For debts under £30k, low income/assets. £90 fee. Lasts 12 months. Source: gov.uk",
        bankruptcy: "Last resort. Writes off most debts. Serious consequences.",
      },
      stepChange: "Free, impartial debt advice. stepchange.org",
      url: DEBT_SOURCES.stepChange,
    });
  },
});
