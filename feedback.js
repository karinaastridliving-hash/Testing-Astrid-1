// Feedback window: area dropdown (+ "Other" free text), kind, overall rating, message. Saved to Supabase table "feedback"
// (or opened as a pre-filled email when only window.FEEDBACK_EMAIL is set).
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const fab = $("#btn-feedback"), dlg = $("#dlg-feedback");
  const hasDb = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
  const mailTo = String(window.FEEDBACK_EMAIL || "").trim();
  if (!hasDb && !mailTo) return; // nothing configured: keep the button hidden
  fab.hidden = false;

  let sb = window.CHS_SB || null; // shared client (carries the signed-in user, if any)
  if (!sb && hasDb) sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const msg = $("#fb-msg"), send = $("#fb-send"), area = $("#fb-area"), other = $("#fb-other");
  let last = 0;

  function open() {
    msg.textContent = "";
    const u = window.CHS_USER && window.CHS_USER();
    if (u && !$("#fb-contact").value) $("#fb-contact").value = u.email || "";
    dlg.showModal();
  }
  fab.addEventListener("click", open);
  $("#fb-cancel").addEventListener("click", () => dlg.close());
  area.addEventListener("change", () => { $("#fb-other-row").hidden = area.value !== "Other"; if (area.value === "Other") other.focus(); });

  $("#form-feedback").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#fb-website").value) return dlg.close(); // honeypot filled: a bot
    const text = $("#fb-message").value.trim();
    if (!area.value) return (msg.textContent = "Please choose what your feedback is about.");
    if (area.value === "Other" && !other.value.trim()) return (msg.textContent = "Please tell us what “Other” refers to.");
    if (!text) return (msg.textContent = "Please write your feedback.");
    const contact = $("#fb-contact").value.trim();
    if (contact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) return (msg.textContent = "That email address doesn't look right (or leave it empty).");
    if (Date.now() - last < 15000) return (msg.textContent = "Please wait a few seconds before sending another one.");

    const kind = (document.querySelector('input[name="fb-kind"]:checked') || {}).value || null;
    const rating = +((document.querySelector('input[name="fb-rating"]:checked') || {}).value || 0) || null;
    const row = {
      area: area.value, other_area: area.value === "Other" ? other.value.trim() : null, kind, rating, message: text, contact: contact || null,
      page: location.origin + location.pathname,
      context: { screen: `${screen.width}x${screen.height}`, viewport: `${innerWidth}x${innerHeight}`, theme: document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), language: navigator.language, userAgent: navigator.userAgent.slice(0, 300), signedIn: !!(window.CHS_USER && window.CHS_USER()) },
    };

    send.disabled = true; msg.textContent = "Sending…";
    try {
      if (hasDb) {
        const { error } = await sb.from("feedback").insert(row);
        if (error) throw new Error(error.message);
      } else {
        const body = [`About: ${row.area}${row.other_area ? " – " + row.other_area : ""}`, `Kind: ${kind || "-"}`, `Rating: ${rating || "-"}/5`, "", text, "", `Page: ${row.page}`, `Screen: ${row.context.viewport}`].join("\n");
        location.href = `mailto:${mailTo}?subject=${encodeURIComponent("Sourcing Studio feedback: " + row.area)}&body=${encodeURIComponent(body)}`;
      }
      last = Date.now();
      $("#form-feedback").reset();
      $("#fb-other-row").hidden = true;
      dlg.close();
      const t = $("#toast"); t.textContent = "Thank you! Your feedback was sent."; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3500);
    } catch (err) {
      msg.textContent = "Couldn't send your feedback: " + err.message;
    } finally { send.disabled = false; }
  });
})();
