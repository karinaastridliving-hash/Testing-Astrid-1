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

## Nearby search (TomTom or Google)

"Search near a destination" geocodes the destination, searches for *furnished apartments, furnished rentals, furnished housing, serviced apartments, corporate apartments for rent* and *aparthotels* around it, keeps only results within the chosen drive time (typical drive time, no live traffic) and shows them on a map and in a list. Choose the provider in `config.js` with `window.MAP_PROVIDER`.

**TomTom (default; free plan, no card needed to start as far as we know)**
1. Sign up at https://developer.tomtom.com and open the Dashboard → API keys.
2. Make sure the key allows the **Search**, **Routing (Matrix Routing)** and **Map Display** APIs. If the dashboard offers an allowed-websites setting, add `https://karinaastridliving-hash.github.io`.
3. Put the key in `config.js` as `window.TOMTOM_KEY`, commit and push.

**Google (better coverage of serviced/corporate apartments, needs a billing account)**
Set `window.MAP_PROVIDER = "google"` and `window.GOOGLE_MAPS_KEY`. In Google Cloud enable *Maps JavaScript API*, *Places API (New)* and *Routes API*, create an API key, restrict it to `https://karinaastridliving-hash.github.io/*` and to those three APIs, and set a budget alert and quota caps.

A browser key is visible to anyone who views the site, so restrict it where the provider allows. Without a key the panel shows links that open the same searches in Google Maps. The same search repeated within 24 hours is served from the browser cache and costs nothing. The map uses Leaflet (bundled in `vendor/leaflet`, BSD-2 licence).

## Sign-in and saved shortlists (Supabase)

Without sign-in, a shortlist lives in one browser. With sign-in, each person has an account (work email + password), and their shortlist is saved privately to it and follows them across devices. Accounts are created by an administrator (any email address) and self sign-up is turned off; set `ALLOWED_EMAIL_DOMAIN` in `config.js` only if you also want to restrict by domain. Nobody sees anyone else's shortlist. The Astrid inventory itself stays public. The sign-in button only appears once `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `config.js`.

**Setup (about 15 minutes, free plan)**
1. Create a project at https://supabase.com (name e.g. `astrid-sourcing`).
2. SQL Editor → New query → paste `supabase/setup.sql` → Run. This creates the shortlist table and makes each row private to its owner.
3. Project Settings → API: copy the **Project URL** and the **anon / publishable key** into `config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). The anon key is meant to be public; the table rules above protect the data. Never put the `service_role` key in the site.
4. Authentication → URL Configuration: set **Site URL** to `https://karinaastridliving-hash.github.io/Testing-Astrid-1/` and add the same address under **Redirect URLs**.
5. Authentication → Sign In / Providers → Email: keep Email enabled, set the minimum password length (10 recommended).

**Two ways to run it** (`AUTH_EMAIL_FEATURES` in `config.js`)
- `true` (default): people can **create their own account** and use **"Forgot password?"**; both send an email (confirmation / reset link). Supabase's built-in email sender is only for testing (very low hourly limit and, as far as we know, limited recipients), so for the whole company connect a mail sender: Authentication → Emails → SMTP Settings (for example Resend, or your company's SMTP).
- `false`: **nothing is ever emailed.** In Authentication → Sign In / Providers turn **off** "Allow new users to sign up" and **off** "Confirm email". You create each person under Authentication → Users → Add user (email + password, tick "Auto Confirm User") and reset passwords there when someone forgets. Set `MIN_PASSWORD_LENGTH = 6` only if you accept 6-digit PINs (easy to guess; not recommended).

## Astrid inventory (`inventory.csv`)

`inventory.csv` is loaded automatically when the site opens and is shown as "Astrid inventory" (the sample data is then hidden). It was built on 2026-10-12 from two sources:

- the Hosteeva "Property Search" export (839 properties: name, city, bedrooms, bathrooms, FAQ link), and
- Astrid's own public property pages (540 pages listed in `sitemap.xml`; same property IDs): map coordinates, photo, description, sleeps, amenities, pet policy, check-in/out and minimum age.

Properties are joined by property ID. 128 properties that are on the website but not in the export were added. Rules used: every Astrid property is tagged *Furnished* (Astrid's site describes its business as furnished apartments); amenities are normalised to the filter names and the website's own labels are kept; "sleeps 1" on the website is treated as unknown (it looks like a default); coordinates of 0,0 or far outside the property's city are dropped (16 properties); photos that are the website's grey placeholder are skipped. Neither source has rates, minimum stay, size or utilities, so those show as unknown ("Price on request", "—") instead of guessed values.

Properties with coordinates also appear (grouped by building) in "Search near a destination". To update the inventory, replace `inventory.csv` using the same columns as below plus `lat,lng,image,description`.

## Data

`data.js` holds **fictional sample listings**. Add real ones with the "Add listing" button or "Import CSV".
User-added data is stored in your browser's localStorage (per device).

CSV columns (header row required, extra columns ignored):

`name,provider,city,neighborhood,beds,baths,sqft,sleeps,monthly,minNights,utilities,petFriendly,amenities,notes` (optional extras: `url,lat,lng,image,description`)

`utilities` / `petFriendly` accept yes/true/1; `amenities` is separated by `;` or `,` (quote the cell if using commas).

## Next steps

Pulling live inventory needs a backend and provider APIs / partner feeds (most corporate housing providers don't offer public APIs; scraping typically violates their terms).
