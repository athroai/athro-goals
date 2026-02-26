/**
 * Lifestyle / travel domain RAG chunks.
 * Generic advice that applies to any destination.
 * Destination-specific data (flights, places, costs) comes from web_search.
 */

import type { KnowledgeChunk } from "./financeChunks";

export const LIFESTYLE_CHUNKS: KnowledgeChunk[] = [
  {
    content: `Flights: Best value usually 3–6 months ahead, mid-week travel. Compare Skyscanner, Google Flights, Kayak. Long-haul: consider stopovers (often cheaper). Budget airlines for short-haul; full-service for long-haul often better value when including baggage.`,
    source: "Flight comparison",
    sourceUrl: "https://www.skyscanner.net",
  },
  {
    content: `Saving for travel: Set target date and total amount. Open dedicated savings account or use round-up apps. £200/month = £2,400/year; £400/month = £4,800/year. Book flights early for best prices. Consider travel insurance, vaccinations (fitfortravel.nhs.uk).`,
    source: "MoneyHelper / travel",
  },
  {
    content: `Travel budget (per person, 2 weeks): Flights vary by destination. Accommodation £30–150/night, food £25–60/day, local transport £10–50/day, activities £30–150/day. Research destination-specific costs. Use web search for current flight prices and accommodation.`,
    source: "Travel budgeting",
  },
  {
    content: `Visa and entry: UK passport holders — many destinations visa-free or visa-on-arrival. Check gov.uk/foreign-travel-advice and the destination's official immigration site. Apply early if visa required (can take weeks). eTA/ESTA for USA, Canada, Australia, NZ.`,
    source: "gov.uk travel",
    sourceUrl: "https://www.gov.uk/foreign-travel-advice",
  },
  {
    content: `Planning a trip: Research destination (best time to visit, must-sees, local transport). Book flights first, then accommodation. Allow buffer for activities and unexpected costs. Consider travel insurance, roaming, and notify bank of travel.`,
    source: "Travel planning",
  },
];
