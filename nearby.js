// "Search near a destination": geocode the destination, find furnished-housing places around it,
// keep only those within the chosen drive time and show them on a map and in a list.
// Providers (config.js → MAP_PROVIDER): "tomtom" (default, free plan, no card) or "google".
//   tomtom: window.TOMTOM_KEY  (Search, Routing/Matrix and Map Display APIs)
//   google: window.GOOGLE_MAPS_KEY (Maps JavaScript API, Places API (New), Routes API)
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const PROVIDER = () => String(window.MAP_PROVIDER || "tomtom").toLowerCase();
  const KEYS = { tomtom: () => window.TOMTOM_KEY || "", google: () => window.GOOGLE_MAPS_KEY || "" };
  const KEY = () => (KEYS[PROVIDER()] ? KEYS[PROVIDER()]() : "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const CATEGORIES = ["furnished apartments", "furnished rentals", "furnished housing", "serviced apartments", "corporate apartments for rent", "aparthotels"];
  $("#nb-cats").innerHTML = CATEGORIES.map((c) => `<label class="check chip"><input type="checkbox" value="${esc(c)}" checked> ${esc(c[0].toUpperCase() + c.slice(1))}</label>`).join("");

  const status = (html) => { $("#nb-status").innerHTML = html; };

  async function google(url, fieldMask, body) {
    const KEY = () => window.GOOGLE_MAPS_KEY || "";
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

  async function gGeocode(text) {
    const d = await google("https://places.googleapis.com/v1/places:searchText", "places.displayName,places.formattedAddress,places.location", { textQuery: text, pageSize: 1 });
    const p = d && d.places && d.places[0];
    if (!p) throw new Error("Couldn't find that address. Try adding the city, e.g. “200 Park Ave, New York”.");
    return { lat: p.location.latitude, lng: p.location.longitude, label: p.formattedAddress || (p.displayName && p.displayName.text) || text };
  }

  async function gFindPlaces(dest, minutes, cats) {
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

  async function gDriveTimes(places, dest) {
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
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.GOOGLE_MAPS_KEY || "")}&callback=__nbMapsReady&v=weekly`;
      s.onerror = () => reject(new Error("Couldn't load Google Maps (check the key and its allowed website)."));
      document.head.appendChild(s);
    }));
  }

  async function gDrawMap(dest, results) {
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


  // ================= TomTom adapter (free plan, no card needed to start) =================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ttFetch(url, opts) {
    let res, data;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, opts);
      data = null;
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (res.status !== 429) break;
      await sleep(800 * (attempt + 1)); // free keys allow only a few requests per second: wait and retry
    }
    if (!res.ok) {
      const detail = data && (data.detailedError && data.detailedError.message || data.errorText || data.error || data.message);
      const hint = res.status === 403 || res.status === 401 ? " Check the TomTom key and that the Search, Routing and Map Display APIs are enabled for it." : res.status === 429 ? " Too many requests for the free plan (per second or per day). Wait a minute and try again." : "";
      throw new Error(`TomTom ${res.status}${detail ? ": " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}.${hint}`);
    }
    return data;
  }

  async function ttGeocode(text) {
    const d = await ttFetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(text)}.json?key=${encodeURIComponent(KEY())}&limit=1`);
    const r = d && d.results && d.results[0];
    if (!r) throw new Error("Couldn't find that address. Try adding the city, e.g. “200 Park Ave, New York”.");
    return { lat: r.position.lat, lng: r.position.lon, label: (r.address && r.address.freeformAddress) || text };
  }

  async function ttFindPlaces(dest, minutes, cats) {
    const radius = Math.min(50000, minutes * 1000);
    const found = new Map();
    for (const cat of cats) {
      const d = await ttFetch(`https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(cat)}.json?key=${encodeURIComponent(KEY())}&lat=${dest.lat}&lon=${dest.lng}&radius=${radius}&limit=50&relatedPois=off`);
      for (const r of (d && d.results) || []) {
        if (!r.position) continue;
        const poi = r.poi || {};
        let url = String(poi.url || "").trim();
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) url = ""; // only web links
        else if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
        const e = found.get(r.id) || { id: r.id, name: poi.name || "Unnamed place", address: (r.address && r.address.freeformAddress) || "", lat: r.position.lat, lng: r.position.lon, url, type: (poi.categories && poi.categories[0]) || "", cats: [] };
        if (!e.cats.includes(cat)) e.cats.push(cat);
        found.set(r.id, e);
      }
      await sleep(300);
    }
    return [...found.values()];
  }

  async function ttDriveTimes(places, dest) {
    await sleep(300);
    const pt = (lat, lng) => ({ point: { latitude: lat, longitude: lng } });
    for (let i = 0; i < places.length; i += 100) {
      const batch = places.slice(i, i + 100);
      const d = await ttFetch(`https://api.tomtom.com/routing/matrix/2?key=${encodeURIComponent(KEY())}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origins: batch.map((p) => pt(p.lat, p.lng)), destinations: [pt(dest.lat, dest.lng)], options: { routeType: "fastest", travelMode: "car" } }),
      });
      // v2 returns {data:[{originIndex, destinationIndex, routeSummary}]}; older shape is a 2-D "matrix"
      const cells = Array.isArray(d && d.data) ? d.data
        : Array.isArray(d && d.matrix) ? d.matrix.flatMap((row, oi) => row.map((c, di) => ({ originIndex: oi, destinationIndex: di, routeSummary: c.response && c.response.routeSummary, statusCode: c.statusCode }))) : [];
      for (const c of cells) {
        const sum = c.routeSummary;
        if (sum && sum.travelTimeInSeconds != null && batch[c.originIndex]) {
          batch[c.originIndex].minutes = Math.round(sum.travelTimeInSeconds / 60);
          batch[c.originIndex].km = (sum.lengthInMeters || 0) / 1000;
        }
      }
    }
  }

  // Leaflet (bundled in /vendor/leaflet) with TomTom map tiles
  let lmap, lgroup;
  function ttDrawMap(dest, results) {
    const L = window.L;
    if (!L) throw new Error("Map library didn't load.");
    if (!lmap) {
      lmap = L.map("nb-map", { scrollWheelZoom: false });
      L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${encodeURIComponent(KEY())}`, { maxZoom: 18, attribution: "© TomTom" }).addTo(lmap);
      lgroup = L.layerGroup().addTo(lmap);
    }
    lgroup.clearLayers();
    const pts = [[dest.lat, dest.lng]];
    L.marker([dest.lat, dest.lng], { icon: L.divIcon({ className: "nb-pin nb-home", html: "★", iconSize: [30, 30] }), zIndexOffset: 1000 }).bindPopup("<strong>Destination</strong>").addTo(lgroup);
    results.forEach((r, i) => {
      L.marker([r.lat, r.lng], { icon: L.divIcon({ className: "nb-pin", html: String(i + 1), iconSize: [26, 26] }) })
        .bindPopup(`<strong>${esc(r.name)}</strong><br>${esc(r.minutes)} min drive`).addTo(lgroup);
      pts.push([r.lat, r.lng]);
    });
    lmap.invalidateSize();
    lmap.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 15 });
  }

  const ADAPTERS = {
    tomtom: { name: "TomTom", geocode: ttGeocode, find: ttFindPlaces, drive: ttDriveTimes, draw: ttDrawMap },
    google: { name: "Google", geocode: gGeocode, find: gFindPlaces, drive: gDriveTimes, draw: gDrawMap },
  };
  const A = () => ADAPTERS[PROVIDER()] || ADAPTERS.tomtom;

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
        ${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${PROVIDER() === "google" ? "Google Maps" : "Website"} ↗</a>` : ""}
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
    btn.disabled = true; status("Searching…");
    try {
      const ck = JSON.stringify([PROVIDER(), text.toLowerCase(), minutes, cats]);
      const cache = store.get("chs.nearbyCache", {});
      let data = cache[ck] && Date.now() - cache[ck].t < 864e5 ? cache[ck] : null; // repeat search within 24h: no Google cost
      if (!data) {
        const dest = await A().geocode(text);
        status("Finding furnished options around " + esc(dest.label) + "…");
        const places = await A().find(dest, minutes, cats);
        status(`Checking drive times for ${places.length} places…`);
        await A().drive(places, dest);
        const within = places.filter((p) => p.minutes != null && p.minutes <= minutes).sort((a, b) => a.minutes - b.minutes);
        data = { t: Date.now(), dest, results: within, hidden: places.length - within.length };
        const keep = Object.entries(cache).filter(([, v]) => Date.now() - v.t < 864e5).slice(-9);
        store.set("chs.nearbyCache", Object.fromEntries(keep.concat([[ck, data]])));
      }
      $("#nb-out").hidden = false;
      renderList(data.dest, data.results, minutes, data.hidden);
      await A().draw(data.dest, data.results);
    } catch (err) {
      status("Search failed: " + esc(err.message));
    } finally { btn.disabled = false; }
  }

  function noKey(text, cats) {
    status(`Map search isn't connected yet (add a key in config.js, see README → Nearby search). In the meantime you can open the same searches in Google Maps: ` +
      cats.map((c) => `<a href="https://www.google.com/maps/search/${encodeURIComponent(c + " near " + text)}" target="_blank" rel="noopener noreferrer">${esc(c)} ↗</a>`).join(" · "));
  }

  $("#nb-go").addEventListener("click", run);
  $("#nb-dest").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
})();
