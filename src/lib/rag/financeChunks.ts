/**
 * Finance domain RAG chunks — seed content for MVP.
 * In production: ingest from gov.uk, MoneyHelper, StepChange via pipeline.
 * Chunk size ~300-500 tokens, overlap 50.
 */

export interface KnowledgeChunk {
  content: string;
  source: string;
  sourceUrl?: string;
}

export const FINANCE_CHUNKS: KnowledgeChunk[] = [
  {
    content: `Mortgage affordability: Lenders typically use income multiples of 4-4.5x your annual income. Some lenders offer up to 5.5x for higher earners. You'll need a minimum 5% deposit (95% loan-to-value). First-time buyers can use a Lifetime ISA for a 25% government bonus on savings up to £4,000 per year. Stress-test: lenders check you can afford repayments at a higher rate (usually 3% above your product rate).`,
    source: "MoneyHelper / gov.uk",
    sourceUrl: "https://www.moneyhelper.org.uk/en/homes/buying-a-home/mortgages",
  },
  {
    content: `Lifetime ISA (LISA) for first-time buyers: Open between 18-39. Contribute up to £4,000 per tax year. Government adds 25% bonus (max £1,000/year). Use for first home up to £450,000. Must buy with a mortgage. Withdrawing for non-qualifying reason incurs 25% penalty. ISA allowance: £20,000 total across all ISAs per tax year.`,
    source: "gov.uk",
    sourceUrl: "https://www.gov.uk/lifetime-isa",
  },
  {
    content: `Getting out of debt: StepChange offers free, impartial debt advice (0800 138 1111). Options: Breathing Space (60-day pause, free), Debt Management Plan (pay what you can afford), IVA (Individual Voluntary Arrangement, formal 5-year plan), DRO (Debt Relief Order for debts under £30k, low income). Never pay for debt advice upfront — free help is available.`,
    source: "StepChange / MoneyHelper",
    sourceUrl: "https://www.stepchange.org/",
  },
  {
    content: `Mortgage timeline: From first decision to completion typically 3-6 months. Steps: 1) Get agreement in principle (1-2 days). 2) Find property, make offer. 3) Full application, valuation, conveyancing (8-12 weeks). 4) Exchange and completion. First-time buyers: allow extra time for LISA withdrawal (can take days), mortgage offer validity (usually 3-6 months).`,
    source: "MoneyHelper",
    sourceUrl: "https://www.moneyhelper.org.uk/en/homes/buying-a-home",
  },
  {
    content: `Stamp duty (England): First-time buyers pay no stamp duty on first £425,000 (property up to £625k). Above that, 5% on portion £425k-£625k. Non-first-time buyers: 0% up to £250k, 5% on £250k-£925k, 10% on £925k-£1.5m. Wales: Land Transaction Tax (different bands). Scotland: Land and Buildings Transaction Tax.`,
    source: "gov.uk",
    sourceUrl: "https://www.gov.uk/stamp-duty-land-tax",
  },
  {
    content: `Saving for a mortgage deposit: Aim for 10-15% for better rates. LISA gives 25% bonus. Help to Buy ISA closed to new applicants. Regular savers: compare rates. Typical first-time buyer deposit (UK): around £30,000-£50,000 depending on region. London higher. Use a budget to work out how much you can save monthly.`,
    source: "MoneyHelper",
  },
];
