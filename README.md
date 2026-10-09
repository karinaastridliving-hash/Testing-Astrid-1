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

## Data

`data.js` holds **fictional sample listings**. Add real ones with the "Add listing" button or "Import CSV".
User-added data is stored in your browser's localStorage (per device).

CSV columns (header row required, extra columns ignored):

`name,provider,city,neighborhood,beds,baths,sqft,sleeps,monthly,minNights,utilities,petFriendly,amenities,notes`

`utilities` / `petFriendly` accept yes/true/1; `amenities` is separated by `;` or `,` (quote the cell if using commas).

## Next steps

Pulling live inventory needs a backend and provider APIs / partner feeds (most corporate housing providers don't offer public APIs; scraping typically violates their terms).
