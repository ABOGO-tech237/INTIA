// ============================================================
// SAFINUM Éwondo Translator — Background Service Worker
// ============================================================

// Création du menu contextuel (clic droit sur la page)
chrome.runtime.onInstalled.addListener(() => {
  // v5.1.1 : on repart de zéro (évite « duplicate id » après mise à jour)
  chrome.contextMenus.removeAll(() => {
  void chrome.runtime.lastError;
  chrome.contextMenus.create({
    id: "safinum-translate",
    title: "Traduire cette page en Éwondo",
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: "safinum-restore",
    title: "Restaurer le texte original",
    contexts: ["page"]
  });
  });
});

// v5.1.1 : envoi sûr vers un onglet. Si le script de contenu n'y est pas
// (onglet ouvert avant l'installation), on l'injecte d'abord. Plus d'erreur
// « Could not establish connection. Receiving end does not exist. »
function sendToTab(tabId, action, cb = () => {}) {
  chrome.tabs.sendMessage(tabId, { action }, (resp) => {
    if (!chrome.runtime.lastError && resp !== undefined) { cb(resp); return; }
    chrome.scripting.executeScript(
      { target: { tabId, allFrames: true }, files: ["engine.js", "dictionary.js", "content.js"] },
      () => {
        if (chrome.runtime.lastError) { cb(null); return; } // page interne (chrome://…) ou file:// non autorisé
        chrome.tabs.sendMessage(tabId, { action }, (r) => { void chrome.runtime.lastError; cb(r); });
      }
    );
  });
}

// Gestion du clic sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === "safinum-translate") {
    sendToTab(tab.id, "translate");
  } else if (info.menuItemId === "safinum-restore") {
    sendToTab(tab.id, "restore");
  }
});

// Relais des messages depuis le popup vers l'onglet actif
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === "content") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) { sendResponse(null); return; }
      {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          void chrome.runtime.lastError;
          sendResponse(response);
        });
      }
    });
    return true; // async
  }
});
