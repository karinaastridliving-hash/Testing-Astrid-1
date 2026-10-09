(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  let userListings = store.get("chs.user", []);
  let shortlist = new Set(store.get("chs.short", []));
  const AMENITIES = ["Furnished", "Gym", "Pool", "Parking", "Washer/Dryer", "Concierge", "Doorman", "Wi-Fi"];

  let feedListings = [];
  let liveListings = [];
  const all = () => liveListings.concat(feedListings, userListings, store.get("chs.hideSample", false) ? [] : window.SAMPLE_LISTINGS);

  const money = (n) => "$" + Math.round(n).toLocaleString();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bedLabel = (b) => (b === 0 ? "Studio" : b + " BR");
  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); };

  // ---------- filters ----------
  function buildFilterOptions() {
    const list = all();
    const fill = (sel, vals) => {
      const cur = sel.value;
      sel.length = 1;
      [...new Set(vals)].filter(Boolean).sort().forEach((v) => sel.add(new Option(v, v)));
      sel.value = cur;
    };
    fill($("#f-city"), list.map((l) => l.city));
    fill($("#f-provider"), list.map((l) => l.provider));
  }
  $("#f-amenities").innerHTML = AMENITIES.map((a) => `<label class="check"><input type="checkbox" value="${a}"> ${a}</label>`).join("");

  function filters() {
    return {
      q: $("#f-q").value.trim().toLowerCase(),
      city: $("#f-city").value,
      nights: +$("#f-nights").value || 0,
      beds: $("#f-beds").value === "" ? null : +$("#f-beds").value,
      guests: +$("#f-guests").value || 0,
      budget: +$("#f-budget").value,
      provider: $("#f-provider").value,
      pets: $("#f-pets").checked,
      util: $("#f-util").checked,
      amenities: [...document.querySelectorAll("#f-amenities input:checked")].map((i) => i.value),
    };
  }

  function matches(l, f) {
    if (f.q && !`${l.name} ${l.neighborhood} ${l.provider} ${l.city}`.toLowerCase().includes(f.q)) return false;
    if (f.city && l.city !== f.city) return false;
    if (f.nights && l.minNights > f.nights) return false;
    if (f.beds !== null && l.beds < f.beds) return false;
    if (f.guests && l.sleeps < f.guests) return false;
    if (f.budget < 10000 && l.monthly > f.budget) return false;
    if (f.provider && l.provider !== f.provider) return false;
    if (f.pets && !l.petFriendly) return false;
    if (f.util && !l.utilities) return false;
    return f.amenities.every((a) => l.amenities.includes(a));
  }

  const sorters = {
    "price-asc": (a, b) => (a.monthly || Infinity) - (b.monthly || Infinity),
    "price-desc": (a, b) => b.monthly - a.monthly,
    "size-desc": (a, b) => (b.sqft || 0) - (a.sqft || 0),
    "ppsf-asc": (a, b) => (a.sqft ? a.monthly / a.sqft : Infinity) - (b.sqft ? b.monthly / b.sqft : Infinity),
  };

  // ---------- results ----------
  function render() {
    const f = filters();
    $("#o-budget").textContent = f.budget >= 10000 ? "Any" : money(f.budget);
    const rows = all().filter((l) => matches(l, f)).sort(sorters[$("#f-sort").value]);
    $("#count").textContent = `${rows.length} listing${rows.length === 1 ? "" : "s"}`;
    $("#cards").innerHTML = rows.length
      ? rows.map((l) => card(l, f)).join("")
      : `<p class="empty">No listings match. Try loosening your filters.</p>`;
    $("#short-count").textContent = shortlist.size;
    $(".notice").hidden = store.get("chs.hideSample", false);
  }

  function card(l, f) {
    const total = f.nights ? `<div class="meta">≈ ${money((l.monthly / 30) * f.nights)} for ${f.nights} nights</div>` : "";
    const tags = [l.live ? `<span class="tag warn">Found online – verify</span>` : "", l.utilities ? `<span class="tag ok">Utilities incl.</span>` : "", l.petFriendly ? `<span class="tag ok">Pets OK</span>` : ""]
      .concat(l.amenities.map((a) => `<span class="tag">${esc(a)}</span>`)).join("");
    const on = shortlist.has(l.id);
    return `<article class="card">
      <div class="hero" style="background:linear-gradient(135deg,hsl(${hue(l.city)} 55% 40%),hsl(${(hue(l.city) + 50) % 360} 55% 30%))">${esc(l.city)}${l.neighborhood ? " · " + esc(l.neighborhood) : ""}</div>
      <div class="body">
        <h3>${esc(l.name)}</h3>
        <div class="meta">${bedLabel(l.beds)} · ${l.baths} BA${l.sqft ? " · " + l.sqft + " sq ft" : ""} · sleeps ${l.sleeps}</div>
        <div class="price">${l.monthly ? money(l.monthly) + ` <small>/ month · ${money(l.monthly / 30)}/night</small>` : "<small>Price on request</small>"}</div>
        ${total}
        <div class="meta">${esc(l.provider || "Unknown provider")} · min ${l.minNights} nights</div>
        <div class="tags">${tags}</div>
        ${l.notes ? `<div class="meta">${esc(l.notes)}</div>` : ""}
      </div>
      <div class="foot">
        <span class="meta">${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">View listing ↗</a>` : l.sqft ? "$" + (l.monthly / l.sqft).toFixed(2) + "/sq ft" : ""}</span>
        <button class="btn ${on ? "primary" : ""}" data-short="${esc(l.id)}">${on ? "✓ Shortlisted" : "+ Shortlist"}</button>
      </div></article>`;
  }

  // ---------- shortlist ----------
  const shortItems = () => all().filter((l) => shortlist.has(l.id));
  function saveShort() { store.set("chs.short", [...shortlist]); }

  function renderShortlist() {
    const items = shortItems();
    if (!items.length) { $("#short-body").innerHTML = `<p class="empty">Nothing shortlisted yet.</p>`; return; }
    const min = Math.min(...items.map((l) => l.monthly));
    const row = (label, fn, cls) => `<tr><th>${label}</th>${items.map((l) => `<td class="${cls ? cls(l) : ""}">${fn(l)}</td>`).join("")}</tr>`;
    $("#short-body").innerHTML = `<div class="tablewrap"><table>
      ${row("", (l) => `<strong>${esc(l.name)}</strong><br><button class="btn" data-short="${esc(l.id)}">Remove</button>`)}
      ${row("Location", (l) => esc(l.city + (l.neighborhood ? " · " + l.neighborhood : "")))}
      ${row("Monthly", (l) => money(l.monthly), (l) => (l.monthly === min ? "best" : ""))}
      ${row("Per night", (l) => money(l.monthly / 30))}
      ${row("Layout", (l) => `${bedLabel(l.beds)} / ${l.baths} BA${l.sqft ? " / " + l.sqft + " sq ft" : ""}`)}
      ${row("Sleeps", (l) => l.sleeps)}
      ${row("Min stay", (l) => l.minNights + " nights")}
      ${row("Utilities", (l) => (l.utilities ? "Included" : "Extra"))}
      ${row("Pets", (l) => (l.petFriendly ? "Yes" : "No"))}
      ${row("Provider", (l) => esc(l.provider))}
      ${row("Amenities", (l) => esc(l.amenities.join(", ")))}
    </table></div>`;
  }

  function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  const COLS = ["name", "provider", "city", "neighborhood", "beds", "baths", "sqft", "sleeps", "monthly", "minNights", "utilities", "petFriendly", "amenities", "notes"];

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  function inquiryText() {
    const f = filters();
    const move = $("#f-movein").value;
    const lines = shortItems().map((l) => `- ${l.name} (${l.city}${l.neighborhood ? ", " + l.neighborhood : ""}) — ${bedLabel(l.beds)}, listed at ${money(l.monthly)}/month`);
    return `Hi,\n\nI'm sourcing corporate housing and am interested in the following:\n\n${lines.join("\n")}\n\nRequirements:\n- Move-in: ${move || "[date]"}\n- Length of stay: ${f.nights ? f.nights + " nights" : "[nights]"}\n- Guests: ${f.guests || "[#]"}\n\nCould you confirm availability, all-in pricing (taxes, fees, utilities, parking), cancellation / early-termination terms, and invoicing options for corporate billing?\n\nThank you,`;
  }

  // ---------- add / import ----------
  function addListing(obj) {
    userListings.push(obj);
    store.set("chs.user", userListings);
    buildFilterOptions();
    render();
  }

  function normalize(o) {
    const bool = (v) => v === true || /^(true|yes|y|1)$/i.test(String(v).trim());
    const amen = Array.isArray(o.amenities) ? o.amenities : String(o.amenities || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const monthly = +o.monthly;
    if (!o.name || !o.city || !(monthly >= 0) || o.monthly === "") return null;
    return {
      id: "u" + Date.now() + Math.random().toString(36).slice(2, 7),
      name: String(o.name).trim(), provider: String(o.provider || "").trim(), city: String(o.city).trim(), neighborhood: String(o.neighborhood || "").trim(),
      beds: +o.beds || 0, baths: +o.baths || 1, sqft: +o.sqft || 0, sleeps: +o.sleeps || 2, monthly, minNights: +o.minNights || 30,
      utilities: bool(o.utilities), petFriendly: bool(o.petFriendly), amenities: amen, notes: String(o.notes || "").trim(), imported: true, url: /^https?:\/\//.test(o.url || "") ? o.url : "",
    };
  }

  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-short]");
    if (!b) return;
    const id = b.dataset.short;
    shortlist.has(id) ? shortlist.delete(id) : shortlist.add(id);
    saveShort(); render();
    if ($("#dlg-short").open) renderShortlist();
  });

  ["#f-q", "#f-city", "#f-nights", "#f-beds", "#f-guests", "#f-budget", "#f-provider", "#f-pets", "#f-util", "#f-sort"].forEach((s) => $(s).addEventListener("input", render));
  $("#f-amenities").addEventListener("change", render);
  $("#btn-reset").addEventListener("click", () => {
    document.querySelectorAll(".filters input, .filters select").forEach((el) => {
      if (el.type === "checkbox") el.checked = false; else if (el.type === "range") el.value = el.max; else el.value = "";
    });
    render();
  });

  $("#btn-shortlist").addEventListener("click", () => { renderShortlist(); $("#dlg-short").showModal(); });
  $("#btn-clear-short").addEventListener("click", () => { shortlist.clear(); saveShort(); renderShortlist(); render(); });
  $("#btn-compare-csv").addEventListener("click", () => {
    const items = shortItems();
    if (!items.length) return toast("Shortlist is empty");
    download("shortlist.csv", [COLS.join(",")].concat(items.map((l) => COLS.map((c) => csvCell(Array.isArray(l[c]) ? l[c].join("; ") : l[c])).join(","))).join("\n"));
  });
  $("#btn-copy-rfp").addEventListener("click", async () => {
    if (!shortItems().length) return toast("Shortlist is empty");
    try { await navigator.clipboard.writeText(inquiryText()); toast("Inquiry email copied"); }
    catch { window.prompt("Copy this inquiry:", inquiryText()); }
  });

  $("#btn-add").addEventListener("click", () => $("#dlg-add").showModal());
  $("#btn-add-cancel").addEventListener("click", () => $("#dlg-add").close());
  $("#form-add").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const o = Object.fromEntries(fd.entries());
    o.utilities = fd.has("utilities"); o.petFriendly = fd.has("petFriendly");
    const l = normalize(o);
    if (!l) return toast("Name, city and monthly rate are required");
    addListing(l); e.target.reset(); $("#dlg-add").close(); toast("Listing added");
  });

  $("#file-import").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await file.text());
    const head = rows.shift().map((h) => h.trim());
    const added = rows.map((r) => normalize(Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))).filter(Boolean);
    userListings = userListings.concat(added);
    store.set("chs.user", userListings);
    if (added.length && confirm(`Imported ${added.length} listing(s). Hide the sample data?`)) store.set("chs.hideSample", true);
    buildFilterOptions(); render();
    toast(`Imported ${added.length} of ${rows.length} rows`);
    e.target.value = "";
  });

  async function loadFeed(url, announce) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = parseCSV(await res.text());
      const head = rows.shift().map((h) => h.trim());
      feedListings = rows.map((r, i) => {
        const l = normalize(Object.fromEntries(head.map((h, j) => [h, r[j] ?? ""])));
        if (l) l.id = "f" + i;
        return l;
      }).filter(Boolean);
      buildFilterOptions(); render();
      if (announce) toast(`Feed loaded: ${feedListings.length} listings`);
    } catch (err) {
      toast("Could not load feed: " + err.message);
    }
  }
  $("#btn-feed").addEventListener("click", () => {
    const url = window.prompt("Paste the CSV link of your inventory (Google Sheets: File → Share → Publish to web → CSV). Leave empty to disconnect.", store.get("chs.feed", ""));
    if (url === null) return;
    store.set("chs.feed", url.trim());
    if (url.trim()) loadFeed(url.trim(), true); else { feedListings = []; buildFilterOptions(); render(); }
  });

  async function liveSearch() {
    const url = window.LIVE_SEARCH_URL;
    const status = $("#live-status");
    if (!url) { status.textContent = "Live search isn't connected yet. See README → Live search."; return; }
    const f = filters();
    const body = { city: f.city, beds: f.beds, guests: f.guests, budget: f.budget, nights: f.nights, movein: $("#f-movein").value, pets: f.pets, utilities: f.util, amenities: f.amenities, q: f.q };
    const key = JSON.stringify(body);
    const cache = store.get("chs.liveCache", {});
    const hit = cache[key];
    const btn = $("#btn-live");
    btn.disabled = true; status.textContent = hit && Date.now() - hit.t < 864e5 ? "Loading saved results…" : "Searching the web… this can take up to a minute.";
    try {
      let listings;
      if (hit && Date.now() - hit.t < 864e5) listings = hit.listings; // same search within 24h: no API cost
      else {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        const data = await res.json();
        if (!res.ok) throw new Error((data.error || "HTTP " + res.status) + (data.detail ? " — " + data.detail : ""));
        listings = data.listings || [];
        const keep = Object.entries(cache).filter(([, v]) => Date.now() - v.t < 864e5).slice(-19);
        store.set("chs.liveCache", Object.fromEntries(keep.concat([[key, { t: Date.now(), listings }]])));
      }
      liveListings = listings.map((o, i) => {
        const l = normalize({ ...o, monthly: o.monthly ?? 0, amenities: o.amenities || [] });
        if (l) { l.id = "w" + i; l.live = true; l.imported = false; }
        return l;
      }).filter(Boolean);
      status.textContent = `Found ${liveListings.length} online listing(s). Always verify price and availability on the source page.`;
      buildFilterOptions(); render();
    } catch (err) {
      status.textContent = "Live search failed: " + err.message;
    } finally { btn.disabled = false; }
  }
  $("#btn-live").addEventListener("click", liveSearch);
  $("#btn-test").addEventListener("click", async () => {
    const status = $("#live-status");
    if (!window.LIVE_SEARCH_URL) { status.textContent = "Live search isn't connected yet."; return; }
    status.textContent = "Testing…";
    try {
      const res = await fetch(window.LIVE_SEARCH_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ debug: true }) });
      const d = await res.json();
      status.innerHTML = "";
      const pre = document.createElement("pre");
      pre.style.cssText = "white-space:pre-wrap;font-size:12px;margin:8px 0 0;max-width:100%";
      pre.textContent = JSON.stringify(d, null, 2);
      status.appendChild(pre);
    } catch (err) { status.textContent = "Test failed: " + err.message; }
  });

  buildFilterOptions();
  render();
  const feedUrl = store.get("chs.feed", "");
  if (feedUrl) loadFeed(feedUrl, false);
})();
