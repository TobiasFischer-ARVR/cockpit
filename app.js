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

const APP_VERSION = "v57"; // im Gleichschritt mit CACHE in service-worker.js pflegen

const EINST_KEY = "cockpit-einst";
let einst = {};
try { einst = JSON.parse(localStorage.getItem(EINST_KEY) || "{}"); } catch (_) {}

const EINST_GROESSEN = [["0.9", "Klein"], ["", "Normal"],
                        ["1.1", "Groß"], ["1.2", "Sehr groß"]];

// Aufklappbarer Abschnitt (Tobias 03.09.): die Detail-Sheets waren lang -
// Wiedervorlage, Startdatum, Nächster Schritt, Kontakt, Historie alle offen
// untereinander. Natives <details>: das Auf- und Zuklappen macht der
// Browser, dafuer braucht es keine Zeile Javascript und keine Bibliothek.
// Gemerkt wird pro Geraet nur die ABWEICHUNG vom Standard - was du
// zuklappst, bleibt zu, bis du es wieder aufmachst.
// Zu per Standard: das Nachschlagewerk. Offen bleibt, woran gearbeitet
// wird - Brand Rating, Wiedervorlage, Nächster Schritt, Startdatum.
const ZU_STD = ["Kontakt & Infos", "Historie"];

// Aendert sich ZU_STD, muessen die auf dem Geraet gemerkten Abweichungen
// weg - sonst zeigt die App weiter die alte Aufteilung und die neue
// Vorgabe kaeme nie an. Zaehler beim Aendern von ZU_STD hochsetzen.
const ZU_STAND = 2;
if (einst.zuStand !== ZU_STAND) {
  delete einst.zu;
  einst.zuStand = ZU_STAND;
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
}

function abschnitt(titel, ...inhalt) {
  const d = el("details", "block");
  const zu = einst.zu || {};
  d.open = titel in zu ? !zu[titel] : !ZU_STD.includes(titel);
  d.ontoggle = () => {
    einst.zu = Object.assign({}, einst.zu, { [titel]: !d.open });
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  };
  d.append(el("summary", "abschnitt", titel), ...inhalt.filter(Boolean));
  return d;
}

function einstAnwenden() {
  // ponytail: zoom statt rem-Umbau - das ganze Layout ist in px; zoom
  // skaliert alles zusammen (wie Androids "Anzeigegroesse") und Chrome/
  // Android kann es. Upgrade auf rem-Basis nur, falls je ein Zielbrowser
  // ohne zoom dazukommt.
  document.body.style.zoom = einst.groesse || "";
}

// Intro (Tobias 02.09.): Andreas Logo kurz einblenden, dann wegblenden.
// Das Element steht in der index.html und ist beim Laden schon sichtbar -
// hier wird es nur wieder los. Antippen ueberspringt.
// ponytail: feste Dauer statt einer Wartelogik auf geladene Daten - das
// Intro soll den Start schmuecken, nicht ihn verlaengern.
// 1900 ms = Aufklappen (.5) + Strahl (.35 Versatz + .85) + kurz stehen
// lassen. Wer es eilig hat, tippt drauf; wen es nervt, schaltet es in den
// Einstellungen ab. Aendert man die Zeiten im CSS, hier mitziehen.
const INTRO_MS = 1900;

function introAusblenden() {
  const i = document.getElementById("intro");
  if (!i) return; // aus (Inline-Script in der index.html hat es entfernt)
  const weg = () => {
    i.classList.add("weg");
    setTimeout(() => i.remove(), 500);
  };
  i.onclick = weg;
  setTimeout(weg, INTRO_MS);
}

function einstZeile(titel, paare, feld) {
  const wrap = el("div");
  wrap.append(el("div", "stand", titel));
  const zeile = el("div", "chips");
  paare.forEach(([wert, label]) => {
    const chip = el("button",
      "chip" + ((einst[feld] || "") === wert ? " aktiv" : ""), label);
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
    einstZeile("Logo beim Start", [["", "An"], ["aus", "Aus"]], "intro"),
    el("div", "stand", "Gilt nur für dieses Gerät · " +
      "Änderung am Intro wirkt beim nächsten Start"));
  // Datenstand-Sicherung (Tobias 30.08.): hier statt im OneDrive-Sheet -
  // das Zahnrad ist auch im UGC Dashboard immer erreichbar
  wrap.append(el("div", "abschnitt", "Datenstand-Sicherung"));
  const sStatus = el("div", "stand", sicherungsText());
  const sZeile = el("div", "chips");
  const sichern = el("button", "chip", "Jetzt sichern");
  sichern.onclick = () => datenstandSichern(sStatus);
  const backup = el("button", "chip", "Backup herunterladen");
  backup.onclick = datenstandBackup;
  const laden = el("button", "chip", "Backup laden");
  laden.onclick = backupLaden;
  sZeile.append(sichern, backup, laden);
  wrap.append(sStatus, sZeile, el("div", "stand",
    "Backup laden: eine cockpit-datenstand-….json auswählen " +
    "(Download-Ordner oder OneDrive) — ersetzt den aktuellen Stand."));

  // Brand-Book-Ordner (Tobias 03.09.): der Pfad kann sich aendern, also
  // gehoert er in die Einstellungen und nicht in den Code. "Prüfen"
  // fragt OneDrive, ob es den Ordner wirklich gibt - ein Tippfehler soll
  // hier auffallen und nicht erst beim naechsten Brand-Book.
  wrap.append(el("div", "abschnitt", "Brand-Book-Ordner (OneDrive)"));
  const pFeld = el("input", "feld");
  pFeld.type = "text";
  pFeld.placeholder = BOOK_BASIS_STD;
  pFeld.value = einst.bookPfad || "";
  const pStand = el("div", "stand", "Aktuell: " + bookBasis().split("root:")[1]);
  const pZeile = el("div", "chips");
  const pSpeichern = el("button", "chip aktiv", "Speichern");
  pSpeichern.onclick = () => {
    einst.bookPfad = pFeld.value.trim();
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
    pStand.textContent = "Aktuell: " + bookBasis().split("root:")[1];
  };
  const pPruefen = el("button", "chip", "Prüfen");
  pPruefen.onclick = async () => {
    pSpeichern.onclick();
    if (typeof OD === "undefined" || !OD.konto()) {
      pStand.textContent = "Zum Prüfen erst bei OneDrive anmelden."; return;
    }
    pStand.textContent = "Prüfe …";
    const d = await OD.graphLeise(bookBasis() + ":/children?$select=name");
    if (!d) { pStand.textContent = "✗ Ordner nicht gefunden — Schreibweise prüfen."; return; }
    // Genau das pruefen, was die App dort braucht (Plan 01.09.): die drei
    // Rating-Unterordner und die zwei Templates. Fehlt etwas, faellt es
    // hier auf und nicht erst beim naechsten Brand-Book.
    const da = new Set((d.value || []).map((x) => x.name));
    const fehlt = ["A Brands", "B Brands", "C Brands",
      "Template Brand-Book A Brand.docx", "Template Brand-Book B-C Brand.docx"]
      .filter((n) => !da.has(n));
    pStand.textContent = fehlt.length
      ? "⚠ Ordner gefunden, aber es fehlt: " + fehlt.join(", ")
      : "✓ Ordner gefunden — Unterordner und Templates sind da.";
  };
  const pStandard = el("button", "chip", "Standard");
  pStandard.onclick = () => { pFeld.value = ""; pSpeichern.onclick(); };
  pZeile.append(pSpeichern, pPruefen, pStandard);
  wrap.append(pFeld, pZeile, pStand, el("div", "stand",
    "Pfad ab OneDrive-Wurzel, ohne die „A Brands“/„B Brands“-Unterordner — " +
    "die hängt die App selbst an. In diesem Ordner müssen auch die beiden " +
    "Template-Dateien liegen. Leer = Standard. Gilt nur für dieses Gerät."));

  // Automatisches Backup (Tobias 01.09.): datierte Kopie nach OneDrive
  wrap.append(el("div", "abschnitt", "Automatisches Backup"));
  const aStand = el("div", "stand", autoBackupText());
  const aFeld = el("input", "tage");
  aFeld.type = "number";
  aFeld.min = "0";
  aFeld.inputMode = "numeric";
  aFeld.value = einst.autoTage || "";
  aFeld.onchange = () => {
    const n = Math.max(0, Math.floor(Number(aFeld.value) || 0));
    einst.autoTage = n || "";
    aFeld.value = einst.autoTage;
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
    aStand.textContent = autoBackupText();
    autoBackupPruefen().then(() => { aStand.textContent = autoBackupText(); });
  };
  wrap.append(el("div", "stand", "Alle wie viel Tage sichern? (0 = aus)"),
    aFeld, aStand, el("div", "stand",
      "Legt beim Öffnen der App eine datierte Kopie in OneDrive an " +
      "(cockpit-datenstand-JJJJ-MM-TT.json), die du oben mit „Backup " +
      "laden“ zurückholst. Anders als „Jetzt sichern“, das immer " +
      "dieselbe Datei überschreibt. Gilt nur für dieses Gerät."));
  sheetOeffnen("Einstellungen", wrap);
}

// Backup zurückspielen (Tobias 31.08.): Dateiauswahl statt Handarbeit am
// PC. Der Android-Dateidialog erreicht Download-Ordner UND OneDrive-App.
// Nach dem Laden gilt das Backup als neueste Änderung (geaendert = jetzt),
// damit es den Stand auf Gerät + OneDrive wirklich ersetzt.
function backupLaden() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = async () => {
    const datei = inp.files[0];
    if (!datei) return;
    let d = null;
    try { d = JSON.parse(await datei.text()); } catch (_) {}
    if (!d || !Array.isArray(d.marken)) {
      banner("Das ist kein Datenstand-Backup (marken fehlt)."); return;
    }
    if (!confirm(`Backup „${datei.name}“ laden?\n` +
        `Stand: ${String(d.geaendert || "?").replace("T", " ")} · ` +
        `${d.marken.length} Marken.\n` +
        "Ersetzt den aktuellen Datenstand auf Gerät + OneDrive.")) return;
    datenstand = d;
    await datenstandPersistieren();
    listeVeraltet = true;
    history.back(); // Sheet zu, popstate zeichnet die Ansicht frisch
  };
  inp.click();
}

// Info-Button (Tobias 30.08.): kontextabhaengig - im Hauptmenue Infos zur
// App allgemein, im UGC-Bereich Infos zum Dashboard (was zaehlen die
// Kacheln? Genau die Fragen, die sonst per Chat geklaert werden muessen).
function sheetInfo() {
  const wrap = el("div");
  const titel = (t) => el("div", "info-titel", t);
  const zeile = (t) => el("div", "stand", t);
  if (location.hash.startsWith("#/ugc") || location.hash === "#/pitchliste") {
    wrap.append(
      titel("Was zählen die Kacheln?"),
      zeile("Kontaktierte Marken: Marken mit mindestens einem Pitch oder " +
            "Follow-up im Zeitraum. „Gesamt“ zählt jede Marke nur einmal — " +
            "deshalb ist Gesamt kleiner als die Summe der Monate."),
      zeile("Follow-ups / Antworten: alle Einträge im Zeitraum."),
      zeile("Davon positiv: Antworten, die in den Books mit „X“ markiert sind."),
      zeile("Nach Erstkontakt: Antworten direkt auf einen Pitch, " +
            "ohne Follow-up dazwischen."),
      titel("Bedienung"),
      zeile("Kachel antippen → Verlauf über die Monate. Diagrammtyp " +
            "(Linie / Punkte / Balken / Fläche) je Kachel wählbar."),
      zeile("Brand-Block: Zahl rechts oben = Marken in der Gruppe, " +
            "ab 5 coral (nur Optik, keine Warnung)."),
      zeile("Wiedervorlage-Ampel: coral = überfällig oder ≤ 7 Tage · " +
            "gelb ≤ 14 · grün ≤ 21 · blau später · grau ohne Termin."));
    if (snap) {
      wrap.append(titel("Datenbasis"),
        zeile(`${snap.quelldateien} Dateien · Stand ` +
              String(snap.erzeugt).replace("T", " ")));
    }
    sheetOeffnen("Info: UGC Dashboard", wrap);
  } else {
    wrap.append(
      titel("Cockpit"),
      zeile("Installierbare Web-App (PWA). Daten liegen auf dem Gerät und " +
            "in OneDrive — nichts auf GitHub."),
      zeile("App-Version " + APP_VERSION + " · Updates holt die App beim " +
            "Öffnen selbst und meldet sich mit einem Banner."),
      zeile(datenstand
        ? `Datenstand: ${datenstand.marken.length} Marken · Stand ` +
          `${String(datenstand.geaendert).replace("T", " ")} · ` +
          `Quelle: ${datenstandQuelle}`
        : "Datenstand: noch nicht geladen"),
      zeile("Ohne Internet zeigt die App den zuletzt geladenen Stand — " +
            "wie alt er ist, steht in der Stand-Zeile."));
    sheetOeffnen("Info: App", wrap);
  }
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

// Diagrammtyp je KPI (Tobias 30.08.): eine Wahl pro Kennzahl, gilt fuer
// Sparkline UND Verlaufs-Sheet. Gewaehlt wird im Sheet, gespeichert in
// den Geraete-Einstellungen (localStorage, wie die Schriftgroesse).
const CHART_TYPEN = [["linie", "Linie"], ["punkte", "Punkte"],
                     ["balken", "Balken"], ["flaeche", "Fläche"]];

function chartTyp(schluessel) {
  return (einst.charts || {})[schluessel] || "linie";
}

// Sparkline in der KPI-Kachel (dataviz-Skill): Monatswerte als gedaempfte
// 2px-Linie, der gewaehlte Monat als Punkt mit 2px Flaechen-Ring.
// Balken-Typ: der gewaehlte Monat ist der volle, die anderen gedaempft.
function sparkline(schluessel) {
  const werte = monate().map((z) => z.gesamt[schluessel]);
  if (werte.length < 2) return null;
  const typ = chartTyp(schluessel);
  const B = 120, H = 30, R = 4, P = R + 2;
  const max = Math.max(...werte, 1);
  const x = (i) => P + (i * (B - 2 * P)) / (werte.length - 1);
  const y = (w) => H - P - (w / max) * (H - 2 * P);
  const akt = zi > 0 ? zi - 1 : werte.length - 1; // Gesamt -> letzter Monat
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${B} ${H}`);
  svg.setAttribute("class", "spark");
  svg.setAttribute("aria-hidden", "true");
  let s = "";
  if (typ === "balken") {
    const bw = Math.min(8, ((B - 2 * P) / werte.length) * 0.6);
    s = werte.map((w, i) =>
      `<rect x="${x(i) - bw / 2}" y="${y(w)}" width="${bw}"` +
      ` height="${Math.max(1, H - P - y(w))}" rx="1"` +
      ` fill="var(--blau)" opacity="${i === akt ? "1" : ".4"}"/>`).join("");
  } else {
    const punkte = werte.map((w, i) => `${x(i)},${y(w)}`).join(" ");
    if (typ === "flaeche") {
      s += `<polygon points="${x(0)},${H - P} ${punkte}` +
           ` ${x(werte.length - 1)},${H - P}" fill="var(--blau)" opacity=".15"/>`;
    }
    s += `<polyline points="${punkte}"` +
         ` fill="none" stroke="var(--blau)" stroke-width="2"` +
         ` stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
    if (typ === "punkte") {
      s += werte.map((w, i) => `<circle cx="${x(i)}" cy="${y(w)}" r="2"` +
                               ` fill="var(--blau)" opacity=".55"/>`).join("");
    }
    s += `<circle cx="${x(akt)}" cy="${y(werte[akt])}" r="${R}"` +
         ` fill="var(--blau)" stroke="var(--panel)" stroke-width="2"/>`;
  }
  svg.innerHTML = s;
  return svg;
}

function kpiKacheln(gesamt) {
  const reihe = el("div", "kacheln");
  for (const [schluessel, titel] of Object.entries(KACHEL_TITEL)) {
    const kachel = el("div", "kachel");
    kachel.dataset.k = schluessel; // Anker fuer gezielten Sparkline-Tausch
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
function sheetOeffnen(titel, inhalt, aktion) {
  sheetEntfernen();
  const schleier = el("div", "schleier");
  schleier.id = "schleier";
  const sheet = el("div", "sheet");
  const kopf = el("div", "sheet-kopf");
  kopf.append(el("div", "titel", titel));
  if (aktion) kopf.append(aktion); // Knopf rechts neben dem Titel (v43)
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
  sheetEbene = null;
  const s = document.getElementById("schleier");
  if (s) s.remove();
}

// Sheet zu + falls der Erledigt-Knopf etwas geändert hat, die Liste
// dahinter frisch zeichnen (sonst zeigt sie noch den alten Status)
let listeVeraltet = false;
// Ebene IM Sheet (Rating-Formular, v44): eigener History-Eintrag, damit
// Zurueck-Geste und Schliessen-Knopf erst das Formular verlassen und die
// Brand-Ansicht wieder zeigen - statt das ganze Sheet zu schliessen.
let sheetEbene = null;
window.addEventListener("popstate", () => {
  if (sheetEbene) { const zurueck = sheetEbene; sheetEbene = null; zurueck(); return; }
  sheetEntfernen();
  if (listeVeraltet) { listeVeraltet = false; render(); }
});

// Verlaufs-Diagramm (Inline-SVG, Specs aus der dataviz-Skill): Hairline-
// Gitter in Randfarbe, saubere Y-Ticks, Wert-Label nur am Endpunkt.
// Serie je nach gewaehltem Typ (Linie/Punkte/Balken/Flaeche, siehe
// CHART_TYPEN). Antippen zeigt den naechstgelegenen Monat.
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
  // Serie je nach gewaehltem Diagrammtyp (chartTyp), danach fuer alle:
  // Endwert-Label + unsichtbarer Tipp-Punkt
  const typ = chartTyp(schluessel);
  const punkte = werte.map((w, i) => `${x(i)},${y(w)}`).join(" ");
  const letzte = werte.length - 1;
  if (typ === "balken") {
    const bw = Math.min(28, ((B - L - R) / werte.length) * 0.6);
    werte.forEach((w, i) => {
      s += `<rect x="${x(i) - bw / 2}" y="${y(w)}" width="${bw}"` +
           ` height="${Math.max(1, y(0) - y(w))}" rx="2"` +
           ` fill="var(--blau)" opacity=".85"/>`;
    });
  } else {
    if (typ === "flaeche") {
      s += `<polygon points="${L},${y(0)} ${punkte} ${x(letzte)},${y(0)}"` +
           ` fill="var(--blau)" opacity=".1"/>`;
    }
    s += `<polyline points="${punkte}" fill="none" stroke="var(--blau)"` +
         ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (typ === "punkte") {
      werte.forEach((w, i) => {
        s += `<circle cx="${x(i)}" cy="${y(w)}" r="3" fill="var(--blau)"` +
             ` stroke="var(--panel)" stroke-width="1.5"/>`;
      });
    }
    s += `<circle cx="${x(letzte)}" cy="${y(werte[letzte])}" r="4"` +
         ` fill="var(--blau)" stroke="var(--panel)" stroke-width="2"/>`;
  }
  s += `<text x="${x(letzte)}" y="${y(werte[letzte]) - 9}" text-anchor="end"` +
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
  let svg = verlaufsDiagramm(schluessel, readout);
  // Diagrammtyp-Chips: Wahl gilt sofort hier UND fuer die Sparkline der
  // Kachel dahinter. Bewusst KEIN render() - das raeumt jedes offene Sheet
  // weg (Router-Regel). Stattdessen nur die eine Sparkline austauschen.
  const typZeile = el("div", "chips");
  CHART_TYPEN.forEach(([wert, label]) => {
    const chip = el("button",
      "chip" + (chartTyp(schluessel) === wert ? " aktiv" : ""), label);
    chip.onclick = () => {
      einst.charts = Object.assign(einst.charts || {}, { [schluessel]: wert });
      localStorage.setItem(EINST_KEY, JSON.stringify(einst));
      [...typZeile.children].forEach(
        (c, i) => c.classList.toggle("aktiv", CHART_TYPEN[i][0] === wert));
      const neu = verlaufsDiagramm(schluessel, readout);
      svg.replaceWith(neu);
      svg = neu;
      const spark = document.querySelector(
        `.kachel[data-k="${schluessel}"] svg.spark`);
      if (spark) spark.replaceWith(sparkline(schluessel));
    };
    typZeile.append(chip);
  });
  wrap.append(readout, svg, typZeile);
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
// Dieselbe Bewertung, zwei Schreibweisen (Tobias 03.09.): das Brand Rating
// in Excel/App speichert Sterne und Herzen ("⭐⭐⭐⭐"), das Word-Book eine
// blanke Zahl ("4"). Im Pitch-Sheet kamen die Book-Werte an und zeigten
// Zahlen, wo im Brand Rating Symbole standen. Umgerechnet wird NUR fuer
// die Anzeige - gespeichert und ins Word exportiert bleibt, was da war.
const SKALA_SYM = { "brand fit": "⭐", "begeisterung": "❤️",
                    "erfolgschance": "⭐" };

function skalaWert(label, wert) {
  const sym = SKALA_SYM[String(label).trim().toLowerCase()];
  const n = Number(String(wert).trim());
  return sym && Number.isInteger(n) && n >= 1 && n <= 5
    ? sym.repeat(n) : wert;
}

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
// ohneRating: im Brand-Rating-Sheet stehen die 4 Bewertungsfelder schon
// im Excel-Block darueber - das Book kopiert sie nur (Tobias 31.08.:
// Rating entsteht im Brand Rating, nicht im Book -> nur einmal zeigen).
const RATING_FELDER = ["rating (a-d)", "brand fit", "begeisterung",
                       "erfolgschance"];

// Kontaktfelder der Book-Kerninfos, die in der App pflegbar sind (Phase 6).
// Labels EXAKT wie im Book-Template - dann deckt sich der App-Wert mit dem
// geparsten Book-Wert, und ein spaeterer Word-Export mappt 1:1.
const KONTAKT_FELDER = ["Website", "Ansprechpartner", "E-Mail", "Social Media"];

// Kerninfos = geparster Book-Stand aus dem Snapshot, ueberschrieben von in
// der App gepflegten Werten (m.kerninfos). Gleiches Overlay-Prinzip wie bei
// der Pitchliste: die App gewinnt, bis der naechste PC-Export beide angleicht.
// Ueberschrieben wird bei VORHANDENEM Schluessel (nicht nur bei Inhalt) -
// sonst kaeme ein in der App geleertes Feld aus dem Snapshot zurueck.
function kerninfosAktuell(m, quelle) {
  const aus = Object.assign({}, (snap.kerninfos && snap.kerninfos[quelle]) || {});
  for (const [k, w] of Object.entries((m && m.kerninfos) || {})) aus[k] = w;
  // Rating-Felder aus dem Brand Rating NACHTRAGEN, wenn der Book-Stand sie
  // nicht kennt (Tobias 01.09.): eine App-angelegte Brand hat noch kein
  // geparstes Book, die Werte stehen aber laengst im Datenstand - ohne das
  // fehlten sie im Pitch-Sheet, waehrend Excel-Brands sie zeigen.
  // Bewusst nur FUELLEN, nie ueberschreiben: weicht ein vorhandener
  // Book-Wert vom Brand Rating ab, soll genau das sichtbar bleiben.
  const br = (m && m.brandrating) || {};
  const nachtrag = { "Rating (A-D)": br.rating, "Brand Fit": br.brandfit,
    "Begeisterung": br.begeisterung, "Erfolgschance": br.erfolgschance };
  for (const [k, w] of Object.entries(nachtrag)) {
    if (!String(aus[k] || "").trim() && String(w || "").trim()) aus[k] = w;
  }
  return aus;
}

// "Kontakt & Infos"-Tabelle - eigener Baustein, weil sie auch OHNE Book
// gebraucht wird (App-angelegte Brand: Kontaktdaten stehen dann nur im
// Datenstand, das Book kennt sie erst nach dem naechsten PC-Export).
// knopf (optional): "✎ Kontaktdaten" fuer das Pitch-Sheet. Ist er dabei,
// wird der Abschnitt AUCH ohne Daten gezeichnet - sonst gaebe es bei einer
// frisch angelegten Brand keinen Weg, die ersten Kontaktdaten einzutragen.
function bereichKontakt(m, quelle, ohneRating, knopf) {
  const frag = document.createDocumentFragment();
  const infos = Object.entries(kerninfosAktuell(m, quelle))
    .filter(([label, wert]) => String(wert).trim() &&
      label.toLowerCase() !== "name" &&
      !(ohneRating && RATING_FELDER.includes(label.trim().toLowerCase())));
  if (!infos.length && !knopf) return frag;
  let inhalt;
  if (infos.length) {
    inhalt = el("div", "tabelle");
    for (const [label, wert] of infos) {
      const zeile = el("div", "zeile");
      zeile.append(el("span", "leise", label),
                   kontaktWert(label, skalaWert(label, wert)));
      inhalt.append(zeile);
    }
  } else {
    inhalt = el("div", "leerzustand kompakt",
      "Noch keine Kontaktdaten eingetragen.");
  }
  let kz = null;
  if (knopf) { kz = el("div", "chips"); kz.append(knopf); }
  frag.append(abschnitt("Kontakt & Infos", inhalt, kz));
  return frag;
}

// Book-Datei direkt oeffnen (Task 4, 31.08.): Graph-Suche nach dem
// Dateinamen - funktioniert unabhaengig davon, wo der Book-Ordner liegt
// (Testdaten-Kopie heute, Andreas Ordner spaeter). webUrl uebergibt auf
// Android an die Word/OneDrive-App. Gibt null zurueck, wenn kein Book
// erreichbar ist (nicht angemeldet / keine Quelle) - ein Knopf, der
// garantiert "nicht gefunden" meldet, gehoert nicht auf den Schirm.
// Eine Stelle fuer alle drei Sheets (Firma, Pitch, Brand Rating).
// Book-Dateiname: geparste Quelle (aus Word eingelesen) oder - bei einer
// in der App angelegten Brand - der Name des selbst erzeugten Books.
// Damit sehen beide Herkuenfte gleich aus (Tobias 03.09.).
function bookName(quelle, m) {
  if (quelle) return quelle;
  return m && m.brandrating && m.brandrating.brandbook
    ? "Brand-Book " + m.name : null;
}

function bookOeffnenZeile(quelle) {
  if (!quelle || typeof OD === "undefined" || !OD.konto()) return null;
  const z = el("div", "chips");
  const b = el("button", "chip", "📄 Brand-Book öffnen");
  b.onclick = () => bookOeffnen(quelle, b);
  z.append(b);
  return z;
}

// "02.09.2026" -> sortierbare Zahl. Unbekanntes Format ans Ende, damit
// ein kaputtes Datum die Reihenfolge nicht durcheinanderwirft.
function datumWert(d) {
  const t = String(d || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return t ? Number(t[3]) * 10000 + Number(t[2]) * 100 + Number(t[1]) : 1e12;
}

// Ereignisse aus BEIDEN Quellen zusammenfuehren (Tobias 02.09.):
//   m.events            - Datenstand, enthaelt auch was die App gerade
//                         erst per "erledigt" eingetragen hat
//   snap.historie[q]    - aus dem Word-Book geparst, letzter PC-Export
// Vorher las die Historie NUR den Snapshot. Zwei Folgen, eine Ursache:
// eine App-angelegte Brand hat keine `quelle` und bekam deshalb gar keine
// Historie zu sehen; und ein frisch erledigter Pitch blieb selbst bei
// Book-Marken unsichtbar, bis am PC neu exportiert wurde.
// Nach einem Export steht dasselbe Ereignis in beiden Quellen - Doppelte
// fallen ueber Datum+Typ+Aktion raus, Schreibweise normalisiert, weil das
// Book "Follow-up 1" schreibt und die App "Follow up 1".
function historieAktuell(m, quelle) {
  const alle = [...((m && m.events) || []),
                ...((snap && snap.historie && snap.historie[quelle]) || [])];
  const gesehen = new Set();
  const raus = [];
  for (const e of alle) {
    const id = [e.datum, e.typ, e.aktion, e.positiv]
      .map((x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
      .join("|");
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    raus.push(e);
  }
  return raus.sort((a, b) => datumWert(a.datum) - datumWert(b.datum));
}

// Eigener Baustein, weil die Historie an drei Stellen gebraucht wird:
// Firmen-Sheet, Pitch-Sheet und Brand-Rating-Sheet - die letzten beiden
// auch dann, wenn es (noch) kein Book gibt.
function bereichHistorie(m, quelle) {
  const frag = document.createDocumentFragment();
  const eintraege = historieAktuell(m, quelle);
  const leer = [];
  if (!eintraege.length) {
    // Am BOOK unterscheiden, nicht am Marken-Objekt: gibt es eine Quelle,
    // ist das geparste Word die Herkunft und ein Update kann wirklich
    // etwas nachliefern. Ohne Book waere derselbe Rat schlicht falsch.
    leer.push(el("div", "leerzustand kompakt", quelle
      ? "Keine Historie im Snapshot — einmal Update (↻) drücken."
      : "Noch keine Ereignisse — der erste Pitch erscheint hier, sobald " +
        "du ihn in der Pitchliste erledigst."));
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
  // Titel zeigt die Anzahl - so sieht man zugeklappt, ob es was zu sehen gibt
  frag.append(abschnitt("Historie", ...leer, tab));
  return frag;
}

function markenDetails(quelle, ohneRating, m, kontaktKnopf) {
  const frag = document.createDocumentFragment();
  const oeffnen = bookOeffnenZeile(bookName(quelle, m));
  if (oeffnen) frag.append(oeffnen);
  // Kerninfos aus dem Brand-Book (Name weggelassen - steht im Sheet-Titel)
  frag.append(bereichKontakt(m, quelle, ohneRating, kontaktKnopf),
              bereichHistorie(m, quelle));
  return frag;
}

// Fenster SYNCHRON oeffnen (vor dem await), sonst blockt der Popup-
// Blocker das window.open nach der Graph-Antwort. Bei mehreren Treffern
// gewinnt der erste - auf /me/drive gibt es den Namen normal nur einmal.
async function bookOeffnen(quelle, btn) {
  btn.disabled = true;
  const fenster = window.open("", "_blank");
  const zu = () => { if (fenster) fenster.close(); };
  try {
    const q = encodeURIComponent(String(quelle).replace(/'/g, "''"));
    const d = await OD.graphLeise(
      `/me/drive/root/search(q='${q}')?$select=name,webUrl,file`);
    const soll = (quelle + ".docx").toLowerCase();
    const treffer = ((d && d.value) || []).find(
      (e) => e.file && String(e.name).toLowerCase() === soll);
    if (treffer && treffer.webUrl) {
      if (fenster) fenster.location = treffer.webUrl;
      else window.open(treffer.webUrl, "_blank");
    } else {
      zu();
      banner(`„${quelle}.docx“ nicht in OneDrive gefunden.`);
    }
  } catch (_) {
    zu();
    banner("OneDrive-Suche fehlgeschlagen.");
  }
  btn.disabled = false;
}

function sheetHistorie(m) {
  const wrap = el("div");
  wrap.append(el("div", "kontext",
    `${m.gruppe || "Sonstige"} · Quelle: ${m.quelle}.docx`));
  wrap.append(markenDetails(m.quelle, false, m));
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
// Phase 5: Erledigt-Knopf (Ablauf 6+8) — trägt die fällige Aktion als
// Event + fortgeschriebene Pitchlisten-Felder in den Datenstand ein;
// Rückgängig stellt exakt den Stand davor wieder her.
function sheetPitch(p) {
  const wrap = el("div");
  const mv = datenstand ? markeZuName(p.name) : null;
  const z = { modus: null };
  const stift = mv && mv.brandrating
    ? formularKnopf(z, bau, "rating", "✎ Rating") : null;
  // Kontaktdaten auch hier bearbeitbar (Tobias 01.09.): faellt im Pitch-
  // Alltag eine falsche E-Mail auf, korrigiert man sie dort, wo man ist.
  const kontaktKnopf = mv
    ? formularKnopf(z, bau, "kontakt", "✎ Kontaktdaten") : null;
  bau();
  sheetOeffnen(p.name, wrap, stift);

  function bau() {
    wrap.innerHTML = "";
    const formular = formularAnsicht(z, mv);
    if (formular) { wrap.append(formular); return; }
    const q = pitchMitDatenstand(p);
    wrap.append(el("div", "kontext",
      ampel(q.datum_naechste_aktion, heuteNull()).text));

    const felder = [
      ["Status", q.status],
      ["Rating", q.rating],
      ["Kategorie", q.kategorie],
      ["Letzter Kontakt", q.letzter_kontakt],
      ["Nächster Schritt", q.naechste_aktion],
      ["Termin", q.datum_naechste_aktion ? deDatum(q.datum_naechste_aktion) : ""],
      ["Follow-ups", q.zaehler],
      ["Kooperation", q.kooperation],
    ].filter(([, wert]) => wert);
    const tab = el("div", "tabelle");
    for (const [label, wert] of felder) {
      const zeile = el("div", "zeile");
      zeile.append(el("span", "leise", label), el("span", null, wert));
      tab.append(zeile);
    }
    wrap.append(abschnitt("Wiedervorlage", tab),
                bereichStartdatum(q), bereichErledigen(q));

    // EIN Bauplan fuer beide Herkuenfte (Tobias 03.09.): ob die Brand aus
    // Andreas Word kam oder in der App entstand, sieht man am Inhalt - das
    // Sheet muss deshalb nicht anders aufgebaut sein. markenDetails deckt
    // beides ab; fehlt ein Book, sagen das die Leerzustaende.
    wrap.append(markenDetails(quelleZuName(p.name), false, mv, kontaktKnopf));

    if (mv && mv.erstellt) wrap.append(bereichLoeschen(mv));
  }

  // Startdatum (Andreas Workflow Schritt 7): frisch aus dem Brand Rating
  // kommt die Brand OHNE Termin in die Pitchliste - erst das manuell
  // gesetzte Startdatum startet die 5/5/10/90-Kadenz. Sichtbar bis zum
  // ersten Kontakt, damit sich ein vertipptes Datum korrigieren laesst.
  function bereichStartdatum(q) {
    const frag = document.createDocumentFragment();
    const m = datenstand ? markeZuName(p.name) : null;
    if (!m || !m.pitchliste || q.letzter_kontakt) return frag;
    const d = el("input", "datum");
    d.type = "date"; // nativer Android-Datumsdialog statt eigener Picker
    d.value = q.datum_naechste_aktion || isoInTagen(0);
    const z = el("div", "chips");
    const ok = el("button", "chip aktiv",
      q.datum_naechste_aktion ? "Startdatum ändern" : "Startdatum setzen");
    ok.onclick = () => {
      if (!d.value) return;
      Object.assign(m.pitchliste,
        { datum_naechste_aktion: d.value, geaendert: lokalIso() });
      listeVeraltet = true;
      datenstandPersistieren();
      bau();
    };
    z.append(d, ok);
    frag.append(abschnitt("Startdatum", z, el("div", "stand",
      "Ab diesem Datum ist der Pitch fällig — erst damit beginnt die " +
      "5/5/10/90-Kadenz.")));
    return frag;
  }

  function bereichErledigen(q) {
    // Inhalt sammeln, am Ende in den aufklappbaren Abschnitt haengen -
    // die Funktion hat zwei Ausgaenge, deshalb nicht direkt hineinbauen.
    const frag = document.createDocumentFragment();
    const m = datenstand ? markeZuName(p.name) : null;
    if (!m || !m.pitchliste) {
      frag.append(el("div", "leerzustand kompakt", datenstand
        ? "Marke nicht im Datenstand — am PC datenstand.py laufen lassen."
        : "Erledigt-Funktion braucht den Datenstand — App einmal mit Internet öffnen."));
      return abschnitt("Nächster Schritt", frag);
    }
    const s = naechsterSchritt(q.naechste_aktion, fuSeitPitch(m));
    const standard = (m.intervalle || {})[s.key] || KADENZ_STD[s.key];
    const tage = el("input", "tage");
    tage.type = "number";
    tage.min = "1";
    tage.inputMode = "numeric";
    tage.value = String(standard);
    const dTage = () => parseInt(tage.value, 10) || standard;
    const danach = el("div", "stand");
    const dText = () => { danach.textContent =
      `Danach: ${s.naechste} am ${deDatum(isoInTagen(dTage()))}`; };
    tage.oninput = dText;
    dText();
    const abstand = el("div", "stand");
    abstand.append("Abstand: ", tage, " Tage — änderbar, gilt dann künftig für diese Marke");
    const zeile = el("div", "chips");
    const ok = el("button", "chip aktiv", `✓ ${s.aktion} erledigt`);
    ok.onclick = () => {
      if (!confirm(`${s.aktion} als erledigt eintragen?\n` +
          `Nächster Schritt: ${s.naechste} am ${deDatum(isoInTagen(dTage()))}`)) return;
      erledigen(m, s, dTage(), standard);
      bau();
    };
    zeile.append(ok);
    frag.append(zeile, abstand, danach);
    // Rückgängig nur für die letzte Aktion (Regel: keine Erstellen-
    // Funktion ohne Löschen-Funktion) — genau diese eine, sonst nichts
    const la = datenstand.letzteAktion;
    if (la && schluessel(la.name) === schluessel(m.name)) {
      frag.append(el("div", "stand",
        `Zuletzt eingetragen: ${la.aktion} (${la.zeit.replace("T", " ").slice(0, 16)})`));
      const rz = el("div", "chips");
      const rk = el("button", "chip", "↶ Rückgängig");
      rk.onclick = () => { rueckgaengig(m, la); bau(); };
      rz.append(rk);
      frag.append(rz);
    }
    return abschnitt("Nächster Schritt", frag);
  }
}

// -------------------------------------------------------------- Pitchliste

function heuteNull() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Zeitstempel in LOKALER Zeit (wie datenstand.py am PC) — toISOString()
// wäre UTC und läge 1-2 h daneben, der "neueste gewinnt"-Vergleich kippt.
function lokalIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 19);
}

// ISO-Datum (YYYY-MM-DD) heute + t Tage, in Lokalzeit gerechnet
function isoInTagen(t) {
  const d = new Date();
  d.setDate(d.getDate() + t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function deDatum(iso) { return String(iso).split("-").reverse().join("."); }

// Namens-Schlüssel wie _schluessel in Python: nur Buchstaben/Ziffern
function schluessel(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
}

function markeZuName(name) {
  const s = schluessel(name);
  return (datenstand.marken || []).find((m) => schluessel(m.name) === s) || null;
}

// Wo die App selbst etwas geändert hat (Erledigt-Knopf), gewinnt der
// Datenstand über die Snapshot-Zeile — bis der nächste PC-Export die
// Änderung regulär enthält (dann ist snap.erzeugt neuer).
function pitchMitDatenstand(p) {
  const m = datenstand && markeZuName(p.name);
  const pl = m && m.pitchliste;
  return pl && pl.geaendert && pl.geaendert > String(snap.erzeugt || "")
    ? { ...p, ...pl } : p;
}

function pitchlisteAktuell() {
  const liste = (snap.pitchliste || []).map(pitchMitDatenstand);
  // In der App angelegte Brands bzw. Pitchlisten-Einträge ergänzen (Neue
  // Brand ODER "Rating abgeschlossen"), bis der PC-Export sie kennt
  // (dann greift die Dublettenprüfung über den Namens-Schlüssel)
  if (datenstand) {
    const da = new Set(liste.map((p) => schluessel(p.name)));
    for (const m of datenstand.marken || []) {
      if (m.pitchliste && (m.erstellt || m.pitchliste.erstellt) &&
          !da.has(schluessel(m.name))) {
        liste.push({ name: m.name, ...m.pitchliste });
      }
    }
  }
  // D-Brands = inaktiv/Archiv bei Andrea (Tobias 01.09.): erscheinen nie
  // in der Pitchliste - egal ob das D aus der Excel-Pitchliste kommt oder
  // per Rating-Edit in der App gesetzt wurde.
  const istD = (p) => {
    if (String(p.rating || "").trim().toUpperCase() === "D") return true;
    const m = datenstand && markeZuName(p.name);
    return Boolean(m && m.brandrating &&
      String(m.brandrating.rating || "").trim().toUpperCase() === "D");
  };
  return liste.filter((p) => !istD(p));
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
    ? deDatum(p.datum_naechste_aktion) : null;
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
const pf = { faellig: "", rating: "", kategorie: "", suche: "", sortierung: "" };

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

// ---------------------------------------------------------- Sortierung
// Sortierbar nach denselben Kriterien, nach denen auch gefiltert wird
// (Tobias 01.09.). "" ist immer die Standard-Sortierung der Liste -
// der erste Chip ist damit gleichzeitig der Zuruecksetzen-Knopf.
const SORT_PITCH = [["", "Dringlichkeit"], ["name", "Name A–Z"],
                    ["rating", "Rating"], ["kategorie", "Kategorie"]];
const SORT_BRAND = [["", "Name A–Z"], ["rating", "Rating"],
                    ["book", "Brand-Book"], ["fit", "Brand Fit"],
                    ["geist", "Begeisterung"], ["chance", "Erfolgschance"],
                    ["erstellt", "Erstellt (neueste zuerst)"]];

const nameVgl = (a, b) => String(a).localeCompare(String(b), "de");

// Vergleich nach einem Schluessel. Leere Werte landen IMMER am Ende (auch
// beim Absteigend-Sortieren) - eine Marke ohne Rating soll die Liste nicht
// anfuehren. Gleichstand wird alphabetisch aufgeloest, damit die Reihenfolge
// stabil und nachvollziehbar bleibt.
function nachSchluessel(schl, absteigend) {
  return (a, b) => {
    const x = schl(a), y = schl(b);
    const xLeer = x === "" || x === null || x === undefined;
    const yLeer = y === "" || y === null || y === undefined;
    if (xLeer && yLeer) return nameVgl(a.name, b.name);
    if (xLeer) return 1;
    if (yLeer) return -1;
    let d = (typeof x === "number" && typeof y === "number")
      ? x - y : nameVgl(x, y);
    if (absteigend) d = -d;
    return d || nameVgl(a.name, b.name);
  };
}

function sortierePitch(liste, art) {
  const k = [...liste];
  if (art === "name") return k.sort((a, b) => nameVgl(a.name, b.name));
  if (art === "rating") return k.sort(nachSchluessel((p) => p.rating));
  if (art === "kategorie") return k.sort(nachSchluessel((p) => p.kategorie));
  // Standard: Dringlichkeit, ohne Termin ans Ende
  return k.sort((a, b) => (a.tage === null ? 1e9 : a.tage) -
                          (b.tage === null ? 1e9 : b.tage));
}

function sortiereBrand(liste, art) {
  const k = [...liste];
  const skala = (feld) => (m) => symAnzahl(m.brandrating[feld]);
  if (art === "rating") return k.sort(nachSchluessel((m) => m.brandrating.rating));
  if (art === "book")   // ohne Book zuerst - das ist die Arbeitsliste
    return k.sort(nachSchluessel((m) => (m.brandrating.brandbook ? 1 : 0)));
  if (art === "fit") return k.sort(nachSchluessel(skala("brandfit"), true));
  if (art === "geist") return k.sort(nachSchluessel(skala("begeisterung"), true));
  if (art === "chance") return k.sort(nachSchluessel(skala("erfolgschance"), true));
  // Erstell-Datum (Tobias 02.09.): nur App-angelegte Brands haben ein
  // "erstellt" - Andreas gewachsene Excel-Brands landen deshalb am Ende
  // (nachSchluessel sortiert Leerwerte immer nach hinten).
  if (art === "erstellt") return k.sort(nachSchluessel((m) => m.erstellt || "", true));
  return k.sort((a, b) => nameVgl(a.name, b.name));
}

// Knopf + Sheet, gleiche Mechanik wie der Filter-Knopf daneben.
function sortierKnopf(optionen, holen, setzen, zeichnen) {
  const btn = el("button", "chip");
  btn.onclick = () => {
    const wrap = el("div");
    wrap.append(chipFilter(optionen, holen(), setzen, zeichnen));
    sheetOeffnen("Sortierung", wrap);
  };
  return btn;
}

// Beschriftung des Sortier-Knopfs + Text fuer die Zaehlerzeile
function sortLabel(optionen, art) {
  const treffer = optionen.find(([w]) => w === art);
  return (treffer || optionen[0])[1];
}

function renderPitchliste() {
  kopfzeile("Pitchliste", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  const heute = heuteNull();
  const alle = pitchlisteAktuell()
    .map((p) => ({ ...p, ...ampel(p.datum_naechste_aktion, heute) }));
  if (!alle.length) {
    c.append(el("div", "leerzustand",
      "Keine Pitchliste im Snapshot — einmal Update (↻) drücken."));
    return;
  }

  // Suchfeld bleibt direkt erreichbar; die Filter-Chips (Faellig / Rating /
  // Kategorie) wohnen wie im Dashboard in einem Sheet hinter einem Knopf
  // (Tobias 30.08.: "sonst wird alles zu unuebersichtlich").
  const suche = el("input", "suche");
  suche.type = "search";
  suche.placeholder = "Suchen (Name, Status, Kooperation …)";
  suche.value = pf.suche;
  suche.oninput = () => { pf.suche = suche.value; zeichnen(); };
  c.append(suche);

  // "Neue Brand" wohnt seit v32 im Brand Rating (Andreas Workflow:
  // Brands entstehen dort, nicht in der Pitchliste)
  const knopfZeile = el("div", "chips");
  const filterBtn = el("button", "chip");
  filterBtn.onclick = () => {
    const wrap = el("div");
    wrap.append(chipFilter(
      [["", "Alle"], [7, "Fällig ≤ 7 Tage"], [14, "≤ 14 Tage"]],
      pf.faellig, (w) => { pf.faellig = w; }, zeichnen));
    const ratings =
      [...new Set(alle.map((p) => p.rating).filter(Boolean))].sort();
    if (ratings.length > 1) {
      wrap.append(chipFilter(ratings.map((r) => [r, "Rating " + r]),
        pf.rating, (w) => { pf.rating = w; }, zeichnen));
    }
    const kategorien =
      [...new Set(alle.map((p) => p.kategorie).filter(Boolean))].sort();
    if (kategorien.length > 1) {
      wrap.append(chipFilter(kategorien.map((k) => [k, k]),
        pf.kategorie, (w) => { pf.kategorie = w; }, zeichnen));
    }
    sheetOeffnen("Filter", wrap);
  };
  const sortBtn = sortierKnopf(SORT_PITCH, () => pf.sortierung,
    (w) => { pf.sortierung = w; }, () => zeichnen());
  knopfZeile.append(filterBtn, sortBtn);
  c.append(knopfZeile);

  // Zaehler + Karten werden beim Tippen im Suchfeld neu gezeichnet, ohne
  // die ganze Ansicht zu rendern (sonst verliert das Suchfeld den Fokus)
  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    const n = (pf.faellig === "" ? 0 : 1) +
      (pf.rating ? 1 : 0) + (pf.kategorie ? 1 : 0);
    filterBtn.textContent = "⛭ Filter" + (n ? ` · ${n} aktiv` : "");
    filterBtn.classList.toggle("aktiv", n > 0);
    sortBtn.textContent = "⇅ " + sortLabel(SORT_PITCH, pf.sortierung);
    sortBtn.classList.toggle("aktiv", Boolean(pf.sortierung));
    const s = pf.suche.trim().toLowerCase();
    const gefiltert = alle.filter((p) =>
      (pf.faellig === "" || (p.tage !== null && p.tage <= pf.faellig)) &&
      (!pf.rating || p.rating === pf.rating) &&
      (!pf.kategorie || p.kategorie === pf.kategorie) &&
      (!s || [p.name, p.status, p.naechste_aktion, p.kooperation, p.kategorie]
        .join(" ").toLowerCase().includes(s)));
    const liste = sortierePitch(gefiltert, pf.sortierung);
    rumpf.innerHTML = "";
    // Zaehler und Liste aus derselben Bedingung (Briefing Abschnitt 4.9)
    const rot = liste.filter((p) => p.klasse === "rot").length;
    rumpf.append(el("div", "stand",
      `${liste.length} von ${alle.length} Marken · ${rot} fällig/überfällig · ` +
      `sortiert nach ${sortLabel(SORT_PITCH, pf.sortierung)}`));
    if (!liste.length) {
      rumpf.append(el("div", "leerzustand", "Nichts passt zu den Filtern."));
      return;
    }
    // Eigene Sektion fuer frisch uebertragene Pitches (Tobias 31.08. spät):
    // ohne Termin UND ohne bisherigen Kontakt = wartet auf sein Startdatum.
    // Ohne die Sektion gingen Neue in der Gesamtliste unter. Excel-Marken
    // ohne Termin, aber MIT Kontakt-Historie bleiben in der Hauptliste.
    const neu = liste.filter((p) => !p.datum_naechste_aktion && !p.letzter_kontakt);
    if (neu.length) {
      rumpf.append(el("div", "abschnitt",
        `🆕 Neu — Startdatum setzen (${neu.length})`));
      const nk = el("div", "karten");
      for (const p of neu) {
        const k = pitchKarte(p);
        k.classList.add("neu");
        nk.append(k);
      }
      rumpf.append(nk, el("div", "abschnitt", "Wiedervorlage"));
    }
    const karten = el("div", "karten");
    for (const p of liste) if (!neu.includes(p)) karten.append(pitchKarte(p));
    rumpf.append(karten);
  }
}

// ------------------------------------------------------------ Brand Rating

// Brand-Rating-Ansicht (Tobias 31.08., Andreas Workflow Phase A): alle
// Marken mit Brandrating-Zeile aus dem Datenstand, alphabetisch. Hier
// entstehen neue Brands ("+ Neue Brand", seit v32 hierher verlegt) und
// hier kommt in Phase 5 der "Rating abgeschlossen"-Knopf dazu.
const bf = { rating: "", book: "", fit: "", geist: "", chance: "", suche: "",
             sortierung: "" };

// Skalenwert aus der Symbol-Kette des Brandrating-Blatts ("⭐⭐⭐" -> 3)
function symAnzahl(s) {
  return (String(s || "").match(/[⭐❤★]/gu) || []).length;
}

// Stufe 2 erledigt = Brand steht in der Pitchliste (App-Eintrag oder
// schon im Excel-Snapshot) - eine Bedingung fuer Statuszeile und Knopf.
function inPitchliste(m) {
  return Boolean(m.pitchliste || (snap && (snap.pitchliste || []).some(
    (p) => schluessel(p.name) === schluessel(m.name))));
}

// Ratings bearbeiten (Tobias 01.09.): Fit/Begeisterung/Erfolgschance und
// das A-D-Rating koennen im Projektverlauf auch SINKEN - deshalb ueberall
// aenderbar, wo die Brand auftaucht (Brand-Rating-Sheet + Pitchlisten-
// Sheet). Rating D = inaktiv/Archiv: damit fliegt die Brand aus der
// Pitchliste (Filter in pitchlisteAktuell), bleibt aber im Brand Rating.
// ZWEI getrennte Formulare (Tobias 01.09., v48) - getrennt nach Herkunft
// der Daten, nicht nach Bildschirmplatz:
//   "✎ Rating"        (Sheet-Kopfzeile) - Rating/Fit/Begeisterung/Erfolgs-
//                     chance, also die Felder aus dem Excel-Blatt.
//   "✎ Kontaktdaten"  (Knopfreihe)      - Website/Ansprechpartner/E-Mail/
//                     Social Media, die gibt es NUR im Brand-Book.
// Achtung beim Lesen: im Word stehen beide Gruppen in derselben Kerninfos-
// Tabelle. "Kontaktdaten" heisst also "nur im Book zu Hause", nicht
// "das einzige, was ins Book wandert".
// Jedes Formular ist eine eigene History-Ebene (v44): Zurueck/Schliessen/
// Abbrechen/Speichern gehen per history.back() zur Brand-Ansicht zurueck,
// erst das naechste Zurueck schliesst das Sheet.
function formularKnopf(z, bau, modus, label) {
  const b = el("button", "chip", label);
  b.onclick = () => {
    if (z.modus === modus) { history.back(); return; } // erneut = Formular zu
    z.modus = modus;
    sheetEbene = () => { z.modus = null; bau(); };
    history.pushState({ sheet: true }, "");
    bau();
  };
  return b;
}

// Baut den Formular-Teil eines Sheets. Gibt null zurueck, wenn gerade kein
// Formular offen ist - dann zeichnet der Aufrufer seine normale Ansicht.
function formularAnsicht(z, m) {
  if (z.modus === "rating") {
    const f = document.createDocumentFragment();
    f.append(el("div", "abschnitt", "Rating bearbeiten"),
      ratingFormular(m, () => history.back()));
    return f;
  }
  if (z.modus === "kontakt") {
    const f = document.createDocumentFragment();
    f.append(el("div", "abschnitt", "Kontaktdaten bearbeiten"),
      kontaktFormular(m, () => history.back()));
    return f;
  }
  return null;
}

function ratingFormular(m, fertig) {
  const br = m.brandrating;
  const wrap = el("div");
  const f = { rating: String(br.rating || "").trim(),
    fit: symAnzahl(br.brandfit), geist: symAnzahl(br.begeisterung),
    chance: symAnzahl(br.erfolgschance) };
  const skala = [1, 2, 3, 4, 5].map((n) => [n, String(n)]);
  const zeile = (titel, paare, feld) => wrap.append(
    el("div", "stand", titel),
    chipFilter(paare, f[feld], (w) => { f[feld] = w; }, () => {}));
  zeile("Rating (A–D)",
    [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D — inaktiv"]], "rating");
  zeile("Brand Fit", skala, "fit");
  zeile("Begeisterung", skala, "geist");
  zeile("Erfolgschance", skala, "chance");
  const okZ = el("div", "chips");
  const ok = el("button", "chip aktiv", "✓ Speichern");
  ok.onclick = () => {
    if (!f.rating) { banner("Rating (A–D) fehlt."); return; }
    if (f.rating === "D" && String(br.rating || "").trim() !== "D" &&
        !confirm(`„${m.name}“ auf D setzen?\n` +
          "D = inaktiv/Archiv — die Brand verschwindet aus der " +
          "Pitchliste, bleibt aber im Brand Rating.")) return;
    Object.assign(br, { rating: f.rating,
      brandfit: "⭐".repeat(f.fit || 0),
      begeisterung: "❤️".repeat(f.geist || 0),
      erfolgschance: "⭐".repeat(f.chance || 0) });
    if (m.pitchliste)
      Object.assign(m.pitchliste, { rating: f.rating, geaendert: lokalIso() });
    listeVeraltet = true;
    datenstandPersistieren();
    fertig();
  };
  const ab = el("button", "chip", "Abbrechen");
  ab.onclick = fertig;
  okZ.append(ok, ab);
  wrap.append(okZ);
  return wrap;
}

// Kontaktdaten (Phase 6): standen bisher NUR im Word-Book - bei einer
// App-angelegten Brand waren sie deshalb bis zum naechsten PC-Export
// unsichtbar. Vorbelegt mit dem aktuellen Stand (Book + App-Overlay).
// Kein Pflichtfeld: eine Brand ohne bekannte E-Mail ist ein normaler
// Zwischenstand, kein Fehler.
function kontaktFormular(m, fertig) {
  const wrap = el("div");
  const vorhanden = kerninfosAktuell(m, quelleZuName(m.name));
  const eingaben = {};
  for (const label of KONTAKT_FELDER) {
    wrap.append(el("div", "stand", label));
    const i = el("input", "feld");
    i.type = label === "E-Mail" ? "email" : "text";
    if (label === "Website") i.inputMode = "url";
    i.value = vorhanden[label] || "";
    eingaben[label] = i;
    wrap.append(i);
    // Such-Knopf statt Raten (siehe webVorschlag): oeffnet die Suche im
    // Browser, Andrea kopiert den richtigen Link zurueck ins Feld.
    const suche = label === "Website"
      ? "https://duckduckgo.com/?q=" + encodeURIComponent(m.name + " offizielle Website")
      : label === "Social Media"
        ? "https://duckduckgo.com/?q=" + encodeURIComponent(m.name + " instagram")
        : null;
    if (suche) {
      const z = el("div", "chips");
      const b = el("button", "chip", "🔎 " + label + " suchen");
      const hinweis = el("div", "stand");
      // Website: erst raten lassen (webVorschlag prueft marke.de/.com per
      // DNS - kein Schluessel, kein Kontingent, kein CORS). Trifft es nicht,
      // oeffnet wie bisher die Browser-Suche. Social Media laesst sich so
      // nicht pruefen (instagram.com existiert immer), da bleibt es beim
      // Browser. Google Custom Search war hier kurz drin und ist wieder
      // raus: seit 01/2026 duerfen neue Suchmaschinen nur noch 50 fest
      // eingetragene Domains durchsuchen - fuer "finde die Seite einer
      // unbekannten Marke" damit nutzlos, Abschaltung 01.01.2027.
      b.onclick = async () => {
        if (label !== "Website") {
          window.open(suche, "_blank", "noopener");
          return;
        }
        b.disabled = true;
        hinweis.textContent = "Suche Domain …";
        const gefunden = await webVorschlag(m.name);
        b.disabled = false;
        if (!gefunden) {
          hinweis.textContent = "Keine passende Domain geraten — Browser-Suche geöffnet.";
          window.open(suche, "_blank", "noopener");
          return;
        }
        i.value = gefunden;
        hinweis.textContent = "Geraten und per DNS bestätigt — bitte kurz prüfen.";
      };
      z.append(b);
      wrap.append(z, hinweis);
    }
  }
  const okZ = el("div", "chips");
  const ok = el("button", "chip aktiv", "✓ Speichern");
  ok.onclick = () => {
    m.kerninfos = m.kerninfos || {};
    for (const [label, i] of Object.entries(eingaben))
      m.kerninfos[label] = i.value.trim();
    listeVeraltet = true;
    datenstandPersistieren();
    fertig();
  };
  const ab = el("button", "chip", "Abbrechen");
  ab.onclick = fertig;
  okZ.append(ok, ab);
  wrap.append(okZ, el("div", "stand",
    "Landet beim „Brand-Book erstellen“ im Word. Steht das Book schon, " +
    "trägt „↻ Book aktualisieren“ die Änderung nach."));
  return wrap;
}

// Löschen nur für App-angelegte Brands (erstellt-Marker) - Andreas
// gewachsene Excel-/Book-Daten fasst die App nicht an. Gemeinsam fuer
// Pitchlisten- und Brand-Rating-Sheet (seit v42 landen neue Brands erst
// nach "Brand-Book befüllt" in der Pitchliste - loeschen muss vorher
// schon gehen).
function bereichLoeschen(m) {
  const frag = document.createDocumentFragment();
  const lz = el("div", "chips");
  const lk = el("button", "chip", "🗑 Brand löschen");
  lk.onclick = () => {
    if (!confirm(`„${m.name}“ komplett löschen?\n` +
        "Verschwindet aus allen Listen; ein per App angelegtes " +
        "Brand-Book wandert in den OneDrive-Papierkorb.")) return;
    brandLoeschen(m);
    history.back(); // Sheet zu, popstate zeichnet die Liste frisch
  };
  lz.append(lk);
  frag.append(abschnitt("Verwaltung", lz, el("div", "stand",
    "Nur möglich, weil diese Brand in der App angelegt wurde.")));
  return frag;
}

function brKarte(m) {
  const br = m.brandrating;
  const karte = el("div", "karte" + (br.brandbook ? "" : " leer"));
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", br.kategorie || "—"),
              el("span", null, br.rating ? "Rating " + br.rating : ""));
  const skalen = [br.brandfit, br.begeisterung, br.erfolgschance]
    .filter(Boolean).join(" · ");
  karte.append(kopf, el("div", "titel", m.name),
    el("div", "kontext", (br.status || "—") + (skalen ? " · " + skalen : "")),
    el("div", "fuss", br.brandbook ? "Brand-Book ✓" : "noch kein Brand-Book"));
  karte.classList.add("tippbar");
  karte.onclick = () => sheetBrandrating(m);
  return karte;
}

function sheetBrandrating(m) {
  const wrap = el("div");
  const z = { modus: null };
  const stift = datenstand
    ? formularKnopf(z, bau, "rating", "✎ Rating") : null;
  bau();
  sheetOeffnen(m.name, wrap, stift);

  function bau() {
    wrap.innerHTML = "";
    const br = m.brandrating;
    const formular = formularAnsicht(z, m);
    if (formular) { wrap.append(formular); return; }
    // Beschriftungen exakt wie in den Book-Kerninfos ("Rating (A-D)", ...) -
    // beides zeigt dieselben Werte aus zwei handgepflegten Quellen (Tobias
    // 31.08.: gleich benennen). Weichen sie ab, ist beim Uebertragen
    // zwischen Excel und Book etwas schiefgegangen.
    const felder = [
      ["Status", br.status], ["Kategorie", br.kategorie],
      ["Brand Fit", br.brandfit], ["Begeisterung", br.begeisterung],
      ["Erfolgschance", br.erfolgschance], ["Rating (A-D)", br.rating],
      // Beide Stufen einzeln sichtbar (Tobias 01.09., v43)
      ["Brand-Book erstellen", br.brandbook ? "✓ erstellt" : "offen"],
      ["Brand-Book befüllt", inPitchliste(m) ? "✓ befüllt" : "offen"],
      // Rating nach dem Erstellen geaendert? Dann liegt die Datei weiter im
      // alten Ordner. Sichtbar machen, statt Ordner und Rating still
      // auseinanderlaufen zu lassen.
      ["Book liegt in",
        m.bookordner && m.bookordner !== String(br.rating).trim()
          ? `${m.bookordner} Brands (Rating ist inzwischen ${br.rating})` : ""],
      ["Notizen", br.notizen],
    ].filter(([, w]) => w);
    const tab = el("div", "tabelle");
    for (const [label, wert] of felder) {
      const zeile = el("div", "zeile");
      zeile.append(el("span", "leise", label),
                   el("span", null, skalaWert(label, wert)));
      tab.append(zeile);
    }
    wrap.append(abschnitt("Brand Rating (Excel-Blatt)", tab));
    wrap.append(bereichAbschluss(br));
    // Gleicher Bauplan wie in der Pitchliste (Tobias 03.09.) - egal ob
    // Word-Import oder in der App angelegt.
    wrap.append(markenDetails(quelleZuName(m.name), true, m));
    if (m.erstellt) wrap.append(bereichLoeschen(m));
  }

  // Book-Workflow in ZWEI Stufen (Tobias 01.09., vorher ein Knopf
  // "Rating abgeschlossen"):
  //   Stufe 1 "Brand-Book erstellen" - Template nach OneDrive + Haken.
  //   Stufe 2 "Brand-Book befüllt"  - erst DANACH geht die Brand in die
  //     Pitchliste (ohne Termin, Startdatum setzt Andrea dort, Schritt 7).
  //   Dazwischen befuellt Andrea das Book in Word.
  function bereichAbschluss(br) {
    const frag = document.createDocumentFragment();
    if (!datenstand) return frag;
    // Rückgängig für die letzte Stufe (Regel: Erstellen nur zusammen
    // mit Löschen) - eine Ebene, wie beim Erledigt-Knopf
    const lb = datenstand.letztesBook;
    if (lb && schluessel(lb.name) === schluessel(m.name)) {
      // Bestaetigung auch IM Sheet (Tobias 01.09.) - das Banner allein
      // reichte nicht als Rueckmeldung
      frag.append(el("div", "stand",
        lb.stufe === 2
          ? "✓ Brand-Book befüllt: " + lb.zeit.replace("T", " ").slice(0, 16) +
            " — die Brand steht jetzt in der Pitchliste (ohne Termin)."
          : "✓ Brand-Book erstellt: " + lb.zeit.replace("T", " ").slice(0, 16)));
      const rz = el("div", "chips");
      const rk = el("button", "chip", "↶ Rückgängig");
      rk.onclick = () => { bookRueckgaengig(m, lb); bau(); };
      rz.append(rk);
      frag.append(rz);
      // kein return: nach Stufe 1 muss der Stufe-2-Knopf direkt sichtbar sein
    }
    const rating = String(br.rating || "").trim();
    const abc = ["A", "B", "C"].includes(rating);
    const online = typeof OD !== "undefined" && OD.konto();
    // EINE Knopfreihe (Tobias 01.09.): "✎ Kontaktdaten" steht neben den
    // Book-Knoepfen - die Book-Felder bearbeitet man dort, wo man das Book
    // erzeugt. Das Rating hat seinen eigenen Stift oben in der Kopfzeile.
    // Sichtbar auch ohne Rating/OneDrive: die Kontaktdaten kann man immer
    // pflegen, auch bevor ein Book existiert.
    const reihe = el("div", "chips");
    reihe.append(formularKnopf(z, bau, "kontakt", "✎ Kontaktdaten"));

    if (!br.brandbook) {
      // ------------------------------------------ Stufe 1: Book erstellen
      if (!abc) {
        frag.append(reihe, el("div", "stand", rating === "D"
          ? "D-Brand = inaktiv/Archiv — kein Brand-Book, keine Pitchliste."
          : "Erst Rating (A–C) vergeben — es bestimmt Template und Ordner."));
        return frag;
      }
      if (!online) {
        frag.append(reihe, el("div", "stand",
          "Fürs Brand-Book erst bei OneDrive anmelden (Hauptmenü)."));
        return frag;
      }
      const b = el("button", "chip aktiv", "📄 Brand-Book erstellen");
      b.onclick = async () => {
        if (!confirm(`Brand-Book für „${m.name}“ anlegen?\n` +
            `Kommt als ${rating}-Brand nach OneDrive — Kerninfos (Name, ` +
            "Kontakt, Rating) trägt die App schon ein. Den Rest in Word " +
            "befüllen und hier „Brand-Book befüllt“ drücken.")) return;
        b.disabled = true;
        const erg = await bookErzeugen(m);
        if (erg === "fehler") {
          b.disabled = false;
          banner("Book-Anlage fehlgeschlagen — Internet/OneDrive prüfen.");
          return;
        }
        // "neu-leer" zaehlt wie "neu": die Datei LIEGT in OneDrive und muss
        // beim Rückgängig wieder verschwinden.
        bookErstelltDaten(m, erg !== "existiert", lokalIso());
        datenstandPersistieren();
        banner(erg === "existiert"
          ? "Book gab es schon in OneDrive — nur der Haken wurde gesetzt."
          : erg === "neu-leer"
            ? "Brand-Book angelegt, aber die Werte konnten nicht eingetragen "
              + "werden — im Word stehen noch Platzhalter."
            : `Brand-Book angelegt, Kerninfos schon eingetragen: ${rating} `
              + `Brands/Brand-Book ${m.name}.docx`);
        bau();
      };
      reihe.append(b);
      frag.append(reihe, el("div", "stand",
        "Stufe 1: erzeugt das Brand-Book aus dem Template, trägt die " +
        "Kerninfos ein und setzt den Haken. In die Pitchliste kommt die " +
        "Brand erst mit „Brand-Book befüllt“."));
      return frag;
    }
    // ------------------------------ Stufe 2: Book befüllt -> Pitchliste
    if (!abc || inPitchliste(m)) {          // D-Archiv-Book oder schon drin
      frag.append(reihe);                   // Bearbeiten bleibt trotzdem da
      return frag;
    }

    // "↻ Book aktualisieren" (Tobias 01.09.): erzeugt das Book neu aus dem
    // Template, mit dem AKTUELLEN App-Stand. Loest das Reihenfolge-Problem
    // (Kontaktdaten erst nach dem Erstellen eingetragen -> standen nie im
    // Word). Bewusst NUR zwischen Stufe 1 und 2 angeboten: bis "befüllt"
    // gedrueckt ist, hat Andrea per Definition noch nichts hineingeschrieben,
    // also kann das Ueberschreiben auch nichts kaputt machen. Danach waere
    // es Chirurgie am fertigen Dokument - dafuer gibt es hier keinen Anlass.
    if (online) {
      const ak = el("button", "chip", "↻ Book aktualisieren");
      ak.onclick = async () => {
        if (!confirm(`Brand-Book für „${m.name}“ neu erzeugen?\n` +
            "Die Kerninfos kommen frisch aus der App. Falls du im Word " +
            "schon etwas geschrieben hast, geht das verloren — deshalb " +
            "geht es nur, solange „Brand-Book befüllt“ nicht gedrückt ist.")) return;
        ak.disabled = true;
        const erg = await bookErzeugen(m, true);
        ak.disabled = false;
        banner(erg === "fehler"
          ? "Aktualisieren fehlgeschlagen — Internet/OneDrive prüfen."
          : erg === "neu-leer"
            ? "Book neu erzeugt, aber die Werte konnten nicht eingetragen werden."
            : "Brand-Book aktualisiert — Kerninfos sind auf dem aktuellen Stand.");
      };
      reihe.append(ak);
    }

    const b = el("button", "chip aktiv", "✓ Brand-Book befüllt");
    b.onclick = () => {
      if (!confirm(`„${m.name}“ in die Pitchliste schieben?\n` +
          "Eintrag kommt ohne Termin — das Startdatum setzt du dort.")) return;
      bookBefuelltDaten(m, lokalIso());
      datenstandPersistieren();
      bau();
    };
    reihe.append(b);
    frag.append(reihe, el("div", "stand",
      "Stufe 2: Book in Word fertig befüllt? Damit geht die Brand in " +
      "die Pitchliste (ohne Termin). „↻ Book aktualisieren“ schreibt " +
      "vorher noch geänderte Kerninfos ins Word nach."));
    return frag;
  }
}

function renderBrandrating() {
  kopfzeile("Brand Rating", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  if (!datenstand) {
    c.append(el("div", "leerzustand",
      "Braucht den Datenstand — App einmal mit Internet öffnen."));
    return;
  }
  const alle = (datenstand.marken || []).filter((m) => m.brandrating);

  const suche = el("input", "suche");
  suche.type = "search";
  suche.placeholder = "Suchen (Name, Status, Kategorie …)";
  suche.value = bf.suche;
  suche.oninput = () => { bf.suche = suche.value; zeichnen(); };
  c.append(suche);

  const knopfZeile = el("div", "chips");
  const neu = el("button", "chip", "＋ Neue Brand");
  neu.onclick = sheetNeueBrand;
  const filterBtn = el("button", "chip");
  filterBtn.onclick = () => {
    const wrap = el("div");
    const ratings = [...new Set(alle.map((m) => m.brandrating.rating)
      .filter(Boolean))].sort();
    if (ratings.length > 1) {
      wrap.append(chipFilter(ratings.map((r) => [r, "Rating " + r]),
        bf.rating, (w) => { bf.rating = w; }, zeichnen));
    }
    wrap.append(chipFilter(
      [["ohne", "Ohne Brand-Book"], ["mit", "Brand-Book ✓"]],
      bf.book, (w) => { bf.book = w; }, zeichnen));
    wrap.append(chipFilter(skalenChips("Fit"), bf.fit,
      (w) => { bf.fit = w; }, zeichnen));
    wrap.append(chipFilter(skalenChips("Begeisterung"), bf.geist,
      (w) => { bf.geist = w; }, zeichnen));
    wrap.append(chipFilter(skalenChips("Erfolgschance"), bf.chance,
      (w) => { bf.chance = w; }, zeichnen));
    sheetOeffnen("Filter", wrap);
  };
  const sortBtn = sortierKnopf(SORT_BRAND, () => bf.sortierung,
    (w) => { bf.sortierung = w; }, () => zeichnen());
  knopfZeile.append(neu, filterBtn, sortBtn);
  c.append(knopfZeile);

  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    const n = [bf.rating, bf.book, bf.fit, bf.geist, bf.chance]
      .filter(Boolean).length;
    filterBtn.textContent = "⛭ Filter" + (n ? ` · ${n} aktiv` : "");
    filterBtn.classList.toggle("aktiv", n > 0);
    sortBtn.textContent = "⇅ " + sortLabel(SORT_BRAND, bf.sortierung);
    sortBtn.classList.toggle("aktiv", Boolean(bf.sortierung));
    const s = bf.suche.trim().toLowerCase();
    const gefiltert = alle.filter((m) => {
      const br = m.brandrating;
      // Suche gewinnt ueber den Book-Filter (Tobias 31.08.): wer gezielt
      // nach einer Marke sucht, soll sie auch finden, wenn "Ohne Brand-
      // Book" die abgehakten gerade ausblendet (wie in der Excel).
      return (!bf.rating || br.rating === bf.rating) &&
        (!bf.book || s || (bf.book === "mit") === Boolean(br.brandbook)) &&
        (!bf.fit || symAnzahl(br.brandfit) >= bf.fit) &&
        (!bf.geist || symAnzahl(br.begeisterung) >= bf.geist) &&
        (!bf.chance || symAnzahl(br.erfolgschance) >= bf.chance) &&
        (!s || [m.name, br.status, br.kategorie, br.notizen]
          .join(" ").toLowerCase().includes(s));
    });
    const liste = sortiereBrand(gefiltert, bf.sortierung);
    rumpf.innerHTML = "";
    const ohne = liste.filter((m) => !m.brandrating.brandbook).length;
    rumpf.append(el("div", "stand",
      `${liste.length} von ${alle.length} Marken · ${ohne} ohne Brand-Book · ` +
      `sortiert nach ${sortLabel(SORT_BRAND, bf.sortierung)}`));
    if (!liste.length) {
      rumpf.append(el("div", "leerzustand", "Nichts passt zu den Filtern."));
      return;
    }
    const karten = el("div", "karten");
    for (const m of liste) karten.append(brKarte(m));
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

// Marken-Filter des UGC-Dashboards (Tobias 29.08.): Rating exakt,
// Skalen-Werte (1-5) als Mindestwert, Antworten aus den KPI-Zahlen.
// Bleibt beim Navigieren erhalten (wie pf) und gilt auch in der Gruppen-
// Ansicht, damit Dashboard-Zaehler und Gruppen-Liste dasselbe zeigen.
const mf = { rating: "", fit: "", geist: "", chance: "", antwort: "" };

function markenFilterAktiv() {
  return Boolean(mf.rating || mf.fit || mf.geist || mf.chance || mf.antwort);
}

function markenFilter(m) {
  const ki = (snap.kerninfos || {})[m.quelle] || {};
  const zahl = (x) => parseInt(x, 10) || 0;
  return (!mf.rating || String(ki["Rating (A-D)"] || "").trim() === mf.rating) &&
    (!mf.fit || zahl(ki["Brand Fit"]) >= mf.fit) &&
    (!mf.geist || zahl(ki["Begeisterung"]) >= mf.geist) &&
    (!mf.chance || zahl(ki["Erfolgschance"]) >= mf.chance) &&
    (!mf.antwort ||
      (mf.antwort === "positiv" ? m.positiv > 0 : m.antworten > 0));
}

// Mindestwert-Chips fuer eine 1-5-Skala ("Fit ≥ 4" heisst: 4 oder besser)
function skalenChips(titel) {
  return [[5, `${titel} 5`], [4, `${titel} ≥ 4`],
          [3, `${titel} ≥ 3`], [2, `${titel} ≥ 2`]];
}

function markenFilterAnzahl() {
  return [mf.rating, mf.fit, mf.geist, mf.chance, mf.antwort]
    .filter(Boolean).length;
}

// Die Marken-Filterzeilen, gemeinsam genutzt vom Dashboard-Filter-Sheet
// (alle 5) und der Gruppen-Ansicht (nur die 3 Skalen - Antwort waere
// Dashboard-Sache, und Rating ist in "A Brands" immer A, Tobias 30.08.)
function filterZeilen(neuzeichnen, alles) {
  const zeilen = [];
  if (alles) {
    zeilen.push(chipFilter(
      [["antwort", "Mit Antwort"], ["positiv", "Antwort positiv"]],
      mf.antwort, (w) => { mf.antwort = w; }, neuzeichnen));
    const ratings = [...new Set(Object.values(snap.kerninfos || {})
      .map((k) => String(k["Rating (A-D)"] || "").trim()).filter(Boolean))].sort();
    if (ratings.length > 1) {
      zeilen.push(chipFilter(ratings.map((r) => [r, "Rating " + r]),
        mf.rating, (w) => { mf.rating = w; }, neuzeichnen));
    }
  }
  zeilen.push(chipFilter(skalenChips("Fit"), mf.fit,
    (w) => { mf.fit = w; }, neuzeichnen));
  zeilen.push(chipFilter(skalenChips("Begeisterung"), mf.geist,
    (w) => { mf.geist = w; }, neuzeichnen));
  zeilen.push(chipFilter(skalenChips("Erfolgschance"), mf.chance,
    (w) => { mf.chance = w; }, neuzeichnen));
  return zeilen;
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

  // Zugang zum Brand Rating (v32): Andreas Vorrat an bewerteten Marken.
  // Badge = Marken ohne Brand-Book (das ist dort die offene Arbeit).
  // Steht VOR der Pitchliste (Tobias 31.08.) - so wie im Ablauf:
  // erst Brand Rating, dann Pitchliste.
  const brMarken = datenstand
    ? (datenstand.marken || []).filter((m) => m.brandrating) : [];
  if (brMarken.length) {
    const ohneBook = brMarken.filter((m) => !m.brandrating.brandbook).length;
    const zugang = el("div", "karte block zugang");
    const kopf = el("div", "kopf");
    kopf.append(el("span", "pill", "Bewertung"),
                el("span", "badge", String(ohneBook)));
    zugang.append(kopf, el("div", "titel", "Brand Rating"),
      el("div", "kontext",
        `${brMarken.length} Marken · ${ohneBook} ohne Brand-Book`));
    zugang.onclick = () => { location.hash = "#/brandrating"; };
    c.append(zugang);
  }

  // Zugang zur Pitchliste, Faellig-Zaehler aus derselben ampel()-Bedingung
  // wie die Listen-Ansicht (Briefing 4.9: ein Zaehler, eine Bedingung)
  if (snap.pitchliste && snap.pitchliste.length) {
    const heute = heuteNull();
    const aktuell = pitchlisteAktuell(); // gleiche Liste wie die Ansicht (ohne D-Brands)
    const faellig = aktuell.filter(
      (p) => ampel(p.datum_naechste_aktion, heute).klasse === "rot").length;
    const zugang = el("div", "karte block zugang");
    const kopf = el("div", "kopf");
    kopf.append(el("span", "pill", "Wiedervorlage"),
                el("span", "badge" + (faellig ? " voll" : ""), String(faellig)));
    zugang.append(kopf, el("div", "titel", "Pitchliste — Nächste Aktionen"),
      el("div", "kontext",
        `${aktuell.length} Marken · ${faellig} fällig/überfällig`));
    zugang.onclick = () => { location.hash = "#/pitchliste"; };
    c.append(zugang);
  }

  if (!z.marken.length) {
    c.append(el("div", "leerzustand", "Keine Aktivität in diesem Zeitraum."));
    return;
  }

  // Ein Filter-Knopf statt fuenf Chip-Reihen (Tobias: "zu wuchtig") -
  // die Filterzeilen wohnen in einem Sheet, der Knopf zeigt den Zustand
  const filterBtn = el("button", "chip");
  filterBtn.onclick = () => {
    const wrap = el("div");
    for (const zeile of filterZeilen(zeichnen, true)) wrap.append(zeile);
    sheetOeffnen("Filter", wrap);
  };
  const filterReihe = el("div", "chips");
  filterReihe.append(filterBtn);
  c.append(filterReihe);

  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    const n = markenFilterAnzahl();
    filterBtn.textContent = "⛭ Filter" + (n ? ` · ${n} aktiv` : "");
    filterBtn.classList.toggle("aktiv", n > 0);
    rumpf.innerHTML = "";
    const sichtbar = z.marken.filter(markenFilter);
    if (markenFilterAktiv()) {
      rumpf.append(el("div", "stand",
        `${sichtbar.length} von ${z.marken.length} Marken entsprechen den Filtern`));
    }
    if (!sichtbar.length) {
      rumpf.append(el("div", "leerzustand", "Nichts passt zu den Filtern."));
      return;
    }
    const zGefiltert = { ...z, marken: sichtbar };
    const gruppen = el("div", "karten");
    for (const [name, marken] of
         [...gruppenMap(zGefiltert)].sort((a, b) => a[0].localeCompare(b[0], "de"))) {
      gruppen.append(gruppenBlock(name, marken));
    }
    rumpf.append(gruppen);
  }
}

function renderGruppe(name) {
  kopfzeile(name, true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";

  const z = zeitraum();
  const alleG = gruppenMap(z).get(name) || [];
  if (!alleG.length) {
    c.append(el("div", "leerzustand",
      `Gruppe "${name}" hat im Zeitraum "${z.label}" keine Einträge.`));
    return;
  }

  // Zweite Ebene: die 3 Skalen-Filter direkt als Chips - wenige genug,
  // dass sie keinen Extra-Knopf brauchen (Tobias 30.08.).
  // Gemeinsamer Zustand mf: Dashboard-Zaehler und diese Liste bleiben synchron.
  for (const zeile of filterZeilen(zeichnen, false)) c.append(zeile);

  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    rumpf.innerHTML = "";
    const marken = alleG.filter(markenFilter);
    rumpf.append(el("div", "stand", `${z.label}: ${z.start} – ${z.ende}` +
      (markenFilterAktiv() ? ` · ${marken.length} von ${alleG.length} nach Filter` : "")));
    if (!marken.length) {
      rumpf.append(el("div", "leerzustand", "Nichts passt zu den Filtern."));
      return;
    }
    const karten = el("div", "karten");
    for (const m of marken) karten.append(markenKarte(m));
    rumpf.append(karten);
  }
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
  } else if (h === "#/brandrating") {
    renderBrandrating();
  } else if (h === "#/buecher") {
    renderBuecher();
  } else {
    renderHauptmenu();
  }
}

// ------------------------------------------------- Datenstand (Phase 4)
// Rohdaten-Master (datenstand.py): Marken, Events, Pitchliste, Kerninfos.
// Die Anzeige laeuft weiterhin ueber den Snapshot - hier wird der Stand
// nur bezogen und aufs Geraet gesichert (IndexedDB). Das ist das
// Fundament fuer Phase 4/5: App haelt die Daten selbst, auch offline.

let datenstand = null;
let datenstandQuelle = "";
const OD_DATENSTAND = "/me/drive/root:/Apps/Cockpit/datenstand.json:/content";

// ------------------------------------------- Erledigt-Knopf (Phase 5)

// Kadenz (Andrea, 29.08.): Pitch→FU1 +5, FU1→FU2 +5, FU2→FU3 +10 Tage,
// nach FU3 +90 Tage Pause bis "Neuer Pitch". Standardwerte — pro Marke
// überschreibbar (m.intervalle, gesetzt beim Ändern des Abstands).
const KADENZ_STD = { fu1: 5, fu2: 5, fu3: 10, pause: 90 };

// Was wird erledigt und was folgt darauf? aktion = fällige naechste_aktion
// aus der Pitchliste, pos = Follow-ups seit dem letzten Pitch.
function naechsterSchritt(aktion, pos) {
  if (String(aktion || "").toLowerCase().includes("follow")) {
    const nr = Math.min(pos + 1, 3);
    return {
      typ: "FollowUp", aktion: "Follow up " + nr, status: "Follow up",
      zaehlt: true,
      naechste: nr < 3 ? "Follow up" : "Neuer Pitch",
      key: nr === 1 ? "fu2" : nr === 2 ? "fu3" : "pause",
    };
  }
  return { typ: "Pitch",
    aktion: aktion === "Neuer Pitch" ? "Neuer Pitch" : "Pitch",
    status: "Pitch", zaehlt: false, naechste: "Follow up", key: "fu1" };
}

// Position im aktuellen Zyklus: FollowUp-Events zählen, Pitch setzt zurück.
// Ohne Events (Marke nur in der Pitchliste): Zähler-Spalte als Näherung.
function fuSeitPitch(m) {
  const ev = m.events || [];
  if (!ev.length) return parseInt((m.pitchliste || {}).zaehler, 10) || 0;
  let pos = 0;
  for (const e of ev) {
    if (e.typ === "Pitch") pos = 0;
    else if (e.typ === "FollowUp") pos++;
  }
  return pos;
}

// Erledigt eintragen: Event anhängen + Pitchlisten-Felder fortschreiben,
// exakt wie Andrea es von Hand macht (Ablauf 8). Der Stand davor wandert
// nach letzteAktion, damit Rückgängig ihn 1:1 wiederherstellen kann.
function erledigen(m, s, tage, standard) {
  const jetzt = lokalIso();
  const heute = deDatum(isoInTagen(0));
  datenstand.letzteAktion =
    { name: m.name, aktion: s.aktion, zeit: jetzt, vorher: { ...m.pitchliste } };
  (m.events = m.events || []).push(
    { typ: s.typ, datum: heute, aktion: s.aktion, positiv: "" });
  Object.assign(m.pitchliste, {
    status: s.status,
    letzter_kontakt: heute,
    naechste_aktion: s.naechste,
    datum_naechste_aktion: isoInTagen(tage),
    geaendert: jetzt,
  });
  if (s.zaehlt) {
    m.pitchliste.zaehler = String(
      (parseInt(datenstand.letzteAktion.vorher.zaehler, 10) || 0) + 1);
  }
  if (tage !== standard) (m.intervalle = m.intervalle || {})[s.key] = tage;
  listeVeraltet = true;
  datenstandPersistieren();
  // Punkt 4 im Brand-Book sofort mitschreiben (Andrea 02.09.)
  bookHistorieMelden(m, heute, s.aktion);
}

function rueckgaengig(m, la) {
  const ev = m.events || [];
  const weg = ev.length && ev[ev.length - 1].aktion === la.aktion
    ? ev.pop() : null;
  m.pitchliste = la.vorher;
  delete datenstand.letzteAktion;
  listeVeraltet = true;
  datenstandPersistieren();
  if (weg) bookHistorieMelden(m, weg.datum, weg.aktion, true);
}

// ----------------------------------------------- Neue Brand (Phase 5)

// Formular für Ablauf 1-3 + 6: Brandrating-Werte (Rating trägt Andrea
// selbst ein — NICHT berechnen, Tobias 29.08.) + Pitchlisten-Eintrag
// "nächste Aktion: Pitch, heute". Löschen-Gegenstück: brandLoeschen()
// in der Detailansicht (Regel: Erstellen nur zusammen mit Löschen).
function sheetNeueBrand() {
  const wrap = el("div");
  const name = el("input", "suche");
  name.placeholder = "Name der Brand";
  const kategorie = el("input", "suche");
  kategorie.placeholder = "Kategorie/Nische";
  kategorie.setAttribute("list", "kategorien-liste");
  const dl = el("datalist"); // native Vorschläge aus den vorhandenen Kategorien
  dl.id = "kategorien-liste";
  for (const k of [...new Set((snap.pitchliste || [])
      .map((p) => p.kategorie).filter(Boolean))].sort()) {
    const o = el("option");
    o.value = k;
    dl.append(o);
  }
  wrap.append(name, kategorie, dl);
  // Erfolgschance im Standard 3 (Andreas Workflow, 31.08.)
  const f = { rating: "", fit: "", geist: "", chance: 3 };
  const skala = [1, 2, 3, 4, 5].map((n) => [n, String(n)]);
  const zeile = (titel, paare, feld) => wrap.append(
    el("div", "stand", titel),
    chipFilter(paare, f[feld], (w) => { f[feld] = w; }, () => {}));
  zeile("Rating (A–D)", ["A", "B", "C", "D"].map((r) => [r, r]), "rating");
  zeile("Brand Fit", skala, "fit");
  zeile("Begeisterung", skala, "geist");
  zeile("Erfolgschance", skala, "chance");
  const okZ = el("div", "chips");
  const ok = el("button", "chip aktiv", "✓ Brand anlegen");
  ok.onclick = () => {
    const n = name.value.trim();
    if (!n) { banner("Name fehlt."); return; }
    if ((datenstand.marken || []).some(
        (m) => schluessel(m.name) === schluessel(n))) {
      banner("Diese Brand gibt es schon."); return;
    }
    brandAnlegen(n, kategorie.value.trim(), f);
    history.back(); // Sheet zu, popstate zeichnet die Liste frisch
  };
  okZ.append(ok);
  wrap.append(okZ, el("div", "stand",
    "Landet im Brand Rating. In die Pitchliste kommt die Brand erst " +
    "über „Brand-Book erstellen“ + „Brand-Book befüllt“. Löschen: in " +
    "der Detailansicht der Brand."));
  sheetOeffnen("Neue Brand", wrap);
}

// ------------------------------------ Website-Vorschlag (Andrea 02.09.)
// Wunsch: Website + Social Media beim Anlegen automatisch finden.
// Was im Browser OHNE Schluessel geht: pruefen, ob eine Domain ueberhaupt
// EXISTIERT - per DNS-over-HTTPS (dns.google erlaubt CORS). Was NICHT
// geht: eine echte Websuche (Google/Bing/DuckDuckGo blocken CORS, ihre
// APIs kosten Schluessel) und Instagram (blockt CORS komplett).
// Deshalb: Domain-Raten + Existenzpruefung als VORSCHLAG, den Andrea im
// Kontaktformular sieht und korrigiert. Fuer Social Media gibt es dort
// einen Such-Knopf statt eines geratenen Werts - ein falscher Instagram-
// Link im Book waere schlimmer als ein leeres Feld.
// ponytail: DNS sagt "Domain existiert", nicht "gehoert der Brand".
// Upgrade auf echte Suche, sobald ein API-Schluessel da ist.
function domainSlug(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss").replace(/&/g, "und")
    .replace(/[^a-z0-9]/g, "");
}

async function domainLebt(host) {
  try {
    const r = await fetch(
      "https://dns.google/resolve?type=A&name=" + encodeURIComponent(host));
    const d = await r.json();
    return d && d.Status === 0 && Array.isArray(d.Answer) && d.Answer.length > 0;
  } catch (_) {
    return false;
  }
}

// Erste erreichbare Kandidaten-Domain, sonst "". .de zuerst (Andreas
// Brands sind ueberwiegend deutsch), dann .com.
async function webVorschlag(name) {
  const slug = domainSlug(name);
  if (slug.length < 3) return "";
  for (const host of [slug + ".de", "www." + slug + ".de",
                      slug + ".com", "www." + slug + ".com"]) {
    if (await domainLebt(host)) return "https://" + host.replace(/^www\./, "");
  }
  return "";
}

function brandAnlegen(name, kategorie, f) {
  const jetzt = lokalIso();
  datenstand.marken.push({
    name, quelle: "", gruppe: "", kerninfos: {}, events: [],
    // KEIN Pitchlisten-Eintrag mehr (Tobias 01.09., v42): der Weg in die
    // Pitchliste fuehrt jetzt immer ueber Brand-Book erstellen + befüllt.
    pitchliste: null,
    // Feldnamen + Symbol-Skalen exakt wie im Brandrating-Blatt
    brandrating: {
      status: "Neu", kategorie,
      brandfit: "⭐".repeat(f.fit || 0),
      begeisterung: "❤️".repeat(f.geist || 0),
      erfolgschance: "⭐".repeat(f.chance || 0),
      rating: f.rating, brandbook: "", notizen: "",
    },
    erstellt: jetzt, // von der App angelegt -> darf gelöscht werden
  });
  const neu = datenstand.marken[datenstand.marken.length - 1];
  listeVeraltet = true;
  datenstandPersistieren();
  // Website-Suche laeuft NEBENHER (Andrea 02.09.: Anlegen als Trigger) -
  // das Formular soll nicht auf DNS-Antworten warten. Nur fuellen, nie
  // ueberschreiben: bis die Antwort da ist, kann Andrea schon getippt haben.
  webVorschlag(name).then((url) => {
    if (!url) return;
    neu.kerninfos = neu.kerninfos || {};
    if (String(neu.kerninfos.Website || "").trim()) return;
    neu.kerninfos.Website = url;
    datenstandPersistieren();
    banner(`Website-Vorschlag für „${name}“: ${url} — bitte prüfen.`);
  });
}

function brandLoeschen(m) {
  // App-erzeugtes Book mit in den OneDrive-Papierkorb (Tobias 01.09.:
  // "löschen aus allen Listen + dem Brand-Book") - nur bei App-angelegten
  // Brands, und DELETE landet im Papierkorb, nichts ist hart weg.
  if (m.erstellt && m.brandrating && m.brandrating.brandbook &&
      typeof OD !== "undefined" && OD.konto()) {
    OD.graphRoh(bookPfad(m), { method: "DELETE" });
  }
  datenstand.marken = datenstand.marken.filter((x) => x !== m);
  if (datenstand.letzteAktion &&
      schluessel(datenstand.letzteAktion.name) === schluessel(m.name)) {
    delete datenstand.letzteAktion;
  }
  if (datenstand.letztesBook &&
      schluessel(datenstand.letztesBook.name) === schluessel(m.name)) {
    delete datenstand.letztesBook;
  }
  listeVeraltet = true;
  datenstandPersistieren();
}

// -------------------------------------- Rating abgeschlossen (Phase 5)

// Book-Ablage in OneDrive (Ordner je Rating darunter: "A Brands"…).
// Seit v56 (Tobias 03.09.) in den Einstellungen aenderbar - Andreas Ordner
// kann sich aendern. Pro Geraet in localStorage, wie die uebrigen
// Einstellungen: der Pfad haengt am OneDrive-Konto, nicht an den Daten.
const BOOK_BASIS_STD = "/Apps/Cockpit/Testdaten/Brand-Books";

// Eingetippten Pfad -> Graph-Adresse. Fuehrender Slash wird ergaenzt,
// nachlaufende entfernt, damit "Dokumente/Brand-Books/" genauso geht wie
// "/Dokumente/Brand-Books". Leer = Standard.
function bookBasis() {
  const roh = String(einst.bookPfad || BOOK_BASIS_STD).trim()
    .replace(/^\/+|\/+$/g, "");
  return "/me/drive/root:/" + (roh || BOOK_BASIS_STD.replace(/^\//, ""));
}
const DOCX_TYP = "application/vnd.openxmlformats-officedocument" +
                 ".wordprocessingml.document";

// Wo das Book WIRKLICH liegt. Der Ordner kommt vom Rating - aendert sich
// das Rating spaeter (seit v42 jederzeit moeglich), zeigt ein frisch
// berechneter Pfad in den falschen Ordner: Loeschen, Rueckgaengig und
// Aktualisieren griffen dann ins Leere und liessen eine verwaiste Datei
// zurueck (Tobias 01.09., "Brand-Book Tobiiiiii.docx"). Deshalb merkt sich
// die Brand beim Erstellen ihren Ordner; nur wenn der fehlt (Andreas
// gewachsene Books, die die App nie angelegt hat) wird gerechnet.
function bookPfad(m) {
  const ordner = m.bookordner || String(m.brandrating.rating).trim();
  return `${bookBasis()}/${ordner} Brands/Brand-Book ${m.name}.docx`;
}

// Werte fuer die Template-Platzhalter (pur, testbar): Name + Kontaktfelder
// aus den Kerninfos + die vier Rating-Werte aus dem Brand Rating. Die
// Schluessel sind die Labels aus der Kerninfos-Tabelle, weil der Platzhalter
// im Template {{Label}} heisst (siehe template_platzhalter.py).
function bookWerte(m) {
  const br = m.brandrating || {};
  const k = kerninfosAktuell(m, quelleZuName(m.name));
  const werte = { "Name": m.name,
    "Rating (A-D)": br.rating || "",
    "Brand Fit": br.brandfit || "",
    "Begeisterung": br.begeisterung || "",
    "Erfolgschance": br.erfolgschance || "" };
  for (const label of KONTAKT_FELDER) werte[label] = k[label] || "";
  return werte;
}

// Werte landen als Text in der document.xml - kaufmaennisches Und & Co.
// muessen escaped werden, sonst ist das Word-Dokument kaputt (es gibt
// wirklich eine Marke "Juno &me").
function xmlText(s) {
  return String(s).replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// .docx ist ein ZIP: word/document.xml raus, Platzhalter ersetzen, rein.
// Ersetzt wird per split/join (literal) statt per RegExp - Labels wie
// "Rating (A-D)" enthalten Sonderzeichen, die als Muster explodieren wuerden.
// Die Platzhalter stehen dank template_platzhalter.py garantiert als EIN
// Word-Run in der Datei und sind deshalb am Stueck auffindbar.
async function docxBefuellen(puffer, werte) {
  const zip = await JSZip.loadAsync(puffer);
  const datei = zip.file("word/document.xml");
  if (!datei) return puffer; // kein Word-Dokument - unveraendert lassen
  let xml = await datei.async("string");
  for (const [label, wert] of Object.entries(werte)) {
    xml = xml.split("{{" + label + "}}").join(xmlText(wert));
  }
  // Rest-Platzhalter entfernen: haette Andreas Template eine Zeile, die
  // die App (noch) nicht kennt, stuende sonst "{{...}}" im fertigen Book.
  xml = xml.replace(/\{\{[^{}]{1,40}\}\}/g, "");
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

// ------------------------------------- Pitch-Historie ins Book (Phase 6)
// Punkt 4 des Brand-Books ist eine Tabelle "Datum | Aktion" mit drei
// Leerzeilen. Jedes erledigte Ereignis (Pitch, Neuer Pitch, Follow up 1-3)
// wandert sofort dorthin - Andrea soll das Book nicht doppelt pflegen.
// ponytail: XML per RegExp statt DOMParser - die document.xml ist ein
// String, den wir nur an einer Stelle anfassen. Grenze: eine TABELLE IN
// EINER TABELLE wuerde das nicht-gierige <w:tbl>…</w:tbl> falsch schneiden.
// Kommt das je vor, auf DOMParser umstellen.

// Sichtbarer Text eines XML-Stuecks (alle <w:t>-Inhalte).
// Entitaeten MUESSEN zurueckuebersetzt werden: in der Datei steht
// "Pitch &amp; Co", sichtbar ist "Pitch & Co". Ohne das fand die
// Rueckgaengig-Suche einen Eintrag mit kaufmaennischem Und nie wieder
// (gefunden 02.09. beim Test gegen ein echtes Brand-Book - der Selbsttest
// mit nachgebauter XML hatte es nicht gezeigt, weil dort kein & vorkam).
// "&amp;" zuletzt aufloesen, sonst wuerde aus "&amp;lt;" ein "<".
function wordText(s) {
  return (String(s).match(/<w:t[^>]*>[^<]*<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, "")).join(" ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Zelle mit neuem Text, Formatierung der Vorlage behalten: Zellen-
// Eigenschaften (tcPr), Absatz-Eigenschaften (pPr) und die Zeichen-
// Formatierung (rPr) des ersten echten Runs werden uebernommen.
function zelleSetzen(tc, text) {
  const tcPr = (tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [""])[0];
  const pPr = (tc.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
  // rPr erst NACH dem pPr suchen - im pPr steckt das rPr der Absatzmarke,
  // nicht das des Textes.
  const rest = pPr ? tc.slice(tc.indexOf(pPr) + pPr.length) : tc;
  const rPr = (rest.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
  return "<w:tc>" + tcPr + "<w:p>" + pPr + "<w:r>" + rPr +
    '<w:t xml:space="preserve">' + xmlText(text) + "</w:t></w:r></w:p></w:tc>";
}

// Neue Zeile aus einer Vorlagen-Zeile bauen (Spalte 1 Datum, 2 Aktion,
// weitere Spalten unveraendert - Andreas Template hat genau zwei).
function zeileBauen(vorlage, datum, aktion) {
  const trPr = (vorlage.match(/<w:trPr>[\s\S]*?<\/w:trPr>/) || [""])[0];
  const zellen = vorlage.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
  if (zellen.length < 2) return null;
  return "<w:tr>" + trPr + zelleSetzen(zellen[0], datum) +
    zelleSetzen(zellen[1], aktion) + zellen.slice(2).join("") + "</w:tr>";
}

// Ereignis in die Historien-Tabelle eintragen (entfernen=true: wieder
// leeren, fuer den Rueckgaengig-Knopf). Gibt die neue XML zurueck oder
// null, wenn die Tabelle nicht gefunden wurde - dann bleibt das Book
// unangetastet, statt es kaputtzuschreiben.
// Freie Leerzeile zuerst fuellen; ist die Tabelle voll, wird eine Zeile
// ANGEHAENGT (Andreas Vorgabe: Zeilen automatisch nachwachsen lassen).
function historieXml(xml, datum, aktion, entfernen) {
  const tabellen = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  // Die richtige Tabelle erkennt man an ihrer Kopfzeile, nicht an der
  // Position - die Kerninfos-Tabelle beginnt mit "Name".
  const tbl = tabellen.find((t) => {
    const kopf = wordText((t.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/) || [""])[0])
      .toLowerCase();
    return kopf.includes("datum") && kopf.includes("aktion");
  });
  if (!tbl) return null;
  const zeilen = tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
  if (zeilen.length < 2) return null;
  let tblNeu;
  if (entfernen) {
    // Letzten passenden Eintrag leeren (die Zeile bleibt als Leerzeile
    // stehen - harmlos, und Word muss keine Zeile verlieren).
    const i = zeilen.map(wordText).reduce((tr, t, j) =>
      (j > 0 && t.includes(datum) && t.includes(aktion) ? j : tr), -1);
    if (i < 0) return null;
    const leer = zeileBauen(zeilen[i], "", "");
    if (!leer) return null;
    tblNeu = tbl.replace(zeilen[i], () => leer);
  } else {
    const leer = zeilen.findIndex((z, j) => j > 0 && !wordText(z).trim());
    const neu = zeileBauen(zeilen[zeilen.length - 1], datum, aktion);
    if (!neu) return null;
    tblNeu = leer > 0
      ? tbl.replace(zeilen[leer], () => neu)
      : tbl.slice(0, -"</w:tbl>".length) + neu + "</w:tbl>";
  }
  // Funktions-Ersatz: sonst wuerde ein "$&" im Word-Text (oder in einem
  // Aktionsnamen) als Rueckverweis-Muster interpretiert.
  return xml.replace(tbl, () => tblNeu);
}

// Das Ganze am echten Book: laden, Zeile setzen, zurueckschreiben.
// Rueckgabe: "ok" | "kein-book" (still - Book existiert nicht oder wir
// sind offline, das ist ein normaler Zustand) | "fehler" (laut melden).
async function bookHistorie(m, datum, aktion, entfernen) {
  if (!m.brandrating || !m.brandrating.brandbook ||
      typeof OD === "undefined" || !OD.konto() ||
      typeof JSZip === "undefined") return "kein-book";
  try {
    const r = await OD.graphRoh(bookPfad(m) + ":/content");
    if (!r || !r.ok) return "kein-book"; // z.B. Andreas handgepflegtes Book
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const d = zip.file("word/document.xml");
    if (!d) return "fehler";
    const xml = historieXml(await d.async("string"), datum, aktion, entfernen);
    if (!xml) return "fehler";
    zip.file("word/document.xml", xml);
    const put = await OD.graphRoh(
      bookPfad(m) + ":/content?@microsoft.graph.conflictBehavior=replace",
      { method: "PUT",
        body: await zip.generateAsync(
          { type: "arraybuffer", compression: "DEFLATE" }),
        headers: { "Content-Type": DOCX_TYP } });
    return put && put.ok ? "ok" : "fehler";
  } catch (_) {
    return "fehler";
  }
}

// Ereignis nachtragen und nur dann etwas sagen, wenn es etwas zu sagen
// gibt. Laeuft absichtlich NEBEN dem Speichern (kein await): der Erledigt-
// Knopf soll nicht auf den Word-Upload warten.
function bookHistorieMelden(m, datum, aktion, entfernen) {
  bookHistorie(m, datum, aktion, entfernen).then((s) => {
    if (s === "ok") {
      banner(entfernen
        ? `„${aktion}“ auch im Brand-Book wieder entfernt.`
        : `„${aktion}“ auch in die Pitch-Historie im Brand-Book eingetragen.`);
    } else if (s === "fehler") {
      banner("Brand-Book konnte nicht nachgetragen werden — " +
        "die Pitch-Historie dort bitte von Hand ergänzen.");
    }
  });
}

// Template nach Rating kopieren (A bzw. B-C; D = Archiv, kein Template).
// GET + PUT statt Graph-copy: copy antwortet asynchron (202 + Monitor-URL),
// die Templates sind winzig. conflictBehavior=fail: ein vorhandenes Book
// (womoeglich handgeschrieben!) wird NIE ueberschrieben.
// Rueckgabe "neu-leer": Book liegt in OneDrive, aber das Befuellen ging
// schief - lieber ein leeres Book + ehrliche Meldung als gar keins.
// ersetzen=true ("Book aktualisieren"): conflictBehavior=replace statt fail,
// also bewusstes Ueberschreiben. Der Aufrufer stellt sicher, dass das nur
// vor Stufe 2 passiert, wo im Book noch nichts von Hand drinsteht.
async function bookErzeugen(m, ersetzen) {
  const tplName = String(m.brandrating.rating).trim() === "A"
    ? "Template Brand-Book A Brand.docx"
    : "Template Brand-Book B-C Brand.docx";
  const tpl = await OD.graphRoh(`${bookBasis()}/${tplName}:/content`);
  if (!tpl || !tpl.ok) return "fehler";
  let inhalt = await tpl.arrayBuffer(), gefuellt = true;
  try {
    if (typeof JSZip === "undefined") throw new Error("jszip.min.js fehlt");
    inhalt = await docxBefuellen(inhalt, bookWerte(m));
  } catch (_) {
    gefuellt = false; // Original-Template hochladen, Platzhalter bleiben drin
  }
  const neu = await OD.graphRoh(
    bookPfad(m) + ":/content?@microsoft.graph.conflictBehavior=" +
      (ersetzen ? "replace" : "fail"),
    { method: "PUT", body: inhalt,
      headers: { "Content-Type": DOCX_TYP } });
  return !neu ? "fehler" : neu.status === 409 ? "existiert"
       : neu.ok ? (gefuellt ? "neu" : "neu-leer") : "fehler";
}

// Datenteil Stufe 1 (pur, testbar in test_kadenz.js): NUR der Erledigt-
// Haken wie im Excel-Blatt - kein Pitchlisten-Eintrag mehr (seit v42,
// der kommt mit Stufe 2). Der Stand davor wandert nach letztesBook,
// damit Rückgängig ihn wiederherstellen kann.
function bookErstelltDaten(m, bookNeu, jetzt) {
  datenstand.letztesBook = { name: m.name, zeit: jetzt, stufe: 1, bookNeu,
    vorher: m.brandrating.brandbook || "" };
  m.brandrating.brandbook = "✔️";
  // Ordner festhalten, in dem die Datei jetzt liegt - ein spaeteres
  // Rating-Update darf den Zugriff darauf nicht verlieren (siehe bookPfad)
  m.bookordner = String(m.brandrating.rating).trim();
  listeVeraltet = true;
}

// Datenteil Stufe 2 "Brand-Book befüllt": Pitchlisten-Eintrag OHNE
// Termin (Andreas Workflow Schritt 7: Startdatum vergibt Andrea manuell,
// erst dann laeuft die 5/5/10/90-Kadenz).
function bookBefuelltDaten(m, jetzt) {
  datenstand.letztesBook = { name: m.name, zeit: jetzt, stufe: 2,
    pitchNeu: !m.pitchliste };
  if (!m.pitchliste) {
    m.pitchliste = { rating: m.brandrating.rating,
      kategorie: m.brandrating.kategorie || "", status: "",
      letzter_kontakt: "", naechste_aktion: "Pitch",
      datum_naechste_aktion: "", zaehler: "0", kooperation: "",
      geaendert: jetzt, erstellt: jetzt };
  }
  listeVeraltet = true;
}

// Rückgängig (eine Ebene): Stufe 2 nimmt den Pitchlisten-Eintrag zurueck,
// Stufe 1 den Haken + das frisch kopierte Book. Graph-DELETE landet im
// OneDrive-Papierkorb - Books mit Inhalt werden nie hart geloescht.
function bookRueckgaengig(m, lb) {
  if (lb.stufe === 2) {
    if (lb.pitchNeu) m.pitchliste = null;
  } else {
    if (lb.bookNeu) {
      OD.graphRoh(bookPfad(m), { method: "DELETE" }); // erst loeschen ...
      delete m.bookordner;                            // ... dann den Merker
    }
    m.brandrating.brandbook = lb.vorher;
    if (lb.pitchNeu) m.pitchliste = null; // Altformat vor v42 (eine Stufe)
  }
  delete datenstand.letztesBook;
  listeVeraltet = true;
  datenstandPersistieren();
}

// Nach jeder App-Änderung: aufs Gerät (IndexedDB) + still nach OneDrive.
// Schlägt OneDrive fehl (offline), gleicht datenstandLaden() beim nächsten
// Laden mit Netz automatisch ab (Gerät neuer als Cloud → Rücksicherung).
async function datenstandPersistieren() {
  datenstand.geaendert = lokalIso();
  datenstand.geaendert_von = "Cockpit-App";
  try { await idbSchreib("datenstand", datenstand); } catch (_) {}
  const ok = typeof OD !== "undefined" &&
    await OD.graphPutLeise(OD_DATENSTAND, datenstand);
  banner(ok ? "Eingetragen — gesichert auf Gerät + OneDrive."
            : "Eingetragen — auf dem Gerät gespeichert, OneDrive folgt beim nächsten Abgleich.");
}

// IndexedDB-Minimum: eine DB "cockpit", ein Key-Value-Store "kv".
// ponytail: kein Schema je Marke - der ganze Datenstand ist ein Eintrag
// (~100 KB). Aufteilen erst, wenn Einzel-Updates in Phase 5 wehtun.
function idb() {
  return new Promise((ok, nein) => {
    const req = indexedDB.open("cockpit", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => nein(req.error);
  });
}
function idbLies(schluessel) {
  return idb().then((db) => new Promise((ok, nein) => {
    const req = db.transaction("kv").objectStore("kv").get(schluessel);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => nein(req.error);
  }));
}
function idbSchreib(schluessel, wert) {
  return idb().then((db) => new Promise((ok, nein) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(wert, schluessel);
    tx.oncomplete = () => ok();
    tx.onerror = () => nein(tx.error);
  }));
}

// Drei Quellen, die neueste gewinnt (Feld "geaendert"):
// Heimnetz (daten/datenstand.json), OneDrive (Graph), Geraet (IndexedDB).
// Frisches von aussen wird aufs Geraet gesichert - so uebersteht der
// Stand Funkloecher und (mit persistentem Speicher) auch Neustarts.
async function datenstandLaden() {
  let lokal = null;
  try {
    const a = await fetch("daten/datenstand.json", { cache: "no-store" });
    if (a.ok) lokal = await a.json();
  } catch (_) {}
  const cloud = typeof OD !== "undefined"
    ? await OD.graphLeise(OD_DATENSTAND)
    : null;
  let geraet = null;
  try { geraet = await idbLies("datenstand"); } catch (_) {}
  const kandidaten = [[lokal, "Heimnetz"], [cloud, "OneDrive"],
                      [geraet, "Gerät"]].filter(([d]) => d);
  if (!kandidaten.length) return;
  kandidaten.sort((a, b) =>
    String(b[0].geaendert || "").localeCompare(String(a[0].geaendert || "")));
  [datenstand, datenstandQuelle] = kandidaten[0];
  if (datenstandQuelle !== "Gerät") {
    try { await idbSchreib("datenstand", datenstand); } catch (_) {}
  } else if (cloud &&
             String(cloud.geaendert || "") < String(datenstand.geaendert || "")) {
    // Auto-Abgleich: Geraet ist neuer als OneDrive -> still zuruecksichern.
    // ponytail: keine WLAN-Erkennung (koennen Browser nicht zuverlaessig),
    // die Datei ist winzig - Abgleich laeuft einfach bei jedem Laden.
    OD.graphPutLeise(OD_DATENSTAND, datenstand);
  }
  // Datiertes Backup, falls faellig. Bewusst OHNE await: der Start soll
  // nicht auf einen Upload warten.
  autoBackupPruefen();
}

// ------------------------------------------- Automatisches Backup (v51)
// Abgrenzung, sonst verwechselt man das mit "Jetzt sichern": Sichern
// ueberschreibt die EINE datenstand.json (passiert ohnehin bei jeder
// Aenderung) - das rettet nichts, wenn vorgestern etwas Falsches passiert
// ist. Hier entsteht stattdessen eine KOPIE PRO DATUM, die genau das
// ueberlebt. Ziel ist OneDrive und nicht der Download-Ordner, weil ein
// Browser ohne Nutzergeste nichts herunterladen darf.
// ponytail: liegt neben datenstand.json statt in einem Backups/-Unterordner
// - spart das Anlegen des Ordners per Graph. Unterordner, wenn es dort
// unuebersichtlich wird.
const OD_BACKUP = (datum) =>
  `/me/drive/root:/Apps/Cockpit/cockpit-datenstand-${datum}.json:/content`;

// Pur gehalten (Datum wird hereingereicht), damit test_kadenz.js das
// Faelligkeits-Rechnen ohne Uhr und ohne OneDrive pruefen kann.
function backupFaellig(e, heute) {
  const tage = Number(e.autoTage);
  if (!tage || tage < 1) return false;      // 0, leer oder Unsinn = aus
  if (!e.autoStand) return true;            // noch nie gesichert -> sofort
  const alt = Date.parse(e.autoStand + "T00:00:00");
  const neu = Date.parse(heute + "T00:00:00");
  if (isNaN(alt) || isNaN(neu)) return true; // kaputter Merker -> lieber sichern
  return (neu - alt) / 86400000 >= tage;
}

function autoBackupText() {
  if (!Number(einst.autoTage)) return "Automatisches Backup: aus";
  return `Alle ${einst.autoTage} Tage · ` +
    (einst.autoStand ? "zuletzt " + einst.autoStand : "noch keins angelegt");
}

// Laeuft beim Laden mit, ohne den Start aufzuhalten (kein await beim
// Aufrufer). Schlaegt der PUT fehl (offline), bleibt der Merker stehen -
// beim naechsten Start wird es erneut versucht.
async function autoBackupPruefen() {
  if (!datenstand || typeof OD === "undefined" || !OD.konto()) return;
  const heute = lokalIso().slice(0, 10);
  if (!backupFaellig(einst, heute)) return;
  if (!await OD.graphPutLeise(OD_BACKUP(heute), datenstand)) return;
  einst.autoStand = heute;
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  banner("Automatisches Backup in OneDrive angelegt.");
}

// "Jetzt sichern" (Phase 4): Datenstand aktiv nach OneDrive schreiben,
// Zeitstempel pro Geraet in den Einstellungen (localStorage).
function sicherungsText() {
  return einst.gesichert
    ? "Zuletzt gesichert: " + einst.gesichert
    : "Noch nicht von diesem Gerät gesichert";
}

async function datenstandSichern(statusEl) {
  if (!datenstand) { banner("Kein Datenstand geladen."); return; }
  statusEl.textContent = "Sichere …";
  const ok = typeof OD !== "undefined" &&
    await OD.graphPutLeise(OD_DATENSTAND, datenstand);
  if (ok) {
    einst.gesichert = new Date().toISOString().slice(0, 16).replace("T", " ");
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  }
  statusEl.textContent = sicherungsText();
  banner(ok ? "Datenstand nach OneDrive gesichert."
            : "Sichern fehlgeschlagen — bei OneDrive angemeldet?");
}

// Backup-Datei in den Download-Ordner (Phase 4): ueberlebt auch das
// Loeschen der Browserdaten. Wiederherstellen bei Bedarf von Hand
// (Datei zurueck nach OneDrive/Apps/Cockpit legen).
function datenstandBackup() {
  if (!datenstand) { banner("Kein Datenstand geladen."); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(
    [JSON.stringify(datenstand, null, 2)], { type: "application/json" }));
  a.download = "cockpit-datenstand-" +
    new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  banner("Backup liegt im Download-Ordner.");
}

// Snapshot aus zwei Quellen, die neuere gewinnt (Feld "erzeugt"):
// 1) lokaler Server (frisch im Heimnetz, sonst Service-Worker-Cache),
// 2) OneDrive-Kopie per Graph (frisch ueberall, sobald angemeldet -
//    export_snapshot.py legt sie in OneDrive/Apps/Cockpit ab).
// Damit ist der Heimserver unterwegs nicht mehr noetig (Phase 3).
async function laden() {
  // Datenstand parallel mitziehen (Phase 4). Seit Phase 5 haengt die
  // Pitchlisten-Anzeige mit daran (Overlay) - deshalb unten mit abwarten.
  const datenstandFertig = datenstandLaden().catch(() => {});
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
  // Dritte Quelle: letzter aufs Geraet gesicherter Snapshot (IndexedDB).
  // Ohne die zeigte die App im Flugmodus "Keine Daten" (Tobias 30.08.) -
  // auf GitHub Pages kommt der Snapshot nur aus OneDrive, offline = nichts.
  let geraet = null;
  try { geraet = await idbLies("snapshot"); } catch (_) {}
  const beste = [lokal, cloud, geraet].filter(Boolean).sort(
    (a, b) => String(b.erzeugt || "").localeCompare(String(a.erzeugt || "")))[0];
  if (!beste) throw new Error(lokalFehler);
  await datenstandFertig; // Overlay (Phase 5) braucht den Datenstand vor dem Rendern
  if (beste !== geraet) {
    try { await idbSchreib("snapshot", beste); } catch (_) {}
  }
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
document.getElementById("info").onclick = sheetInfo;

document.getElementById("zurueck").onclick = () => {
  // Eine Ebene hoch, nicht Browser-History: vorhersagbar bei Direktaufruf
  const h = location.hash;
  location.hash =
    h.startsWith("#/ugc/") || h === "#/pitchliste" || h === "#/brandrating"
      ? "#/ugc" : "#/";
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

// Persistenter Speicher (Phase 4): sonst darf der Browser IndexedDB bei
// Platzmangel still wegraeumen. Bei installierter PWA meist auto-genehmigt.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

if ("serviceWorker" in navigator) {
  // Soll/Ist-Abgleich (Tobias 30.08.): reg.update() vergleicht den
  // installierten Service Worker byteweise mit dem auf GitHub und laedt
  // bei Abweichung die neue Version. Laeuft beim App-Start UND bei jeder
  // Rueckkehr in die App - Android weckt PWAs oft nur auf statt sie neu
  // zu starten, dann laeuft kein Startcode und der Start-Check allein
  // wuerde Updates verpassen (so blieb v22 haengen).
  navigator.serviceWorker.register("service-worker.js")
    .then((reg) => {
      reg.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    })
    .catch(() => {});
  // Neuer Service Worker uebernimmt (skipWaiting) -> Seite einmal neu laden,
  // damit sofort die neue Version laeuft statt erst beim uebernaechsten Start.
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (neuGeladen) return; // Schutz gegen Reload-Schleife
    neuGeladen = true;
    sessionStorage.setItem("cockpit-update", "1"); // Banner nach dem Reload
    location.reload();
  });
  if (sessionStorage.getItem("cockpit-update")) {
    sessionStorage.removeItem("cockpit-update");
    banner("App aktualisiert auf " + APP_VERSION);
  }
}

einstAnwenden(); // gespeicherten Stil sofort anwenden, vor dem ersten Rendern
introAusblenden();

(async () => {
  try {
    await laden();
  } catch (fehler) {
    ladefehler = fehler.message;
  }
  render();
})();
