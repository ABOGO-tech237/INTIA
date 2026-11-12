// ============================================================
// SAFINUM Éwondo Translator — Content Script (v5.1.1)
// Traduit le contenu visible d'une page web en langue Éwondo.
//
// Fonctionne dans deux contextes :
//   • script de contenu de l'extension (toutes les pages) ;
//   • script classique de demo.html, avec ou sans extension
//     (ouverture locale file:// ou petit serveur http://).
// ============================================================

(function () {
  "use strict";

  // Garde anti double-injection (manifest + injection programmatique)
  if (window.__safinumEwondoLoaded) return;
  window.__safinumEwondoLoaded = true;

  const HAS_EXT = typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id);
  const HAS_STORAGE = HAS_EXT && !!(chrome.storage && chrome.storage.local);
  // demo.html porte l'attribut <html data-safinum-demo> (pas de script
  // inline : interdit par la CSP des pages d'extension MV3)
  const DEMO_MODE = !!window.SAFINUM_DEMO || document.documentElement.hasAttribute("data-safinum-demo");

  let isTranslated = false;
  let originalTitle = null;
  const originalTexts = new Map(); // nœud texte → texte original
  const listeners = new Set();     // callbacks d'état (utilisés par la démo)

  // Limites de mots compatibles avec les lettres accentuées
  const WB_L = "(?<![\\p{L}\\p{M}\\p{N}_])";
  const WB_R = "(?![\\p{L}\\p{M}\\p{N}_])";

  // ── Protection des données financières ─────────────────
  /**
   * Règle SAFINUM fonctionnalité 3 :
   *   Les montants numériques (ex: 5 000 FCFA, 12 500 XAF) et les
   *   références de transaction ne sont JAMAIS traduits — ils sont
   *   préservés tels quels pour éviter toute confusion financière.
   * Cela inclut : montants, codes de transaction, numéros de compte,
   * pourcentages (taux d'intérêt), dates, codes PIN, numéros de téléphone,
   * identifiants de référence, et toute séquence alphanumérique financière.
   *
   * v5.0 : la regex v4.5 était écrite sur plusieurs lignes avec un drapeau
   * « x » qui n'existe pas en JavaScript → erreur de syntaxe, le script
   * entier ne se chargeait pas. Mêmes motifs, réécrits en une seule regex.
   */
  // Aligné sur engine.js : « 2 % », dates « 05 nov. 2026 », comptes « CM 001 … ».
  const PROTECT_RE = new RegExp(
    [
      "\\d{1,2}\\s+(?:janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)\\.?\\s+\\d{4}",
      "\\d+(?:[.,]\\d+)?\\s*%",
      "((?:\\d[\\d\\s\\u00a0\\u202f .,]*)\\s*(?:FCFA|XAF|EUR|USD|GBP|CFA|F\\b|€|\\$)(?:\\s*\\/\\s*\\w+)?)",
      "(\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+(?:[.,]\\d+)?)",
      "(\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2})",
      "\\bCM(?:[\\s\\u00a0\\u202f]\\d{2,})+",
      "([A-Z]{2,}-\\d{4,}[-A-Z0-9]*)",
      "([A-Z]{4,}\\d{4,}[A-Z0-9]*)",
      "(\\+?[26][0-9]{8,})",
      "(\\b\\d{4,}\\b)"
    ].join("|"),
    "gi"
  );

  function protect(text, store, open, close) {
    return text.replace(PROTECT_RE, (match) => {
      store.push(match);
      return `${open}${store.length - 1}${close}`;
    });
  }

  function restore(text, store, re) {
    return text.replace(re, (_, i) => store[+i]);
  }

  // ── Traduction par le dictionnaire (repli) ─────────────
  function dictionaryTranslate(text) {
    if (!text || text.trim().length === 0) return text;
    if (typeof EWONDO_DICT === "undefined") return text;

    const protected_ = [];
    let result = protect(text, protected_, "\x00P", "\x00");

    // v5.1.1 : une seule regex précompilée (plus long d'abord), un seul passage.
    const m = dictMatcher();
    result = result.replace(m.re, (match) => {
      const ew = m.table.get(match.toLowerCase().replace(/\s+/g, " ").replace(/’/g, "'"));
      if (ew === undefined) return match;
      return match[0] === match[0].toUpperCase() ? ew.charAt(0).toUpperCase() + ew.slice(1) : ew;
    });

    return restore(result, protected_, /\x00P(\d+)\x00/g);
  }

  let _dictMatcher = null;
  function dictMatcher() {
    if (_dictMatcher) return _dictMatcher;
    const table = new Map();
    for (const [fr, ew] of Object.entries(EWONDO_DICT)) if (fr.length >= 2) table.set(fr.toLowerCase(), ew);
    const keys = [...table.keys()].sort((a, b) => b.length - a.length);
    const alt = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+").replace(/'/g, "['’]")).join("|");
    _dictMatcher = { table, re: new RegExp(`${WB_L}(?:${alt})${WB_R}`, "giu") };
    return _dictMatcher;
  }

  function engineReady() {
    return typeof ewondoEngine !== "undefined" && ewondoEngine.ready;
  }

  /**
   * Point d'entrée unique. Si le moteur est prêt, on lui passe le texte
   * original : il fait d'abord la correspondance exacte, puis protège
   * dates, comptes, pourcentages et montants. Un masquage préalable
   * (ex. découpe de « 2345 » / « 6789 » dans « CM 001 2345 6789 01 »)
   * empêchait « Numéro de compte : … » d'être traduit sur la page.
   * Le dictionnaire de repli continue de protéger lui-même.
   */
  function translateText(text) {
    if (!text || text.trim().length === 0) return text;
    if (engineReady()) return ewondoEngine.translateText(text);
    return dictionaryTranslate(text);
  }

  // ── Collecte des nœuds texte ───────────────────────────
  // Exclut scripts, styles, champs, et toute zone marquée
  // data-safinum-skip, translate="no" ou class="notranslate".
  // v5.1.1 : liste élargie pour les sites ordinaires (champs, code, éditeurs).
  const SKIP_TAGS = new Set(["script", "style", "noscript", "iframe", "pre", "code", "kbd", "samp", "var",
    "textarea", "input", "select", "svg", "math", "canvas", "template", "object", "embed"]);
  const SKIP_SELECTOR = "[data-safinum-skip], [translate='no'], .notranslate, pre, code, textarea, svg, [contenteditable]:not([contenteditable='false'])";

  function isSkipped(el) {
    if (!el || !el.tagName) return true;
    const tag = el.tagName.toLowerCase();
    // Libellés d'<option> et <optgroup> : à traduire, même à l'intérieur d'un <select>
    // (on ne touche jamais à option.value, que la page soumet).
    if (tag === "option" || tag === "optgroup") return false;
    if (SKIP_TAGS.has(tag)) return true;
    if (el.isContentEditable) return true;
    if (el.closest && el.closest("option, optgroup")) return false;
    return !!(el.closest && el.closest(SKIP_SELECTOR));
  }

  function getTextNodes(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      return root.nodeValue.trim() && !isSkipped(root.parentElement) ? [root] : [];
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isSkipped(node.parentElement)) return NodeFilter.FILTER_REJECT;
        if (originalTexts.has(node)) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue.trim().length === 0) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  const written = new WeakMap(); // nœud → dernière valeur écrite par nous
  function translateNode(node) {
    const original = node.nodeValue;
    const translated = translateText(original);
    if (translated !== original) {
      if (!originalTexts.has(node)) originalTexts.set(node, original);
      written.set(node, translated);
      node.nodeValue = translated;
    }
  }

  const ATTRS = ["placeholder", "title", "alt", "aria-label", "value"];
  function translateAttributes(root) {
    const scope = root.querySelectorAll ? root : document;
    const SEL = "input, button, a, img, [title], [aria-label], [placeholder]";
    const els = [...scope.querySelectorAll(SEL)];
    if (root.matches && root.matches(SEL)) els.unshift(root);
    els.forEach((el) => {
      // Les attributs d'un champ (placeholder, title…) sont de l'interface : traduits ;
      // seule sa valeur saisie reste intacte.
      if (el.isContentEditable || (el.closest && el.closest("[data-safinum-skip], [translate='no'], .notranslate"))) return;
      // Ne jamais toucher à la valeur saisie ou par défaut d'un champ
      for (const attr of ATTRS) {
        if (attr === "value" && el.tagName === "INPUT") continue;
        if (!el.hasAttribute(attr)) continue;
        const orig = el.getAttribute(attr);
        const tr = translateText(orig);
        if (tr === orig) continue;
        const saved = JSON.parse(el.dataset.safinumOrigAttr || "{}");
        if (!(attr in saved)) saved[attr] = orig;
        el.dataset.safinumOrigAttr = JSON.stringify(saved);
        el.setAttribute(attr, tr);
      }
    });
    translateSelectLabels(root);
  }

  // Libellés visibles des listes déroulantes. Jamais option.value.
  function translateSelectLabels(root) {
    const scope = root.querySelectorAll ? root : document;
    const els = [...scope.querySelectorAll("option, optgroup")];
    if (root.matches && (root.matches("option") || root.matches("optgroup"))) els.unshift(root);
    els.forEach((el) => {
      if (el.closest && el.closest("[data-safinum-skip], [translate='no'], .notranslate")) return;
      if (el.tagName === "OPTGROUP") {
        if (!el.hasAttribute("label")) return;
        const orig = el.getAttribute("label");
        const tr = translateText(orig);
        if (tr === orig) return;
        const saved = JSON.parse(el.dataset.safinumOrigAttr || "{}");
        if (!("label" in saved)) saved.label = orig;
        el.dataset.safinumOrigAttr = JSON.stringify(saved);
        el.setAttribute("label", tr);
        return;
      }
      // option : le libellé est le texte, pas la valeur soumise.
      if (!("safinumOrigText" in el.dataset)) el.dataset.safinumOrigText = el.textContent;
      const orig = el.dataset.safinumOrigText;
      const tr = translateText(orig);
      if (tr !== orig) el.textContent = tr;
    });
  }

  // ── Traduction / restauration ──────────────────────────
  function notify() {
    for (const cb of listeners) {
      try { cb(isTranslated); } catch (e) { console.error(e); }
    }
  }

  const IS_TOP = (() => { try { return window.top === window; } catch (e) { return false; } })();

  function translatePage() {
    if (isTranslated) return;
    if (!document.body) return;
    flushPending(); // traite d'abord les changements déjà en file
    getTextNodes(document.body).forEach(translateNode);
    translateAttributes(document);
    if (document.title && IS_TOP) {
      const t = translateText(document.title);
      if (t !== document.title) { originalTitle = document.title; document.title = t; }
    }
    isTranslated = true;
    observer.takeRecords(); // ignore nos propres écritures
    document.documentElement.setAttribute("data-safinum-lang", "ewo");
    if (!DEMO_MODE && IS_TOP) showTranslatedBanner();
    if (HAS_STORAGE && !DEMO_MODE) chrome.storage.local.set({ translated: true });
    notify();
  }

  function restorePage() {
    if (!isTranslated) return;
    for (const [node, original] of originalTexts) {
      // ne pas écraser un texte que la page a elle-même modifié depuis
      if (node.nodeValue === written.get(node)) node.nodeValue = original;
    }
    originalTexts.clear();
    if (originalTitle !== null) { document.title = originalTitle; originalTitle = null; }
    document.querySelectorAll("[data-safinum-orig-attr]").forEach((el) => {
      const saved = JSON.parse(el.dataset.safinumOrigAttr);
      for (const [attr, val] of Object.entries(saved)) el.setAttribute(attr, val);
      delete el.dataset.safinumOrigAttr;
    });
    document.querySelectorAll("[data-safinum-orig-text]").forEach((el) => {
      el.textContent = el.dataset.safinumOrigText;
      delete el.dataset.safinumOrigText;
    });
    isTranslated = false;
    pending.clear();
    observer.takeRecords();
    document.documentElement.removeAttribute("data-safinum-lang");
    bannerShown = false;
    if (!DEMO_MODE && IS_TOP) showBanner("↩️ Texte original restauré");
    if (HAS_STORAGE && !DEMO_MODE) chrome.storage.local.set({ translated: false });
    notify();
  }

  function togglePage() {
    if (isTranslated) restorePage();
    else translatePage();
    return isTranslated;
  }

  // ── Bannière flottante (pages web, pas la démo) ────────
  // Une seule instance (id fixe). Texte passé par le lexique : « traduire en
  // éwondo » = « timi Ewondo » (entrée exacte sourcée). « Page traduite » n'est
  // pas dans le lexique ; on n'invente pas de mot. Le nom propre est conservé.
  let bannerShown = false;
  function showTranslatedBanner() {
    if (bannerShown) return;
    bannerShown = true;
    const sourced = translateText("Traduire en Éwondo");
    showBanner("✅ " + sourced + " — SAFINUM Éwondo Translator");
  }

  function showBanner(message) {
    let banner = document.getElementById("safinum-ewondo-banner");
    if (!banner || !banner.parentNode) {
      banner = document.createElement("div");
      banner.id = "safinum-ewondo-banner";
      banner.setAttribute("data-safinum-skip", "");
      banner.setAttribute("role", "status");
      Object.assign(banner.style, {
        position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483647",
        background: "#006b3f", color: "#fff", padding: "12px 18px",
        borderRadius: "12px", borderLeft: "6px solid #fcd116",
        fontSize: "15px", fontFamily: "system-ui, sans-serif", fontWeight: "600",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)", transition: "opacity 0.4s ease",
        maxWidth: "320px", lineHeight: "1.4"
      });
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.style.opacity = "1";
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => { banner.style.opacity = "0"; }, 3500);
  }

  // ── Messages du popup / background (extension) ─────────
  if (HAS_EXT && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.action) return;
      if (!["translate", "restore", "toggle", "getStatus"].includes(msg.action)) return;
      const reply = () => sendResponse({ status: isTranslated ? "translated" : "original", isTranslated,
        engine: engineReady() ? "model" : "dictionary", frame: IS_TOP ? "top" : "sub" });
      if (msg.action === "getStatus") { reply(); return; }
      // v5.1.1 : le modèle est chargé à la demande (pas sur chaque page visitée)
      ensureModel().then(() => {
        try {
          if (msg.action === "translate") translatePage();
          else if (msg.action === "restore") restorePage();
          else togglePage();
        } catch (e) { console.warn("[SAFINUM] traduction interrompue :", e); }
        reply();
      });
      return true; // réponse asynchrone
    });
  }

  // ── Chargement du modèle linguistique embarqué ─────────
  // 1) window.EWONDO_MODEL (ewondo_model.js, compatible file://)
  // 2) sinon ewondo_model.json via fetch (extension ou http://)
  // 3) sinon repli dictionnaire (dictionary.js)
  function loadModel() {
    if (typeof ewondoEngine === "undefined") return Promise.resolve(false);
    if (ewondoEngine.ready) return Promise.resolve(true);
    if (window.EWONDO_MODEL && ewondoEngine.loadFromObject(window.EWONDO_MODEL)) return Promise.resolve(true);
    let url = "ewondo_model.json";
    if (HAS_EXT && chrome.runtime.getURL) url = chrome.runtime.getURL("ewondo_model.json");
    else if (location.protocol === "file:") return Promise.resolve(false); // fetch interdit en file://
    return ewondoEngine.load(url);
  }

  let _modelPromise = null;
  function ensureModel() {
    if (!_modelPromise) _modelPromise = loadModel().catch(() => false);
    return _modelPromise;
  }
  // Démo / modèle embarqué : chargement immédiat ; pages web : à la demande.
  const modelReady = (DEMO_MODE || window.EWONDO_MODEL) ? ensureModel() : Promise.resolve(false);
  if (!DEMO_MODE && HAS_STORAGE) {
    try {
      chrome.storage.local.get(["autoTranslate"], (data) => {
        if (chrome.runtime.lastError) return;
        if (data && data.autoTranslate) ensureModel().then(() => translatePage());
      });
    } catch (e) { /* contexte invalidé (extension rechargée) */ }
  }

  // ── Fonctionnalité 5 : contenu inédit (dynamique) ──────
  // v5.1.1 : nœuds ajoutés ET textes modifiés en place (characterData),
  // regroupés et traités par lots (≤ 1 fois / 150 ms) pour ne pas
  // ralentir les sites qui changent sans cesse (fils d'actualité, SPA).
  // v5.2.1 : ne plus jeter les écritures de la page arrivées pendant
  // notre passe. takeRecords() en fin de lot avalait le français que
  // Vue réinjecte (ex. « Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA) »
  // au changement de mode de paiement) sans rappeler l'observateur, et
  // la ligne restait visible jusqu'à une mutation ultérieure. On ignore
  // seulement nos propres écritures, on retraduit le reste tout de suite,
  // et on n'attend pas 150 ms quand la page écrase un texte déjà traduit.
  const pending = new Set();
  let flushTimer = null;
  function queue(mutations) {
    for (const m of mutations) {
      if (m.type === "characterData") {
        const n = m.target;
        if (written.get(n) === n.nodeValue) continue; // notre propre écriture
        if (originalTexts.has(n)) originalTexts.delete(n); // la page a changé ce texte
        pending.add(n);
      } else {
        m.addedNodes.forEach((n) => pending.add(n));
      }
    }
  }
  function flushPending() {
    clearTimeout(flushTimer); flushTimer = null;
    for (let passe = 0; passe < 6; passe++) {
      queue(observer.takeRecords());
      if (!isTranslated) { pending.clear(); return; }
      if (!pending.size) return;
      const nodes = [...pending]; pending.clear();
      for (const node of nodes) {
        if (!node.isConnected) continue;
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.id === "safinum-ewondo-banner") continue;
          getTextNodes(node).forEach(translateNode);
          translateAttributes(node);
        } else if (node.nodeType === Node.TEXT_NODE && !originalTexts.has(node)) {
          getTextNodes(node).forEach(translateNode);
        }
      }
    }
  }
  const observer = new MutationObserver((mutations) => {
    if (!isTranslated) return;
    queue(mutations);
    // Synchrone une fois la page traduite : un setTimeout(150) (voire 0)
    // laisse Vue peindre le français réinjecté (changement de mode de
    // paiement, recalcul des frais) avant notre passe. flushPending
    // ignore déjà nos propres écritures et reprend les mutations de la
    // page survenues pendant la passe (jusqu'à 6 tours).
    flushPending();
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true });

  // ── API publique (utilisée par demo.html, tests) ───────
  window.SafinumTranslator = {
    translateText,
    translatePage,
    restorePage,
    togglePage,
    isTranslated: () => isTranslated,
    engine: () => (engineReady() ? "model" : (typeof EWONDO_DICT !== "undefined" ? "dictionary" : "none")),
    modelReady,
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  };
})();
