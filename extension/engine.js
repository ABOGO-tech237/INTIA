// ============================================================
// SAFINUM Éwondo Translator — Moteur linguistique embarqué
// Architecture : phrases exactes + grammaire sourcée (Pichon 1950)
//                + repli lexical seulement si la phrase est entière
// Modèle : ewondo_model.json (v5.1 : 382 expressions, 222 mots)
// v5.0 : chargement possible depuis un objet (démo autonome file://)
//        + limites de mots compatibles avec les lettres accentuées
// v5.1.1 : ré-injection, regex unique
// Grammaire : règles de Pichon 1950 uniquement, page citée en commentaire.
//             Une règle sans source n'est pas implémentée.
//             Une phrase incomplète (mot ou règle manquant) reste intacte.
// ============================================================

// v5.1.1 : fichier ré-injectable sans erreur (« Identifier 'WB_L' has already
// been declared ») : tout est enveloppé et publié une seule fois sur globalThis.
(function (g) {
"use strict";
if (g.ewondoEngine) return;

// Limites de mots Unicode : `\b` de JavaScript ne connaît que [A-Za-z0-9_],
// ce qui coupait les mots accentués (« crédité », « sécurité », « bloqué »).
const WB_L = "(?<![\\p{L}\\p{M}\\p{N}_])";
const WB_R = "(?![\\p{L}\\p{M}\\p{N}_])";

// Jeton de donnée protégée (montants, dates, références, téléphones).
const RE_PROTECTED = /\x00P\d+\x00|\uE000\d+\uE001/g;
const RE_PROTECTED_ONLY = /^(?:\x00P\d+\x00|\uE000\d+\uE001)$/;

// ─────────────────────────────────────────────────────────────
// Grammaire sourcée — Pichon, Petite grammaire ewondo, 1950.
// Orthographe de sortie : AGLC (NOTES-EQUIPE §0) : è→ɛ, ò→ɔ, ë→ə, ñ→ŋ ;
// les tons ne sont pas notés.
// ─────────────────────────────────────────────────────────────

// P p.20 : « La forme négative des verbes s'obtient en ajoutant
// « kik » « pas » après le verbe. »  (aussi p.66, indicatif : madin kik).
// P p.99 (lexique éwondo-français) : « kik, ki […] ne pas ».
// On utilise la forme « kik » citée par la règle, déjà retenue en v5.1.
const KIK = "kik";

// P p.66 : subjonctif et impératif négatifs —
// « On emploie l'indicatif présent, précédé du mot të »
// (OCR « fé » ; les paradigmes et exemples portent të / té :
// « të wadin », « Të miaké avol », « Té miabè »).
// Lexique P p.118 : « tëgë, të, sans, ne… pas ». AGLC : të → tə.
const TE = "tə";

// P p.114 : « jamais, tò eyôñ » → tɔ eyɔŋ (AGLC). Place : fin de proposition
// (NT 2012 Jn 6,35 « ayi ki wog ekode tò eyòṅ » ; Jn 10,28 ; Jn 13,8).
const JAMAIS = "tɔ eyɔŋ";

// P p.11 : ban = « et (entre 2 personnes) ».
// P p.14 (PDF 16, vocabulaire ; exemples p.15) : ai = « et, avec » (entre noms).
// P p.21 : ndò fë = « et (entre deux phrases) » → ndɔ fə.
const ET_PERSONNES = "ban";
const ET_NOMS = "ai";
const ET_PHRASES = "ndɔ fə";

// P p.12 : indicatif présent d'un verbe d'action.
// « Les pronoms de ce verbe sont ceux du verbe « être » auxquels on a
// ajouté a, la marque du présent actif. »
// « me + a = ma ; o + a = wa ; a + a = a ; bi + a = bia ; be + a = ba. »
// Le paradigme écrit aussi « mia din, vous aimez » (mi + a = mia).
const SUBJECT_PREFIX = {
  je: "ma",
  tu: "wa",
  il: "a",
  elle: "a",
  nous: "bia",
  vous: "mia",
  ils: "ba",
  elles: "ba"
};

// P p.20 et p.56-58 : présent négatif du verbe « être ».
// « je ne suis pas, mesikik ; tu n'es pas, osikik ; il n'est pas, asikik ;
// nous ne sommes pas, bisikik ; vous n'êtes pas, misikik ; ils ne sont pas,
// besikik. »  Le présent de « être » « ne prend pas [l'] a supplémentaire »
// (p.58) : on n'utilise donc pas ma- + stem + kik pour « être ».
const ETRE_NEG_PRESENT = {
  je: "mesikik",
  tu: "osikik",
  il: "asikik",
  elle: "asikik",
  nous: "bisikik",
  vous: "misikik",
  ils: "besikik",
  elles: "besikik"
};

// P p.43 : « L'adjectif possessif se place après le nom qu'il détermine,
// et suit la règle d'accord ; c'est-à-dire, il prend le préfixe de la
// classe de ce nom. »
// Bases p.43 : « am, mon, mes ; oe, ton, tes ; ie, son, ses ;
// an, notre, nos ; an, votre, vos ; aban, […] leurs. »
// Tableau classe I (mòn / bòn), p.43-44, AGLC (ò → ɔ) :
//   sg : wɔm, woe, (3e sg. : lecture incertaine, non générée), wan, wan, waban
//   pl : bam, boe, …, ban, ban, baban
// L'accord n'est appliqué que si la classe est sourcée (tableau ci-dessous
// ou motif déjà présent dans le modèle exact).
// « son/sa » cl. I sg = woe (comme « ton ») ; « ses » cl. I pl = boe
// (tableau P p.43-44, pages PDF 45-46 : mòn wòm, woe, woe, wan, wan, waban ;
// bòn bam, boe, boe, ban, ban, baban).
const POSS_BY_CLASS = {
  "I-sg": { mon: "wɔm", ma: "wɔm", mes: "wɔm", ton: "woe", ta: "woe", tes: "woe", son: "woe", sa: "woe", ses: "woe", notre: "wan", nos: "wan", votre: "wan", vos: "wan", leur: "waban", leurs: "waban" },
  "I-pl": { mon: "bam", ma: "bam", mes: "bam", ton: "boe", ta: "boe", tes: "boe", son: "boe", sa: "boe", ses: "boe", notre: "ban", nos: "ban", votre: "ban", vos: "ban", leur: "baban", leurs: "baban" }
};

// Classe sourcée uniquement pour des lemmes éwondo déjà dans le modèle.
// P p.101 : « mòni (1), argent ».
const NOUN_CLASS = {
  "mɔni": { key: "I-sg", source: "Pichon 1950 p.101 « mòni (1), argent »" }
};

// P p.7-8 : l'article éwondo « e » ne s'emploie que devant un nom accompagné
// d'un adjectif déterminatif, ordinal ou démonstratif, ou suivi d'un pronom
// relatif. « En dehors de ces cas on n'emploie pas l'article. »
// Les articles français le, la, les, l', un, une, des, du ne sont donc
// pas rendus dans les constructions que nous savons traduire.
const FR_ARTICLES = new Set(["le", "la", "les", "l", "l'", "un", "une", "des", "du"]);

// Noms de marque / codes déjà conservés tels quels (NOTES-EQUIPE, audit).
const PASSTHROUGH = new Set([
  "mtn", "orange", "money", "mobile", "wave", "camfinance", "safinum", "pay",
  "pin", "fcfa", "xaf", "eur", "usd", "qr", "nfc", "om", "txn", "ewondo",
  "éwondo", "en", "fr", "cm", "an"
]);

class EwondoEngine {
  constructor() {
    this.model = null;
    this.ready = false;
    this.ngramIndex = {};
    this.gaps = [];
  }

  // ── Chargement du modèle JSON ─────────────────────────────
  async load(modelUrl) {
    try {
      const resp = await fetch(modelUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.loadFromObject(await resp.json());
    } catch (e) {
      console.warn("[EwondoEngine] Modèle non chargé (repli dictionnaire) :", e);
    }
    return this.ready;
  }

  // Chargement direct (ex. window.EWONDO_MODEL fourni par ewondo_model.js)
  loadFromObject(model) {
    if (!model || !model.exact || !model.words) return false;
    if (this.ready) return true;
    this.model = model;
    this.ngramIndex = {};
    this._buildNgramIndex();
    this._buildLexiconIndex();
    this.ready = true;
    console.log(
      `[EwondoEngine] Modèle chargé — ${Object.keys(model.exact).length} phrases, ` +
      `${Object.keys(model.words).length} mots, domaine: ${model.meta && model.meta.domain}`
    );
    return true;
  }

  // ── Index n-gram en mémoire ───────────────────────────────
  _buildNgramIndex() {
    for (const [fr, ew] of Object.entries(this.model.exact)) {
      for (const gram of this._ngrams(fr)) {
        if (!this.ngramIndex[gram]) this.ngramIndex[gram] = [];
        this.ngramIndex[gram].push([fr, ew]);
      }
    }
  }

  // Index pour la grammaire : formes de possessifs déjà sourcées dans exact,
  // et radicaux verbaux déduits de conjugaisons exactes (ex. « je comprends » = mayem).
  _buildLexiconIndex() {
    this._possExamples = Object.create(null); // frNoun → { det, nounEw, possEw }
    this._verbStems = Object.create(null);    // infinitif ou forme FR → radical EW
    const dets = "mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs";
    const rePoss = new RegExp("(?:^| )(" + dets + ") (.+)$");
    for (const [fr, ew] of Object.entries(this.model.exact)) {
      const m = fr.match(rePoss);
      if (!m) continue;
      const det = m[1];
      const nounFr = m[2];
      const parts = ew.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const possEw = parts[parts.length - 1];
      // Si le nom français a déjà une entrée lexicale, on ne retient le
      // motif que lorsque cette entrée précède bien le possessif dans la
      // sortie (ex. « entrer votre code » = « nyan asoe wan »).
      const known = (this.model.exact[nounFr] || this.model.words[nounFr] || "").trim();
      let nounEw;
      if (known && ew.trim().endsWith(known + " " + possEw)) {
        nounEw = known;
      } else if (!fr.startsWith(det + " ")) {
        // Locution plus longue sans lemme isolé : on n'invente pas le nom.
        continue;
      } else {
        nounEw = parts.slice(0, -1).join(" ");
      }
      // Une entrée plus directe (« votre code ») remplace un motif dérivé.
      const prev = this._possExamples[nounFr];
      const direct = fr === det + " " + nounFr;
      if (!prev || direct) {
        this._possExamples[nounFr] = { det, nounEw, possEw };
      }
    }
    // « je X » = ma- + radical, P p.12.
    for (const [fr, ew] of Object.entries(this.model.exact)) {
      const m = fr.match(/^je (\S+)$/);
      if (!m) continue;
      const form = ew.trim();
      if (!form.startsWith("ma") || form.includes(" ")) continue;
      const stem = form.slice(2);
      if (stem) {
        this._verbStems[m[1]] = stem;
        const inf = this._toInfinitive(m[1]);
        if (inf) this._verbStems[inf] = stem;
      }
    }
    // Verbes du lexique dont la sortie est un seul radical (pas de locution).
    for (const [fr, ew] of Object.entries(this.model.words)) {
      if (ew && !ew.includes(" ") && /(?:er|ir|re|oir)$/.test(fr)) {
        this._verbStems[fr] = ew;
      }
    }
  }

  _ngrams(text, n = 2) {
    const toks = text.toLowerCase().split(/\s+/);
    const grams = new Set(toks);
    for (let i = 0; i <= toks.length - n; i++) {
      grams.add(toks.slice(i, i + n).join(" "));
    }
    return grams;
  }

  _norm(text) {
    return text.toLowerCase().trim().replace(/’/g, "'").replace(/\s+/g, " ");
  }

  clearGaps() {
    this.gaps = [];
  }

  getGaps() {
    return this.gaps.slice();
  }

  _recordGap(fr, reason, missing) {
    this.gaps.push({ fr, reason, missing: missing || [] });
  }

  // ── Méthode principale de traduction (chaîne unique) ─────
  translate(text) {
    if (!this.ready || !this.model) return { text, confidence: 0, method: "not_ready" };

    const key = this._norm(text);

    // 1. Correspondance exacte (lookup table)
    if (this.model.exact[key]) {
      return { text: this.model.exact[key], confidence: 1.0, method: "exact" };
    }

    // 2. Grammaire sourcée (phrase entière)
    const g = this._grammarTranslate(key);
    if (g && g.ok) {
      return { text: g.text, confidence: 0.95, method: "grammar", rule: g.rule, source: g.source };
    }

    // 3. Fuzzy matching n-gram : conservé pour l'API translate(), mais
    //    jamais utilisé par translateText (pas de traduction approximative
    //    d'une phrase de page).
    const queryGrams = this._ngrams(key);
    const scores = {};
    for (const gram of queryGrams) {
      for (const [candFr, candEw] of (this.ngramIndex[gram] || [])) {
        scores[candFr] = (scores[candFr] || 0) + 1;
      }
    }

    if (Object.keys(scores).length > 0) {
      const bestFr = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
      const candGrams = this._ngrams(bestFr);
      const intersection = [...queryGrams].filter(x => candGrams.has(x)).length;
      const union = new Set([...queryGrams, ...candGrams]).size;
      const jaccard = intersection / union;

      if (jaccard > 0.45) {
        const result = this.model.exact[bestFr];
        return { text: result, confidence: jaccard, method: "fuzzy" };
      }
    }

    // 4. Mot unique du lexique (étiquette d'interface, pas une phrase mêlée)
    if (!key.includes(" ") && this._lookup(key)) {
      const ew = this._lookup(key);
      return { text: ew, confidence: 1.0, method: "word" };
    }

    this._recordGap(text, (g && g.reason) || "règle ou mot manquant pour une phrase entière", (g && g.missing) || []);
    return { text, confidence: 0, method: "unknown" };
  }

  // ── Traduction d'un texte long (plusieurs phrases) ───────
  translateText(text) {
    if (!this.ready) return text;

    // Correspondance exacte sur le texte original (chiffres compris), pour
    // ne pas casser une entrée du lexique du type
    // « … 2026 - Safinum » ou « Frais de 2 % (min. 200 FCFA, …) ».
    const ws = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const lead = ws ? ws[1] : "";
    const mid = ws ? ws[2] : text;
    const trail = ws ? ws[3] : "";
    if (mid) {
      const peeled = this._peelPunct(mid);
      const fullKey = this._norm(peeled.inner);
      const exactHit = (fullKey && (this.model.exact[fullKey] || this.model.words[fullKey])) || null;
      if (exactHit) {
        return lead + peeled.before + this._matchCase(peeled.inner, exactHit) + peeled.after + trail;
      }
    }

    // ── Protéger les données financières et les identifiants ─
    // Ordre : dates en lettres, pourcentages (y compris « 2 % »), montants,
    // numéros de compte, références, téléphones, puis autres nombres.
    const protected_ = [];
    const protectRe = new RegExp(
      [
        // dates « 05 nov. 2026 » (un seul bloc, le point de l'abréviation n'est pas une fin de phrase)
        "\\d{1,2}\\s+(?:janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)\\.?\\s+\\d{4}",
        // pourcentages entiers ou décimaux : 2 %, 1,5 %, 18,5%
        "\\d+(?:[.,]\\d+)?\\s*%",
        // montants avec devise
        "\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:FCFA|XAF|EUR|USD|F\\b|€|\\$)(?:\\s*\\/\\s*\\w+)?",
        // milliers sans devise
        "\\d{1,3}(?:[\\s\\u00a0\\u202f]\\d{3})+(?:[.,]\\d+)?",
        // dates chiffrées
        "\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2}",
        // numéro de compte « CM 001 2345 6789 01 »
        "\\bCM(?:[\\s\\u00a0\\u202f]\\d{2,})+",
        // références type OM-2026-9910, TXN-2026-0012
        "[A-Z]{2,}-\\d{4,}[-A-Z0-9]*",
        // téléphones
        "\\+?[26]\\d{8,}",
        // autres nombres de 4 chiffres ou plus (années isolées, PIN…)
        "\\b\\d{4,}\\b"
      ].join("|"),
      "gi"
    );
    let result = text.replace(protectRe, (match) => {
      const token = `\x00P${protected_.length}\x00`;
      // La date reste un seul bloc ; on y traduit seulement un mois déjà sourcé.
      protected_.push(this._renderProtected(match));
      return token;
    });

    result = this._translateSegments(result);

    result = result.replace(/\x00P(\d+)\x00/g, (_, i) => protected_[+i]);
    return result;
  }

  // À l'intérieur d'un jeton protégé, traduire uniquement les mots déjà
  // présents dans le lexique (mois « nov. » / « oct. », etc.). Rien n'est inventé :
  // si l'abréviation n'est pas sourcée, le jeton reste inchangé. La date
  // demeure un seul bloc, sans coupure sur le point de l'abréviation.
  _renderProtected(match) {
    const monthRe = /\b(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)\.?/gi;
    return match.replace(monthRe, (raw) => {
      const bare = raw.replace(/\.$/, "");
      const key = this._norm(bare);
      const words = this.model.words || {};
      const exact = this.model.exact || {};
      return words[key] || exact[key] || words[this._norm(raw)] || exact[this._norm(raw)] || raw;
    });
  }

  // Découpe en phrases, traduit chacune entièrement ou la laisse intacte.
  _translateSegments(text) {
    // Ne pas couper sur le point d'une abréviation (min., max., nov., etc.).
    const parts = text.split(/(?<=(?<!\b(?:min|max|janv|f[eé]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c|mr|mme|dr|st|cf|etc|ex|n°|tel|tél|réf|ref))[.!?…])(?=\s|$)/i);
    return parts.map((seg) => this._translateOneSegment(seg)).join("");
  }

  _translateOneSegment(seg) {
    if (!seg) return seg;
    const m = seg.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const lead = m ? m[1] : "";
    const trail = m ? m[3] : "";
    const core = m ? m[2] : seg;
    if (!core) return seg;

    const peeled = this._peelPunct(core);
    const translated = this._translateCore(peeled.inner, core);
    if (translated === null) return seg;
    return lead + peeled.before + this._matchCase(peeled.inner, translated) + peeled.after + trail;
  }

  _peelPunct(core) {
    // Virgule, tiret et tirets typographiques aussi en tête, pour conserver
    // « , max. » et « - Safinum » autour d'un segment protégé ou d'un nom propre.
    const m = core.match(/^([«»"“”'‘’(\[\s.,;:!?…—–-]*)([\s\S]*?)([»«"“”'‘’)\]\s.,;:!?…—–-]*)$/);
    if (!m) return { before: "", inner: core, after: "" };
    return { before: m[1], inner: m[2], after: m[3] };
  }

  _matchCase(original, ew) {
    if (!original || !ew) return ew;
    const letters = original.replace(/[^\p{L}]/gu, "");
    if (letters.length > 1 && letters === letters.toUpperCase()) {
      // Les titres tout en capitales : on garde la casse du lexique
      // (pas de mot éwondo en capitales dans le modèle) et on majuscule
      // seulement l'initiale, comme en v5.1.1.
      return ew.charAt(0).toUpperCase() + ew.slice(1);
    }
    if (/\p{L}/u.test(original[0]) && original[0] === original[0].toUpperCase()) {
      return ew.charAt(0).toUpperCase() + ew.slice(1);
    }
    return ew;
  }

  // Traduit le noyau d'un segment. Renvoie null s'il faut le laisser intact.
  // Les montants protégés restent à leur place, avec la ponctuation qui les entoure
  // (« Solde disponible : 47 500 FCFA »).
  _translateCore(inner, originalForGap) {
    const trimmed = inner.trim();
    if (!trimmed) return inner;

    const withoutProt = trimmed.replace(RE_PROTECTED, " ").replace(/\s+/g, " ").trim();
    if (!withoutProt) return inner;

    const pieces = trimmed.split(/(\x00P\d+\x00|\uE000\d+\uE001)/);
    const out = [];
    let gap = null;
    for (const piece of pieces) {
      if (!piece) continue;
      if (RE_PROTECTED_ONLY.test(piece)) { out.push(piece); continue; }
      const peeled = this._peelPunct(piece);
      if (!peeled.inner.trim()) { out.push(piece); continue; }
      const tr = this._translateFrench(peeled.inner);
      if (tr === null) {
        gap = this._lastFrenchGap || { reason: "phrase non rendue entièrement (mot ou règle manquant)", missing: this._missingWords(this._norm(peeled.inner)) };
        break;
      }
      out.push(peeled.before + this._matchCase(peeled.inner, tr) + peeled.after);
    }
    if (gap) {
      this._recordGap(originalForGap || inner, gap.reason, gap.missing || []);
      return null;
    }
    return out.join("");
  }

  // Traduction d'un fragment français sans montant (clé normalisée, ponctuation déjà pelée).
  _translateFrench(inner) {
    const keyRaw = this._norm(inner);
    const key = keyRaw.replace(/^[\s.,;:!?…—–-]+|[\s.,;:!?…—–-]+$/g, "");
    this._lastFrenchGap = null;
    if (!key) return inner;
    if (this.model.exact[key]) return this.model.exact[key];
    if (this.model.words[key]) return this.model.words[key];
    const strippedArts = this._stripLeadingArticles(key);
    if (strippedArts && strippedArts !== key) {
      if (this.model.exact[strippedArts]) return this.model.exact[strippedArts];
      if (this.model.words[strippedArts]) return this.model.words[strippedArts];
    }
    const g = this._grammarTranslate(key, inner);
    if (g && g.ok) return g.text;
    this._lastFrenchGap = {
      reason: (g && g.reason) || "phrase non rendue entièrement (mot ou règle manquant)",
      missing: (g && g.missing) || this._missingWords(key)
    };
    return null;
  }

  _stripProtected(text) {
    return text.replace(RE_PROTECTED, " ").replace(/\s+/g, " ").trim();
  }

  _reinsertProtected(original, translated) {
    const tokens = original.match(RE_PROTECTED) || [];
    if (tokens.length === 0) return translated;
    // On replace les montants à la même position relative (début / milieu / fin).
    const startProt = original.match(/^(?:\s|\x00P\d+\x00|\uE000\d+\uE001)+/);
    const endProt = original.match(/(?:\s|\x00P\d+\x00|\uE000\d+\uE001)+$/);
    const leading = [];
    const trailing = [];
    const middle = [];
    let seenFr = false;
    const pieces = original.split(/(\x00P\d+\x00|\uE000\d+\uE001)/);
    for (const p of pieces) {
      if (!p) continue;
      if (RE_PROTECTED_ONLY.test(p)) {
        if (!seenFr) leading.push(p);
        else middle.push(p);
      } else if (p.replace(/\s+/g, "")) {
        seenFr = true;
        // protégé déjà classé en « leading » qui suivrait un vide : rien
      }
    }
    // Les jetons après le français vont en trailing (on les reprend depuis la fin).
    const all = original.match(RE_PROTECTED) || [];
    const trailCount = endProt ? (endProt[0].match(RE_PROTECTED) || []).length : 0;
    const leadCount = startProt ? (startProt[0].match(RE_PROTECTED) || []).length : 0;
    const head = all.slice(0, leadCount);
    const tail = all.slice(all.length - trailCount);
    const mid = all.slice(leadCount, all.length - trailCount);
    const midJoin = mid.length ? " " + mid.join(" ") + " " : " ";
    return (head.length ? head.join(" ") + " " : "") + translated + (mid.length ? midJoin : "") + (tail.length ? " " + tail.join(" ") : "");
  }

  _stripLeadingArticles(key) {
    if (!key) return key;
    const toks = key.split(" ");
    while (toks.length > 1 && FR_ARTICLES.has(toks[0])) toks.shift();
    return toks.join(" ");
  }

  _lookup(fr) {
    if (!fr) return null;
    const k = this._norm(fr);
    if (this.model.exact[k]) return this.model.exact[k];
    if (this.model.words[k]) return this.model.words[k];
    return null;
  }

  // ── Grammaire : renvoie {ok, text, rule, source} ou {ok:false, reason, missing}
  _grammarTranslate(key, raw) {
    if (!key) return { ok: false, reason: "vide", missing: [] };

    // (a) Défense / impératif-subjonctif négatif : tə + indicatif présent
    //     P p.66. 2e pers. pluriel : tə + mia- + radical (ex. Tə miakab).
    const imp = this._tryNegativeImperative(key);
    if (imp) return imp;

    // (b) Négation d'indicatif : verbe conjugué + kik  (P p.20, p.66)
    const neg = this._tryIndicativeNegation(key);
    if (neg) return neg;

    // (c) « sans » + GN  : tə ai + nom  (P p.118 « sans, tëgë ai, té ai »)
    const sans = this._trySans(key);
    if (sans) return sans;

    // (d) Possessif + nom : nom + possessif  (P p.43)
    const poss = this._tryPossessiveNP(key);
    if (poss) return poss;

    // (e) « et » selon le contexte (P p.11 / p.14-15 / p.21)
    const et = this._tryCoordination(key, raw);
    if (et) return et;

    // (f) Formule de salutation + nom propre : « Bonjour, Amina »
    const greet = this._tryGreeting(key, raw);
    if (greet) return greet;

    return { ok: false, reason: "aucune règle sourcée ne couvre cette phrase", missing: this._missingWords(key) };
  }

  _tryNegativeImperative(key) {
    // « ne V-ez pas (jamais) … »  /  « ne V-e pas … » (2sg, wa-)
    // « ne partagez pas » ; « ne partagez jamais votre code pin »
    const re = /^ne ([^\s]+?)(?:-t-on)? (pas|jamais)(?: (.+))?$/;
    const m = key.match(re);
    if (!m) return null;
    const verbForm = m[1];
    const adverb = m[2];
    const rest = m[3] || "";

    // 2e pluriel (V-ez) : préfixe mia-  (P p.12 « mia din, vous aimez »)
    // 2e singulier (V-e / V-s, sans -ez) : préfixe wa-  (P p.12 ; p.66 « të wadin »)
    const is2pl = /ez$/.test(verbForm) || /issez$/.test(verbForm);
    const prefix = is2pl ? "mia" : "wa";
    const person = is2pl ? "vous" : "tu";

    const stem = this._verbStem(verbForm);
    if (!stem) {
      return {
        ok: false,
        reason: "mot manquant au lexique (verbe de la défense) ou radical non sourcé",
        missing: [this._toInfinitive(verbForm) || verbForm]
      };
    }

    let complements = "";
    if (rest) {
      const c = this._translateComplement(rest);
      if (!c.ok) return c;
      complements = c.text ? " " + c.text : "";
    }
    // Surface : Tə miakab, Të wadin — préfixe soudé au radical (P p.12, p.66).
    // « jamais » : tɔ eyɔŋ en fin de proposition (P p.114 ; NT Jn 6,35 ; 10,28 ; 13,8).
    // Les phrases déjà dans exact (ex. v5.1 « Tə miakab asoe wan ») restent prioritaires.
    let text = TE.charAt(0).toUpperCase() + TE.slice(1) + " " + prefix + stem + complements;
    if (adverb === "jamais") text += " " + JAMAIS;
    return {
      ok: true,
      text,
      rule: "tə + " + (is2pl ? "mia-" : "wa-") + "radical (défense / impératif négatif)",
      source: "Pichon 1950 p.66 ; préfixe " + person + " : p.12"
    };
  }

  _tryIndicativeNegation(key) {
    // « je/tu/il/… ne V pas … »  ;  « je n'V pas … »
    const re = /^(je|tu|il|elle|nous|vous|ils|elles) n(?:e |')([^\s]+?) (pas|jamais)(?: (.+))?$/;
    const m = key.match(re);
    if (!m) return null;
    const subj = m[1];
    const verbForm = m[2];
    const adverb = m[3];
    const rest = m[4] || "";

    // Verbe « être » : paradigme propre (P p.20, p.56-58).
    if (this._isEtre(verbForm)) {
      if (rest) {
        // Complément de « être » : pas de règle sourcée assez sûre ici.
        return {
          ok: false,
          reason: "règle non sourcée pour un attribut après « ne … être … pas »",
          missing: rest.split(/\s+/)
        };
      }
      return {
        ok: true,
        text: ETRE_NEG_PRESENT[subj],
        rule: "présent négatif de « être » (forme figée, sans a- supplémentaire)",
        source: "Pichon 1950 p.20 et p.56-58"
      };
    }

    const stem = this._verbStem(verbForm);
    if (!stem) {
      return {
        ok: false,
        reason: "mot manquant au lexique (verbe de la négation) ou radical non sourcé",
        missing: [this._toInfinitive(verbForm) || verbForm]
      };
    }
    let complements = "";
    if (rest) {
      const c = this._translateComplement(rest);
      if (!c.ok) return c;
      complements = c.text ? " " + c.text : "";
    }
    let text = SUBJECT_PREFIX[subj] + stem + " " + KIK + complements;
    if (adverb === "jamais") text += " " + JAMAIS;
    return {
      ok: true,
      text,
      rule: "indicatif présent + kik" + (adverb === "jamais" ? " + tɔ eyɔŋ en fin de proposition" : ""),
      source: "Pichon 1950 p.20 et p.66 ; préfixe sujet p.12" + (adverb === "jamais" ? " ; jamais : P p.114, NT Jn 6,35" : "")
    };
  }

  _trySans(key) {
    const m = key.match(/^sans (.+)$/);
    if (!m) return null;
    const c = this._translateComplement(m[1]);
    if (!c.ok) return c;
    // P p.118 : « sans, tëgë ai, té ai ». La v5.1 retient « tə ai » (déjà
    // dans « sans frais » = « tə ai mɔni »).
    return {
      ok: true,
      text: "tə ai " + c.text,
      rule: "sans = tə ai + nom",
      source: "Pichon 1950 p.118 « sans, tëgë ai, té ai »"
    };
  }

  _tryPossessiveNP(key) {
    const re = /^(mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs) (.+)$/;
    const m = key.match(re);
    if (!m) return null;
    const det = m[1];
    const nounFr = m[2];
    // Si tout le GN est déjà dans exact, c'est géré plus haut. Ici : composition.
    const nounEw = this._lookup(nounFr) || this._lookup(this._stripLeadingArticles(nounFr));
    if (!nounEw) {
      return {
        ok: false,
        reason: "mot manquant au lexique (nom du groupe possessif)",
        missing: [nounFr]
      };
    }

    const possEw = this._possessiveForm(det, nounFr, nounEw);
    if (!possEw) {
      return {
        ok: false,
        reason: "accord de classe non sourcé pour ce nom (P p.43 : le possessif prend le préfixe de classe)",
        missing: [nounFr]
      };
    }
    return {
      ok: true,
      text: nounEw + " " + possEw,
      rule: "possessif après le nom (accord de classe sourcé)",
      source: "Pichon 1950 p.43-44"
    };
  }

  _possessiveForm(det, nounFr, nounEw) {
    // 1) Motif déjà présent dans exact pour le même nom français.
    const ex = this._possExamples[nounFr];
    if (ex) {
      const classKey = this._classKeyFromPoss(ex.possEw);
      if (classKey && POSS_BY_CLASS[classKey] && POSS_BY_CLASS[classKey][det]) {
        return POSS_BY_CLASS[classKey][det];
      }
      // Même déterminant déjà attesté.
      if (ex.det === det) return ex.possEw;
      // Même personne, genre/nombre français différent (mon/ma, votre/vos)
      const groups = [
        ["mon", "ma", "mes"],
        ["ton", "ta", "tes"],
        ["notre", "nos"],
        ["votre", "vos"],
        ["leur", "leurs"]
      ];
      if (groups.some((g) => g.includes(ex.det) && g.includes(det))) return ex.possEw;
    }
    // 2) Classe sourcée du lemme éwondo (ex. mɔni, cl. I, P p.101), y compris
    //    si le nom éwondo est une locution commençant par ce lemme.
    const head = nounEw.split(/\s+/)[0];
    const cls = NOUN_CLASS[nounEw] || NOUN_CLASS[head];
    if (cls && POSS_BY_CLASS[cls.key] && POSS_BY_CLASS[cls.key][det]) {
      return POSS_BY_CLASS[cls.key][det];
    }
    return null;
  }

  _classKeyFromPoss(possEw) {
    for (const [key, map] of Object.entries(POSS_BY_CLASS)) {
      if (Object.values(map).includes(possEw)) return key;
    }
    return null;
  }

  _tryCoordination(key, raw) {
    // Un seul « et » central : on refuse un assemblage approximatif de listes longues.
    const parts = key.split(" et ");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const left = this._translateComplement(parts[0]);
    const right = this._translateComplement(parts[1]);
    if (!left.ok) return left;
    if (!right.ok) return right;
    const et = this._chooseEt(parts[0], parts[1], raw);
    if (!et) {
      return {
        ok: false,
        reason: "règle « et » : contexte (personnes / noms / phrases) non établi de façon sourcée",
        missing: []
      };
    }
    return {
      ok: true,
      text: left.text + " " + et.form + " " + right.text,
      rule: et.rule,
      source: et.source
    };
  }

  // P p.11 ban (entre 2 personnes) ; p.14-15 ai (entre noms, « et, avec ») ;
  // p.21 ndɔ fə (entre deux phrases).
  _chooseEt(leftFr, rightFr, raw) {
    const clauseLike = (s) => /\b(je|tu|il|elle|nous|vous|ils|elles|qui|que|dont|est|sont|a|ont|fait|font)\b/.test(s) || /[,;:]/.test(s);
    if (clauseLike(leftFr) || clauseLike(rightFr)) {
      return { form: ET_PHRASES, rule: "et entre deux phrases = ndɔ fə", source: "Pichon 1950 p.21 « ndò fë, et (entre deux phrases) »" };
    }
    const nameLike = (s) => {
      const toks = s.trim().split(/\s+/);
      return toks.length >= 1 && toks.every((w) => {
        const clean = w.replace(/[^\p{L}-]/gu, "");
        return clean && (clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase());
      });
    };
    // Noms propres lus dans le texte original (casse), pas dans la clé normalisée.
    const rawParts = (raw || "").split(/\s+et\s+/i);
    if (rawParts.length === 2 && nameLike(rawParts[0]) && nameLike(rawParts[1])) {
      return { form: ET_PERSONNES, rule: "et entre deux personnes = ban", source: "Pichon 1950 p.11 « ban, et (entre 2 personnes) »" };
    }
    // Deux GN : ai « et, avec » (P p.14 vocabulaire, exemples p.15).
    return { form: ET_NOMS, rule: "et entre noms = ai", source: "Pichon 1950 p.14 « ai, et, avec » (PDF 16 ; exemples p.15)" };
  }

  _tryGreeting(key, raw) {
    const m = key.match(/^(bonjour|bonsoir)(?:[,]? (.+))?$/);
    if (!m) return null;
    const greet = this._lookup(m[1]);
    if (!greet) return { ok: false, reason: "mot manquant au lexique", missing: [m[1]] };
    if (!m[2]) return { ok: true, text: greet, rule: "lexique (salutation)", source: "modèle exact/words" };
    // Le reste doit être un nom propre (chaque mot capitalisé dans l'original).
    const restRaw = (raw || "").trim();
    const namePart = restRaw.split(/[,]/).slice(1).join(",").trim() || m[2];
    const names = namePart.split(/\s+/).filter(Boolean);
    const allNames = names.every((n) => {
      const cleaned = n.replace(/[^\p{L}-]/gu, "");
      return cleaned && cleaned[0] === cleaned[0].toUpperCase() && !this._lookup(n.toLowerCase());
    });
    if (!allNames) {
      return {
        ok: false,
        reason: "mot manquant au lexique après la salutation",
        missing: names.map((n) => n.toLowerCase())
      };
    }
    return {
      ok: true,
      text: greet + ", " + names.join(" "),
      rule: "salutation du lexique + nom propre inchangé",
      source: "lexique « bonjour/bonsoir » ; noms propres non traduits"
    };
  }

  // Complément (GN simple) : articles omis (P p.7-8), possessif (P p.43),
  // sinon expression ou mot du lexique, sinon échec.
  _translateComplement(fr) {
    const key = this._norm(fr);
    if (!key) return { ok: true, text: "" };
    if (this._lookup(key)) return { ok: true, text: this._lookup(key) };
    const noArt = this._stripLeadingArticles(key);
    if (noArt !== key && this._lookup(noArt)) return { ok: true, text: this._lookup(noArt) };

    const poss = this._tryPossessiveNP(key);
    if (poss) return poss;

    // Suite de GN déjà au lexique, séparés seulement par des articles :
    // on refuse un assemblage mot à mot d'une syntaxe non sourcée.
    const missing = this._missingWords(key);
    return {
      ok: false,
      reason: missing.length
        ? "mot manquant au lexique : " + missing.join(", ")
        : "règle non sourcée pour ce complément",
      missing
    };
  }

  _missingWords(key) {
    if (!key) return [];
    const toks = key.split(/\s+/).filter(Boolean);
    const missing = [];
    let i = 0;
    while (i < toks.length) {
      let hit = null;
      for (let j = toks.length; j > i; j--) {
        const span = toks.slice(i, j).join(" ");
        if (this._lookup(span) || FR_ARTICLES.has(span) || PASSTHROUGH.has(span) || RE_PROTECTED_ONLY.test(span)) {
          hit = j;
          break;
        }
      }
      if (hit) i = hit;
      else {
        if (!/^\d+$/.test(toks[i])) missing.push(toks[i]);
        i += 1;
      }
    }
    return missing;
  }

  _isEtre(form) {
    return /^(suis|es|est|sommes|êtes|etes|sont|être|etre)$/.test(form);
  }

  _verbStem(form) {
    const k = this._norm(form);
    if (this._verbStems[k]) return this._verbStems[k];
    const inf = this._toInfinitive(k);
    if (inf && this._verbStems[inf]) return this._verbStems[inf];
    if (inf && this._lookup(inf)) {
      const ew = this._lookup(inf);
      if (ew && !ew.includes(" ")) return ew;
      // Locution (ex. « vérifier » = « fəb dzi ») : pas de conjugaison sourcée.
      return null;
    }
    if (this._lookup(k) && !this._lookup(k).includes(" ")) return this._lookup(k);
    return null;
  }

  // Lemmatisation française (côté source), pas une règle éwondo.
  _toInfinitive(form) {
    const f = this._norm(form);
    if (!f) return null;
    const irr = {
      sais: "savoir", sait: "savoir", savons: "savoir", savez: "savoir", savent: "savoir",
      comprends: "comprendre", comprend: "comprendre", comprenons: "comprendre",
      comprenez: "comprendre", comprennent: "comprendre",
      fais: "faire", fait: "faire", faisons: "faire", faites: "faire", font: "faire",
      vais: "aller", va: "aller", allons: "aller", allez: "aller", vont: "aller",
      peux: "pouvoir", peut: "pouvoir", pouvons: "pouvoir", pouvez: "pouvoir", peuvent: "pouvoir",
      dois: "devoir", doit: "devoir", devons: "devoir", devez: "devoir", doivent: "devoir",
      vois: "voir", voit: "voir", voyons: "voir", voyez: "voir", voient: "voir",
      reçois: "recevoir", reçoit: "recevoir", recevons: "recevoir", recevez: "recevoir", reçoivent: "recevoir"
    };
    if (irr[f]) return irr[f];
    if (/(er|ir|re|oir)$/.test(f)) return f;
    if (f.endsWith("issez") && f.length > 6) return f.slice(0, -4) + "ir"; // saisissez → saisir
    if (f.endsWith("ez") && f.length > 3) return f.slice(0, -2) + "er";
    if (f.endsWith("ons") && f.length > 4) return f.slice(0, -3) + "er";
    if (f.endsWith("ent") && f.length > 4) return f.slice(0, -3) + "er";
    if (f.endsWith("es") && f.length > 3) return f.slice(0, -1) + "r"; // aimes → aimer (es→er via e+r)
    if (f.endsWith("e") && f.length > 2) return f + "r";
    return null;
  }

  // Construit (une fois) la table FR→Éwondo et la regex combinée.
  // Conservé pour d'éventuels outils ; translateText n'en fait plus un
  // remplacement au morceau (ce qui produisait des phrases mêlées).
  _getMatcher() {
    if (this._matcher && this._matcher.model === this.model) return this._matcher;
    const table = new Map();
    for (const [fr, ew] of Object.entries(this.model.exact)) if (fr.length >= 2) table.set(fr.toLowerCase(), ew);
    for (const [fr, ew] of Object.entries(this.model.words)) if (fr.length >= 2 && !table.has(fr.toLowerCase())) table.set(fr.toLowerCase(), ew);
    const keys = [...table.keys()].sort((a, b) => b.length - a.length);
    const alt = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+").replace(/'/g, "['’]")).join("|");
    const re = keys.length ? new RegExp(`${WB_L}(?:${alt})${WB_R}`, "giu") : null;
    this._matcher = { model: this.model, re, table };
    return this._matcher;
  }

  // ── Statistiques ──────────────────────────────────────────
  stats() {
    return this.model?.meta || {};
  }
}

// Export singleton
g.EwondoEngine = EwondoEngine;
g.ewondoEngine = new EwondoEngine();
})(typeof globalThis !== "undefined" ? globalThis : window);
