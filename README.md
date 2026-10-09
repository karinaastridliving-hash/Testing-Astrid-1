# Corporate Housing Sourcer

A single-page sourcing tool for finding and comparing corporate / furnished apartments. No build step, no backend.

## Run

```
python3 -m http.server 8000   # then open http://localhost:8000
```

(Or just open `index.html` in a browser.)

## Features

- Filter by city, bedrooms, guests, budget, provider, amenities, pets, utilities; text search
- Enter nights to hide listings whose minimum stay is too long and see an estimated stay cost
- Sort by price, size, or price per sq ft
- Shortlist listings, compare side by side, export to CSV
- One-click "Copy inquiry email" to send to providers
- Add listings by hand, or import a CSV

## Live search and inventory feed

- **Inventory feed:** click "Inventory feed" and paste a CSV link (e.g. a Google Sheet published to the web). Listings reload from it each time the page opens, so the team updates the sheet and the site follows. Same columns as the CSV import below.
- **Live search button:** asks Claude (with web search) to find real listings for your filters. Needs the small backend in `worker/` — see below.

## Live search setup (Cloudflare Worker + Anthropic API key)

1. Create an API key at https://console.anthropic.com and **set a monthly spend limit** there. Each live search runs several web searches and costs real money (billed per token plus per web search; check current pricing).
2. Install Node.js, then in a terminal:
   ```
   cd worker
   npm install
   npx wrangler login                      # free Cloudflare account
   npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
   npx wrangler deploy
   ```
3. Wrangler prints a URL like `https://housing-live-search.<you>.workers.dev`. Paste it into `config.js` as `window.LIVE_SEARCH_URL`, commit, push.
4. If your site isn't at `https://karinaastridliving-hash.github.io`, edit `ALLOWED_ORIGIN` in `worker/wrangler.toml` and redeploy.

Cost controls: the worker uses Claude Haiku 5.5 with low effort, at most 4 web searches and 5,000 output tokens per request, and the site caches identical searches in the browser for 24 hours (repeat searches are free). Tune `model`, `max_uses` and `effort` in `worker/src/index.ts`.

Notes: results are AI-gathered from public web pages and **must be verified** on the source page (price, availability, terms). The worker only accepts requests from `ALLOWED_ORIGIN`, but that is not strong protection: keep the spend limit on.

## Data

`data.js` holds **fictional sample listings**. Add real ones with the "Add listing" button or "Import CSV".
User-added data is stored in your browser's localStorage (per device).

CSV columns (header row required, extra columns ignored):

`name,provider,city,neighborhood,beds,baths,sqft,sleeps,monthly,minNights,utilities,petFriendly,amenities,notes`

`utilities` / `petFriendly` accept yes/true/1; `amenities` is separated by `;` or `,` (quote the cell if using commas).

## Next steps

Pulling live inventory needs a backend and provider APIs / partner feeds (most corporate housing providers don't offer public APIs; scraping typically violates their terms).
