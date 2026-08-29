// Cockpit-PWA: Hash-Routing ueber vier Ansichten + Detail-Sheets.
//   #/            Hauptmenue (neutrale Huelle - spaeter mehrere Bereiche)
//   #/ugc         UGC KPI-Dashboard: Monats-Chips, Kacheln mit Sparkline, Brand-Container
//   #/ugc/<name>  Firmen-Karten einer Brand-Gruppe
//   #/buecher     Platzhalter fuer den Buecher-Bereich
// KPI-Kachel antippen -> Sheet mit Verlaufs-Diagramm (Monatswerte).
// Firmen-Karte antippen -> Sheet mit kompletter Pitch-/Antwort-Historie.
// Daten: daten/snapshot.json (export_snapshot.py / Update-Button via server.py).

const KACHEL_TITEL = {
  marken: "Kontaktierte Marken",
  followups: "Follow-ups",
  antworten: "Antworten",
  positiv: "Davon positiv",
  nach_erstkontakt: "Nach Erstkontakt",
};

const SVG_NS = "http://www.w3.org/2000/svg";

let snap = null;
let ladefehler = null;
let zi = 0; // gewaehlter Zeitraum-Index (0 = Gesamt), bleibt beim Navigieren erhalten

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

function kopfzeile(titel, zurueckSichtbar) {
  document.getElementById("titel").textContent = titel;
  document.getElementById("zurueck").style.visibility =
    zurueckSichtbar ? "visible" : "hidden";
  // Hauptmenue ohne Update-Knopf (Tobias 29.08.) - der lebt in den
  // Bereichen (UGC, Buecher), nicht auf der Startseite
  document.getElementById("update").style.visibility =
    zurueckSichtbar ? "visible" : "hidden";
}

// ------------------------------------------------------------ Einstellungen
// Persoenlicher Stil (Andrea), pro Geraet in localStorage. Kein Sync -
// Geschmackssache gehoert aufs Geraet, nicht in die Daten.

const APP_VERSION = "v16"; // im Gleichschritt mit CACHE in service-worker.js pflegen

const EINST_KEY = "cockpit-einst";
let einst = {};
try { einst = JSON.parse(localStorage.getItem(EINST_KEY) || "{}"); } catch (_) {}

const EINST_GROESSEN = [["0.9", "Klein"], ["", "Normal"],
                        ["1.1", "Groß"], ["1.2", "Sehr groß"]];
// Nur Systemschriften - laden nichts nach, sehen auf jedem Geraet gut aus
const EINST_SCHRIFTEN = [["", "Standard"], ["Georgia, serif", "Serif"],
                         ["Consolas, 'Roboto Mono', monospace", "Mono"]];
const EINST_AKZENTE = [["", "Coral"], ["#4b7bd4", "Blau"], ["#3fa971", "Grün"],
                       ["#8b5cf6", "Violett"], ["#ec4899", "Pink"],
                       ["#14b8a6", "Türkis"]];

function einstAnwenden() {
  // ponytail: zoom statt rem-Umbau - das ganze Layout ist in px; zoom
  // skaliert alles zusammen (wie Androids "Anzeigegroesse") und Chrome/
  // Android kann es. Upgrade auf rem-Basis nur, falls je ein Zielbrowser
  // ohne zoom dazukommt.
  document.body.style.zoom = einst.groesse || "";
  document.body.style.fontFamily = einst.schrift || "";
  document.documentElement.style.setProperty("--coral", einst.akzent || "#f2664c");
}

function einstZeile(titel, paare, feld) {
  const wrap = el("div");
  wrap.append(el("div", "stand", titel));
  const zeile = el("div", "chips");
  paare.forEach(([wert, label]) => {
    const chip = el("button",
      "chip" + ((einst[feld] || "") === wert ? " aktiv" : ""), label);
    if (feld === "akzent" && wert) chip.style.color = wert;
    chip.onclick = () => {
      einst[feld] = wert;
      localStorage.setItem(EINST_KEY, JSON.stringify(einst));
      einstAnwenden(); // sofort sichtbar, Sheet bleibt offen
      [...zeile.children].forEach(
        (c, i) => c.classList.toggle("aktiv", paare[i][0] === wert));
    };
    zeile.append(chip);
  });
  wrap.append(zeile);
  return wrap;
}

function sheetEinstellungen() {
  const wrap = el("div");
  wrap.append(
    einstZeile("Schriftgröße", EINST_GROESSEN, "groesse"),
    einstZeile("Schriftart", EINST_SCHRIFTEN, "schrift"),
    einstZeile("Akzentfarbe", EINST_AKZENTE, "akzent"),
    el("div", "stand", "Gilt nur für dieses Gerät · App-Version " + APP_VERSION));
  sheetOeffnen("Einstellungen", wrap);
}

function banner(text) {
  const b = el("div", "banner", text);
  document.body.append(b);
  setTimeout(() => b.remove(), 4000);
}

function zeitraum() {
  return snap.zeitraeume[zi] || snap.zeitraeume[0];
}

// Monats-Zeitraeume ohne den "Gesamt"-Eintrag (Index 0)
function monate() {
  return snap.zeitraeume.slice(1);
}

function gruppenMap(z) {
  const map = new Map();
  for (const m of z.marken) {
    const g = m.gruppe || "Sonstige";
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(m);
  }
  return map;
}

// ---------------------------------------------------------------- Bausteine

// Filter-Chips fuer die Monatswahl (Briefing Abschnitt 5: waagerecht scrollend)
// Jahres-Chips: gewaehltes Jahr ("" = neuestes). Die Jahres-Reihe erscheint
// erst, wenn Monate aus mehr als einem Jahr im Snapshot sind - bis dahin
// sieht die Zeitraum-Wahl aus wie immer. "Gesamt" rechnet immer ueber alles.
let jahrWahl = "";

function chipZeile() {
  const wrap = el("div");
  const jahre = [...new Set(monate().map((z) => z.label.slice(-4)))];
  const jahr = jahre.includes(jahrWahl) ? jahrWahl : jahre[jahre.length - 1];
  if (jahre.length > 1) {
    const jz = el("div", "chips");
    for (const j of jahre) {
      const chip = el("button", "chip" + (j === jahr ? " aktiv" : ""), j);
      chip.onclick = () => {
        jahrWahl = j;
        // gewaehlter Monat liegt nicht im neuen Jahr -> zurueck auf Gesamt
        if (zi > 0 && snap.zeitraeume[zi].label.slice(-4) !== j) zi = 0;
        render();
      };
      jz.append(chip);
    }
    wrap.append(jz);
  }
  const zeile = el("div", "chips");
  let aktivChip = null;
  snap.zeitraeume.forEach((z, i) => {
    if (i > 0 && jahre.length > 1 && z.label.slice(-4) !== jahr) return;
    // bei sichtbarer Jahres-Reihe reicht der Monatsname ("Jun" statt "Jun 2026")
    const text = i > 0 && jahre.length > 1 ? z.label.slice(0, -5) : z.label;
    const chip = el("button", "chip" + (i === zi ? " aktiv" : ""), text);
    chip.onclick = () => { zi = i; render(); };
    if (i === zi) aktivChip = chip;
    zeile.append(chip);
  });
  wrap.append(zeile);
  // Nach dem Neuaufbau (render nach Monatswahl) den aktiven Chip ins Bild
  // holen - sonst steht die Leiste wieder links, obwohl z.B. "Dez" gewaehlt ist
  if (aktivChip) requestAnimationFrame(() =>
    aktivChip.scrollIntoView({ inline: "center", block: "nearest" }));
  return wrap;
}

// Sparkline in der KPI-Kachel (dataviz-Skill): Monatswerte als gedaempfte
// 2px-Linie, der gewaehlte Monat als Punkt mit 2px Flaechen-Ring.
function sparkline(schluessel) {
  const werte = monate().map((z) => z.gesamt[schluessel]);
  if (werte.length < 2) return null;
  const B = 120, H = 30, R = 4, P = R + 2;
  const max = Math.max(...werte, 1);
  const x = (i) => P + (i * (B - 2 * P)) / (werte.length - 1);
  const y = (w) => H - P - (w / max) * (H - 2 * P);
  const akt = zi > 0 ? zi - 1 : werte.length - 1; // Gesamt -> letzter Monat
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${B} ${H}`);
  svg.setAttribute("class", "spark");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    `<polyline points="${werte.map((w, i) => `${x(i)},${y(w)}`).join(" ")}"` +
    ` fill="none" stroke="var(--blau)" stroke-width="2"` +
    ` stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>` +
    `<circle cx="${x(akt)}" cy="${y(werte[akt])}" r="${R}"` +
    ` fill="var(--blau)" stroke="var(--panel)" stroke-width="2"/>`;
  return svg;
}

function kpiKacheln(gesamt) {
  const reihe = el("div", "kacheln");
  for (const [schluessel, titel] of Object.entries(KACHEL_TITEL)) {
    const kachel = el("div", "kachel");
    kachel.append(el("div", "titel", titel),
                  el("div", "wert", String(gesamt[schluessel])));
    const sp = sparkline(schluessel);
    if (sp) {
      kachel.append(sp);
      kachel.classList.add("tippbar");
      kachel.onclick = () => sheetVerlauf(schluessel);
    }
    reihe.append(kachel);
  }
  return reihe;
}

function markenKarte(m) {
  const karte = el("div", "karte" + (m.kontaktiert ? "" : " leer"));
  const kopf = el("div", "kopf");
  kopf.append(el("span", null, m.gruppe || "Sonstige"),
              el("span", null, m.kontaktiert ? "Kontaktiert" : "Nur Antwort"));
  karte.append(kopf, el("div", "titel", m.name),
    el("div", "kontext",
      `Follow-ups: ${m.followups} · Antworten: ${m.antworten} (${m.positiv} positiv) · Nach Erstkontakt: ${m.nach_erstkontakt}`),
    el("div", "fuss", `Quelle: ${m.quelle}.docx`));
  karte.classList.add("tippbar");
  karte.onclick = () => sheetHistorie(m);
  return karte;
}

// Brand-Container: Baustein "Block" aus dem Design-Briefing
// (gestrichelter Rahmen = Behaelter, Zaehler-Badge, ab 5 Eintraegen coral)
function gruppenBlock(name, marken) {
  const block = el("div", "karte block");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "Brand"),
              el("span", "badge" + (marken.length >= 5 ? " voll" : ""),
                 String(marken.length)));
  block.append(kopf, el("div", "titel", name),
    el("div", "kontext", marken.map((m) => m.name).join(", ")));
  block.onclick = () => { location.hash = "#/ugc/" + encodeURIComponent(name); };
  return block;
}

// ------------------------------------------------------------------ Sheets

// Sheet von unten (Briefing Abschnitt 5): volle Breite, max. ~90% Hoehe,
// Kopf und Knopfleiste angeheftet, Inhalt scrollt dazwischen.
// Schliessen: Knopf oder Tipp auf den Schleier (Wisch-Geste bewusst gespart -
// kollidiert auf Touch mit dem Scrollen des Inhalts).
// Sheets sind bewusst keine Routen - aber die Android-Zurueck-Geste soll
// ein offenes Sheet SCHLIESSEN statt die Ansicht dahinter zu wechseln.
// Deshalb: beim Oeffnen ein History-Eintrag (pushState, URL unveraendert);
// Zurueck-Geste, Schliessen-Knopf und Schleier-Tipp nehmen ihn per
// history.back() zurueck, und der popstate-Handler raeumt das Sheet weg.
function sheetOeffnen(titel, inhalt) {
  sheetEntfernen();
  const schleier = el("div", "schleier");
  schleier.id = "schleier";
  const sheet = el("div", "sheet");
  const kopf = el("div", "sheet-kopf");
  kopf.append(el("div", "titel", titel));
  const koerper = el("div", "sheet-inhalt");
  koerper.append(inhalt);
  const fuss = el("div", "sheet-fuss");
  const zu = el("button", null, "Schließen");
  zu.onclick = () => history.back();
  fuss.append(zu);
  sheet.append(kopf, koerper, fuss);
  schleier.append(sheet);
  schleier.onclick = (e) => { if (e.target === schleier) history.back(); };
  document.body.append(schleier);
  history.pushState({ sheet: true }, "");
}

function sheetEntfernen() {
  const s = document.getElementById("schleier");
  if (s) s.remove();
}

window.addEventListener("popstate", sheetEntfernen);

// Verlaufs-Diagramm (Inline-SVG, Specs aus der dataviz-Skill): 2px-Linie,
// Flaechen-Fuellung ~10%, Hairline-Gitter in Randfarbe, saubere Y-Ticks,
// Wert-Label nur am Endpunkt. Antippen zeigt den naechstgelegenen Monat.
function verlaufsDiagramm(schluessel, readout) {
  const ms = monate();
  const werte = ms.map((z) => z.gesamt[schluessel]);
  const B = 340, H = 190, L = 34, R = 14, O = 16, U = 26;
  const max = Math.max(...werte, 1);
  const schritt = Math.max(1, Math.ceil(max / 4));
  const oben = Math.ceil(max / schritt) * schritt;
  const x = (i) => werte.length < 2
    ? (L + B - R) / 2
    : L + (i * (B - L - R)) / (werte.length - 1);
  const y = (w) => H - U - (w / oben) * (H - O - U);

  let s = "";
  // Gitter + Y-Ticks (Text in Text-Token, nie in Serienfarbe)
  for (let w = 0; w <= oben; w += schritt) {
    s += `<line x1="${L}" y1="${y(w)}" x2="${B - R}" y2="${y(w)}"` +
         ` stroke="var(--rand)" stroke-width="1"/>` +
         `<text x="${L - 6}" y="${y(w) + 3}" text-anchor="end"` +
         ` font-size="9" fill="var(--text-leise)">${w}</text>`;
  }
  // X-Labels: nur Monatskuerzel, bei vielen Monaten jeden n-ten
  const nter = Math.ceil(ms.length / 6);
  ms.forEach((z, i) => {
    if (i % nter !== 0 && i !== ms.length - 1) return;
    s += `<text x="${x(i)}" y="${H - U + 14}" text-anchor="middle"` +
         ` font-size="9" fill="var(--text-leise)">${z.label.split(" ")[0]}</text>`;
  });
  // Flaechen-Wash + Linie + Endpunkt mit Flaechen-Ring + Endwert-Label
  const punkte = werte.map((w, i) => `${x(i)},${y(w)}`).join(" ");
  const letzte = werte.length - 1;
  s += `<polygon points="${L},${y(0)} ${punkte} ${x(letzte)},${y(0)}"` +
       ` fill="var(--blau)" opacity=".1"/>` +
       `<polyline points="${punkte}" fill="none" stroke="var(--blau)"` +
       ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
       `<circle cx="${x(letzte)}" cy="${y(werte[letzte])}" r="4"` +
       ` fill="var(--blau)" stroke="var(--panel)" stroke-width="2"/>` +
       `<text x="${x(letzte)}" y="${y(werte[letzte]) - 9}" text-anchor="end"` +
       ` font-size="10" font-weight="600" fill="var(--text)">${werte[letzte]}</text>` +
       `<circle id="tipp-punkt" r="4" fill="var(--blau)"` +
       ` stroke="var(--panel)" stroke-width="2" visibility="hidden"/>`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${B} ${H}`);
  svg.setAttribute("class", "verlauf");
  svg.innerHTML = s;

  // Tipp-Rueckmeldung statt Hover (Briefing Abschnitt 5)
  svg.onclick = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * B;
    const i = Math.min(werte.length - 1, Math.max(0,
      Math.round(((px - L) / (B - L - R)) * (werte.length - 1))));
    const p = svg.querySelector("#tipp-punkt");
    p.setAttribute("cx", x(i));
    p.setAttribute("cy", y(werte[i]));
    p.setAttribute("visibility", "visible");
    readout.textContent = `${ms[i].label}: ${werte[i]}`;
  };
  return svg;
}

function sheetVerlauf(schluessel) {
  const wrap = el("div");
  const readout = el("div", "readout", "Diagramm antippen für Monatswerte");
  wrap.append(readout, verlaufsDiagramm(schluessel, readout));
  // Monatswerte zusaetzlich als Tabelle (dataviz-Skill: Tabellen-Ansicht
  // als verlaesslicher Kanal neben dem Diagramm)
  const tab = el("div", "tabelle");
  monate().forEach((z) => {
    const zeile = el("div", "zeile");
    zeile.append(el("span", "leise", z.label),
                 el("span", "num", String(z.gesamt[schluessel])));
    tab.append(zeile);
  });
  wrap.append(tab);
  sheetOeffnen(KACHEL_TITEL[schluessel], wrap);
}

// Kerninfo-Wert anklickbar machen: Web-Adressen oeffnen die Seite,
// E-Mail-Adressen den Mail-Entwurf, Telefonnummern den Anruf (tel:).
// Erkennung ueber Wert UND Label, damit z.B. eine spaeter ergaenzte
// "Telefon:"-Zeile automatisch funktioniert.
function kontaktWert(label, wert) {
  const l = label.toLowerCase();
  let href = null;
  if (/^https?:\/\//i.test(wert)) href = wert;
  else if (/^www\./i.test(wert)) href = "https://" + wert;
  else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert)) href = "mailto:" + wert;
  else if (l.includes("telefon") || l.includes("tel.") ||
           /^[+0][\d\s\/\-()]{5,}$/.test(wert)) {
    href = "tel:" + wert.replace(/[^+\d]/g, "");
  }
  if (!href) return el("span", null, wert);
  const a = el("a", "link", wert);
  a.href = href;
  if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
  return a;
}

// Kerninfos + Historie einer Marke - gemeinsamer Baustein fuer das
// Firmen-Sheet (UGC-Gruppe) und das Wiedervorlage-Sheet (Pitchliste).
function markenDetails(quelle) {
  const frag = document.createDocumentFragment();

  // Kerninfos aus dem Brand-Book (Name weggelassen - steht im Sheet-Titel)
  const infos = Object.entries((snap.kerninfos && snap.kerninfos[quelle]) || {})
    .filter(([label]) => label.toLowerCase() !== "name");
  if (infos.length) {
    frag.append(el("div", "abschnitt", "Kontakt & Infos"));
    const infoTab = el("div", "tabelle");
    for (const [label, wert] of infos) {
      const zeile = el("div", "zeile");
      zeile.append(el("span", "leise", label), kontaktWert(label, wert));
      infoTab.append(zeile);
    }
    frag.append(infoTab);
  }

  frag.append(el("div", "abschnitt", "Historie"));
  const eintraege = (snap.historie && snap.historie[quelle]) || [];
  if (!eintraege.length) {
    frag.append(el("div", "leerzustand kompakt",
      "Keine Historie im Snapshot — einmal Update (↻) drücken."));
  }
  const tab = el("div", "tabelle");
  for (const e of eintraege) {
    const zeile = el("div", "zeile historie");
    const punktKlasse = e.typ === "Antwort"
      ? (e.positiv === "X" ? "punkt-positiv" : "punkt-antwort")
      : "punkt-" + e.typ.toLowerCase();
    const text = e.typ === "Antwort"
      ? (e.positiv === "X" ? "Antwort — positiv" : "Antwort")
      : (e.aktion || e.typ);
    const label = el("span");
    label.append(el("span", "punkt " + punktKlasse), document.createTextNode(text));
    zeile.append(el("span", "num leise datum", e.datum), label);
    tab.append(zeile);
  }
  frag.append(tab);
  return frag;
}

function sheetHistorie(m) {
  const wrap = el("div");
  wrap.append(el("div", "kontext",
    `${m.gruppe || "Sonstige"} · Quelle: ${m.quelle}.docx`));
  wrap.append(markenDetails(m.quelle));
  sheetOeffnen(m.name, wrap);
}

// Pitchlisten-Name -> Book-Quelle ("Balolo" -> "Brand-Book Balolo").
// Ueber den Anzeigenamen verglichen, Gross/klein und Randleerzeichen egal.
function quelleZuName(name) {
  const n = String(name).trim().toLowerCase();
  for (const q of Object.keys(snap.historie || {})) {
    if (q.replace(/^brand-book\s*/i, "").trim().toLowerCase() === n) return q;
  }
  return null;
}

// Detail-Sheet einer Wiedervorlage: alle Excel-Felder, plus Kontakt &
// Historie aus dem Brand-Book, wenn eines im Datenordner liegt.
function sheetPitch(p) {
  const wrap = el("div");
  wrap.append(el("div", "kontext", p.text));

  wrap.append(el("div", "abschnitt", "Wiedervorlage"));
  const felder = [
    ["Status", p.status],
    ["Rating", p.rating],
    ["Kategorie", p.kategorie],
    ["Letzter Kontakt", p.letzter_kontakt],
    ["Nächster Schritt", p.naechste_aktion],
    ["Termin", p.datum_naechste_aktion
      ? p.datum_naechste_aktion.split("-").reverse().join(".") : ""],
    ["Follow-ups", p.zaehler],
    ["Kooperation", p.kooperation],
  ].filter(([, wert]) => wert);
  const tab = el("div", "tabelle");
  for (const [label, wert] of felder) {
    const zeile = el("div", "zeile");
    zeile.append(el("span", "leise", label), el("span", null, wert));
    tab.append(zeile);
  }
  wrap.append(tab);

  const quelle = quelleZuName(p.name);
  if (quelle) {
    wrap.append(markenDetails(quelle));
  } else {
    wrap.append(el("div", "abschnitt", "Brand-Book"));
    wrap.append(el("div", "leerzustand kompakt",
      "Kein Brand-Book im aktuellen Datenordner — liegt im echten Verzeichnis (kommt mit Phase 3 / OneDrive)."));
  }
  sheetOeffnen(p.name, wrap);
}

// -------------------------------------------------------------- Pitchliste

function heuteNull() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Ampel der Excel-Pitchliste, live gerechnet (Regeln siehe Projektnotiz):
// ueberfaellig oder <=7 Tage = rot, <=14 gelb, <=21 gruen, sonst neutral.
// Live statt im Export, damit ein alter Snapshot nicht die Ampel von
// gestern zeigt. Deckt bewusst auch ueberfaellig ab (Excel-Bug 2).
function ampel(datumIso, heute) {
  if (!datumIso) return { klasse: "grau", text: "kein Termin eingetragen", tage: null };
  const tage = Math.round((new Date(datumIso) - heute) / 86400000);
  if (tage < 0) {
    return { klasse: "rot",
             text: `überfällig seit ${-tage} ${tage === -1 ? "Tag" : "Tagen"}`, tage };
  }
  const text = tage === 0 ? "heute fällig"
    : tage === 1 ? "morgen fällig" : `fällig in ${tage} Tagen`;
  if (tage <= 7) return { klasse: "rot", text, tage };
  if (tage <= 14) return { klasse: "gelb", text, tage };
  if (tage <= 21) return { klasse: "gruen", text, tage };
  return { klasse: "neutral", text, tage };
}

function pitchKarte(p) {
  const karte = el("div", "karte ampel-" + p.klasse);
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", p.kategorie || "—"),
              el("span", null, p.rating ? "Rating " + p.rating : ""));
  const datum = p.datum_naechste_aktion
    ? p.datum_naechste_aktion.split("-").reverse().join(".") : null;
  karte.append(kopf, el("div", "titel", p.name),
    el("div", "kontext",
      `${p.status || "—"} · Follow-ups: ${p.zaehler || "0"}` +
      (p.naechste_aktion ? ` · Nächster Schritt: ${p.naechste_aktion}` : "") +
      (p.kooperation ? ` · Kooperation: ${p.kooperation}` : "")),
    el("div", "fuss", datum ? `${datum} — ${p.text}` : p.text));
  karte.classList.add("tippbar");
  karte.onclick = () => sheetPitch(p);
  return karte;
}

// Filterzustand der Pitchliste - bleibt beim Navigieren erhalten (wie zi).
// faellig: "" = alle, sonst max. Rest-Tage (ueberfaellig zaehlt immer mit).
const pf = { faellig: "", rating: "", kategorie: "", suche: "" };

// Eine Chip-Reihe fuer einen Filter: aktiven Chip nochmal antippen = aus.
// Zeichnet nur die Ergebnisliste neu (neuzeichnen), nie die ganze Ansicht -
// sonst springt die gescrollte Chip-Leiste zurueck an den Anfang.
function chipFilter(paare, aktiv, setzen, neuzeichnen) {
  const zeile = el("div", "chips");
  paare.forEach(([wert, label]) => {
    const chip = el("button", "chip" + (wert === aktiv ? " aktiv" : ""), label);
    chip.onclick = () => {
      const neu = chip.classList.contains("aktiv") ? "" : wert;
      setzen(neu);
      [...zeile.children].forEach(
        (c, i) => c.classList.toggle("aktiv", paare[i][0] === neu));
      neuzeichnen();
    };
    zeile.append(chip);
  });
  return zeile;
}

function renderPitchliste() {
  kopfzeile("Pitchliste", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  const heute = heuteNull();
  const alle = (snap.pitchliste || [])
    .map((p) => ({ ...p, ...ampel(p.datum_naechste_aktion, heute) }))
    .sort((a, b) => (a.tage === null ? 1e9 : a.tage) -
                    (b.tage === null ? 1e9 : b.tage));
  if (!alle.length) {
    c.append(el("div", "leerzustand",
      "Keine Pitchliste im Snapshot — einmal Update (↻) drücken."));
    return;
  }

  // Suchfeld + Filter-Chips (Faellig / Rating / Kategorie), UND-verknuepft.
  // Rating- und Kategorie-Werte kommen aus den Daten, nie hart verdrahtet.
  const suche = el("input", "suche");
  suche.type = "search";
  suche.placeholder = "Suchen (Name, Status, Kooperation …)";
  suche.value = pf.suche;
  suche.oninput = () => { pf.suche = suche.value; zeichnen(); };
  c.append(suche);
  c.append(chipFilter([["", "Alle"], [7, "Fällig ≤ 7 Tage"], [14, "≤ 14 Tage"]],
    pf.faellig, (w) => { pf.faellig = w; }, zeichnen));
  const ratings = [...new Set(alle.map((p) => p.rating).filter(Boolean))].sort();
  if (ratings.length > 1) {
    c.append(chipFilter(ratings.map((r) => [r, "Rating " + r]),
      pf.rating, (w) => { pf.rating = w; }, zeichnen));
  }
  const kategorien =
    [...new Set(alle.map((p) => p.kategorie).filter(Boolean))].sort();
  if (kategorien.length > 1) {
    c.append(chipFilter(kategorien.map((k) => [k, k]),
      pf.kategorie, (w) => { pf.kategorie = w; }, zeichnen));
  }

  // Zaehler + Karten werden beim Tippen im Suchfeld neu gezeichnet, ohne
  // die ganze Ansicht zu rendern (sonst verliert das Suchfeld den Fokus)
  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    const s = pf.suche.trim().toLowerCase();
    const liste = alle.filter((p) =>
      (pf.faellig === "" || (p.tage !== null && p.tage <= pf.faellig)) &&
      (!pf.rating || p.rating === pf.rating) &&
      (!pf.kategorie || p.kategorie === pf.kategorie) &&
      (!s || [p.name, p.status, p.naechste_aktion, p.kooperation, p.kategorie]
        .join(" ").toLowerCase().includes(s)));
    rumpf.innerHTML = "";
    // Zaehler und Liste aus derselben Bedingung (Briefing Abschnitt 4.9)
    const rot = liste.filter((p) => p.klasse === "rot").length;
    rumpf.append(el("div", "stand",
      `${liste.length} von ${alle.length} Marken · ${rot} fällig/überfällig · sortiert nach Dringlichkeit`));
    if (!liste.length) {
      rumpf.append(el("div", "leerzustand", "Nichts passt zu den Filtern."));
      return;
    }
    const karten = el("div", "karten");
    for (const p of liste) karten.append(pitchKarte(p));
    rumpf.append(karten);
  }
}

// ---------------------------------------------------------------- Ansichten

function renderHauptmenu() {
  kopfzeile("Cockpit", false);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";

  const ugc = el("div", "karte menue-karte" + (snap ? "" : " leer"));
  ugc.append(el("div", "titel", "UGC"),
    el("div", "kontext",
      snap ? `KPI-Dashboard · ${snap.zeitraeume[0].marken.length} Marken`
           : "Keine Daten — erst bei OneDrive anmelden"));
  ugc.onclick = () => { location.hash = "#/ugc"; };

  const buecher = el("div", "karte menue-karte leer");
  buecher.append(el("div", "titel", "Bücher"),
                 el("div", "kontext", "Platzhalter — Inhalt folgt"));
  buecher.onclick = () => { location.hash = "#/buecher"; };

  // OneDrive (Phase 3): anmelden bzw. Verbindungs-Beweis anzeigen
  const odDa = typeof OD !== "undefined";
  const konto = odDa && OD.bereit() ? OD.konto() : null;
  const od = el("div", "karte menue-karte" + (konto ? "" : " leer"));
  od.append(el("div", "titel", "OneDrive"),
    el("div", "kontext",
      konto ? `Verbunden als ${konto.name || konto.username}`
        : odDa && OD.fehler() ? "Fehler: " + OD.fehler()
        : "Nicht verbunden — antippen zum Anmelden"));
  od.onclick = () => {
    if (!odDa) return;
    if (konto) sheetOneDrive(); else OD.anmelden();
  };

  const liste = el("div", "karten");
  liste.append(ugc, buecher, od);
  c.append(liste);
}

// Beweis-Sheet fuer den OneDrive-Zugang: listet die oberste Ordner-Ebene.
// Mehr braucht Phase 3a nicht - der echte Datei-Zugriff kommt danach.
async function sheetOneDrive() {
  const konto = OD.konto();
  const wrap = el("div");
  wrap.append(el("div", "kontext",
    `Verbunden als ${konto.name || konto.username}`));
  wrap.append(el("div", "abschnitt", "Oberste Ordner-Ebene"));
  const status = el("div", "leerzustand kompakt", "Lade OneDrive …");
  wrap.append(status);
  const ab = el("button", "chip", "Abmelden");
  ab.onclick = () => OD.abmelden();
  wrap.append(ab);
  sheetOeffnen("OneDrive", wrap);
  try {
    const d = await OD.graph("/me/drive/root/children");
    const tab = el("div", "tabelle");
    for (const eintrag of d.value) {
      const zeile = el("div", "zeile");
      zeile.append(el("span", null, eintrag.name),
        el("span", "leise", eintrag.folder
          ? `${eintrag.folder.childCount} Elemente` : "Datei"));
      tab.append(zeile);
    }
    status.replaceWith(tab);
  } catch (fehler) {
    status.textContent = "Zugriff fehlgeschlagen: " + fehler.message;
  }
}

function renderUgc() {
  kopfzeile("UGC KPI-Dashboard", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  const z = zeitraum();
  const alleMarken = snap.zeitraeume[0].marken.length;

  if (snap.zeitraeume.length > 1) c.append(chipZeile());
  // Pflicht-Hinweis (Briefing Abschnitt 5): Gefiltertes wird gezaehlt,
  // sonst haelt man die Ansicht fuer vollstaendig.
  const hinweis = zi > 0 && z.marken.length < alleMarken
    ? ` · ${alleMarken - z.marken.length} von ${alleMarken} Marken ohne Aktivität ausgeblendet`
    : "";
  c.append(el("div", "stand",
    `${z.label}: ${z.start} – ${z.ende} · ${snap.quelldateien} Dateien · Stand ${snap.erzeugt.replace("T", " ")}${hinweis}`));
  c.append(kpiKacheln(z.gesamt));

  // Zugang zur Pitchliste, Faellig-Zaehler aus derselben ampel()-Bedingung
  // wie die Listen-Ansicht (Briefing 4.9: ein Zaehler, eine Bedingung)
  if (snap.pitchliste && snap.pitchliste.length) {
    const heute = heuteNull();
    const faellig = snap.pitchliste.filter(
      (p) => ampel(p.datum_naechste_aktion, heute).klasse === "rot").length;
    const zugang = el("div", "karte block zugang");
    const kopf = el("div", "kopf");
    kopf.append(el("span", "pill", "Wiedervorlage"),
                el("span", "badge" + (faellig ? " voll" : ""), String(faellig)));
    zugang.append(kopf, el("div", "titel", "Pitchliste — Nächste Aktionen"),
      el("div", "kontext",
        `${snap.pitchliste.length} Marken · ${faellig} fällig/überfällig`));
    zugang.onclick = () => { location.hash = "#/pitchliste"; };
    c.append(zugang);
  }

  if (!z.marken.length) {
    c.append(el("div", "leerzustand", "Keine Aktivität in diesem Zeitraum."));
    return;
  }
  const gruppen = el("div", "karten");
  for (const [name, marken] of
       [...gruppenMap(z)].sort((a, b) => a[0].localeCompare(b[0], "de"))) {
    gruppen.append(gruppenBlock(name, marken));
  }
  c.append(gruppen);
}

function renderGruppe(name) {
  kopfzeile(name, true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";

  const z = zeitraum();
  const marken = gruppenMap(z).get(name);
  if (!marken) {
    c.append(el("div", "leerzustand",
      `Gruppe "${name}" hat im Zeitraum "${z.label}" keine Einträge.`));
    return;
  }
  c.append(el("div", "stand", `${z.label}: ${z.start} – ${z.ende}`));
  const karten = el("div", "karten");
  for (const m of marken) karten.append(markenKarte(m));
  c.append(karten);
}

function renderBuecher() {
  kopfzeile("Bücher", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";

  // Platzhalter-Struktur aus Projektparameter.md (Fehlerreihe)
  const block = el("div", "karte block leer");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "Reihe"), el("span", "badge", "2"));
  block.append(kopf, el("div", "titel", "Fehlerreihe"),
    el("div", "kontext", "Anfängerfehler, Denkfehler"),
    el("div", "fuss", "Platzhalter — Inhalt folgt"));
  const karten = el("div", "karten");
  karten.append(block);
  c.append(karten);
}

function renderFehler() {
  kopfzeile("Cockpit", false);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  c.append(el("div", "leerzustand",
    "daten/snapshot.json nicht gefunden oder ungültig (" + ladefehler +
    "). Erst export_snapshot.py laufen lassen oder Update drücken."));
}

// ------------------------------------------------------------------ Router

function render() {
  sheetEntfernen(); // beim Ansichtswechsel darf kein Sheet haengenbleiben
  if (!snap) {
    // Ohne Daten muss das Hauptmenue erreichbar bleiben, sonst kommt man
    // nie an die OneDrive-Anmeldung (Henne-Ei auf frischem Geraet).
    if (location.hash && location.hash !== "#/") { renderFehler(); return; }
    renderHauptmenu(); return;
  }
  const h = location.hash;
  if (h.startsWith("#/ugc/")) {
    renderGruppe(decodeURIComponent(h.slice("#/ugc/".length)));
  } else if (h === "#/ugc") {
    renderUgc();
  } else if (h === "#/pitchliste") {
    renderPitchliste();
  } else if (h === "#/buecher") {
    renderBuecher();
  } else {
    renderHauptmenu();
  }
}

// Snapshot aus zwei Quellen, die neuere gewinnt (Feld "erzeugt"):
// 1) lokaler Server (frisch im Heimnetz, sonst Service-Worker-Cache),
// 2) OneDrive-Kopie per Graph (frisch ueberall, sobald angemeldet -
//    export_snapshot.py legt sie in OneDrive/Apps/Cockpit ab).
// Damit ist der Heimserver unterwegs nicht mehr noetig (Phase 3).
async function laden() {
  let lokal = null, lokalFehler = "nicht erreichbar";
  try {
    const antwort = await fetch("daten/snapshot.json", { cache: "no-store" });
    if (antwort.ok) lokal = await antwort.json();
    else lokalFehler = `HTTP ${antwort.status}`;
  } catch (fehler) {
    lokalFehler = fehler.message;
  }
  const cloud = typeof OD !== "undefined"
    ? await OD.graphLeise("/me/drive/root:/Apps/Cockpit/snapshot.json:/content")
    : null;
  const beste = [lokal, cloud].filter(Boolean).sort(
    (a, b) => String(b.erzeugt || "").localeCompare(String(a.erzeugt || "")))[0];
  if (!beste) throw new Error(lokalFehler);
  snap = beste;
  ladefehler = null;
  if (zi >= snap.zeitraeume.length) zi = 0; // Snapshot kann kuerzer geworden sein
}

async function update() {
  const btn = document.getElementById("update");
  btn.disabled = true;
  try {
    let ergebnis = null;
    try {
      const antwort = await fetch("/update", { method: "POST" });
      ergebnis = await antwort.json();
    } catch (_) { /* kein Heimserver erreichbar (unterwegs/GitHub Pages) */ }
    if (ergebnis && ergebnis.ok) {
      await laden();
      render();
      banner(`${ergebnis.dateien} Dateien eingelesen · ${ergebnis.erzeugt.replace("T", " ")}`);
    } else if (ergebnis) {
      banner("Update fehlgeschlagen: " + (ergebnis.fehler || "unbekannt"));
    } else {
      // Ohne Heimserver kann niemand die Books neu einlesen - aber den
      // aktuellsten Snapshot aus OneDrive holen geht von ueberall.
      await laden();
      render();
      banner("Kein Heimserver — aktueller Stand aus OneDrive: " +
        String(snap.erzeugt || "?").replace("T", " "));
    }
  } catch (fehler) {
    banner("Keine Datenquelle erreichbar: " + fehler.message);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("einstellungen").onclick = sheetEinstellungen;

document.getElementById("zurueck").onclick = () => {
  // Eine Ebene hoch, nicht Browser-History: vorhersagbar bei Direktaufruf
  const h = location.hash;
  location.hash =
    h.startsWith("#/ugc/") || h === "#/pitchliste" ? "#/ugc" : "#/";
};
document.getElementById("update").onclick = update;
window.addEventListener("hashchange", render);
// Nach dem (asynchronen) MSAL-Start einmal neu laden + rendern: die
// OneDrive-Karte zeigt dann den Login-Zustand, und laden() kann jetzt
// auch die OneDrive-Kopie des Snapshots beruecksichtigen
window.addEventListener("od-ready", async () => {
  try { await laden(); } catch (_) { /* Fehlerbild steht schon */ }
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

einstAnwenden(); // gespeicherten Stil sofort anwenden, vor dem ersten Rendern

(async () => {
  try {
    await laden();
  } catch (fehler) {
    ladefehler = fehler.message;
  }
  render();
})();
