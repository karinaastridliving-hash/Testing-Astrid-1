import Anthropic from "@anthropic-ai/sdk";

interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

interface Filters {
  city?: string; beds?: number | null; guests?: number; budget?: number;
  nights?: number; movein?: string; pets?: boolean; utilities?: boolean;
  amenities?: string[]; q?: string;
}

const SYSTEM = `You are a corporate-housing sourcing assistant. Use web search to find REAL, currently listed furnished / corporate / mid-term apartments that match the user's requirements.
Rules:
- Only report listings you actually found on a web page during this search. Never invent listings, prices or URLs.
- "url" must be the direct page of the listing (or the provider's page for that property).
- If a field is not stated on the page, use null. Do not guess.
- Prefer stays of 30+ nights. Return at most 8 listings. Be economical: run few, well-targeted searches (prefer provider sites such as Furnished Finder, Landing, Oakwood, Sentral, Corporate Housing by Owner), read the snippets, and stop as soon as you have enough matching listings. Keep "notes" under 15 words.
Respond with ONLY a JSON array (no prose, no code fences). Each item:
{"name":string,"provider":string,"city":string,"neighborhood":string|null,"beds":number|null,"baths":number|null,"sqft":number|null,"sleeps":number|null,"monthly":number|null,"minNights":number|null,"utilities":boolean|null,"petFriendly":boolean|null,"amenities":string[],"notes":string,"url":string}
"monthly" is the USD price per 30 days.`;

function describe(f: Filters): string {
  const lines = [
    `City / area: ${f.city || "any large US business city (ask nothing, pick the most relevant)"}`,
    f.beds === 0 ? "Layout: studio" : f.beds ? `Bedrooms: at least ${f.beds}` : "",
    f.guests ? `Guests: ${f.guests}` : "",
    f.budget && f.budget < 10000 ? `Max budget: $${f.budget} per month` : "",
    f.nights ? `Length of stay: ${f.nights} nights` : "",
    f.movein ? `Move-in date: ${f.movein}` : "",
    f.pets ? "Must be pet friendly" : "",
    f.utilities ? "Utilities must be included" : "",
    f.amenities?.length ? `Must have: ${f.amenities.join(", ")}` : "",
    f.q ? `Extra keywords: ${f.q}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors: Record<string, string> = {
      "Access-Control-Allow-Origin": allowed || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    if (allowed && origin !== allowed) return json({ error: "Origin not allowed" }, 403);

    let filters: Filters;
    try {
      filters = (await request.json()) as Filters;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: `Find corporate housing matching:\n${describe(filters)}` },
    ];

    try {
      let response: Anthropic.Message | undefined;
      // Web search runs server-side; a long search may pause the turn, so continue a few times.
      for (let i = 0; i < 2; i++) {
        response = await client.messages.create({
          model: "claude-haiku-5-5",
          max_tokens: 5000,
          system: SYSTEM,
          output_config: { effort: "low" },
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
          messages,
        });
        if (response.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: response.content });
      }
      if (!response) return json({ error: "No response" }, 502);
      if (response.stop_reason === "refusal") return json({ error: "The model declined this request." }, 422);

      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      return json({ listings: extractJsonArray(text) });
    } catch (err) {
      console.error("anthropic call failed", err);
      if (err instanceof Anthropic.RateLimitError) return json({ error: "Rate limited, try again shortly." }, 429);
      // Anthropic error messages never contain the API key, so it is safe to surface them for debugging.
      const detail = err instanceof Anthropic.APIError ? `${err.status ?? ""} ${err.message}`.trim() : String(err);
      return json({ error: "Search failed.", detail: detail.slice(0, 400) }, 502);
    }
  },
};
