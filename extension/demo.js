// ============================================================
// CamFinance — application de démonstration SAFINUM Éwondo (v5.0)
// Fonctionne en page d'extension ET en page autonome (file:// ou http://).
// Aucune donnée réelle, aucun appel réseau.
// ============================================================
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const T = window.SafinumTranslator; // fourni par content.js

  // ── Formatage (espace insécable fine → espace insécable simple) ──
  const fmt = (n) => Math.round(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, "\u00a0");
  const fcfa = (n) => fmt(n) + "\u00a0FCFA";
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

  // ── Règles métier (identiques à la v4.5) ──
  const MIN_AMOUNT = 500;
  const MAX_AMOUNT = 200000;
  const OPERATORS = {
    mtn:    { label: "MTN Mobile Money", fee: (a) => Math.round(a * 0.015) },
    orange: { label: "Orange Money",     fee: (a) => Math.round(a * 0.010) },
    wave:   { label: "Wave",             fee: () => 0 },
    bank:   { label: "Virement bancaire", fee: () => 500 }
  };

  // ── État de l'application ──
  const state = {
    balance: 47500,
    balanceVisible: true,
    filter: "all",
    pending: null,
    txns: [
      { kind: "out", icon: "i-phone", tone: "y", name: "Recharge Orange Money", date: "06/11/2026", status: "Réussi", ref: "OM-2026-7841", amount: 5000 },
      { kind: "out", icon: "i-send", tone: "g", name: "Transfert MTN Mobile Money", date: "05/11/2026", status: "Réussi", ref: "MTN-2026-3312", amount: 15000 },
      { kind: "in", icon: "i-bank", tone: "g", name: "Dépôt bancaire", date: "04/11/2026", status: "Approuvé", ref: "AF-2026-0099", amount: 50000 },
      { kind: "out", icon: "i-cart", tone: "b", name: "Paiement marchand", date: "03/11/2026", status: "Réussi", ref: "PAY-2026-5520", amount: 3500 },
      { kind: "void", icon: "i-x", tone: "r", name: "Transfert annulé", date: "02/11/2026", status: "Annulé", ref: "TXN-2026-0012", amount: 0 }
    ]
  };

  const DYNAMIC_MESSAGES = [
    "Remboursement dû le 15/11/2026. Montant : 10 000 FCFA. Délai de remboursement : 8 jours.",
    "Avertissement de sécurité : tentative de connexion suspecte détectée sur votre compte.",
    "Votre prêt a été approuvé. Montant accordé : 25 000 FCFA. Taux d'intérêt : 18,5 %.",
    "Votre solde a été crédité de 5 000 FCFA. Référence : OM-2026-9910. Paiement reçu.",
    "Mise à jour de sécurité disponible. Vos données sont protégées.",
    "Dépôt de 20 000 FCFA reçu de Express Union. Référence : EU-2026-5581."
  ];
  let dynIndex = 0;

  // ── Navigation ──
  const SCREENS = ["accueil", "frais", "transfert", "historique"];
  function go(id) {
    if (!SCREENS.includes(id)) return;
    SCREENS.forEach((s) => $("#panel-" + s).classList.toggle("active", s === id));
    $$(".nav button").forEach((b) => {
      if (b.dataset.target === id) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("#screens").scrollTop = 0;
  }

  // ── Toast ──
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
  }

  // ── Solde ──
  function renderBalance() {
    $("#balanceAmount").textContent = state.balanceVisible ? fmt(state.balance) : "• • • • •";
    $("#balanceToggleLabel").textContent = state.balanceVisible ? "Masquer le solde" : "Afficher le solde";
    $("[data-action='toggle-balance']").setAttribute("aria-pressed", String(!state.balanceVisible));
  }

  // ── Listes de transactions (construites par DOM : pas d'injection HTML) ──
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(id, size = 22) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }
  function txnRow(t) {
    const row = el("div", "txn");
    const ic = el("span", "ico " + (["g", "y", "b", "r"].includes(t.tone) ? t.tone : "g"));
    ic.appendChild(icon(t.icon));
    const main = el("div", "txn-main");
    main.appendChild(el("div", "txn-name", t.name));
    const meta = el("div", "txn-meta");
    meta.appendChild(document.createTextNode(`${t.date} · Réf. ${t.ref}`));
    meta.appendChild(el("span", "status " + (t.kind === "void" ? "ko" : "ok"), t.status));
    main.appendChild(meta);
    const sign = t.kind === "in" ? "+ " : t.kind === "out" ? "- " : "";
    const amt = el("div", "txn-amount " + t.kind, sign + fcfa(t.amount));
    row.append(ic, main, amt);
    return row;
  }
  function renderLists() {
    const recent = $("#recentList");
    recent.replaceChildren(...state.txns.filter((t) => t.kind !== "void").slice(0, 3).map(txnRow));
    const list = $("#historyList");
    const items = state.txns.filter((t) => state.filter === "all" || t.kind === state.filter);
    list.replaceChildren(...(items.length ? items.map(txnRow) : [el("div", "empty", "Aucune transaction.")]));
    $$(".filters button").forEach((b) => b.classList.toggle("on", b.dataset.filter === state.filter));
  }

  // ── Message du service (contenu dynamique, fonctionnalité 5) ──
  function setDynamic(msg) { $("#dynamicMsg").textContent = msg; }
  function newMessage() {
    setDynamic(DYNAMIC_MESSAGES[dynIndex++ % DYNAMIC_MESSAGES.length]);
    go("accueil");
    toast("Nouveau message reçu.");
  }

  // ── Transfert ──
  const form = $("#transferForm");
  const phoneInput = $("#phoneInput");
  const amountInput = $("#amountInput");
  const pinInput = $("#pinInput");

  const digits = (s) => String(s || "").replace(/\D/g, "");
  function readAmount() { return parseInt(digits(amountInput.value), 10) || 0; }
  function readOp() { const r = $("input[name='op']:checked"); return r ? r.value : ""; }
  function normPhone(raw) {
    let d = digits(raw);
    if (d.startsWith("237") && d.length === 12) d = d.slice(3);
    return d;
  }

  function updateFees() {
    const amount = readAmount();
    const op = readOp();
    $$(".op").forEach((l) => l.classList.toggle("sel", l.querySelector("input").checked));
    const box = $("#feesLive");
    if (!amount || !op) { box.classList.remove("show"); return; }
    const fees = OPERATORS[op].fee(amount);
    $("#feesValue").textContent = fees === 0 ? "Sans frais" : fcfa(fees);
    $("#totalValue").textContent = fcfa(amount + fees);
    box.classList.add("show");
  }

  function setStep(n) {
    $$(".stepper .st").forEach((s) => s.classList.toggle("on", +s.dataset.step <= n));
  }
  function showError(msg, field) {
    $("#errorText").textContent = msg;
    $("#errorBanner").classList.remove("hidden");
    $$(".input").forEach((i) => i.classList.remove("bad"));
    if (field) { field.classList.add("bad"); field.focus(); }
    $("#errorBanner").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideError() {
    $("#errorBanner").classList.add("hidden");
    $$(".input").forEach((i) => i.classList.remove("bad"));
  }

  function prepareTransfer(ev) {
    if (ev) ev.preventDefault();
    const phone = normPhone(phoneInput.value);
    const amount = readAmount();
    const op = readOp();
    const pin = pinInput.value;
    if (!/^6\d{8}$/.test(phone)) return showError("Numéro invalide. Entrez un numéro à 9 chiffres.", phoneInput);
    if (amount < MIN_AMOUNT) return showError("Montant invalide. Le minimum est de 500 FCFA.", amountInput);
    if (amount > MAX_AMOUNT) return showError("Montant trop élevé. Le maximum est de 200 000 FCFA.", amountInput);
    if (!op) return showError("Choisissez un mode de paiement.");
    if (!/^\d{4}$/.test(pin)) return showError("Code PIN incorrect. Entrez 4 chiffres.", pinInput);
    const fees = OPERATORS[op].fee(amount);
    const total = amount + fees;
    if (total > state.balance) return showError("Solde insuffisant.", amountInput);
    hideError();
    state.pending = { phone, amount, op, fees, total };
    $("#sumBenef").textContent = phone;
    $("#sumOp").textContent = OPERATORS[op].label;
    $("#sumAmount").textContent = fcfa(amount);
    $("#sumFees").textContent = fees === 0 ? "Sans frais" : fcfa(fees);
    $("#sumTotal").textContent = fcfa(total);
    form.classList.add("hidden");
    $("#summaryCard").classList.remove("hidden");
    setStep(2);
    toast("Récapitulatif prêt.");
  }

  function confirmTransfer() {
    const p = state.pending;
    if (!p) return;
    const btn = $("#confirmBtn");
    btn.disabled = true;
    const spinner = el("span", "spinner");
    btn.prepend(spinner);
    $("#confirmLabel").textContent = "Traitement en cours…";
    setTimeout(() => {
      const ref = "TXN-2026-" + String(Math.floor(Math.random() * 9000 + 1000));
      state.balance -= p.total;
      state.txns.unshift({ kind: "out", icon: "i-send", tone: "g", name: p.op === "bank" ? "Virement bancaire" : "Transfert " + OPERATORS[p.op].label, date: today(), status: "Réussi", ref, amount: p.total });
      renderBalance(); renderLists();
      $("#txnRef").textContent = ref;
      $("#okAmount").textContent = fcfa(p.amount);
      $("#okBalance").textContent = fcfa(state.balance);
      spinner.remove();
      btn.disabled = false;
      $("#confirmLabel").textContent = "Confirmer le transfert";
      $("#summaryCard").classList.add("hidden");
      $("#successScreen").classList.remove("hidden");
      setStep(3);
      setDynamic(`Votre transfert a été approuvé. Montant : ${fcfa(p.amount)}. Bénéficiaire : ${p.phone}. Référence : ${ref}.`);
      state.pending = null;
    }, 1200);
  }

  function editTransfer() {
    $("#summaryCard").classList.add("hidden");
    form.classList.remove("hidden");
    setStep(1);
    toast("Vous pouvez modifier le transfert.");
  }

  function resetTransfer() {
    $("#successScreen").classList.add("hidden");
    form.reset();
    form.classList.remove("hidden");
    hideError(); updateFees(); setStep(1);
    phoneInput.focus();
  }

  function simulateError() {
    $("#summaryCard").classList.add("hidden");
    form.classList.remove("hidden");
    setStep(1);
    showError("Connexion impossible. Service indisponible. Veuillez réessayer.");
    setDynamic("Activité suspecte détectée sur votre compte. Transaction bloquée pour votre sécurité. Veuillez contacter votre banque.");
    state.pending = null;
  }

  // ── Traduction (bouton jaune) ──
  const translateBtn = $("#demoTranslateBtn");
  function renderLang(on) {
    translateBtn.classList.toggle("active", on);
    translateBtn.setAttribute("aria-pressed", String(on));
    $("#translateLabel").textContent = on ? "Revenir au français" : "Traduire en Éwondo";
    const pill = $("#langPill");
    pill.textContent = on ? "Éwondo" : "FR";
    pill.classList.toggle("ewo", on);
    document.documentElement.lang = on ? "ewo" : "fr";
  }
  function renderEngine() {
    const box = $("#engineStatus");
    const mode = T ? T.engine() : "none";
    box.classList.remove("ok", "warn");
    if (mode === "model" && typeof ewondoEngine !== "undefined" && ewondoEngine.model) {
      const m = ewondoEngine.model;
      box.classList.add("ok");
      $("#engineText").textContent = `Moteur éwondo prêt : ${Object.keys(m.exact).length} expressions, ${Object.keys(m.words).length} mots (modèle v${(m.meta && m.meta.version) || "?"}).`;
    } else if (mode === "dictionary") {
      box.classList.add("warn");
      $("#engineText").textContent = "Moteur non chargé : traduction par le dictionnaire de secours.";
    } else {
      box.classList.add("warn");
      $("#engineText").textContent = "Traduction indisponible (scripts manquants).";
    }
  }

  // ── Branchements ──
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (a) {
      const act = a.dataset.action;
      if (act === "go") go(a.dataset.target);
      else if (act === "toggle-balance") { state.balanceVisible = !state.balanceVisible; renderBalance(); }
      else if (act === "new-message") newMessage();
      else if (act === "receive") toast("Partagez votre numéro pour recevoir de l'argent.");
      else if (act === "recharge") { go("transfert"); toast("Choisissez l'opérateur pour la recharge."); }
      else if (act === "confirm") confirmTransfer();
      else if (act === "edit") editTransfer();
      else if (act === "reset") resetTransfer();
      else if (act === "simulate-error") simulateError();
      return;
    }
    const chip = e.target.closest("[data-amount]");
    if (chip) { amountInput.value = fmt(+chip.dataset.amount); updateFees(); return; }
    const f = e.target.closest("[data-filter]");
    if (f) { state.filter = f.dataset.filter; renderLists(); }
  });
  form.addEventListener("submit", prepareTransfer);
  form.addEventListener("input", updateFees);
  form.addEventListener("change", updateFees);
  amountInput.addEventListener("blur", () => { const a = readAmount(); if (a) amountInput.value = fmt(a); });

  if (T) {
    translateBtn.addEventListener("click", () => T.togglePage());
    T.onChange(renderLang);
    T.modelReady.then(renderEngine);
  } else {
    translateBtn.disabled = true;
  }

  $("#balanceDate").textContent = "Mis à jour : " + today();
  renderBalance();
  renderLists();
  renderEngine();
})();
