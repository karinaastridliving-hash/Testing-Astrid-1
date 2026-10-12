// URL of the live-search Cloudflare Worker (see README → Live search setup).
window.LIVE_SEARCH_URL = "https://housing-live-search.karinaastridliving.workers.dev";

// "Search near a destination" (see README → Nearby search).
// Map provider: "tomtom" (free plan, no card to start) or "google".
window.MAP_PROVIDER = "tomtom";
window.TOMTOM_KEY = "qq6dmtzi447zdTKfgZa99AlYRGGz9ur6";       // TomTom key: Search, Routing (Matrix) and Map Display APIs
window.GOOGLE_MAPS_KEY = "";  // only if MAP_PROVIDER = "google"

// Sign-in + saved shortlists (Supabase, see README → Sign-in). The anon key is meant to be public: row-level security protects the data.
window.SUPABASE_URL = "";
window.SUPABASE_ANON_KEY = "";
window.ALLOWED_EMAIL_DOMAIN = "astridliving.com";
window.MIN_PASSWORD_LENGTH = 10;     // 6 allows 6-digit PINs (easier, but guessable)
window.AUTH_EMAIL_FEATURES = true;  // true: "Forgot password" / "Create account" send emails (needs a mail sender in Supabase). false: admin creates accounts and resets passwords, nothing is emailed
