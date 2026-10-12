// URL of the live-search Cloudflare Worker (see README → Live search setup).
window.LIVE_SEARCH_URL = "https://housing-live-search.karinaastridliving.workers.dev";

// "Search near a destination" (see README → Nearby search).
// Map provider: "tomtom" (free plan, no card to start) or "google".
window.MAP_PROVIDER = "tomtom";
window.TOMTOM_KEY = "";       // TomTom key: Search, Routing (Matrix) and Map Display APIs
window.GOOGLE_MAPS_KEY = "";  // only if MAP_PROVIDER = "google"
