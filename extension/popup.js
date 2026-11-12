// ============================================================
// SAFINUM Éwondo Translator — Popup Script (v5.1.1)
// ============================================================

const mainToggle   = document.getElementById("mainToggle");
const statusPill   = document.getElementById("statusPill");
const toggleLabel  = document.getElementById("toggleLabel");
const autoCheckbox = document.getElementById("autoCheckbox");
const msgBox       = document.getElementById("msg");

let currentlyTranslated = false;

document.getElementById("ver").textContent = "v" + chrome.runtime.getManifest().version.replace(/\.0$/, "");

// ── Interface ────────────────────────────────────────────
function setUI(translated) {
  currentlyTranslated = !!translated;
  mainToggle.classList.toggle("active", currentlyTranslated);
  mainToggle.setAttribute("aria-pressed", String(currentlyTranslated));
  statusPill.classList.toggle("active", currentlyTranslated);
  statusPill.textContent = currentlyTranslated ? "Éwondo" : "Français";
  toggleLabel.textContent = currentlyTranslated ? "Revenir au texte original" : "Traduire cette page en Éwondo";
}

function showMsg(text) {
  msgBox.textContent = text || "";
  msgBox.classList.toggle("show", !!text);
}

// ── Onglet actif ─────────────────────────────────────────
function withActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs && tabs[0]));
}

const DEMO_URL = chrome.runtime.getURL("demo.html");
const isOwnDemo = (tab) => !!tab && (tab.url || "").startsWith(DEMO_URL);

// chrome://, edge://, about:, Chrome Web Store, pages d'autres extensions → non injectables
function isInjectableTab(tab) {
  if (!tab || !tab.id) return false;
  const url = tab.url || "";
  if (isOwnDemo(tab)) return true;
  return /^(https?|file):/.test(url) && !/^https:\/\/chrome\.google\.com\/webstore/.test(url) && !/^https:\/\/chromewebstore\.google\.com/.test(url);
}

// Envoie une action à la page : la démo de l'extension écoute via runtime,
// les pages web via le content script (injecté si nécessaire).
function sendAction(tab, action, callback) {
  if (isOwnDemo(tab)) {
    chrome.runtime.sendMessage({ action }, (resp) => { void chrome.runtime.lastError; callback(resp); });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (resp) => {
    if (!chrome.runtime.lastError && resp !== undefined) {
      chrome.tabs.sendMessage(tab.id, { action }, (r) => { void chrome.runtime.lastError; callback(r); });
      return;
    }
    // Onglet ouvert avant l'installation (ou avant un rechargement de
    // l'extension) : injection programmatique dans tous les cadres.
    // v5.1.1 : les fichiers sont ré-injectables sans erreur.
    chrome.scripting.executeScript(
      { target: { tabId: tab.id, allFrames: true }, files: ["engine.js", "dictionary.js", "content.js"] },
      () => {
        const err = chrome.runtime.lastError;
        if (err) { console.warn("[SAFINUM] injection impossible :", err.message); callback(null, err.message); return; }
        chrome.tabs.sendMessage(tab.id, { action }, (r) => { void chrome.runtime.lastError; callback(r); });
      }
    );
  });
}

const FILE_HELP = "Fichier local : ouvrez chrome://extensions, « Détails » de SAFINUM Éwondo, puis activez « Autoriser l'accès aux URL de fichier ».";

function refreshStatus() {
  withActiveTab((tab) => {
    if (!isInjectableTab(tab)) {
      mainToggle.disabled = true;
      showMsg("Cette page ne peut pas être traduite (page interne du navigateur).");
      return;
    }
    if (isOwnDemo(tab)) {
      chrome.runtime.sendMessage({ action: "getStatus" }, (r) => { void chrome.runtime.lastError; if (r) setUI(r.isTranslated); });
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (r) => {
      if (chrome.runtime.lastError) return; // pas encore injecté
      if (r) setUI(r.isTranslated);
    });
  });
}

mainToggle.addEventListener("click", () => {
  withActiveTab((tab) => {
    if (!isInjectableTab(tab)) return;
    showMsg("");
    const go = () => sendAction(tab, currentlyTranslated ? "restore" : "translate", (resp) => {
      if (resp) setUI(resp.isTranslated);
      else showMsg("La page n'a pas répondu. Rechargez-la (F5) puis réessayez.");
    });
    // Pages locales (file://) : Chrome exige une autorisation explicite
    if (/^file:/.test(tab.url || "") && chrome.extension && chrome.extension.isAllowedFileSchemeAccess) {
      chrome.extension.isAllowedFileSchemeAccess((allowed) => {
        if (allowed) go();
        else showMsg(FILE_HELP);
      });
      return;
    }
    go();
  });
});

// ── Option : traduction automatique ──────────────────────
chrome.storage.local.get(["autoTranslate"], (data) => {
  autoCheckbox.checked = !!(data && data.autoTranslate);
});
autoCheckbox.addEventListener("change", () => {
  chrome.storage.local.set({ autoTranslate: autoCheckbox.checked });
});

// ── Lexique : lu depuis le modèle embarqué (fichier local) ─
const LEXIQUE = ["envoyer de l'argent", "solde disponible", "frais", "bénéficiaire", "code pin", "alerte de sécurité", "historique"];
fetch(chrome.runtime.getURL("ewondo_model.json"))
  .then((r) => r.json())
  .then((m) => {
    const box = document.getElementById("lexique");
    for (const fr of LEXIQUE) {
      const ew = (m.exact && m.exact[fr]) || (m.words && m.words[fr]);
      if (!ew) continue;
      const row = document.createElement("div");
      row.className = "lex-item";
      const a = document.createElement("span"); a.className = "lex-fr"; a.textContent = fr.charAt(0).toUpperCase() + fr.slice(1);
      const b = document.createElement("span"); b.className = "lex-ew"; b.textContent = ew.charAt(0).toUpperCase() + ew.slice(1);
      row.append(a, b);
      box.appendChild(row);
    }
    document.getElementById("stats").textContent =
      `Modèle v${m.meta.version} : ${Object.keys(m.exact).length} expressions · ${Object.keys(m.words).length} mots`;
  })
  .catch(() => { document.getElementById("stats").textContent = "Modèle indisponible : dictionnaire de secours."; });

// ── Bouton démo ──────────────────────────────────────────
document.getElementById("btnDemo").addEventListener("click", () => {
  chrome.tabs.create({ url: DEMO_URL });
  window.close();
});

refreshStatus();
