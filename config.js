// URL of the live-search Cloudflare Worker (see README → Live search setup).
window.LIVE_SEARCH_URL = "https://housing-live-search.karinaastridliving.workers.dev";

// "Search near a destination" (see README → Nearby search).
// Map provider: "tomtom" (free plan, no card to start) or "google".
window.MAP_PROVIDER = "tomtom";
window.TOMTOM_KEY = "qq6dmtzi447zdTKfgZa99AlYRGGz9ur6";       // TomTom key: Search, Routing (Matrix) and Map Display APIs
window.GOOGLE_MAPS_KEY = "";  // only if MAP_PROVIDER = "google"

// Sign-in + saved shortlists (Supabase, see README → Sign-in). The anon key is meant to be public: row-level security protects the data.
window.SUPABASE_URL = "https://zpvbtnsoenkdtvsuwzai.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_zSpG9V407eDhDAkeddIHjA_MwDVA3FJ"; // publishable key: meant to be public
window.ALLOWED_EMAIL_DOMAIN = "";    // "" = any email you add as a user; "astridliving.com" = only that domain
window.MIN_PASSWORD_LENGTH = 10;     // 6 allows 6-digit PINs (easier, but guessable)
window.AUTH_EMAIL_FEATURES = false;  // true: "Forgot password" / "Create account" send emails (needs a mail sender in Supabase). false: admin creates accounts and resets passwords, nothing is emailed
// Feedback button: responses are saved to Supabase (table "feedback", see supabase/feedback.sql). If Supabase is not set up,
// set an email address here and the button opens a pre-filled email instead ("" = no fallback).
window.FEEDBACK_EMAIL = "";
window.PHOTOS_URL = "https://astrid-photos.karinaastridliving.workers.dev";
