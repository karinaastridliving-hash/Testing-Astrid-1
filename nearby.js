// "Search near a destination": geocode the destination, find furnished-housing places around it with
// Google Places (New), keep only those within the chosen drive time (Google Routes), show them on a map.
// Needs window.GOOGLE_MAPS_KEY (config.js): a key restricted to this site, with Maps JavaScript API,
// Places API (New) and Routes API enabled.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const KEY = () => window.GOOGLE_MAPS_KEY || "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const CATEGORIES = ["furnished apartments", "furnished rentals", "furnished housing", "serviced apartments", "corporate apartments for rent", "aparthotels"];
  $("#nb-cats").innerHTML = CATEGORIES.map((c) => `<label class="check chip"><input type="checkbox" value="${esc(c)}" checked> ${esc(c[0].toUpperCase() + c.slice(1))}</label>`).join("");

  const status = (html) => { $("#nb-status").innerHTML = html; };

  async function google(url, fieldMask, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": fieldMask },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON error */ }
    if (!res.ok) {
      const e = data && (Array.isArray(data) ? data[0] : data).error;
      throw new Error(e ? `${e.message || "request failed"}${e.status ? " (" + e.status + ")" : ""}` : "Google request failed: HTTP " + res.status);
    }
    return data;
  }

  async function geocode(text) {
    const d = await google("https://places.googleapis.com/v1/places:searchText", "places.displayName,places.formattedAddress,places.location", { textQuery: text, pageSize: 1 });
    const p = d && d.places && d.places[0];
    if (!p) throw new Error("Couldn't find that address. Try adding the city, e.g. “200 Park Ave, New York”.");
    return { lat: p.location.latitude, lng: p.location.longitude, label: p.formattedAddress || (p.displayName && p.displayName.text) || text };
  }

  async function findPlaces(dest, minutes, cats) {
    const radius = Math.min(50000, minutes * 1000);
    const mask = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName";
    const found = new Map();
    await Promise.all(cats.map(async (cat) => {
      const d = await google("https://places.googleapis.com/v1/places:searchText", mask, {
        textQuery: cat, pageSize: 20,
        locationBias: { circle: { center: { latitude: dest.lat, longitude: dest.lng }, radius } },
      });
      for (const p of (d && d.places) || []) {
        const e = found.get(p.id) || { id: p.id, name: p.displayName ? p.displayName.text : "Unnamed place", address: p.formattedAddress || "", lat: p.location.latitude, lng: p.location.longitude, url: p.googleMapsUri || "", type: p.primaryTypeDisplayName ? p.primaryTypeDisplayName.text : "", cats: [] };
        if (!e.cats.includes(cat)) e.cats.push(cat);
        found.set(p.id, e);
      }
    }));
    return [...found.values()];
  }

  async function addDriveTimes(places, dest) {
    const wp = (lat, lng) => ({ waypoint: { location: { latLng: { latitude: lat, longitude: lng } } } });
    for (let i = 0; i < places.length; i += 100) {
      const batch = places.slice(i, i + 100);
      const d = await google("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", "originIndex,destinationIndex,duration,distanceMeters,condition", {
        origins: batch.map((p) => wp(p.lat, p.lng)), destinations: [wp(dest.lat, dest.lng)], travelMode: "DRIVE",
      });
      for (const el of Array.isArray(d) ? d : []) {
        if (el.condition === "ROUTE_EXISTS" && el.duration) {
          batch[el.originIndex].minutes = Math.round(parseInt(el.duration, 10) / 60);
          batch[el.originIndex].km = (el.distanceMeters || 0) / 1000;
        }
      }
    }
  }

  // ---- map ----
  let mapsLoading;
  function loadMaps() {
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();
    return (mapsLoading ||= new Promise((resolve, reject) => {
      window.__nbMapsReady = resolve;
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY())}&callback=__nbMapsReady&v=weekly`;
      s.onerror = () => reject(new Error("Couldn't load Google Maps (check the key and its allowed website)."));
      document.head.appendChild(s);
    }));
  }

  async function drawMap(dest, results) {
    await loadMaps();
    const g = window.google.maps;
    const map = new g.Map($("#nb-map"), { center: { lat: dest.lat, lng: dest.lng }, zoom: 11, mapTypeControl: false, streetViewControl: false });
    const bounds = new g.LatLngBounds();
    const info = new g.InfoWindow();
    const dm = new g.Marker({ position: { lat: dest.lat, lng: dest.lng }, map, title: "Destination", zIndex: 999, icon: { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: "#34506c", fillOpacity: 1, strokeColor: "#c1a463", strokeWeight: 4 } });
    bounds.extend(dm.getPosition());
    results.forEach((r, i) => {
      const m = new g.Marker({ position: { lat: r.lat, lng: r.lng }, map, title: r.name, label: { text: String(i + 1), color: "#fff", fontSize: "11px" } });
      m.addListener("click", () => { info.setContent(`<strong>${esc(r.name)}</strong><br>${esc(r.minutes)} min drive`); info.open({ map, anchor: m }); });
      bounds.extend(m.getPosition());
    });
    if (results.length) map.fitBounds(bounds, 40);
  }

  // ---- render ----
  function renderList(dest, results, minutes, hidden) {
    $("#nb-title").textContent = `Within ${minutes} min drive of ${dest.label}`;
    $("#nb-list").innerHTML = results.length ? results.map((r, i) => `<article class="nb-item">
        <div class="nb-n">${i + 1}</div>
        <div class="nb-main">
          <h3>${esc(r.name)}</h3>
          <div class="meta">${esc(r.address)}</div>
          <div class="tags"><span class="tag ok">${esc(r.minutes)} min · ${r.km.toFixed(1)} km</span>${r.type ? `<span class="tag">${esc(r.type)}</span>` : ""}${r.cats.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
        </div>
        ${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ""}
      </article>`).join("") : `<p class="empty">Nothing found within ${minutes} minutes. Try a longer drive time or more search terms.</p>`;
    status(`${results.length} place${results.length === 1 ? "" : "s"} within ${minutes} min` + (hidden ? ` (${hidden} farther away hidden)` : "") + `. Drive times are typical, without live traffic. Check availability and rates with each provider.`);
  }

  async function run() {
    const text = $("#nb-dest").value.trim();
    const minutes = +$("#nb-minutes").value;
    const cats = [...document.querySelectorAll("#nb-cats input:checked")].map((i) => i.value);
    if (!text) return status("Enter the destination first (the client's office, site or address).");
    if (!cats.length) return status("Tick at least one search term.");
    if (!KEY()) return noKey(text, cats);
    const btn = $("#nb-go");
    btn.disabled = true; status("Searching Google Maps…");
    try {
      const ck = JSON.stringify([text.toLowerCase(), minutes, cats]);
      const cache = store.get("chs.nearbyCache", {});
      let data = cache[ck] && Date.now() - cache[ck].t < 864e5 ? cache[ck] : null; // repeat search within 24h: no Google cost
      if (!data) {
        const dest = await geocode(text);
        status("Finding furnished options around " + esc(dest.label) + "…");
        const places = await findPlaces(dest, minutes, cats);
        status(`Checking drive times for ${places.length} places…`);
        await addDriveTimes(places, dest);
        const within = places.filter((p) => p.minutes != null && p.minutes <= minutes).sort((a, b) => a.minutes - b.minutes);
        data = { t: Date.now(), dest, results: within, hidden: places.length - within.length };
        const keep = Object.entries(cache).filter(([, v]) => Date.now() - v.t < 864e5).slice(-9);
        store.set("chs.nearbyCache", Object.fromEntries(keep.concat([[ck, data]])));
      }
      $("#nb-out").hidden = false;
      renderList(data.dest, data.results, minutes, data.hidden);
      await drawMap(data.dest, data.results);
    } catch (err) {
      status("Search failed: " + esc(err.message));
    } finally { btn.disabled = false; }
  }

  function noKey(text, cats) {
    status(`Google Maps isn't connected yet (see README → Nearby search). In the meantime you can open the same searches in Google Maps: ` +
      cats.map((c) => `<a href="https://www.google.com/maps/search/${encodeURIComponent(c + " near " + text)}" target="_blank" rel="noopener noreferrer">${esc(c)} ↗</a>`).join(" · "));
  }

  $("#nb-go").addEventListener("click", run);
  $("#nb-dest").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
})();
