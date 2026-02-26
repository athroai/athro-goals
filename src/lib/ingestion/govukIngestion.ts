/**
 * Gov.uk Content API ingestion pipeline.
 * Fetches trusted content from gov.uk, chunks, and stores for RAG.
 * Run: npx tsx scripts/ingest-govuk.ts
 */

const GOVUK_API_BASE = "https://www.gov.uk/api/content";

export interface GovUkContentItem {
  base_path: string;
  title: string;
  document_type: string;
  details?: {
    body?: string;
    parts?: Array<{ body: string; title: string; slug: string }>;
  };
  web_url?: string;
  withdrawn_notice?: unknown;
}

export interface KnowledgeChunk {
  content: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

/** Finance-related gov.uk paths to ingest (Content API paths) */
export const GOVUK_FINANCE_PATHS = [
  "buying-a-home",
  "lifetime-isa",
  "stamp-duty-land-tax",
  "affordable-home-ownership-schemes",
  "shared-ownership-scheme",
] as const;

/** Strip HTML to plain text */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Chunk text into ~400 char chunks with 50 char overlap */
export function chunkText(
  text: string,
  sourceUrl: string,
  source: string,
  chunkSize = 400,
  overlap = 50
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return chunks;

  let start = 0;
  const fetchedAt = new Date().toISOString();

  while (start < cleaned.length) {
    let end = start + chunkSize;
    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    const slice = cleaned.slice(start, end).trim();
    if (slice.length > 50) {
      chunks.push({
        content: slice,
        source: `gov.uk — ${source}`,
        sourceUrl,
        fetchedAt,
      });
    }
    start = end - overlap;
    if (start >= cleaned.length) break;
  }

  return chunks;
}

/** Fetch a single page from gov.uk Content API */
export async function fetchGovUkPage(path: string): Promise<GovUkContentItem | null> {
  const url = `${GOVUK_API_BASE}/${path}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as GovUkContentItem;
  } catch {
    return null;
  }
}

/** Extract all text from a content item (guide with parts or single body) */
export function extractTextFromContent(item: GovUkContentItem): string {
  const parts: string[] = [];
  const details = item.details;

  if (details?.parts) {
    for (const part of details.parts) {
      if (part.body) parts.push(htmlToPlainText(part.body));
    }
  } else if (details?.body) {
    parts.push(htmlToPlainText(details.body));
  }

  return parts.join("\n\n");
}

/** Check if content is actually withdrawn (has explanation or withdrawn_at) */
function isWithdrawn(notice: unknown): boolean {
  if (!notice || typeof notice !== "object") return false;
  const n = notice as Record<string, unknown>;
  return !!(n.withdrawn_at || n.explanation);
}

/** Ingest a single path and return chunks */
export async function ingestPath(path: string): Promise<KnowledgeChunk[]> {
  const item = await fetchGovUkPage(path);
  if (!item || isWithdrawn(item.withdrawn_notice)) return [];

  const webUrl = item.web_url ?? `https://www.gov.uk${item.base_path}`;
  const text = extractTextFromContent(item);
  if (!text) return [];

  return chunkText(text, webUrl, item.title);
}

/** Ingest all finance paths */
export async function ingestAllFinance(): Promise<KnowledgeChunk[]> {
  const allChunks: KnowledgeChunk[] = [];

  for (const path of GOVUK_FINANCE_PATHS) {
    const chunks = await ingestPath(path);
    allChunks.push(...chunks);
  }

  return allChunks;
}
