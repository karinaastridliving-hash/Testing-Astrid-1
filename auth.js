// Sign-in with email + password (Supabase), password reset by emailed link, and per-user saved shortlists.
// Needs window.SUPABASE_URL / SUPABASE_ANON_KEY in config.js; without them the sign-in button stays hidden and the
// shortlist is kept in this browser only. Only addresses at ALLOWED_EMAIL_DOMAIN may sign in or create an account
// (also enforced in the database, see supabase/setup.sql).
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const btn = $("#btn-auth");
  const URL_ = window.SUPABASE_URL, KEY = window.SUPABASE_ANON_KEY;
  const DOMAIN = String(window.ALLOWED_EMAIL_DOMAIN || "astridliving.com").toLowerCase();
  const MIN = Math.max(6, +window.MIN_PASSWORD_LENGTH || 10); // use 6 to allow 6-digit PINs (weaker; see README)
  const EMAIL_FEATURES = window.AUTH_EMAIL_FEATURES !== false; // false = no emails at all: accounts are created by an admin, who also resets passwords
  if (!URL_ || !KEY || !window.supabase) return; // not configured: keep the button hidden

  const sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const emailOk = (e) => String(e || "").trim().toLowerCase().endsWith("@" + DOMAIN);
  const here = () => location.origin + location.pathname;
  let user = null, mode = "signin";

  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3500); };
  const dlg = $("#dlg-auth"), msg = $("#auth-msg"), send = $("#auth-send");
  const email = $("#auth-email"), pw = $("#auth-pw"), pw2 = $("#auth-pw2");

  // ---------- dialog modes ----------
  const TITLES = { signin: "Sign in", signup: "Create your account", forgot: "Reset your password", recover: "Set a new password", account: "Your account" };
  const SUBS = {
    signin: "Sign in with your work email and password. Your shortlist is saved to your account and follows you to any device.",
    signup: `Use your @${DOMAIN} email. Choose a password of at least ${MIN} characters. We'll email you a link to confirm your address.`,
    forgot: `Enter your @${DOMAIN} email and we'll send you a link to choose a new password.`,
    recover: `Choose a new password (at least ${MIN} characters).`,
    account: "",
  };
  const LABEL = { signin: "Sign in", signup: "Create account", forgot: "Email me a reset link", recover: "Save new password" };
  const LINKS = EMAIL_FEATURES ? {
    signin: [["Forgot password?", "forgot"], ["Create account", "signup"]],
    signup: [["I already have an account", "signin"]],
    forgot: [["Back to sign in", "signin"]],
    recover: [], account: [],
  } : { signin: [], recover: [], account: [] };
  function setMode(m, keepMsg) {
    mode = m;
    if (!keepMsg) msg.textContent = "";
    $("#auth-title").textContent = TITLES[m];
    $("#auth-sub").textContent = SUBS[m]; $("#auth-sub").hidden = !SUBS[m];
    const showEmail = m === "signin" || m === "signup" || m === "forgot";
    const showPw = m === "signin" || m === "signup" || m === "recover";
    const showPw2 = m === "signup" || m === "recover";
    $("#auth-email-row").hidden = !showEmail; $("#auth-pw-row").hidden = !showPw; $("#auth-pw2-row").hidden = !showPw2;
    $("#auth-pw-label").textContent = m === "recover" ? "New password" : "Password";
    pw.autocomplete = m === "signin" ? "current-password" : "new-password";
    $("#auth-account").hidden = m !== "account";
    if (m === "account") $("#auth-who").textContent = `Signed in as ${user ? user.email : ""}. Your shortlist is saved to this account.`;
    send.hidden = m === "account"; send.textContent = LABEL[m] || "";
    $("#auth-links").innerHTML = (LINKS[m] || []).map(([t, to]) => `<button type="button" data-mode="${to}">${t}</button>`).join("")
      + (!EMAIL_FEATURES && m === "signin" ? "<span class=\"meta\">Forgot your password? Ask your administrator to reset it.</span>" : "");
  }
  $("#auth-links").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });

  // ---------- state ----------
  function ui() {
    btn.hidden = false;
    btn.textContent = user ? `${String(user.email).split("@")[0]} · Account` : "Sign in";
    const hint = $("#short-hint");
    hint.hidden = false;
    hint.textContent = user ? `Saved to your account (${user.email}).` : "Sign in to save your shortlist to your account and see it on any device.";
  }

  async function syncDown() {
    const { data, error } = await sb.from("shortlist").select("listing_id,snapshot");
    if (error) return toast("Couldn't load your saved shortlist: " + error.message);
    const cloud = new Map((data || []).map((r) => [r.listing_id, r.snapshot]));
    const extra = window.CHS.entries().filter((e) => !cloud.has(e.id)); // shortlisted in this browser before signing in
    if (extra.length) {
      const { error: e2 } = await sb.from("shortlist").upsert(extra.map((e) => ({ user_id: user.id, listing_id: e.id, snapshot: e.snapshot })), { onConflict: "user_id,listing_id" });
      if (e2) toast("Couldn't save some items to your account: " + e2.message);
    }
    window.CHS.setEntries([...cloud].map(([id, snapshot]) => ({ id, snapshot })).concat(extra));
  }

  window.CHS.onChange = async (type, id, snapshot) => {
    if (!user) return;
    let res;
    if (type === "add") res = await sb.from("shortlist").upsert({ user_id: user.id, listing_id: id, snapshot }, { onConflict: "user_id,listing_id" });
    else if (type === "remove") res = await sb.from("shortlist").delete().eq("user_id", user.id).eq("listing_id", id);
    else if (type === "clear") res = await sb.from("shortlist").delete().eq("user_id", user.id);
    if (res && res.error) toast("Couldn't save to your account: " + res.error.message);
  };

  sb.auth.onAuthStateChange((event, session) => {
    const next = session && session.user ? session.user : null;
    if (next && !emailOk(next.email)) { sb.auth.signOut(); return toast("Only @" + DOMAIN + " addresses can sign in."); }
    const changed = (next && next.id) !== (user && user.id);
    user = next;
    ui();
    if (event === "PASSWORD_RECOVERY") { setMode("recover"); if (!dlg.open) dlg.showModal(); } // arrived from the reset link
    if (changed) { if (user) syncDown(); else window.CHS.reset(); } // on sign-out, wipe the local copy so the next person on this computer starts clean
  });

  // ---------- events ----------
  btn.addEventListener("click", () => { setMode(user ? "account" : "signin"); dlg.showModal(); });
  $("#auth-cancel").addEventListener("click", () => dlg.close());
  $("#auth-changepw").addEventListener("click", () => { pw.value = pw2.value = ""; setMode("recover"); });
  $("#auth-signout").addEventListener("click", async () => { dlg.close(); await sb.auth.signOut(); toast("Signed out. Your shortlist stays saved in your account."); });

  $("#form-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const em = email.value.trim().toLowerCase();
    send.disabled = true;
    try {
      if ((mode === "signin" || mode === "signup" || mode === "forgot") && !emailOk(em)) return (msg.textContent = `Please use your @${DOMAIN} email address.`);
      if (mode === "signin") {
        msg.textContent = "Signing in…";
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pw.value });
        if (error) return (msg.textContent = /confirm/i.test(error.message) ? "Please confirm your email first (check the link we sent you)." : "Wrong email or password. If you forgot it, use “Forgot password?”.");
        pw.value = ""; dlg.close(); toast("Signed in");
      } else if (mode === "signup") {
        if (pw.value.length < MIN) return (msg.textContent = `Password must be at least ${MIN} characters.`);
        if (pw.value !== pw2.value) return (msg.textContent = "The two passwords don't match.");
        msg.textContent = "Creating your account…";
        const { data, error } = await sb.auth.signUp({ email: em, password: pw.value, options: { emailRedirectTo: here() } });
        if (error) return (msg.textContent = /database|domain|astrid/i.test(error.message) ? `Only @${DOMAIN} addresses can create an account.` : "Couldn't create the account: " + error.message);
        pw.value = pw2.value = "";
        if (data && data.session) { dlg.close(); toast("Account created"); }
        else msg.textContent = "Account created. Open the email we sent you and tap the confirmation link, then sign in.";
      } else if (mode === "forgot") {
        msg.textContent = "Sending…";
        const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: here() });
        msg.textContent = error ? "Couldn't send the email: " + error.message + (/rate|limit/i.test(error.message) ? " (too many requests; wait a few minutes)." : "")
          : "If that address has an account, a reset link is on its way. Open it on this device (check spam too).";
      } else if (mode === "recover") {
        if (pw.value.length < MIN) return (msg.textContent = `Password must be at least ${MIN} characters.`);
        if (pw.value !== pw2.value) return (msg.textContent = "The two passwords don't match.");
        const { error } = await sb.auth.updateUser({ password: pw.value });
        if (error) return (msg.textContent = "Couldn't change the password: " + error.message);
        pw.value = pw2.value = ""; dlg.close(); toast("Password updated");
      }
    } finally { send.disabled = false; }
  });
  ui();
})();
