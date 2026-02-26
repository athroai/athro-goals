/**
 * Runtime fetch from gov.uk Content API for tools.
 * Use for live, trusted content when tools are invoked.
 */

const GOVUK_API_BASE = "https://www.gov.uk/api/content";

export interface GovUkFetchResult {
  title: string;
  content: string;
  sourceUrl: string;
  ok: boolean;
}

/** Fetch gov.uk page and return plain-text content for tool use */
export async function fetchGovUkForTool(path: string): Promise<GovUkFetchResult> {
  const url = `${GOVUK_API_BASE}/${path}`;
  const webUrl = `https://www.gov.uk/${path}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { title: path, content: "", sourceUrl: webUrl, ok: false };
    }
    const data = (await res.json()) as {
      title?: string;
      details?: {
        body?: string;
        parts?: Array<{ body: string; title: string }>;
      };
      withdrawn_notice?: { withdrawn_at?: string; explanation?: string };
    };

    if (data.withdrawn_notice?.withdrawn_at) {
      return { title: data.title ?? path, content: "", sourceUrl: webUrl, ok: false };
    }

    const parts: string[] = [];
    if (data.details?.parts) {
      for (const p of data.details.parts) {
        if (p.body) parts.push(stripHtml(p.body));
      }
    } else if (data.details?.body) {
      parts.push(stripHtml(data.details.body));
    }

    const content = parts.join("\n\n");
    return {
      title: data.title ?? path,
      content,
      sourceUrl: webUrl,
      ok: content.length > 0,
    };
  } catch {
    return { title: path, content: "", sourceUrl: webUrl, ok: false };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
