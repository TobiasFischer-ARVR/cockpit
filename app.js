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
  pitches: "Pitches",
  followups: "Follow-ups",
  antworten: "Antworten",
  positiv: "Davon positiv",
  nach_erstkontakt: "Nach Erstkontakt",
  // Seite 2 - die restlichen Zeilen aus Andreas Kennzahlen-Blatt
  nach_followup: "Nach Follow-up",
  gespraeche: "Kennenlerngespräche",
  kooperationen: "Kooperationen",
  koop_quote: "Kooperationsquote",
  abschlussquote: "Abschlussquote",
  auftragswert: "Ø Auftragswert",
  // Ohne eigene Kachel: nur als Prozentwert oben rechts in ihrer Kachel
  // und als zweites Diagramm im Verlaufs-Sheet.
  quote_antworten: "Antwortquote",
  quote_positiv: "Positivquote",
};

// Zwei Seiten zu je sechs Kacheln, horizontal wischbar (Tobias 05.09.).
const KACHEL_SEITEN = [
  ["marken", "pitches", "followups", "antworten", "positiv",
   "nach_erstkontakt"],
  ["nach_followup", "gespraeche", "kooperationen", "koop_quote",
   "abschlussquote", "auftragswert"],
];

// Welche Kachel traegt oben rechts eine Quote.
const KACHEL_QUOTE = { antworten: "quote_antworten", positiv: "quote_positiv" };

// Quoten in PROZENTPUNKTEN (0-100), nicht als Bruch: das Verlaufs-Diagramm
// rechnet seine Gitterlinien in ganzen Schritten, bei Werten unter 1 haette
// es nur die Linien 0 und 1 gezogen.
function quote(a, b) {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : null;
}

// Kennzahlen, die nicht im Snapshot stehen, sich aber vollstaendig aus ihm
// rechnen. Die beiden Quotenformeln sind aus Andreas echten Monatswerten
// zurueckgerechnet und ueber alle vier Monate gegengeprueft (05.09.):
// 3/28 · 3/23 · 5/46 · 5/20 bzw. 2/3 · 1/3 · 1/5 · 2/5.
// ACHTUNG: Ablaufplan.md nennt fuer die Antwortquote noch "=B7/B4"
// (Antworten je Marke). Das galt vor dem Einfuegen der Zeile
// "Anzahl Pitches" am 30.08. - seither sind es die Kontakte im Nenner.
// "nach_followup" stand hier bis v76 als (antworten - nach_erstkontakt).
// Das war falsch: eine Antwort, deren Pitch im Vormonat lag, faellt aus
// BEIDEN Kategorien (siehe kpis_pro_marke in ugc_core.py) - die Differenz
// hat sie dann stillschweigend den Follow-ups zugeschlagen. Der Snapshot
// liefert den Wert seit dem Fix selbst; fehlt er in einem alten Snapshot,
// zeigt die Kachel ehrlich "—" statt einer geratenen Zahl.
const KPI_ABGELEITET = {
  quote_antworten: (g) => quote(g.antworten, g.pitches + g.followups),
  quote_positiv:   (g) => quote(g.positiv, g.antworten),
};

const KPI_EINHEIT = { quote_antworten: " %", quote_positiv: " %",
                      koop_quote: " %", abschlussquote: " %",
                      auftragswert: " €" };

// Ohne Datenquelle (Stand 05.09.): Kennenlerngespraeche, Kooperationen und
// Auftragswert stehen in keinem Brand-Book, Andrea tippt sie heute von Hand
// ins Excel; Kooperations- und Abschlussquote haengen daran. Solange das so
// ist, zeigt die Kachel einen Platzhalter - eine 0 waere eine Behauptung.
function kpiWert(gesamt, schluessel) {
  if (schluessel in gesamt) return gesamt[schluessel];
  const f = KPI_ABGELEITET[schluessel];
  return f ? f(gesamt) : null;
}

function kpiText(schluessel, wert) {
  return wert === null || wert === undefined
    ? "—" : String(wert) + (KPI_EINHEIT[schluessel] || "");
}

// ------------------------------------------- KPI aus dem Datenstand (v87)
// Bis v86 zeigten die Kacheln stur `snap.zeitraeume[].gesamt` - also den
// Stand des letzten PC-Exports. Ein "✓ erledigt" in der App landete im
// Datenstand und im Word-Book, aber an keiner Kachel (Tobias 06.09.:
// "der Follow-up zählt nicht hoch"). Betroffen waren alle sechs Zähler;
// Follow-up war nur die Aktion, die er gemacht hatte.
//
// Exakt derselbe Fehler wie am 02.09. eine Ebene höher. Damals für die
// Historie gelöst (historieAktuell), die Kacheln blieben außen vor.
//
// Gezählt wird auf `m.events` ROH - bewusst NICHT über historieAktuell().
// Das war der erste Versuch und der Rundlauf-Test hat ihn widerlegt: die
// Entdopplung dort wirft Ereignisse weg, die der PC zählt, und die App
// kam auf 60 statt 62 Follow-ups. Die Entdopplung ist für die ANZEIGE
// richtig (dieselbe Zeile nicht zweimal zeigen), für die ZÄHLUNG wäre sie
// eine zweite, abweichende Semantik - und die erzeugte Excel würde am PC
// und am Handy verschiedene Zahlen tragen.
// `m.events` ist ohnehin die vollständige Liste: der Import füllt sie aus
// dem Word-Book, "✓ erledigt" hängt direkt an. Genau deshalb zählt die
// Kachel jetzt hoch.
//
// (Die 60/62-Differenz war KEIN Rechenfehler, sondern echte Dubletten in
// zwei Brand-Books - siehe Projektnotiz, eigener Befund.)
//
// Portiert aus ugc_core.kpis_pro_marke - Zähl-Definitionen dort, sie sind
// mit Andrea abgestimmt und über vier Monate gegengerechnet. test_kpi.js
// prüft den Port gegen die echten Snapshot-Zahlen.

// Unlesbare Daten zählen nirgends mit (wie `dt is None` auf der PC-Seite).
// datumWert() liefert für Unlesbares 1e12 - das fiele sonst als "ganz spät"
// in die Rückblick-Schleife und könnte letzterKontakt verfälschen.
function eventDatum(e) {
  const d = datumWert(e && e.datum);
  return d < 1e12 ? d : null;
}

// Ereignistypen, die als KONTAKT mit der Marke gelten (Tobias/Andrea
// 14.09., bestätigt 16.09.): "Kontakt = Pitch, Follow-up oder
// Creatorpool-Prüfung". "Rückantworten prüfen" gehört NICHT dazu und
// erzeugt gar kein Ereignis.
const KONTAKT_TYPEN = ["Pitch", "FollowUp", "Creatorpool"];

// Zählt dieses Ereignis als Kontakt? EINE Stelle statt vier.
// Vor dem 16.09. stand ("Pitch", "FollowUp") an sechs Stellen verstreut
// (vier in ugc_core.py, zwei hier) - ein neuer Typ wäre aus jeder
// Zählung gefallen, ohne dass irgendwo etwas rot wird. Das Gegenstück
// in ugc_core.py heißt ist_kontakt() und muss mitwandern.
//
// Die "einmal je Monat"-Regel steckt NICHT hier, sondern im
// Zeitraum-Filter davor: "kontaktiert" ist ein Ja/Nein je Zeitraum.
function istKontakt(e) {
  return KONTAKT_TYPEN.indexOf(e.typ) !== -1;
}

// Kennzahlen EINER Marke für einen Zeitraum. Gibt null zurück, wenn die
// Marke im Zeitraum gar nichts hatte - dann taucht sie auch nicht auf.
function kpiMarke(ereignisse, von, bis) {
  const gueltig = ereignisse.filter((e) => eventDatum(e) !== null);
  const drin = (e) => {
    const d = eventDatum(e);
    return d >= von && d <= bis;
  };
  const imZeitraum = gueltig.filter(drin);
  if (!imZeitraum.length) return null;
  const vomTyp = (t) => imZeitraum.filter((e) => e.typ === t);
  const antworten = vomTyp("Antwort");

  // Der Rückblick geht bewusst über die GANZE Historie, nicht nur über den
  // Zeitraum (PC-Fix vom 05.09., gefunden an Woodwatch: Pitch 29.06.,
  // Antwort 01.07.). Sonst stünde eine Antwort ohne Vorgeschichte da und
  // fiele aus BEIDEN Kategorien heraus.
  // Bei gleichem Datum kommt der Kontakt vor der Antwort - man kann nicht
  // antworten, bevor gepitcht wurde (_chronologisch auf der PC-Seite).
  const sortiert = [...gueltig].sort((a, b) =>
    (eventDatum(a) - eventDatum(b)) ||
    ((a.typ === "Antwort" ? 1 : 0) - (b.typ === "Antwort" ? 1 : 0)));
  let nachErst = 0, nachFu = 0, letzterKontakt = null;
  for (const e of sortiert) {
    if (istKontakt(e)) {
      letzterKontakt = e.typ;
    } else if (e.typ === "Antwort" && drin(e)) {
      // Eine Antwort ohne jeden vorherigen Kontakt bleibt bewusst in
      // keiner der beiden Kategorien - sie zu erfinden wäre schlimmer.
      // Creatorpool zählt wie ein Erstkontakt (Tobias, 16.09.): eine
      // Antwort danach ist "nach Erstkontakt", nicht "nach Follow-up".
      // Eine dritte Kategorie wurde ausdrücklich verworfen.
      if (letzterKontakt === "Pitch" || letzterKontakt === "Creatorpool") {
        nachErst++;
      } else if (letzterKontakt === "FollowUp") nachFu++;
    }
  }
  return {
    // Eine Antwort ist KEIN Kontakt - die kommt von der Marke (Andrea 24.08.)
    kontaktiert: imZeitraum.some(istKontakt),
    pitches: vomTyp("Pitch").length,
    followups: vomTyp("FollowUp").length,
    antworten: antworten.length,
    positiv: antworten.filter((e) => e.positiv === "X").length,
    nach_erstkontakt: nachErst,
    nach_followup: nachFu,
  };
}

const KPI_SUMMEN = ["pitches", "followups", "antworten", "positiv",
                    "nach_erstkontakt", "nach_followup"];

// Ein Zeitraum, frisch gerechnet: {gesamt, marken}. `historien` ist die
// vorbereitete Liste [{marke, ereignisse}], damit historieAktuell() nicht
// je Zeitraum erneut läuft.
function kpiZeitraum(historien, von, bis) {
  const gesamt = { marken: 0 };
  for (const k of KPI_SUMMEN) gesamt[k] = 0;
  const marken = [];
  for (const { marke, ereignisse } of historien) {
    const k = kpiMarke(ereignisse, von, bis);
    if (!k) continue;
    if (k.kontaktiert) gesamt.marken++;
    for (const feld of KPI_SUMMEN) gesamt[feld] += k[feld];
    // `gruppe` ist der ORDNERNAME der Word-Datei, und die Gruppenliste auf
    // dem Dashboard gruppiert danach. Bis v121 kam der Wert ausschliesslich
    // vom PC-Import (export_snapshot.py rechnet ihn aus dem Dateipfad) - die
    // App selbst hat ihn NIE geschrieben. Folge: Rating gewechselt, Datei
    // verschoben, Kerninfos im Word nachgezogen - und die Liste zeigte
    // trotzdem den alten Buchstaben, bis am PC importiert wurde.
    // Gefunden von Tobias am 13.09. beim ersten echten Rating-Wechsel.
    //
    // `bookordner` weiss es besser, sobald die App die Datei selbst angelegt
    // oder verschoben hat - dieselbe Quelle, aus der bookPfad() den Pfad
    // baut. Ist er nicht gesetzt (Andreas gewachsene Books, die die App nie
    // angefasst hat), bleibt der importierte Wert stehen.
    //
    // BEWUSST NICHT auf m.brandrating.rating zurueckgefallen wie bookPfad():
    // das waere eine Behauptung ueber den Ablageort, die niemand geprueft
    // hat. Weichen Rating und Ordner auseinander (Landpark, urbanjngl am
    // 11.09.), soll genau das sichtbar bleiben.
    // `rating` ist die BEWERTUNG, nicht der Ordner (v125). Bis hierher las
    // der Rating-Filter aus snap.kerninfos - einem Wert, den nur der
    // PC-Import schreibt. Stellte Andrea eine Marke in der App von A auf C,
    // wanderte sie in der Gruppenliste sofort nach "C Brands", war ueber
    // "Rating = C" aber erst nach dem naechsten Import zu finden.
    //
    // BEWUSST NICHT bookordner wie bei `gruppe`: der sagt, WO die Datei
    // liegt. Rating und Ordner duerfen auseinanderlaufen (Landpark,
    // urbanjngl am 11.09.) - ein Filter namens "Rating" muss die Bewertung
    // nehmen, sonst versteckt er genau diese Faelle.
    marken.push({ name: marke.name, quelle: marke.quelle || "",
                  rating: marke.brandrating
                    ? String(marke.brandrating.rating || "").trim() : "",
                  gruppe: marke.bookordner
                    ? marke.bookordner + " Brands"
                    : (marke.gruppe || ""), ...k });
  }
  return { gesamt, marken };
}

// Schreibt die frisch gerechneten Werte IN den geladenen Snapshot.
// Absicht: jeder Leser von `z.gesamt` bekommt sie automatisch - die
// Kacheln, das Verlaufs-Diagramm UND der Excel-Export (xlsxKennzahlen).
// Hätte ich nur die Anzeige korrigiert, zeigte die App andere Zahlen als
// die erzeugte Excel - genau die Sorte Divergenz, die heute schon zweimal
// aufgefallen ist (v84 Rating-Felder, v86 Vorlage-Ordner).
// Der Snapshot wird nie zurückgeschrieben, die Änderung bleibt im Speicher.
// Idempotent: rechnet immer aus den Quellen, nicht aus dem Vorstand.
function kpiNachrechnen() {
  if (!snap || !Array.isArray(snap.zeitraeume)) return;
  if (!datenstand || !Array.isArray(datenstand.marken)) return;  // Rückfall
  const historien = datenstand.marken.map((marke) => ({
    marke, ereignisse: marke.events || [],
  }));
  // Jüngstes Ereignis überhaupt - der "Gesamt"-Zeitraum endet im Snapshot
  // am letzten Ereignis ZUM EXPORTZEITPUNKT. Ohne das Nachziehen fiele ein
  // heute erledigter Follow-up aus der Gesamtspalte heraus, während die
  // Monatskachel ihn zeigt.
  let juengste = 0;
  for (const { ereignisse } of historien)
    for (const e of ereignisse) juengste = Math.max(juengste, eventDatum(e) || 0);

  snap.zeitraeume.forEach((z, i) => {
    if (i === 0 && juengste > datumWert(z.ende)) z.ende = isoZuDe(juengste);
    const { gesamt, marken } = kpiZeitraum(historien, datumWert(z.start),
                                                      datumWert(z.ende));
    z.gesamt = gesamt;
    z.marken = marken;
  });
  // ponytail: neue MONATE legt die Rechnung nicht an. Läuft der Monat um,
  // ohne dass am PC exportiert wurde, fehlt die Monatskachel - die Zahl
  // steckt dann in "Gesamt", geht also nicht verloren. Beim nächsten
  // PC-Export ist der Monat da. Erst bauen, wenn das je stört.
}

// Sortierzahl (JJJJMMTT) zurück ins deutsche Datum - Gegenstück zu
// datumWert(), nur für die Gesamt-Zeitraumgrenze gebraucht.
function isoZuDe(wert) {
  const t = String(wert);
  return t.slice(6, 8) + "." + t.slice(4, 6) + "." + t.slice(0, 4);
}

const SVG_NS = "http://www.w3.org/2000/svg";

let snap = null;
let ladefehler = null;
// Gesetzt von laden(), wenn der eingestellte Ordner nicht erreichbar war.
// null = in Ordnung oder gar nicht angemeldet.
let datenPfadFehler = null;
let zi = 0; // gewaehlter Zeitraum-Index (0 = Gesamt), bleibt beim Navigieren erhalten

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Warnkarte fuer einen ins Leere zeigenden Ordner (v90). Gibt null
// zurueck, wenn alles in Ordnung ist - der Aufrufer haengt sie einfach an.
// Sie ist ANTIPPBAR und fuehrt direkt in die Einstellungen: eine Warnung,
// die nicht sagt was zu tun ist, ist nur halb so viel wert.
function pfadWarnung() {
  if (!datenPfadFehler) return null;
  const k = el("div", "karte block warnung tippbar");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "⚠ Achtung"));
  k.append(kopf, el("div", "titel", "Daten-Ordner nicht erreichbar"),
    el("div", "kontext", datenPfadFehler + " Zum Ändern hier tippen."));
  k.onclick = sheetEinstellungen;
  return k;
}

// Hinweiszeile "in Word geaendert" (v123). Gibt null zurueck, wenn nichts
// anliegt - der Aufrufer haengt sie einfach an.
//
// WEGKLICKBAR, und das ist keine Bequemlichkeit: Andrea kann den PC-Import
// nicht selbst ausloesen, das kann nur Tobias. Ein Hinweis, der bis zum
// Import stehen bleibt, ist fuer sie also einer, den sie NIE wegbekommt -
// nach drei Tagen Tapete, nach einer Woche unsichtbar. Genau so ist das
// 4-Sekunden-Sicherungsbanner am 04.09. gestorben, nur andersherum.
//
// Weggeklickt wird auf den cTag gemerkt: dieselbe Aenderung bleibt weg,
// eine NEUE holt die Zeile von selbst zurueck. Dadurch kann sie nicht zur
// Tapete werden, und es braucht keine Ruecksetz-Logik.
//
// Die Meldung nennt nur die Tatsache, keine Handlung (Tobias 14.09.):
// "bitte am PC einlesen" waere eine Aufforderung an jemanden, der sie
// nicht ausfuehren kann.
function bookAenderungZeile() {
  const weg = einst.bookHinweisWeg || {};
  const namen = [...bookGeaendert].filter(([n, c]) => weg[n] !== c)
    .map(([n]) => n);
  if (!namen.length) return null;
  const k = el("div", "karte block warnung");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "ℹ Hinweis"));
  const zu = el("button", "chip", "✕");
  zu.onclick = (e) => {
    e.stopPropagation();
    const w = einst.bookHinweisWeg || {};
    for (const [n, c] of bookGeaendert) w[n] = c;
    einst.bookHinweisWeg = w;
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
    k.remove();
  };
  kopf.append(zu);
  k.append(kopf, el("div", "titel", namen.length === 1
      ? "1 Brand-Book wurde in Word geändert"
      : `${namen.length} Brand-Books wurden in Word geändert`),
    el("div", "kontext",
      namen.join(", ") + " — der angezeigte Stand kann veraltet sein."));
  return k;
}

// "Nur auf diesem Geraet" als BLEIBENDE Karte (v124, Backlog 8).
//
// Vorher war das ein Banner: vier Sekunden, dann weg. Am 04.09. genau so
// uebersehen - Andrea arbeitete danach WOCHENLANG ohne Cloud-Kopie, ohne es
// zu merken. Ein Warnhinweis, der von selbst verschwindet, warnt nur den,
// der zufaellig gerade hinsieht.
//
// Der Merker liegt in einst (Geraet), nicht im Datenstand: "meine Kopie ist
// nicht in der Cloud" ist eine Aussage ueber DIESES Geraet. Und er ueberlebt
// den Neustart - der Fehler tat es schliesslich auch.
//
// ABSICHTLICH NICHT WEGKLICKBAR - anders als bookAenderungZeile(). Der
// Unterschied ist nicht Geschmack, sondern die Regel dahinter: Einen
// Hinweis, dessen Ursache man selbst beseitigen kann, darf man nicht
// wegwischen koennen. Hier kann Andrea etwas tun (anmelden, Ordner
// pruefen), beim Word-Hinweis nicht (nur Tobias kann importieren).
function wolkenWarnung() {
  if (!einst.cloudFehlt) return null;
  const k = el("div", "karte block warnung tippbar");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "⚠ Achtung"));
  k.append(kopf, el("div", "titel", "Nur auf diesem Gerät gesichert"),
    el("div", "kontext",
      "Die letzte Änderung ist nicht in OneDrive angekommen. Geht das "
      + "Gerät verloren, sind die Einträge weg. Zum Prüfen hier tippen."));
  k.onclick = sheetEinstellungen;
  return k;
}

// Offene Standwahl als BLEIBENDE Karte (v136) - gleiche Regel wie bei der
// Wolken-Warnung: nicht wegklickbar, weil Andrea die Ursache selbst
// beseitigen kann (naemlich durch Entscheiden). Antippen holt die Frage
// zurueck, statt sie nur zu beschreiben.
function standWahlWarnung() {
  if (!standWahlOffen) return null;
  const k = el("div", "karte block warnung tippbar");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "⚠ Achtung"));
  k.append(kopf, el("div", "titel", "Datenstand noch nicht entschieden"),
    el("div", "kontext",
      "Zwei Stände unterscheiden sich in den Marken. Es wurde nichts "
      + "übernommen und nichts gespeichert. Zum Entscheiden hier tippen."));
  k.onclick = () => abgleichBeiRueckkehr();
  return k;
}

// Hat der letzte Bestandslauf FEHLER gefunden? Traegt die Warnkarte.
//
// Modulweit und ephemer, mit Absicht weder in einst noch im Datenstand:
// der Wert wird bei jedem Start neu berechnet, und er haengt am
// geraetespezifischen Book-Pfad. Ihn zu speichern hiesse, eine Aussage ueber
// DIESES Geraet zu konservieren, die beim naechsten Start ohnehin neu
// entsteht - und die Andreas Handy nach ihrer eigenen Korrektur noch als
// alte Warnung zeigen wuerde.
let bestandFehlerDa = false;

// Laeuft gerade ein Bestandslauf? Sperre nach dem Muster von abgleichLaeuft
// / abgleichNachholen (v95).
//
// Noetig geworden durch die Reparatur-Knoepfe (Review 18.09.): Der Knopf am
// Befund ruft den Pruefknopf PROGRAMMATISCH auf - und `disabled` blockiert
// nur einen echten Fingertipp, keinen Funktionsaufruf. Tippt sie einen
// zweiten Befund an, waehrend der erste noch speichert, laufen zwei
// Durchgaenge gleichzeitig: beide leeren dieselbe Statuszeile und befuellen
// sie neu, beide schreiben bookDateien und den Befund-Merker. Die DATEN
// bleiben heil (die Schreibkette aus v128 serialisiert sie), die ANZEIGE
// nicht.
//
// Vertagt statt verworfen: ein abgewiesener Lauf holt sich hinterher nach.
// Wer einen Knopf drueckt, muss das Ergebnis sehen - ein still
// verschluckter zweiter Lauf hiesse "nichts passiert", obwohl repariert
// wurde.
let bestandLaeuft = false;

// Stiller Bestandslauf (v137, Backlog 28). Tobias am 18.09.: "auf User
// Anfrage (manuell) pruefen oder beim Start der App" - also beides.
//
// Beim Start aber STILL, ausser es gibt einen Befund. Eine Meldung, die bei
// jedem Start erscheint, wird nach drei Tagen weggeklickt und greift dann
// nicht mehr, wenn sie zaehlt. Genau daran ist das Sicherungsbanner am
// 04.09. gestorben.
//
// Nur FEHLER ziehen die Karte hoch, keine Hinweise: eine verwaiste Datei
// darf gewollt sein und steht deshalb in "Daten pruefen" und sonst nirgends.
//
// Rueckgabe: ob sich der Zustand geaendert hat - nur dann muss neu
// gezeichnet werden.
async function bestandStillPruefen() {
  if (!datenstand || !datenstand.marken) return false;
  // Einem laufenden Durchgang aus dem Weg gehen: der Hintergrundlauf wuerde
  // ihm sonst bookDateien unter den Fuessen austauschen.
  if (bestandLaeuft) return false;
  bestandLaeuft = true;
  try {
  await bookAenderungenPruefen();          // fuellt bookDateien
  const daten = bestandBefunde(datenstand.marken);
  const dateien = bestandDateiBefunde(datenstand.marken, bookDateien);
  const vorher = bestandFehlerDa;
  bestandFehlerDa = (daten.fehler.length + dateien.fehler.length) > 0;
  return bestandFehlerDa !== vorher;
  } finally { bestandLaeuft = false; }
}

// Befund-Karte (v137). Bleibend und nicht wegklickbar - nach derselben
// Regel wie die Wolken-Warnung: was die Nutzerin selbst beheben kann, darf
// sie nicht wegwischen koennen. Und beheben kann sie es jetzt wirklich, der
// Knopf sitzt seit v137 am Befund.
function bestandWarnung() {
  if (!bestandFehlerDa) return null;
  const k = el("div", "karte block warnung tippbar");
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", "\u26a0 Achtung"));
  k.append(kopf, el("div", "titel", "Daten pr\u00fcfen hat etwas gefunden"),
    el("div", "kontext",
      "Buch, Brand Rating und Pitchliste widersprechen sich an mindestens "
      + "einer Stelle. Zum Ansehen hier tippen."));
  k.onclick = sheetEinstellungen;
  return k;
}

// Merker setzen/loeschen. Schreibt nur bei WECHSEL in den Geraetespeicher,
// nicht bei jedem Speichern.
function wolkeMerken(ok) {
  if (Boolean(einst.cloudFehlt) === !ok) return;
  einst.cloudFehlt = !ok;
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  listeVeraltet = true;
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

const APP_VERSION = "v137"; // im Gleichschritt mit CACHE in service-worker.js pflegen

const EINST_KEY = "cockpit-einst";
let einst = {};
try { einst = JSON.parse(localStorage.getItem(EINST_KEY) || "{}"); } catch (_) {}

const EINST_GROESSEN = [["0.9", "Klein"], ["", "Normal"],
                        ["1.1", "Groß"], ["1.2", "Sehr groß"]];

// Abschnitt im Detail-Sheet. Nur noch ein beschrifteter Block - das
// Zeigen/Verstecken macht zuReitern() nach dem Bauen.
function abschnitt(titel, ...inhalt) {
  const d = el("div", "block");
  d.dataset.titel = titel;
  d.append(el("div", "abschnitt", titel), ...inhalt.filter(Boolean));
  return d;
}

// Welcher Abschnitt in welchen Reiter gehoert (Tobias 03.09. abends,
// nach dem Handy-Test: Aufklappen war ihm zu unruhig). Was hier fehlt,
// bekommt einen eigenen Reiter unter seinem eigenen Namen.
const REITER = {
  "Wiedervorlage": "Aktion",
  "Startdatum": "Aktion",
  "Antwort eintragen": "Aktion",
  "Kundenauftrag": "Aktion",
  // Bereichswechsel, keine Kontaktereignisse - steht trotzdem bei der
  // Historie, weil es dort gesucht wird.
  "Verlauf des Auftrags": "Historie",
  "Nächster Schritt": "Aktion",
  "Brand Rating (Excel-Blatt)": "Rating",
  "Verwaltung": "Rating",
  "Kontakt & Infos": "Kontakt",
  "Historie": "Historie",
  // Eigener, vierter Reiter (v83) - die Excel-Spalten ohne eigenes
  // Formular. Bewusst nicht unter "Rating" einsortiert: dort steht die
  // Anzeige-Tabelle, hier stehen Eingabefelder.
  "Sonstiges": "Sonstiges",
  // Einstellungs-Sheet (v61)
  "Darstellung": "Darstellung",
  "Datenstand-Sicherung": "Sicherung",
  "Excel erzeugen": "Sicherung",
  "Automatisches Backup": "Sicherung",
  // v105: der Sicherungs-Ordner wohnt beim Sichern, nicht bei den anderen
  // Pfaden - dort sucht man ihn, wenn eine Sicherung fehlt.
  "Pfad Sicherungen": "Sicherung",
  // Die Pruefung vergleicht Book gegen Excel, also Daten gegen Daten -
  // sie gehoert zu den Pfaden, nicht zur Sicherung (v92).
  "Daten prüfen": "OneDrive",
  "Pfad Brand-Books": "OneDrive",
  "Pfad Datenbank": "OneDrive",
  // Warteliste (v103). Im Einstellungs-Sheet ein eigener Reiter; das
  // Warteliste-Sheet selbst wird NICHT geteilt - eine Liste braucht keine
  // Reiter. Seine drei Abschnitte stehen hier trotzdem, weil der
  // Invariantentest in test_bookpfad.js statisch JEDEN abschnitt()-Aufruf
  // in app.js prueft und einen fehlenden Eintrag als vergessen wertet.
  "Datenlogging": "OneDrive",
  "Warteliste": "Warteliste",
  "Nichts offen": "Warteliste",
  "Braucht dich": "Warteliste",
  "Wartet aufs Brand-Book": "Warteliste",
};

// Fertig gebautes Sheet in Reiter aufteilen. Bewusst HINTERHER statt in
// jeder der neun Bau-Funktionen: die bleiben alle unveraendert, sie
// haengen ihre Abschnitte weiter einfach untereinander.
//   - Alles VOR dem ersten Abschnitt (Ampel, "Brand-Book öffnen") bleibt
//     oben stehen; das gehoert zu keinem Reiter.
//   - Loses NACH einem Abschnitt (die Book-Knoepfe im Brand Rating)
//     wandert in dessen Reiter mit - sonst stuende es zusammenhanglos
//     ueber der Leiste.
// merker: Schluessel in den Geraete-Einstellungen, damit nach einem
// Neuzeichnen (z.B. "✓ erledigt") derselbe Reiter offen bleibt statt
// zurueck auf den ersten zu springen.
function zuReitern(wrap, merker) {
  const kopf = [];
  const gruppen = new Map();          // Reiter-Name -> Knoten
  let aktuell = null;
  for (const k of [...wrap.childNodes]) {
    if (k.classList && k.classList.contains("block")) {
      aktuell = REITER[k.dataset.titel] || k.dataset.titel;
      if (!gruppen.has(aktuell)) gruppen.set(aktuell, []);
    }
    (aktuell === null ? kopf : gruppen.get(aktuell)).push(k);
  }
  if (gruppen.size < 2) return;       // ein Reiter ist kein Reiter
  wrap.innerHTML = "";               // loest die Knoten nur aus dem DOM,
  wrap.append(...kopf);              // die Referenzen oben bleiben gueltig
  const leiste = el("div", "chips reiter");
  const buehne = el("div");
  const namen = [...gruppen.keys()];
  let aktiv = null;
  const einsetzen = (name) => {
    aktiv = name;
    buehne.innerHTML = "";
    buehne.append(...gruppen.get(name));
    [...leiste.children].forEach((c, i) =>
      c.classList.toggle("aktiv", namen[i] === name));
  };
  const zeigen = (name) => {
    einsetzen(name);
    einst[merker] = name;
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  };
  for (const name of namen) {
    const c = el("button", "chip", name);
    c.onclick = () => zeigen(name);
    leiste.append(c);
  }
  wrap.append(leiste, buehne);
  zeigen(namen.includes(einst[merker]) ? einst[merker] : namen[0]);

  // Sheet-Hoehe festnageln (Tobias 03.09.): sonst springt das Fenster bei
  // jedem Reiterwechsel auf die Hoehe des jeweiligen Inhalts. Jeden Reiter
  // einmal einsetzen, hoechsten Wert merken, als Mindesthoehe setzen.
  // Messen geht erst, wenn das Sheet im DOM haengt - beim ersten Bauen
  // kommt sheetOeffnen() erst NACH zuReitern(), deshalb ueber
  // requestAnimationFrame und mit isConnected-Wache.
  // ponytail: misst bei jedem Neuzeichnen neu (3 Layouts, einmal pro
  // Sheet-Aufbau). Zwischenspeichern erst, falls das je auffaellt.
  const messen = () => {
    if (!wrap.isConnected) { requestAnimationFrame(messen); return; }
    const vorher = aktiv;
    let hoch = 0;
    for (const name of namen) {
      einsetzen(name);
      hoch = Math.max(hoch, buehne.scrollHeight);
    }
    buehne.style.minHeight = hoch + "px";
    einsetzen(vorher);   // einsetzen statt zeigen: kein Schreiben in die
  };                     // Einstellungen, der Reiter hat sich nicht geaendert
  requestAnimationFrame(messen);
}

// Reste der Aufklapp-Variante (v56/v57) einmal aus den Einstellungen
// werfen - sie werden von keiner Zeile mehr gelesen.
if (einst.zu || einst.zuStand !== undefined || einst.intro !== undefined) {
  delete einst.zu;        // Aufklapp-Variante (v56/v57)
  delete einst.zuStand;
  delete einst.intro;     // "Logo beim Start" - Intro gibt es nicht mehr (v64)
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
}

function einstAnwenden() {
  // ponytail: zoom statt rem-Umbau - das ganze Layout ist in px; zoom
  // skaliert alles zusammen (wie Androids "Anzeigegroesse") und Chrome/
  // Android kann es. Upgrade auf rem-Basis nur, falls je ein Zielbrowser
  // ohne zoom dazukommt.
  document.body.style.zoom = einst.groesse || "";
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

// --------------------------------------------------- Ordner-Browser (v86)
// Tobias 06.09.: der OneDrive-Pfad wird nicht mehr getippt, sondern
// durchgeklickt. Ein Tippfehler im Book-Pfad hat bei Andrea schon einmal
// eine halbe Stunde Suche gekostet (v56), und ein falscher Datenbank-Ordner
// sichert still gar nichts (v71) - Graph legt fehlende Ordner beim PUT
// nicht an.
//
// Bewusst KEIN eigenes Sheet: der Browser zeichnet in den Abschnitt, aus
// dem er aufgerufen wurde. Ein zweites Sheet ueber dem Einstellungs-Sheet
// haette einen zweiten History-Eintrag gebraucht, und die Android-
// Zurueck-Geste haette dann zwei Ebenen abzuraeumen gehabt.
//
// Abwaegung (Tobias 06.09.): ohne Tippfeld gibt es keinen Weg mehr, einen
// Pfad ohne OneDrive-Anmeldung zu setzen. Verschmerzbar - ohne Anmeldung
// nuetzt der Pfad ohnehin nichts, und "Pruefen" braucht sie auch heute.
// Wer trotzdem zurueck muss: "Standard" setzt ohne Verbindung zurueck.

// Graph-Adresse fuer die Kinder eines Pfades. Die Wurzel hat KEIN ":" -
// "/me/drive/root:/:/children" waere ein 400er.
function graphKinder(teile) {
  return teile.length
    ? "/me/drive/root:/" + teile.join("/") + ":/children"
    : "/me/drive/root/children";
}

// Ein Graph-Fehlerstatus als Klartext. Frueher dreimal fast gleich im
// Einstellungs-Sheet; 404 heisst je nach Ordner etwas anderes, deshalb
// als Parameter.
function graphFehlerText(status, text404) {
  return status === 404 ? text404
    : status === 403
      ? "✗ Keine Berechtigung (403) — beim Anmelden dem Datei-Zugriff zustimmen."
      : "✗ OneDrive-Fehler " + status + " — Screenshot an Tobias.";
}

// Zeichnet den Browser in "ziel". fertig(pfad) bekommt den gewaehlten
// Pfad ohne fuehrenden Slash ("" = OneDrive-Wurzel), abbruch() nichts.
function ordnerBrowser(ziel, startTeile, fertig, abbruch) {
  const teile = startTeile.slice();
  zeichnen();

  async function zeichnen() {
    ziel.innerHTML = "";
    // Brotkrumen: jedes Segment springt auf seine Ebene zurueck. Ersetzt
    // einen "eine Ebene hoch"-Knopf - aus fuenf Ebenen ist das ein Tipp
    // statt vier.
    const krumen = el("div", "chips");
    const wurzel = el("button", "chip" + (teile.length ? "" : " aktiv"), "OneDrive");
    wurzel.onclick = () => { teile.length = 0; zeichnen(); };
    krumen.append(wurzel);
    teile.forEach((name, i) => {
      const b = el("button", "chip" + (i === teile.length - 1 ? " aktiv" : ""), name);
      b.onclick = () => { teile.length = i + 1; zeichnen(); };
      krumen.append(b);
    });
    ziel.append(krumen);

    const liste = el("div", "ordnerliste");
    liste.append(el("div", "stand", "Lade …"));
    const knoepfe = el("div", "chips");
    const nehmen = el("button", "chip aktiv", "✓ Diesen Ordner nehmen");
    nehmen.onclick = () => fertig(teile.join("/"));
    const ab = el("button", "chip", "Abbrechen");
    ab.onclick = abbruch;
    knoepfe.append(nehmen, ab);
    ziel.append(liste, knoepfe);

    const r = await OD.graphRoh(graphKinder(teile) +
      "?$select=name,folder,remoteItem&$top=400");
    liste.innerHTML = "";
    if (!r) {
      liste.append(el("div", "stand",
        "✗ Kein Zugriff aufs Konto — ab- und neu anmelden."));
      return;
    }
    if (!r.ok) {
      liste.append(el("div", "stand", graphFehlerText(r.status,
        "✗ Ordner nicht mehr da — eine Ebene zurück.")));
      return;
    }
    // Nur Ordner. Verknuepfungen (remoteItem) tragen ihren folder-Facet
    // eine Ebene tiefer - ohne die zweite Bedingung fehlten sie in der
    // Liste, und man haette sich gewundert, wo der Ordner hin ist.
    const alle = ((await r.json()).value || [])
      .filter((x) => x.folder || (x.remoteItem && x.remoteItem.folder))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"));
    if (!alle.length) {
      liste.append(el("div", "stand", "Keine Unterordner — " +
        "„Diesen Ordner nehmen“ oder eine Ebene zurück."));
      return;
    }
    for (const x of alle) {
      // Verknuepfung auf ein fremdes OneDrive: taucht in /children auf,
      // laesst sich aber nicht oeffnen (HTTP 422, siehe Projektnotiz
      // "Ordner & Konten"). Anzeigen und erklaeren statt in den Fehler
      // laufen lassen.
      const verknuepft = !x.folder && !!x.remoteItem;
      const b = el("button", "ordner" + (verknuepft ? " gesperrt" : ""),
        (verknuepft ? "🔗 " : "📁 ") + x.name);
      b.onclick = verknuepft
        ? () => banner("„" + x.name + "“ ist eine Verknüpfung " +
            "auf ein anderes OneDrive — da kann die App nicht hinein.")
        : () => { teile.push(x.name); zeichnen(); };
      liste.append(b);
    }
  }
}

// Ein Pfad-Abschnitt fuer die Einstellungen: Anzeige, Ordner-Browser,
// Pruefen, Standard. basis() liefert die Graph-Adresse, pruefer() den
// Ergebnistext.
function pfadAbschnitt(titel, schluessel, standard, basis, pruefer, hilfe) {
  const koerper = el("div");
  const stand = el("div", "stand");
  const ergebnis = el("div", "stand");   // Pruefergebnis, eigene Zeile: der
                                         // Pfad soll dabei sichtbar bleiben
  const zeigeStand = () => {
    stand.textContent = "Aktuell: " + basis().split("root:")[1];
  };
  const setzen = (pfad) => {
    einst[schluessel] = pfad;
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
    ergebnis.textContent = "";
    zeigeStand();
  };
  const angemeldet = () => typeof OD !== "undefined" && OD.konto();

  const pruefen = async () => {
    if (!angemeldet()) {
      ergebnis.textContent = "Zum Prüfen erst bei OneDrive anmelden."; return;
    }
    ergebnis.textContent = "Prüfe …";
    ergebnis.textContent = await pruefer();
  };

  function normal() {
    koerper.innerHTML = "";
    const zeile = el("div", "chips");
    const waehlen = el("button", "chip aktiv", "📁 Ordner wählen");
    waehlen.onclick = () => {
      if (!angemeldet()) {
        ergebnis.textContent =
          "Zum Auswählen erst bei OneDrive anmelden."; return;
      }
      koerper.innerHTML = "";
      ordnerBrowser(koerper,
        String(einst[schluessel] || standard).split("/").filter(Boolean),
        (pfad) => { setzen(pfad); normal(); pruefen(); },
        normal);
    };
    const pKnopf = el("button", "chip", "Prüfen");
    pKnopf.onclick = pruefen;
    const std = el("button", "chip", "Standard");
    std.onclick = () => setzen("");
    zeile.append(waehlen, pKnopf, std);
    koerper.append(zeile);
    zeigeStand();
  }
  normal();
  return abschnitt(titel, koerper, stand, ergebnis, el("div", "stand", hilfe));
}

// Der Ordner allein reicht nicht: ohne snapshot.json bleibt das
// UGC-Dashboard leer, und genau das war Andreas Symptom (v71).
async function pruefeCockpit() {
  const r = await OD.graphRoh(datenBasis() + ":/children?$select=name");
  if (!r) return "✗ Kein Zugriff aufs Konto — ab- und neu anmelden.";
  if (!r.ok) return graphFehlerText(r.status,
    "✗ Ordner nicht gefunden — hier wird NICHTS gesichert.");
  const da = new Set((((await r.json()).value) || []).map((x) => x.name));
  return "✓ Ordner erreichbar · "
    + (da.has("snapshot.json") ? "snapshot.json da"
       : "⚠ snapshot.json fehlt — Dashboard bleibt leer")
    + (da.has("datenstand.json") ? " · Arbeitsstand gesichert"
       : " · noch kein Arbeitsstand");
}

// Sicherungs-Ordner pruefen (v105). Der einzige Weg, einen falschen Pfad zu
// finden, BEVOR eine Sicherung gebraucht wird - alle anderen Meldungen
// kommen erst, wenn ein Schreibversuch scheitert.
async function pruefeSicherungen() {
  const r = await OD.graphRoh(sicherungBasis() +
    ":/children?$select=name,lastModifiedDateTime&$top=200");
  if (!r) return "✗ Kein Zugriff aufs Konto — ab- und neu anmelden.";
  if (!r.ok) return graphFehlerText(r.status,
    "✗ Ordner nicht gefunden — hier wird NICHTS gesichert.");
  const alle = ((await r.json()).value) || [];
  const unsere = alle.filter((d) =>
    /^cockpit-(datenstand-|vor-v)/.test(String(d.name || "")));
  if (!unsere.length) {
    return "✓ Ordner erreichbar · noch keine Sicherung darin";
  }
  const neuste = unsere.map((d) => String(d.lastModifiedDateTime || ""))
    .sort().pop();
  const version = unsere.some((d) =>
    String(d.name).startsWith("cockpit-vor-" + APP_VERSION + "-"));
  return `✓ Ordner erreichbar · ${unsere.length} Sicherung(en) · ` +
    `neuste ${String(neuste).slice(0, 16).replace("T", " ")}` +
    (version ? ` · Rückfahrkarte für ${APP_VERSION} da`
             : ` · ⚠ keine Rückfahrkarte für ${APP_VERSION}`);
}

// Genau das pruefen, was die App dort braucht (Plan 01.09.): die vier
// Rating-Unterordner und die zwei Templates. "D Brands" gehoert dazu
// (Tobias 04.09.) - fehlt er, scheitert erst das Anlegen des ersten
// D-Books, weil Graph fehlende Elternordner beim PUT nicht anlegt.
async function pruefeBooks() {
  const r = await OD.graphRoh(bookBasis() + ":/children?$select=name");
  if (!r) return "✗ Kein Zugriff aufs Konto — ab- und neu anmelden.";
  if (!r.ok) return graphFehlerText(r.status,
    "✗ Ordner nicht gefunden — neu auswählen.");
  const da = new Set((((await r.json()).value) || []).map((x) => x.name));
  const fehlt = ["A Brands", "B Brands", "C Brands", "D Brands",
    "Template Brand-Book A Brand.docx", "Template Brand-Book B-C Brand.docx"]
    .filter((n) => !da.has(n));
  return fehlt.length
    ? "⚠ Ordner gefunden, aber es fehlt: " + fehlt.join(", ")
    : "✓ Ordner gefunden — Unterordner und Templates sind da.";
}

function sheetEinstellungen() {
  const wrap = el("div");
  wrap.append(abschnitt("Darstellung",
    einstZeile("Schriftgröße", EINST_GROESSEN, "groesse"),
    el("div", "stand", "Gilt nur für dieses Gerät.")));
  // Datenstand-Sicherung (Tobias 30.08.): hier statt im OneDrive-Sheet -
  // das Zahnrad ist auch im UGC Dashboard immer erreichbar
  const sStatus = el("div", "stand", sicherungsText());
  const sZeile = el("div", "chips");
  const sichern = el("button", "chip", "Jetzt sichern");
  sichern.onclick = () => datenstandSichern(sStatus);
  const backup = el("button", "chip", "Backup herunterladen");
  backup.onclick = datenstandBackup;
  const laden = el("button", "chip", "Backup laden");
  laden.onclick = backupLaden;
  sZeile.append(sichern, backup, laden);
  wrap.append(abschnitt("Datenstand-Sicherung", sStatus, sZeile,
    el("div", "stand",
      "Backup laden: eine cockpit-datenstand-….json auswählen " +
      "(Download-Ordner oder OneDrive) — ersetzt den aktuellen Stand. " +
      "Der jetzige Stand wird vorher automatisch in den Download-Ordner " +
      "gesichert (cockpit-vor-rueckspielung-….json)."),
    // Punkt 34 (Tobias, 18.09.): *"Egal, packt den Hinweis halt unter den
    // Button in die Settings."* Stand bisher nur in der Sammelmappe fuer
    // Andrea - also an einer Stelle, die sie im Ernstfall nicht offen hat.
    // Hier steht er da, wo der Knopf ist.
    el("div", "stand",
      "⚠ Grenze: „Backup laden“ stellt nur die Daten der App wieder her — " +
      "NICHT die Word-Dokumente. Wurde zwischenzeitlich z. B. ein Rating " +
      "geändert, steht danach in der App wieder der alte Wert, im " +
      "Brand-Book aber der neue.")));

  // Datenlogging (v103). Werkzeug auf Zeit: einschalten, Fehler einfangen,
  // wieder ausschalten. Der Pfad wird MIT angezeigt - steht der Datenbank-
  // Ordner falsch, liefe auch das Log ins Leere (Vorfall 04.09.).
  const lStatus = el("div", "stand", logStufe()
    ? "Schreibt nach " + logBasis().split("root:").pop() +
      " — heutige Datei: " + logDatei().split("/").pop()
    : "Aus. Einschalten, wenn ein Fehler nachvollzogen werden soll.");
  wrap.append(abschnitt("Datenlogging",
    einstZeile("Umfang", LOG_STUFEN, "logStufe"),
    lStatus,
    el("div", "stand",
      "einfach: jeder OneDrive-Zugriff mit Status und Graph-Fehlercode. " +
      "erweitert: zusätzlich SOLL/IST und welche Schutzregel gegriffen hat. " +
      "Eine Datei je Tag und Gerät.")));

  // Warteliste (v103): fest erreichbar. Das Fenster geht von allein nur
  // auf, wenn ein Eintrag Andreas Zutun braucht - alles andere traegt sich
  // selbst nach. Trotzdem muss sie jederzeit nachsehen koennen, was noch
  // unterwegs ist, ohne auf einen Banner zu warten.
  const wOffen = ((datenstand && datenstand.ausstehend) || []);
  const wDringend = wOffen.filter((e) => e.grund === "braucht-dich").length;
  const wZeile = el("div", "chips");
  const wKnopf = el("button", "chip",
    "Warteliste öffnen" + (wOffen.length ? " (" + wOffen.length + ")" : ""));
  wKnopf.onclick = sheetWarteliste;
  wZeile.append(wKnopf);
  wrap.append(abschnitt("Warteliste",
    el("div", "stand", !wOffen.length
      ? "Alles ist im Brand-Book angekommen."
      : (wOffen.length === 1 ? "1 Eintrag wartet" : wOffen.length + " Einträge warten")
        + " aufs Brand-Book"
        + (wDringend ? " — davon " + wDringend + " mit deinem Zutun." : ".")),
    wZeile));

  // Excel erzeugen (v80): frische Datei aus der Vorlage, direkt vom Geraet.
  // Bis dahin ging das nur am PC ueber excel_generator.py - Andrea hat
  // weder Python noch Excel-COM. Gebaut wird im Browser mit JSZip, genau
  // wie das Brand-Book: die .xlsm ist ein ZIP mit XML.
  // Den WIRKLICHEN Zielpfad zeigen, nicht nur "Ordner Export" (Tobias
  // 06.09.: Excel erzeugt, Datei nirgends gefunden). Der Pfad haengt am
  // Datenbank-Ordner - steht der falsch, sieht man es hier sofort.
  const xStatus = el("div", "stand",
    "Vorlage → fertige Excel nach " + excelNachbar("Export").split("root:")[1]);
  const xZeile = el("div", "chips");
  const xKnopf = el("button", "chip", "📊 Excel erzeugen");
  xKnopf.onclick = async () => {
    xKnopf.disabled = true;
    xStatus.textContent = "Erzeuge Excel …";
    try {
      xStatus.textContent = await excelErzeugen();
    } catch (fehler) {
      // Nichts still schlucken (v70/v71/v75): der echte Fehler gehoert in
      // die Anzeige, sonst sucht Andrea im Dunkeln.
      xStatus.textContent = "Fehlgeschlagen: " + fehler.message;
    }
    xKnopf.disabled = false;
  };
  xZeile.append(xKnopf);
  wrap.append(abschnitt("Excel erzeugen", xStatus, xZeile,
    el("div", "stand",
      "Brand Rating und Pitchliste werden neu geschrieben; Kriterien, " +
      "Formeln und Formatierung bleiben aus der Vorlage. Vorlage und " +
      "Export liegen neben dem Datenbank-Ordner. Gleicher Tag = gleiche " +
      "Datei, sie wird ersetzt.")));

  // Eine Befundzeile, bei zwei Befundarten mit Reparatur-Knopf (v137,
  // Backlog 13). Bis hierher war jeder Befund reiner Text: die App fand die
  // Sache, konnte sie aber nicht abstellen - fuer eine Altlast blieb nur
  // Handarbeit an der JSON (werkzeuge/haken_entfernen.py, am 11.09. fuer
  // Kena gebaut).
  //
  // Einen Knopf gibt es NUR, wo die App sicher weiss, was richtig ist:
  //   haken-ohne-book       es gibt keine Datei, also ist der Haken falsch
  //   book-falscher-ordner  bookordner IST das Feld "wo die Datei liegt"
  //
  // Rating-Konflikte bekommen bewusst keinen (Tobias, 18.09.): dort muesste
  // die App entscheiden, welche Seite gewinnt, und beim Word-Vergleich auch
  // noch ins Dokument schreiben. Die Anweisung dazu steht seit dem 07.09.
  // unter dem Befund und bleibt stehen.
  const befundReparatur = (f) => {
    const m = markeZuName(f.name);
    if (!m) return null;
    if (f.art === "haken-ohne-book" && m.brandrating) {
      return { text: "Haken entfernen",
               mach: () => { m.brandrating.brandbook = ""; } };
    }
    if (f.art === "book-falscher-ordner" && f.ordner) {
      return { text: "Ordner nachtragen",
               mach: () => { m.bookordner = f.ordner; } };
    }
    return null;
  };
  const befundZeile = (f, nochmal) => {
    const zeile = el("div", null, "• " + f.name + ": " + f.text);
    const tu = befundReparatur(f);
    if (!tu) return zeile;
    const k = el("button", "chip", tu.text);
    k.onclick = async () => {
      k.disabled = true;                 // ein Klick, eine Aenderung
      tu.mach();
      listeVeraltet = true;
      await datenstandPersistieren();
      nochmal();      // frisch nachrechnen statt die Zeile nur wegzunehmen
    };
    zeile.append(" ", k);
    return zeile;
  };

  // Datenpruefung (v92): Word-Book gegen Excel. Findet Marken, bei denen
  // das Brand-Book noch ein aelteres Rating traegt - ein stiller
  // Widerspruch, den vorher niemand sehen konnte (3 von 45 am 06.09.).
  const pStatus = el("div", "stand",
    "Vergleicht Rating, Brand Fit, Begeisterung und Erfolgschance " +
    "zwischen Brand-Book und Excel.");
  const pZeile = el("div", "chips");
  const pKnopf = el("button", "chip", "🔍 Daten prüfen");
  let bestandNachholen = false;
  // Zwei Funktionen statt einer: der Durchgang selbst darf frueh
  // zurueckspringen ("keine Abweichungen"), ohne dass dabei das Nachholen
  // verlorengeht. In EINER Funktion haette genau dieser frueher return das
  // Nachholen uebersprungen - und eine Reparatur waere ohne sichtbare
  // Wirkung geblieben.
  const pruefen = async () => {
    if (bestandLaeuft) { bestandNachholen = true; return; }
    bestandLaeuft = true;
    try { await pruefenEinmal(); } finally { bestandLaeuft = false; }
    // Waehrend des Laufs kam noch eine Reparatur dazu -> noch einmal, damit
    // die Anzeige den Stand NACH der letzten Aenderung zeigt.
    if (bestandNachholen) { bestandNachholen = false; await pruefen(); }
  };
  const pruefenEinmal = async () => {
    if (!datenstand || !datenstand.marken) {
      pStatus.textContent = "Kein Datenstand geladen.";
      return;
    }
    pStatus.textContent = "";
    // Word -> App (v123): die einzige Stelle, an der die App ueberhaupt
    // merkt, dass ein Book inzwischen anders aussieht.
    //
    // Gesperrt wird nur um den await herum, wie beim Nachbarknopf
    // "Excel erzeugen". Das genuegt: alles davor und danach laeuft
    // synchron, ein zweiter Klick kann sich also nur HIER dazwischen
    // schieben. Ohne die Sperre haengen zwei Durchlaeufe ihre Ergebnisse
    // nacheinander in dasselbe pStatus - zweimal derselbe Befund.
    pKnopf.disabled = true;
    const wordNeu = await bookAenderungenPruefen();
    pKnopf.disabled = false;
    // ERST JETZT rechnen (v137). Die Bestandspruefung lief bis v136 VOR dem
    // await - bestandDateiBefunde() saehe dann die Dateiliste des vorigen
    // Laufs oder gar keine. Reihenfolge-Regel vom 10.09.: wer liest, muss
    // hinter dem stehen, der holt.
    const daten = bestandBefunde(datenstand.marken);
    const dateien = bestandDateiBefunde(datenstand.marken, bookDateien);
    const fehler = daten.fehler.concat(dateien.fehler);
    const hinweise = daten.hinweise.concat(dateien.hinweise);
    // Wechselt der Befundstand, muss die Ansicht DAHINTER neu gezeichnet
    // werden - sonst haengt die Warnkarte hinterher (Review 18.09.). Beide
    // Richtungen zaehlen: ein frisch gefundener Fehler muss die Karte
    // hochziehen, ein behobener sie wegnehmen. Ohne das zeigte die App
    // entweder einen Befund nicht an, den sie gerade gefunden hat, oder
    // warnte weiter vor etwas, das erledigt ist - beides genau der Fehler,
    // den dieses Paket abstellen soll.
    const warVorher = bestandFehlerDa;
    bestandFehlerDa = fehler.length > 0;
    if (bestandFehlerDa !== warVorher) listeVeraltet = true;
    if (wordNeu.length) {
      listeVeraltet = true;
      pStatus.append(el("div", null, "⚠ In Word geändert: "
        + wordNeu.join(", ") + " — der angezeigte Stand kann veraltet sein."));
    }
    if (!fehler.length && !hinweise.length) {
      pStatus.append(el("div", null,
        "✓ Keine Abweichungen — Book, Brand Rating und Pitchliste sind sich einig."));
      pStatus.append(el("div", "stand", spiegelHinweis()));
      return;
    }
    if (fehler.length) {
      pStatus.append(el("div", null, `⚠ ${fehler.length} Abweichung(en):`));
      for (const f of fehler) {
        pStatus.append(befundZeile(f, pruefen));
      }
      // Die Anweisung MUSS der PC-Weg sein (Tobias 07.09., v93): "↻ Book
      // aktualisieren" stand hier bis v92 - der Knopf ist fuer genau diese
      // Marken aber nie erreichbar. Er wird nur zwischen Stufe 1 und 2
      // angeboten, Book und App driften jedoch erst DANACH auseinander.
      pStatus.append(el("div", "stand",
        "Das Book hält meist den älteren Stand. Im Word korrigieren, dann " +
        "am PC nachziehen (ziehe_books_nach.py)."));
    }
    if (hinweise.length) {
      pStatus.append(el("div", null, `ℹ ${hinweise.length} Hinweis(e):`));
      for (const h of hinweise) {
        pStatus.append(befundZeile(h, pruefen));
      }
      pStatus.append(el("div", "stand",
        "Kein Fehler — nur Marken, die liegengeblieben sein könnten."));
    }
    pStatus.append(el("div", "stand", spiegelHinweis()));
  };
  pKnopf.onclick = pruefen;
  pZeile.append(pKnopf);
  wrap.append(abschnitt("Daten prüfen", pStatus, pZeile));

  // Datenbank- und Brand-Books-Pfad: seit v86 wird der Pfad NICHT mehr
  // getippt, sondern durchgeklickt (Tobias 06.09.). Beide Abschnitte
  // kommen aus derselben Funktion - zwei Bedienungen fuer dieselbe Sache
  // waeren Unsinn, und der halbe Abschnitt war ohnehin schon doppelt.
  wrap.append(pfadAbschnitt("Pfad Datenbank",
    "datenPfad", DATEN_BASIS_STD, datenBasis, pruefeCockpit,
    "Hier liegen die Daten fürs Dashboard (snapshot.json) und der " +
    "Arbeitsstand. Die Sicherungen wohnen seit v105 im eigenen Ordner " +
    "darunter. Der Ordner muss existieren — die App legt ihn nicht an. " +
    "„Standard“ setzt zurück auf " +
    DATEN_BASIS_STD + ". Gilt nur für dieses Gerät."));
  wrap.append(pfadAbschnitt("Pfad Brand-Books",
    "bookPfad", BOOK_BASIS_STD, bookBasis, pruefeBooks,
    "Der Ordner ÜBER den „A Brands“/„B Brands“-" +
    "Unterordnern — die hängt die App selbst an. In diesem Ordner " +
    "müssen auch die beiden Template-Dateien liegen. Gilt nur für " +
    "dieses Gerät."));

  // Sicherungs-Ordner (v105, Tobias 11.09.). Dritter Aufruf derselben
  // Funktion - Ordner wählen, Prüfen und Standard gibt es damit umsonst.
  wrap.append(pfadAbschnitt("Pfad Sicherungen",
    "sicherungsPfad", SICHERUNG_BASIS_STD, sicherungBasis, pruefeSicherungen,
    "Hier landen die automatischen Backups und die Kopie vor jedem " +
    "Versionswechsel. Es bleiben die " + SICHERUNGEN_MAX + " neuesten " +
    "stehen, dazu die Rückfahrkarte der laufenden Version — ältere " +
    "wandern in den OneDrive-Papierkorb. Angefasst wird dabei nur, was " +
    "die App selbst geschrieben hat. Der Ordner muss existieren — die " +
    "App legt ihn nicht an. Gilt nur für dieses Gerät."));

  // Automatisches Backup (Tobias 01.09.): datierte Kopie nach OneDrive
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
  wrap.append(abschnitt("Automatisches Backup",
    el("div", "stand", "Alle wie viel Tage sichern? (0 = aus)"),
    aFeld, aStand, el("div", "stand",
      "Legt beim Öffnen der App eine datierte Kopie im Sicherungs-Ordner " +
      "an (cockpit-datenstand-JJJJ-MM-TT.json), die du oben mit „Backup " +
      "laden“ zurückholst. Anders als „Jetzt sichern“, das immer " +
      "dieselbe Datei überschreibt. Gilt nur für dieses Gerät."),
    // Zweite, unabhaengige Sicherung (v97): eine je App-Version, egal ob
    // das taegliche Backup an ist. Sichtbar, damit ein dauerhaft
    // fehlschlagender Upload nicht still bleibt.
    el("div", "stand", versionsSicherungText()),
    el("div", "stand",
      "Zusätzlich legt die App beim ersten Start jeder neuen Version " +
      "eine Kopie an (cockpit-vor-VERSION-JJJJ-MM-TT.json) — die " +
      "Rückfahrkarte, falls ein Update schiefgeht. Läuft unabhängig " +
      "vom Wert oben.")));
  zuReitern(wrap, "reiterEinst");
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
        `Aktuell: ${((datenstand && datenstand.marken) || []).length} Marken.\n` +
        "Ersetzt den aktuellen Datenstand auf Gerät + OneDrive.\n" +
        "Der jetzige Stand wird vorher gesichert — nach OneDrive und in " +
        "den Download-Ordner.")) return;
    // Backlog 33 (gefunden 14.09. beim Durchspielen von Backlog 9): bis hier
    // war das Zurueckspielen eine Einbahnstrasse. Die einzige Pruefung war
    // Array.isArray(d.marken) - eine Datei mit LEEREM Marken-Array kam
    // anstandslos durch, auf Geraet UND OneDrive, ohne Weg zurueck.
    // Greift jemand unter Druck zur falschen von mehreren aehnlich
    // benannten Dateien, ist die Kopie hier die einzige Rueckfahrkarte.
    // BEWUSST vor dem Ersetzen und NACH dem confirm: kein Download bei
    // jedem Abbruch, aber einer bei jedem echten Zurueckspielen.
    // Gehoert die Datei ueberhaupt zu diesem Konto? (Backlog 33b)
    // Geprueft wird NUR, wenn beide Seiten es wissen:
    //   - nicht angemeldet    -> keine Vergleichsbasis, durchlassen
    //   - Datei ohne Stempel  -> vom PC-Werkzeug oder aelter als v135,
    //                            durchlassen. Ein Abbruch wuerde hier jedes
    //                            bestehende Backup entwerten.
    // Beide bekannt und verschieden: das ist der Fall, um den es geht -
    // Tobias' Testdaten in Andreas Bestand. Strukturell sieht die Datei
    // identisch aus, nur der Inhalt gehoert jemand anderem.
    const dessen = kontoFremd(d);
    if (dessen) {
      const meins = kontoKennung();
      if (!confirm("⚠ ACHTUNG — dieses Backup gehört zu einem ANDEREN " +
          "OneDrive-Konto.\n\n" +
          "Backup von:  " + (dessen.name || "unbekannt") + "\n" +
          "Angemeldet:  " + (meins.name || "unbekannt") + "\n\n" +
          "Wird es geladen, ersetzt es den kompletten Bestand dieses Kontos " +
          "durch fremde Daten — auf Gerät UND OneDrive.\n\n" +
          "Wirklich fremde Daten laden?")) {
        banner("Abgebrochen — das Backup gehört zu " +
               (dessen.name || "einem anderen Konto") + ".");
        return;
      }
      logZeile("backup-fremdes-konto",
        { von: dessen.name || dessen.id, nach: meins.name || meins.id });
    }
    // Sicherheitskopie - aber nur, wenn es etwas zu sichern GIBT.
    //
    // Zweiter Review 18.09., zwei Funde in einem Absatz:
    //
    //  1. Ohne geladenen Datenstand hat die erste Fassung ABGEBROCHEN -
    //     datenstandBackup() liefert dann false. Das ist genau der Notfall,
    //     fuer den dieser Weg existiert: frische Installation, Browserdaten
    //     geloescht. Ein Sicherheitsnetz, das die Rettung verhindert, ist
    //     keines. Ohne Bestand gibt es nichts zu verlieren - durchlassen.
    //
    //  2. Der Download-Ordner ist NICHT nachweisbar. datenstandBackup()
    //     meldete true, sobald a.click() zurueckkam - ob Android den
    //     Download wirklich angenommen hat, weiss die App nicht. Ein Gate
    //     auf einen unbeweisbaren Erfolg ist Theater. Der PUT nach OneDrive
    //     liefert dagegen ein echtes true/false.
    //
    // Deshalb: die CLOUD-Kopie ist die Bedingung, der Download laeuft
    // zusaetzlich mit. Scheitert die Cloud-Kopie, wird nicht ersetzt - ohne
    // OneDrive liefe das Zurueckspielen ohnehin nur aufs Geraet, und dann
    // steht der wiederhergestellte Stand an genau einer Stelle.
    if (datenstand) {
      const kopie = "cockpit-vor-rueckspielung-" +
        lokalIso().slice(0, 16).replace("T", "-").replace(":", "") + ".json";
      const gesichert = typeof OD !== "undefined" && await OD.graphPutLeise(
        datenBasis() + "/" + kopie + ":/content", datenstand);
      datenstandBackup("cockpit-vor-rueckspielung-"); // zusaetzlich, ungeprueft
      if (!gesichert) {
        banner("Sicherheitskopie konnte nicht in OneDrive abgelegt werden — " +
               "es wurde NICHTS ersetzt. Erst wieder verbinden.");
        return;
      }
    }
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
      zeile("Pitches / Follow-ups / Antworten: alle Einträge im Zeitraum."),
      zeile("Davon positiv: Antworten, die in den Books mit „X“ markiert sind."),
      zeile("Nach Erstkontakt: Antworten direkt auf einen Pitch, " +
            "ohne Follow-up dazwischen."),
      zeile("Antwortquote = Antworten ÷ (Pitches + Follow-ups). " +
            "Positivquote = positive ÷ alle Antworten. Beide stehen als " +
            "Prozentwert oben rechts in ihrer Kachel."),
      zeile("Kennenlerngespräche, Kooperationen und Ø Auftragswert stehen " +
            "in keinem Brand-Book — sie zeigen „—“, bis es eine Quelle " +
            "gibt. Kooperations- und Abschlussquote hängen daran."),
      titel("Bedienung"),
      zeile("Kachelblock nach links wischen → die restlichen sechs " +
            "Kennzahlen. Die Punkte darunter zeigen, wo man ist."),
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
      updateSuchKnopf(),
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

// Meldungen sammeln sich seit v119 in EINEM Container (Tobias 12.09.):
// vorher hing jedes Banner einzeln an body und trug seine Position selbst -
// zwei gleichzeitige Meldungen lagen damit exakt uebereinander, die untere
// war unlesbar. Der Stapel ist eine Flex-Spalte in der Bildschirmmitte.
// Der Container wird einmal angelegt und bleibt; leer ist er unsichtbar
// (kein Rahmen, kein Hintergrund, pointer-events: none).
function bannerStapel() {
  let s = document.getElementById("banner-stapel");
  if (!s) {
    s = el("div", "banner-stapel");
    s.id = "banner-stapel";
    document.body.append(s);
  }
  return s;
}

function banner(text) {
  const b = el("div", "banner", text);
  bannerStapel().append(b);
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
  const werte = monate().map((z) => kpiWert(z.gesamt, schluessel));
  if (werte.length < 2 || werte.some((w) => w === null)) return null;
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

function kpiKachel(gesamt, schluessel) {
  const wert = kpiWert(gesamt, schluessel);
  const kachel = el("div", "kachel" + (wert === null ? " leer" : ""));
  kachel.dataset.k = schluessel; // Anker fuer gezielten Sparkline-Tausch
  const kopf = el("div", "kachel-kopf");
  kopf.append(el("div", "titel", KACHEL_TITEL[schluessel]));
  const quoteK = KACHEL_QUOTE[schluessel];
  if (quoteK) {
    kopf.append(el("div", "quote", kpiText(quoteK, kpiWert(gesamt, quoteK))));
  }
  kachel.append(kopf, el("div", "wert", kpiText(schluessel, wert)));
  const sp = sparkline(schluessel);
  if (sp) {
    kachel.append(sp);
    kachel.classList.add("tippbar");
    kachel.onclick = () => sheetVerlauf(schluessel);
  }
  return kachel;
}

// Seiten-Punkte spiegeln nur, wo der Browser gerade steht. Bewusst KEIN
// Gesten-Handler: das Wischen macht CSS scroll-snap: mandatory, ein
// eigener Touch-Handler wuerde mit dem vertikalen Scrollen der Seite
// kollidieren (dieselbe Falle wie beim Wisch-zum-Schliessen).
function seitenPunkte(seiten) {
  const leiste = el("div", "punkte");
  // Pfeile links und rechts der Punkte (v100). Am PC laesst sich die Reihe
  // sonst gar nicht bedienen: die Scrollleiste ist ausgeblendet
  // (scrollbar-width: none), und ohne Leiste scrollt eine Maus nicht
  // waagerecht. Auf dem Handy bleibt das Wischen der Hauptweg, die Pfeile
  // stoeren dort nicht (Tobias 09.09.).
  const pfeil = (richtung, zeichen, beschriftung) => {
    const b = el("button", "seitenpfeil", zeichen);
    b.setAttribute("aria-label", beschriftung);
    b.onclick = () => seiten.scrollBy(
      { left: richtung * seiten.clientWidth, behavior: "smooth" });
    return b;
  };
  const zurueck = pfeil(-1, "‹", "Vorherige Kacheln");
  const vor = pfeil(1, "›", "Nächste Kacheln");
  // Eigene Liste statt leiste.children: dort stehen jetzt auch die Pfeile.
  const punkte = KACHEL_SEITEN.map(() => el("span", "punkt"));
  leiste.append(zurueck, ...punkte, vor);
  const setzen = () => {
    const i = Math.round(seiten.scrollLeft / Math.max(1, seiten.clientWidth));
    punkte.forEach((p, j) => p.classList.toggle("aktiv", j === i));
    zurueck.disabled = i <= 0;
    vor.disabled = i >= KACHEL_SEITEN.length - 1;
  };
  seiten.onscroll = setzen;
  setzen();
  return leiste;
}

function kpiKacheln(gesamt) {
  const seiten = el("div", "kachel-seiten");
  for (const keys of KACHEL_SEITEN) {
    const reihe = el("div", "kacheln");
    for (const schluessel of keys) reihe.append(kpiKachel(gesamt, schluessel));
    seiten.append(reihe);
  }
  const block = el("div");
  block.append(seiten, seitenPunkte(seiten));
  return block;
}

function markenKarte(m) {
  const karte = el("div", "karte" + (m.kontaktiert ? "" : " leer"));
  const kopf = el("div", "kopf");
  kopf.append(el("span", null, m.gruppe || "Sonstige"),
              el("span", null, m.kontaktiert ? "Kontaktiert" : "Nur Antwort"));
  karte.append(kopf, el("div", "titel", m.name),
    el("div", "kontext",
      `Follow-ups: ${m.followups} · Antworten: ${m.antworten} (${m.positiv} positiv) · Nach Erstkontakt: ${m.nach_erstkontakt}`),
    el("div", "fuss", `Quelle: ${m.quelle}.docx`
      + (bookGeaendert.has(m.name) ? " · ✎ in Word geändert" : "")));
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
  // Aufgeschobenen Abgleich jetzt nachholen (v95): waehrend das Sheet
  // offen war, durfte der Datenstand nicht ausgetauscht werden.
  if (abgleichNachholen) { abgleichNachholen = false; abgleichBeiRueckkehr(); }
});

// Verlaufs-Diagramm (Inline-SVG, Specs aus der dataviz-Skill): Hairline-
// Gitter in Randfarbe, saubere Y-Ticks, Wert-Label nur am Endpunkt.
// Serie je nach gewaehltem Typ (Linie/Punkte/Balken/Flaeche, siehe
// CHART_TYPEN). Antippen zeigt den naechstgelegenen Monat.
// typK: Diagrammtyp eines ANDEREN Schluessels benutzen. Das Quoten-
// Diagramm haengt bewusst am Typ seiner Kachel - eine Wahl, nicht zwei.
function verlaufsDiagramm(schluessel, readout, typK) {
  const ms = monate();
  const werte = ms.map((z) => kpiWert(z.gesamt, schluessel));
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
         ` font-size="9" fill="var(--text-leise)">${kpiText(schluessel, w)}</text>`;
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
  const typ = chartTyp(typK || schluessel);
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
       ` font-size="10" font-weight="600" fill="var(--text)">` +
       `${kpiText(schluessel, werte[letzte])}</text>` +
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
    readout.textContent =
      `${ms[i].label}: ${kpiText(schluessel, werte[i])}`;
  };
  return svg;
}

function sheetVerlauf(schluessel) {
  const wrap = el("div");
  const readout = el("div", "readout", "Diagramm antippen für Monatswerte");
  const quoteK = KACHEL_QUOTE[schluessel];
  let svg = verlaufsDiagramm(schluessel, readout);
  let qsvg = quoteK ? verlaufsDiagramm(quoteK, readout, schluessel) : null;
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
      if (qsvg) {
        const qneu = verlaufsDiagramm(quoteK, readout, schluessel);
        qsvg.replaceWith(qneu);
        qsvg = qneu;
      }
      const spark = document.querySelector(
        `.kachel[data-k="${schluessel}"] svg.spark`);
      if (spark) spark.replaceWith(sparkline(schluessel));
    };
    typZeile.append(chip);
  });
  wrap.append(readout, svg);
  if (qsvg) wrap.append(el("div", "abschnitt", KACHEL_TITEL[quoteK]), qsvg);
  wrap.append(typZeile);
  // Monatswerte zusaetzlich als Tabelle (dataviz-Skill: Tabellen-Ansicht
  // als verlaesslicher Kanal neben dem Diagramm)
  const tab = el("div", "tabelle");
  monate().forEach((z) => {
    const zeile = el("div", "zeile");
    zeile.append(el("span", "leise", z.label),
                 el("span", "num",
                    kpiText(schluessel, kpiWert(z.gesamt, schluessel))));
    if (quoteK) {
      zeile.append(el("span", "num",
                      kpiText(quoteK, kpiWert(z.gesamt, quoteK))));
    }
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
// ohneRating: die 4 Bewertungsfelder stehen im Sheet schon weiter oben -
// das Book kopiert sie nur (Tobias 31.08.: Rating entsteht im Brand
// Rating, nicht im Book -> nur einmal zeigen). Seit v84 in BEIDEN
// Brand-Sheets gesetzt; davor zeigte das Pitch-Sheet sie unter "Kontakt",
// weil das Word sie mit den Kontaktdaten in einer Tabelle fuehrt.
// Bleibt false fuer das Firmen-Sheet der UGC-Gruppe, das keinen eigenen
// Rating-Block hat.
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

function bookOeffnenZeile(quelle, m) {
  if (!quelle || typeof OD === "undefined" || !OD.konto()) return null;
  const z = el("div", "chips");
  const b = el("button", "chip", "📄 Brand-Book öffnen");
  b.onclick = () => bookOeffnen(quelle, b, m);
  z.append(b);
  return z;
}

// "02.09.2026" -> sortierbare Zahl. Unbekanntes Format ans Ende, damit
// ein kaputtes Datum die Reihenfolge nicht durcheinanderwirft.
function datumWert(d) {
  // Sucht das Datum IM Text, statt den ganzen Text als Datum zu verlangen
  // (v88, Tobias 06.09.). Der PC-Parser (ugc_core.parse_datum) kann das
  // laengst - die App war strenger, und ein Leerzeichen hinter dem Datum
  // machte das Ereignis unlesbar und damit fuer die KPI-Rechnung
  // unsichtbar. Zwei Parser mit verschiedener Toleranz sind eine stille
  // Falle: der PC liest die Zeile, die App nicht.
  // Vertraegt jetzt dasselbe wie der PC:
  //   "06.09.2026 "   Leerzeichen dahinter
  //   "06.09.2026\u00a0" geschuetztes Leerzeichen aus Word
  //   "06. 09. 2026"  Leerzeichen zwischen den Teilen
  //   "06-09-2026"    Bindestriche
  //   "06.09.26"      zweistelliges Jahr
  //   "am 06.09.2026" Text drumherum
  const t = String(d == null ? "" : d)
    .match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/);
  if (!t) return 1e12;
  const jahr = Number(t[3]) < 100 ? Number(t[3]) + 2000 : Number(t[3]);
  const monat = Number(t[2]), tag = Number(t[1]);
  // Unmoegliche Daten (31.02.) sind KEIN Datum - wie am PC, wo
  // datetime(...) dafuer ValueError wirft. Ueber ein echtes Date-Objekt
  // geprueft statt ueber tag <= 31: der Februar hat nun mal keinen 31.
  const probe = new Date(jahr, monat - 1, tag);
  if (probe.getFullYear() !== jahr || probe.getMonth() !== monat - 1
      || probe.getDate() !== tag) return 1e12;
  return jahr * 10000 + monat * 100 + tag;
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
// Ein Historien-Eintrag auf seinen Kern reduziert: Kleinschreibung, alles
// ausser Buchstaben und Ziffern weg. Damit sind "Follow Up 2", "Follow up 2"
// und "Follow-up 2" derselbe Eintrag.
// EINE Regel, zwei Verwender (v88): die Entdopplung der Anzeige
// (historieAktuell) und die Dublettensperre beim Schreiben ins Brand-Book
// (historieXml). Vorher gab es die Regel nur beim Anzeigen - deshalb stand
// derselbe Follow-up bei "Coffeecycle Hamburg" und "Nuts and Golden"
// zweimal im Book: Andrea schreibt "Follow Up", die App "Follow up".
function historieSchluessel(...teile) {
  return teile.map((x) => String(x || "").toLowerCase()
    .replace(/[^a-z0-9]/g, "")).join("|");
}

function historieAktuell(m, quelle) {
  const alle = [...((m && m.events) || []),
                ...((snap && snap.historie && snap.historie[quelle]) || [])];
  const gesehen = new Set();
  const raus = [];
  for (const e of alle) {
    const id = historieSchluessel(e.datum, e.typ, e.aktion, e.positiv);
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
  // Rating-Wechsel (v92): eigener Block, NICHT zwischen den Ereignissen.
  // Ein Rating-Wechsel ist kein Kontakt - stuende er in derselben Liste,
  // laese man ihn als Teil des Pitch-Verlaufs.
  const rTab = [];
  if ((m.ratingHistorie || []).length) {
    const t2 = el("div", "tabelle");
    for (const r of m.ratingHistorie) {
      const z = el("div", "zeile historie");
      const label = el("span");
      label.append(el("span", "punkt punkt-rating"),
        document.createTextNode(`Rating ${r.von} → ${r.nach}`));
      z.append(el("span", "num leise datum", r.datum), label);
      t2.append(z);
    }
    rTab.push(el("div", "stand", "Rating-Wechsel"), t2);
  }
  // Titel zeigt die Anzahl - so sieht man zugeklappt, ob es was zu sehen gibt
  frag.append(abschnitt("Historie", ...leer, tab, ...rTab));
  return frag;
}

function markenDetails(quelle, ohneRating, m, kontaktKnopf) {
  const frag = document.createDocumentFragment();
  const oeffnen = bookOeffnenZeile(bookName(quelle, m), m);
  if (oeffnen) frag.append(oeffnen);
  // Kerninfos aus dem Brand-Book (Name weggelassen - steht im Sheet-Titel)
  frag.append(bereichKontakt(m, quelle, ohneRating, kontaktKnopf),
              bereichHistorie(m, quelle));
  return frag;
}

// Fenster SYNCHRON oeffnen (vor dem await), sonst blockt der Popup-
// Blocker das window.open nach der Graph-Antwort. Bei mehreren Treffern
// gewinnt der erste - auf /me/drive gibt es den Namen normal nur einmal.
async function bookOeffnen(quelle, btn, m) {
  btn.disabled = true;
  const fenster = window.open("", "_blank");
  const zu = () => { if (fenster) fenster.close(); };
  const hin = (url) => {
    if (fenster) fenster.location = url;
    else window.open(url, "_blank");
  };
  // Protokoll (Backlog 2): v108 deckt die Datenstand- und Book-SCHREIBwege ab,
  // das Oeffnen in Word fehlte. Genau dort ist aber "nicht gefunden" schon
  // zweimal aufgeschlagen - v93 (Suchindex hinkt) und v95 (eigener Pfad).
  // Festgehalten wird, WELCHER der beiden Wege getragen hat: nur daran sieht
  // man spaeter, ob die Suche wieder hinterherhinkt oder der Pfad falsch ist.
  const t0 = Date.now();
  const notiz = (weg, gefunden) => logZeile("book-oeffnen",
    { marke: (m && m.name) || String(quelle), quelle: String(quelle),
      weg, gefunden, ms: Date.now() - t0 });
  try {
    // 1. Der Pfad, den die App SELBST kennt (v95). Bis v93 lief das nur
    // ueber die OneDrive-Suche - die ist indexbasiert und liefert eine
    // eben ueberschriebene Datei zeitweise nicht zurueck. Nach
    // "↻ Book aktualisieren" meldete das Oeffnen deshalb "nicht
    // gefunden", obwohl die Datei da war. Dazu: graphLeise() schluckt
    // jeden Fehler zu null, eine Drosselung sah genauso aus. Und bei
    // zwei gleichnamigen Dateien nahm die Suche einfach die erste.
    if (m && m.brandrating) {
      const t = await OD.graphLeise(bookPfad(m) + "?$select=webUrl");
      if (t && t.webUrl) {
        notiz("eigener-pfad", true);
        hin(t.webUrl); btn.disabled = false; return;
      }
    }
    // 2. Rueckfall Suche: Andreas gewachsene Books hat die App nie
    // angelegt - dort kann der Dateiname vom berechneten Pfad abweichen.
    const q = encodeURIComponent(String(quelle).replace(/'/g, "''"));
    const d = await OD.graphLeise(
      `/me/drive/root/search(q='${q}')?$select=name,webUrl,file`);
    const soll = (quelle + ".docx").toLowerCase();
    const treffer = ((d && d.value) || []).find(
      (e) => e.file && String(e.name).toLowerCase() === soll);
    if (treffer && treffer.webUrl) {
      notiz("suche", true);
      hin(treffer.webUrl);
    } else {
      notiz("suche", false);
      zu();
      banner(`„${quelle}.docx“ nicht in OneDrive gefunden.`);
    }
  } catch (_) {
    notiz("fehler", false);
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
  zuReitern(wrap, "reiterFirma");
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
    // Frisch aus dem Bestand lesen, nicht aus dem p von der Liste: nach
    // einem "Erledigt" steht der neue Termin am Datenstand, waehrend p
    // noch den Stand von vor dem Klick traegt (bis v103 tat das
    // pitchMitDatenstand).
    const q = mv && mv.pitchliste ? { ...p, ...mv.pitchliste } : p;
    wrap.append(el("div", "kontext",
      ampel(q.datum_naechste_aktion, heuteNull()).text));

    // Die vier Bewertungsfelder stehen hier, nicht unter "Kontakt"
    // (Tobias 06.09.). Sie kamen dort nur an, weil das Word sie in
    // DERSELBEN Kerninfos-Tabelle fuehrt wie Website und E-Mail - eine
    // Eigenheit der Vorlage, kein Ordnungsprinzip. Jetzt liegen sie in
    // beiden Brand-Sheets im ersten Reiter, an derselben Stelle.
    // Quelle ist das Brand Rating (mv.brandrating), genau wie im Brand-
    // Rating-Sheet - nicht der Book-Stand. Sonst zeigten die zwei Sheets
    // bei abweichendem Book verschiedene Werte fuer dieselbe Marke.
    const br = (mv && mv.brandrating) || {};
    const felder = [
      ["Status", q.status],
      ["Rating", q.rating],
      ["Brand Fit", br.brandfit],
      ["Begeisterung", br.begeisterung],
      ["Erfolgschance", br.erfolgschance],
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
    // Im Kundenauftrag gibt es KEINEN "Naechster Schritt"-Abschnitt mehr
    // (Tobias, 17.09.): die Checkliste ist dort der Terminplan, und zwei
    // Terminquellen nebeneinander waeren genau die Doppeldeutigkeit, die
    // vermieden werden soll.
    const imAuftrag = !!(mv && mv.kundenauftrag);
    wrap.append(abschnitt("Wiedervorlage", tab),
                bereichKundenauftrag(), bereichStartdatum(q),
                bereichAntwort(q));
    if (!imAuftrag) wrap.append(bereichErledigen(q));
    wrap.append(bereichAuftragsverlauf());

    // EIN Bauplan fuer beide Herkuenfte (Tobias 03.09.): ob die Brand aus
    // Andreas Word kam oder in der App entstand, sieht man am Inhalt - das
    // Sheet muss deshalb nicht anders aufgebaut sein. markenDetails deckt
    // beides ab; fehlt ein Book, sagen das die Leerzustaende.
    // ohneRating=true wie im Brand-Rating-Sheet: die vier Werte stehen
    // oben in der Wiedervorlage-Tabelle, unter "Kontakt" gehoeren nur
    // Website, Ansprechpartner, E-Mail und Social Media.
    wrap.append(markenDetails(quelleZuName(p.name), true, mv, kontaktKnopf));
    wrap.append(bereichSonstiges(mv, bau));

    if (mv && mv.erstellt) wrap.append(bereichLoeschen(mv));
    zuReitern(wrap, "reiterPitch");
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

  // Der Verlauf der Bereichswechsel - ein EIGENER Abschnitt, nicht Teil des
  // Kundenauftrags (Codex-Befund, 17.09.). Lag er darin, verschwand er beim
  // Zurueckschieben aus der Anzeige, obwohl die Daten erhalten blieben: die
  // einzige Spur, dass die Marke je im Auftrag war, war nicht mehr zu sehen.
  //
  // Absichtlich nicht in bereichHistorie() gemischt: das sind
  // Bereichswechsel, keine Kontaktereignisse. In einer gemeinsamen Liste
  // saehen sie aus wie etwas, das die KPI zaehlt.
  function bereichAuftragsverlauf() {
    const frag = document.createDocumentFragment();
    const m = datenstand ? markeZuName(p.name) : null;
    const hist = (m && m.kundenauftragHistorie) || [];
    if (!hist.length) return frag;
    for (const h of hist) {
      const zeile = el("div", "stand",
        `${h.datum} · ` +
        (h.richtung === "hinein" ? "in den Auftrag" : "zurück in die Pitchliste") +
        (h.grund ? ` — ${h.grund}` : "") +
        (h.naechsterPitch ? ` · nächster Pitch am ${deDatum(h.naechsterPitch)}` : ""));
      frag.append(zeile);
      // Archivierte Checkliste: offene Punkte bleiben offen (Codex, 17.09.).
      // Sie stehen hier, damit nachvollziehbar ist, was beim Rueckweg
      // liegengeblieben ist.
      const a = h.archiv;
      if (a && (a.checkliste || []).length) {
        const offen = a.checkliste.filter((z) => !z.erledigt);
        frag.append(el("div", "leise",
          `   archiviert: ${a.checkliste.length} Punkt(e), ` +
          `${offen.length} davon offen` +
          (a.prio ? ` · war Prio ${a.prio}` : "")));
        for (const z of offen) {
          frag.append(el("div", "leise",
            `   ☐ ${z.text}${z.datum ? " — " + deDatum(z.datum) : ""}`));
        }
      }
    }
    return abschnitt("Verlauf des Auftrags", frag);
  }

  // Der Auftrag selbst (Release 6, Schritt 20). Nur sichtbar, wenn die Marke
  // wirklich im Bereich steht - das Objekt IST der Zustand.
  //
  // Erreichbar ueber dasselbe sheetPitch() wie aus der Pitchliste: weil
  // m.pitchliste beim Verschieben stehen bleibt, braucht ein Kundenauftrag
  // kein eigenes Sheet. Alles darunter (Kontakt, Historie, Sonstiges) gilt
  // unveraendert weiter.
  function bereichKundenauftrag() {
    const frag = document.createDocumentFragment();
    const m = datenstand ? markeZuName(p.name) : null;
    if (!m || !m.kundenauftrag) return frag;
    const ka = m.kundenauftrag;
    // Verwirft die Bereinigung Zeilen, MUSS neu gezeichnet werden: sonst
    // zeigt der Bildschirm eine Zeile, die im Array nicht mehr existiert,
    // und der eingefrorene Index des Loeschknopfs trifft die falsche.
    // Reproduziert (Audit 17.09.): Text von A leeren, dann auf das X von B
    // tippen -> geloescht wurde C, ohne Rueckfrage, ohne Rueckgaengig.
    const sichern = (neuZeichnen) => {
      const weg = checklisteBereinigen(ka);
      listeVeraltet = true;
      datenstandPersistieren();
      if (weg && neuZeichnen !== false) bau();
    };

    frag.append(el("div", "stand", `Im Auftrag seit ${ka.seit || "—"}`));

    // --- Prioritaet. Nochmal auf dieselbe Stufe tippen hebt sie auf: ohne
    // das gaebe es keinen Weg zurueck nach "noch nicht eingeordnet".
    const prioZeile = el("div", "chips");
    for (const stufe of [1, 2, 3]) {
      const k = el("button",
        Number(ka.prio) === stufe ? "chip aktiv" : "chip", "Prio " + stufe);
      k.onclick = () => {
        ka.prio = Number(ka.prio) === stufe ? null : stufe;
        sichern();
        bau();
      };
      prioZeile.append(k);
    }
    frag.append(el("div", "stand", "Priorität:"), prioZeile);

    // --- Checkliste. Gespeichert wird bei onchange, NICHT bei oninput:
    // sonst schriebe jeder Tastendruck den ganzen Datenstand.
    ka.checkliste = ka.checkliste || [];
    // z && ... wie in checklisteBereinigen: ein null aus einem von Hand
    // bearbeiteten Datenstand wuerde hier werfen, bevor die Bereinigung
    // ueberhaupt laufen kann.
    frag.append(el("div", "abschnitt",
      `Checkliste (${ka.checkliste.filter((z) => z && z.erledigt).length}/` +
      `${ka.checkliste.length})`));
    ka.checkliste.forEach((z, i) => {
      const zeile = el("div", "fgruppe");
      const haken = el("input");
      haken.type = "checkbox";
      haken.checked = !!z.erledigt;
      haken.onchange = () => { z.erledigt = haken.checked; sichern(); bau(); };
      const txt = el("input", "feld");
      txt.type = "text";
      txt.value = z.text || "";
      txt.placeholder = "z. B. Vertrag unterschrieben";
      txt.onchange = () => { z.text = txt.value.trim(); sichern(); };
      const dat = el("input", "datum");
      dat.type = "date";
      dat.value = z.datum || "";
      dat.onchange = () => { z.datum = dat.value; sichern(); };
      // Keine Anlege-Funktion ohne Loesch-Funktion (Regel aus v96): eine
      // vertippte Zeile bliebe sonst fuer immer stehen.
      const weg = el("button", "chip", "✕");
      weg.onclick = () => {
        if (z.text && !confirm(`Zeile „${z.text}“ entfernen?`)) return;
        // Ueber die IDENTITAET loeschen, nicht ueber den Index aus dem
        // forEach: zwischen Zeichnen und Klick kann checklisteBereinigen()
        // das Array verkuerzt haben.
        const stelle = ka.checkliste.indexOf(z);
        if (stelle >= 0) ka.checkliste.splice(stelle, 1);
        sichern(false);
        bau();
      };
      const kopf = el("div", "chips");
      kopf.append(haken, weg);
      zeile.append(kopf, txt, dat);
      frag.append(zeile);
    });
    const plusZeile = el("div", "chips");
    const plus = el("button", "chip", "+ Zeile");
    plus.onclick = () => {
      // Bewusst ohne sichern(): checklisteBereinigen() wuerde die leere
      // Zeile im selben Atemzug wieder wegwerfen. Sie wird gespeichert,
      // sobald Text drinsteht (txt.onchange).
      ka.checkliste.push({ text: "", datum: "", erledigt: false });
      bau();
    };
    plusZeile.append(plus);
    frag.append(plusZeile);

    // --- Rueckweg. Der Grund ist Pflicht (Workflow): in vier Wochen ist
    // sonst nicht mehr nachvollziehbar, warum die Marke wieder in der
    // Kadenz steht. Speichern bleibt inaktiv, solange nichts dasteht.
    const zKnopf = el("button", "chip", "↩ Zurück in die Pitchliste");
    const zForm = el("div", "fgruppe");
    zForm.style.display = "none";
    const zGrund = el("input", "feld");
    zGrund.type = "text";
    zGrund.placeholder = "Warum? (Pflichtangabe)";
    // Pflicht-Datum (Tobias, 17.09.): ohne gewaehlten Termin war jede
    // zurueckgeschobene Marke sofort faellig, auch wenn gerade nichts zu tun
    // war. Sichtbar vorbelegt mit heute - damit ist es kein stiller
    // Standard mehr, sondern eine Angabe, die Andrea sieht und aendert.
    const zDatum = el("input", "datum");
    zDatum.type = "date";
    zDatum.value = isoInTagen(0);
    // Dasselbe Muster wie im Termin-Dialog: die Zahl schreibt ins Datumsfeld,
    // damit es nur EINE Quelle gibt und keine Vorrangregel braucht.
    const zPlus = el("input", "tage");
    zPlus.type = "number";
    zPlus.min = "1";
    zPlus.inputMode = "numeric";
    zPlus.placeholder = "z. B. 90";
    zPlus.oninput = () => {
      const t = parseInt(zPlus.value, 10);
      if (t > 0) zDatum.value = isoInTagen(t);
    };
    const zOk = el("button", "chip aktiv", "Zurückschieben");
    zOk.disabled = true;
    const zPruefen = () => {
      zOk.disabled = !zGrund.value.trim() || !zDatum.value;
    };
    zGrund.oninput = zPruefen;
    zDatum.onchange = zPruefen;
    zOk.onclick = () => {
      const grund = zGrund.value.trim();
      if (!grund || !zDatum.value) return;
      // Offene Punkte ausdruecklich nennen (Codex, 17.09.): muessen sie
      // weiter verfolgt werden, ist das Beenden des Auftrags fachlich noch
      // nicht passend. Andrea soll das sehen, bevor sie bestaetigt.
      const offen = (ka.checkliste || []).filter((z) => z && !z.erledigt);
      if (!confirm(`„${m.name}“ zurück in die Pitchliste?\n\n` +
          (offen.length
            ? `ACHTUNG: ${offen.length} Punkt(e) der Checkliste sind noch ` +
              `offen:\n` +
              offen.slice(0, 5).map((z) => "  · " + (z.text || "(ohne Text)"))
                .join("\n") +
              (offen.length > 5 ? `\n  · … und ${offen.length - 5} weitere` : "") +
              "\n\n"
            : "") +
          "Die Marke startet wieder bei Pitch, der Follow-up-Zähler wird " +
          `zurückgesetzt, nächster Pitch am ${deDatum(zDatum.value)}.\n` +
          "Checkliste und Priorität werden im Verlauf archiviert.")) return;
      if (!kundenauftragZurueck(m, grund, lokalIso(), zDatum.value)) {
        banner("Das ging nicht — bitte die Liste einmal neu laden.");
        return;
      }
      banner("Zurück in der Pitchliste.");
      bau();
    };
    zKnopf.onclick = () => {
      zForm.style.display = zForm.style.display === "none" ? "" : "none";
    };
    const zZeile = el("div", "chips unter-feld");
    zZeile.append(zOk);
    zForm.append(el("div", "stand", "Grund für den Rückweg:"), zGrund,
      el("div", "stand", "Nächster Pitch am:"), zDatum,
      el("div", "stand", "… oder ab heute in Tagen:"), zPlus,
      zZeile);
    const zAussen = el("div", "chips");
    zAussen.append(zKnopf);
    frag.append(zAussen, zForm);

    return abschnitt("Kundenauftrag", frag);
  }

  // Antwort eintragen (Release 4, Baustein 1). Erscheint erst, wenn die
  // Marke ueberhaupt kontaktiert wurde - vorher gibt es nichts zu
  // beantworten, und ein Knopf ohne Anlass ist eine Einladung zum Fehlklick
  // (dieselbe Ueberlegung wie beim Startdatum-Abschnitt darueber).
  function bereichAntwort(q) {
    const frag = document.createDocumentFragment();
    const m = datenstand ? markeZuName(p.name) : null;
    if (!m || !m.pitchliste || !q.letzter_kontakt) return frag;
    // Im Kundenauftrag wird nicht geantwortet (Tobias, 17.09.): eine Antwort
    // ist ein Vorgang der Pitchliste. Statt des Formulars steht hier der
    // Verweis auf den einzigen richtigen Weg - sonst haette die Nutzerin
    // zwei Wege zurueck, und nur einer davon fuehrt Buch.
    if (m.kundenauftrag) {
      frag.append(el("div", "stand",
        "Diese Marke steht im Kundenauftrag — hier wird keine Antwort mehr " +
        "eingetragen. Soll sie zurück in die Kadenz, führt der Weg über " +
        "„↩ Zurück in die Pitchliste“ im Abschnitt „Kundenauftrag“; dort " +
        "wird auch der Grund festgehalten."));
      return abschnitt("Antwort eintragen", frag);
    }

    // Zwei Chips statt <input type="radio">: die App hat fuer "chip aktiv"
    // schon eine Darstellung, ein Radio braeuchte neues CSS.
    let positiv = true;
    const kPos = el("button", "chip aktiv", "positiv");
    const kNeg = el("button", "chip", "negativ");
    const setzen = (wert) => {
      positiv = wert;
      kPos.className = wert ? "chip aktiv" : "chip";
      kNeg.className = wert ? "chip" : "chip aktiv";
    };
    kPos.onclick = () => setzen(true);
    kNeg.onclick = () => setzen(false);
    const wahl = el("div", "chips");
    wahl.append(kPos, kNeg);

    // Das Datum ist der LETZTE KONTAKT, nicht der naechste Termin (Andrea,
    // 16.09., rot auf dem Blatt). Die Antwort IST ein Kontaktereignis; die
    // Wiedervorlage setzt sie danach getrennt ueber "Termin aendern".
    const d = el("input", "datum");
    d.type = "date";
    d.value = isoInTagen(0);

    const bem = el("input", "feld");
    bem.type = "text";
    bem.placeholder = "kurzer Satz — der ausführliche Text gehört ins Book";

    const ok = el("button", "chip aktiv", "Antwort eintragen");
    ok.onclick = () => {
      if (!d.value) { banner("Bitte ein Datum wählen."); return; }
      const datumDe = deDatum(d.value);
      // Steht fuer diesen Tag schon eine Antwort, ist das eine KORREKTUR -
      // Ereignis und Book-Zeile werden ersetzt, nicht verdoppelt
      // (Tobias, 17.09.). Andrea soll das vorher wissen.
      const alt = (m.events || []).find(
        (e) => e && e.typ === "Antwort" && e.datum === datumDe);
      if (!confirm((alt
            ? `Für den ${datumDe} ist schon eine Antwort eingetragen ` +
              `(${alt.positiv ? "positiv" : "negativ"}).\n` +
              "Sie wird ERSETZT — auch im Brand-Book.\n\n"
            : "") +
          `Antwort als ${positiv ? "positiv" : "negativ"} eintragen, ` +
          `datiert auf den ${datumDe}?\n\n` +
          (positiv
            ? "Die Kadenz wird danach gestoppt: es wird nichts mehr von " +
              "allein fällig."
            : "Die Marke springt danach zurück auf Pitch."))) return;
      antwortEintragen(m, d.value, positiv, bem.value.trim(), lokalIso());
      bau();
    };
    const zeile = el("div", "chips");
    zeile.append(ok);

    frag.append(
      el("div", "stand", "Antwort:"), wahl,
      el("div", "stand", "Datum der Antwort (= letzter Kontakt):"), d,
      el("div", "stand", "Bemerkung (optional):"), bem,
      zeile);
    // 1:1 wiederverwendet, kein neuer Code fuer den Book-Knopf. Er steht
    // hier, weil die ausfuehrliche Notiz weiter ins Word gehoert - er
    // ersetzt das Bemerkungsfeld nicht (Tobias, 16.09.).
    const bz = bookOeffnenZeile(quelleZuName(p.name), m);
    if (bz) frag.append(bz);

    // "in Kundenauftraege verschieben" (Release 6, Schritt 17). Der Knopf
    // bleibt AUCH ohne Zusage sichtbar, nur ausgegraut und mit Begruendung
    // daneben - ein Knopf, der einfach fehlt, sieht aus wie eine fehlende
    // Funktion. Die eigentliche Sperre sitzt in kundenauftragVerschieben();
    // hier steht nur die Anzeige davon.
    // Der Fall "steht schon im Auftrag" ist oben abgefangen und kommt hier
    // nicht mehr an.
    {
      const kaZeile = el("div", "chips");
      // Dieselbe Funktion, die auch das Verschieben selbst absichert -
      // nicht eine zweite Abfrage von q.positivBeantwortet (Fall 27/29).
      const erlaubt = verschiebenErlaubt(m);
      const kaKnopf = el("button", erlaubt ? "chip aktiv" : "chip",
        "→ in Kundenaufträge verschieben");
      if (!erlaubt) {
        kaKnopf.disabled = true;
      } else {
        kaKnopf.onclick = () => {
          if (!confirm(`„${m.name}“ in die Kundenaufträge verschieben?\n\n` +
              "Die Marke verschwindet aus der Pitchliste. Die Pitchdaten " +
              "bleiben erhalten — zurückschieben geht jederzeit.")) return;
          if (!kundenauftragVerschieben(m, lokalIso())) {
            banner("Das ging nicht — bitte die Liste einmal neu laden.");
            return;
          }
          banner("In die Kundenaufträge verschoben.");
          bau();
        };
      }
      kaZeile.append(kaKnopf);
      frag.append(kaZeile);
      if (!erlaubt) {
        frag.append(el("div", "stand",
          "Erst nach einer positiv eingetragenen Antwort — der Auftrag " +
          "entsteht aus der Zusage, nicht aus dem Knopf."));
      }
    }
    return abschnitt("Antwort eintragen", frag);
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
    // Nach einer positiven Antwort ist die Kadenz still (Tobias, 16.09.):
    // kein Erledigt-Knopf, kein "Danach: ...", kein Herkunftsfeld. OHNE das
    // meldete die App weiter "Follow up 2 fällig", obwohl von allein nichts
    // mehr fällig werden darf - und ein Klick erzeugte ein Ereignis, das dem
    // Flag widerspricht. "Termin ändern" bleibt absichtlich benutzbar: eine
    // Zusage heißt nicht, dass es nichts mehr zu terminieren gibt.
    // A1 (Tobias, 17.09.): Hat Andrea sich nach der Zusage ueber "Termin
    // aendern" eine Wiedervorlage gesetzt (termin_hand), bekommt sie den
    // Erledigt-Knopf zurueck - sonst stuende die Marke rot und ueberfaellig
    // in der Liste, ohne dass sie sie abraeumen koennte.
    // Die automatische Kadenz bleibt trotzdem still: erledigen() leert die
    // Terminfelder bei gesetztem Flag gleich wieder (siehe dort).
    const gestoppt = !!q.positivBeantwortet && !q.termin_hand;
    const s = naechsterSchritt(q.naechste_aktion, fuSeitPitch(m));
    const standard = (m.intervalle || {})[s.key] || KADENZ_STD[s.key];
    const tage = el("input", "tage");
    tage.type = "number";
    tage.min = "1";
    tage.inputMode = "numeric";
    tage.value = String(standard);
    const dTage = () => parseInt(tage.value, 10) || standard;
    const danach = el("div", "stand");
    // Das Datumsfeld "Einmalig auf ein Datum legen" (v95) ist mit v117 weg
    // (Tobias 12.09., Andrea benutzte es nicht). Es war KEIN Datums-Setzer,
    // sondern ein Zusatz zum Erledigt-Klick: allein geaendert passierte
    // nichts, es gab keinen Speichern-Knopf und keine Rueckmeldung. Genau
    // so hat Tobias es missverstanden - ein stiller Nicht-Effekt.
    // Denselben Zweck erfuellt "✎ Termin ändern" (v113) vollstaendig, mit
    // eigenem Speichern-Knopf UND termin_hand-Kennzeichen.
    const dText = () => {
      danach.textContent =
        `Danach: ${s.naechste} am ${deDatum(isoInTagen(dTage()))}`;
    };
    tage.oninput = dText;
    dText();
    const abstand = el("div", "stand");
    abstand.append("Abstand: ", tage, " Tage — änderbar, gilt dann künftig ",
      "für diese Marke.");
    // Herkunft nur beim Pitch (v90): bei einem Follow-up ist die Aktion
    // durchnummeriert, da gibt es nichts zu erklaeren.
    let herkunft = null;
    if (!gestoppt && s.typ === "Pitch") {
      herkunft = el("input", "feld");
      herkunft.type = "text";
      herkunft.placeholder = "z. B. über Bewerberformular auf der Homepage";
      const liste = pitchHerkuenfte();
      if (liste.length) {
        const dl = el("datalist");
        dl.id = "vs-pitchherkunft";
        for (const v of liste) {
          const o = el("option");
          o.value = v;
          dl.append(o);
        }
        herkunft.setAttribute("list", dl.id);
        frag.append(dl);
      }
      frag.append(el("div", "stand",
        "Woher kam der Pitch? (optional — steht so im Brand-Book)"), herkunft);
    }
    // Der Text, der im Book und im Datenstand landet.
    const aktionText = () => {
      const h = herkunft ? herkunft.value.trim() : "";
      return h ? `${s.aktion} — ${h}` : s.aktion;
    };
    const zeile = el("div", "chips");
    const ok = el("button", "chip aktiv", `✓ ${s.aktion} erledigt`);
    ok.onclick = () => {
      if (herkunft && herkunftUnzulaessig(herkunft.value)) {
        banner("Das Wort „Follow“ darf nicht in die Herkunft — der Eintrag " +
          "würde beim nächsten Import als Follow-up gezählt statt als Pitch.");
        return;
      }
      const text = aktionText();
      // Warnung bei fehlendem Startdatum (v119, Tobias 12.09.): Kommt eine
      // Brand frisch aus dem Brand Rating, steht sie OHNE Termin in der
      // Pitchliste - der Erledigt-Knopf ist trotzdem schon sichtbar.
      // Die Daten bleiben stimmig (der Pitch wird auf HEUTE datiert, was
      // richtig ist, wenn die Mail heute rausging). Der Schaden bei einem
      // Fehlklick ist eine VERFRUEHTE WAHRHEIT: "Pitch am ... versendet"
      // steht dann in den Daten UND im Word-Book, ohne dass eine Mail
      // rausging. Deshalb hier nennen statt den Knopf auszublenden -
      // Ausblenden haette Andrea gezwungen, vor einem Pitch am selben Tag
      // erst ein Startdatum "heute" zu setzen (Pflichtklick ohne Nutzen).
      const ohneStart = !q.datum_naechste_aktion && !q.letzter_kontakt;
      if (!confirm((ohneStart
            ? "Für diese Brand ist noch KEIN Startdatum gesetzt.\n" +
              `„${text}“ wird auf HEUTE (${deDatum(isoInTagen(0))}) datiert ` +
              "und auch so ins Brand-Book geschrieben.\n\n"
            : "") +
          `${text} als erledigt eintragen?\n` +
          `Nächster Schritt: ${s.naechste} am ${deDatum(isoInTagen(dTage()))}`)) return;
      // s bleibt unangetastet - nur die Aktions-Beschriftung wird ersetzt.
      // typ/status/naechste/zaehlt kommen weiter aus naechsterSchritt(),
      // damit die Herkunft NUR Text ist und keine Logik verschiebt.
      erledigen(m, { ...s, aktion: text }, dTage(), standard);
      bau();
    };
    if (gestoppt) {
      frag.append(el("div", "stand", m.kundenauftrag
        ? "Kadenz gestoppt — die Marke steht im Kundenauftrag. Zurück in " +
          "die Kadenz geht es über „↩ Zurück in die Pitchliste“ im " +
          "Abschnitt „Kundenauftrag“."
        : "Kadenz gestoppt — positiv beantwortet. Von allein wird nichts " +
          "mehr fällig. Zurücknehmen lässt sich das über „Antwort " +
          "eintragen“ mit „negativ“ für denselben Tag."));
    } else {
      zeile.append(ok);
    }

    // Zweiter Knopf DIREKT darunter (v113): Termin und naechsten Schritt
    // aendern, OHNE etwas abzuhaken. Andrea am 09.09.: "der Kunde meldet
    // sich erst nach seinem Urlaub".
    const tKnopf = el("button", "chip", "✎ Termin ändern");
    const tForm = el("div", "fgruppe");
    tForm.style.display = "none";
    // Freitext mit Vorschlagsliste statt fester Auswahl (Tobias 12.09.):
    // Andrea soll auch etwas eintragen koennen, das die Kadenz nicht kennt -
    // "Angebot nachfassen", "Muster verschickt". Gleicher Bauplan wie das
    // Herkunftsfeld beim Pitch: datalist schlaegt vor, verbietet aber nichts.
    // q, NICHT p (v129, von Tobias am 16.09. gefunden). `p` ist die
    // Pitchlisten-Zeile, mit der sheetPitch() EINMAL aufgerufen wurde -
    // sie friert den Stand beim Oeffnen des Sheets ein. `q` mischt bei
    // jedem bau() den Datenstand darueber und ist damit der aktuelle Wert.
    //
    // Der Fehler war doppelt sichtbar: das Feld zeigte nach dem Speichern
    // wieder den ALTEN Termin, und der Vergleich weiter unten pruefte
    // gegen denselben alten Wert - wer den urspruenglichen Termin wieder
    // eintrug, bekam "Nichts geändert" und kam nicht mehr zurueck.
    const tAktion = el("input", "feld");
    tAktion.type = "text";
    tAktion.value = q.naechste_aktion || "";
    tAktion.placeholder = "z. B. Follow up, Neuer Pitch, Angebot nachfassen";
    const tListe = el("datalist");
    tListe.id = "vs-naechsterschritt";
    // Creatorpool und Rueckantworten pruefen dazu (Release 5). Beide sind
    // in naechsterSchritt() bereits eigene Zweige (Release 2) - bis hier
    // waren sie nur nicht eintippbar, ausser als Freitext auf gut Glueck.
    // Schreibweise WORTGLEICH zur Erkennung dort, sonst faellt der Eintrag
    // in den Pitch-Zweig zurueck.
    for (const v of ["Pitch", "Follow up", "Neuer Pitch", "Creatorpool",
                     "Rückantworten prüfen"]) {
      const o = el("option");
      o.value = v;
      tListe.append(o);
    }
    tAktion.setAttribute("list", tListe.id);
    const tDatum = el("input", "datum");
    tDatum.type = "date";
    tDatum.value = q.datum_naechste_aktion || "";
    // "+ X Tage" (Andrea, 16.09.): rechnet AB HEUTE und schreibt das
    // Ergebnis sofort ins Datumsfeld. Damit gibt es keine zwei Wahrheiten
    // und keine Vorrangregel - gespeichert wird weiterhin nur tDatum.
    // Bewusst ohne Vorschauzeile und ohne Rueckrechnung vom Datum auf die
    // Tage (Bauplan Schritt 15: eine Begruendung ist noch kein Beduerfnis).
    const tPlus = el("input", "tage");
    tPlus.type = "number";
    tPlus.min = "1";
    tPlus.inputMode = "numeric";
    tPlus.placeholder = "z. B. 14";
    tPlus.oninput = () => {
      const n = parseInt(tPlus.value, 10);
      if (n > 0) tDatum.value = isoInTagen(n);
    };
    const tSpeichern = el("button", "chip aktiv", "Speichern");
    tSpeichern.onclick = () => {
      const a = tAktion.value.trim();
      const d = tDatum.value;
      // Nur weitergeben, was sich wirklich unterscheidet - sonst stempelt
      // jedes Oeffnen des Dialogs den Eintrag neu.
      const aNeu = a && a !== (q.naechste_aktion || "") ? a : "";
      const dNeu = d && d !== (q.datum_naechste_aktion || "") ? d : "";
      if (!aNeu && !dNeu) { banner("Nichts geändert."); return; }
      if (!terminSetzenDaten(m, aNeu, dNeu, lokalIso())) {
        banner("Diese Marke steht nicht in der Pitchliste."); return;
      }
      datenstandPersistieren();
      banner("Termin übernommen — die Kadenz bleibt unverändert.");
      bau();
    };
    tKnopf.onclick = () => {
      tForm.style.display = tForm.style.display === "none" ? "" : "none";
    };
    // el(tag, klasse, TEXT) - das dritte Argument wird als textContent
    // gesetzt. Ein Element dort landet als "[object HTMLButtonElement]" in
    // der Anzeige (12.09. genau so passiert). Kinder gehoeren an append().
    const tZeile = el("div", "chips unter-feld");
    tZeile.append(tSpeichern);
    tForm.append(
      el("div", "stand", "Nächster Schritt:"), tAktion, tListe,
      el("div", "stand", "Termin:"), tDatum,
      el("div", "stand", "… oder ab heute in Tagen:"), tPlus,
      tZeile,
      el("div", "stand",
        "Gilt einmalig. Der Abstand für die folgenden Termine bleibt, wie " +
        "er ist — und dieser Termin wird als „von Hand gesetzt“ vermerkt, " +
        "damit ihn keine Nachrechnung überschreibt."));
    zeile.append(tKnopf);
    frag.append(zeile, tForm);
    if (!gestoppt) frag.append(abstand, danach);
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

// Gegenstueck zu isoInTagen (v95): wie viele Tage liegen zwischen heute
// und einem ISO-Datum? Fuer das Datumsfeld im Erledigen-Bereich, das die
// Tage-Rechnerei ersetzt. Ueber Mitternacht der LOKALEN Zeit gerechnet -
// mit UTC-Millisekunden kaeme je nach Uhrzeit ein Tag zu viel oder zu
// wenig heraus. Rueckgabe null, wenn nichts Brauchbares dasteht.
// ACHTUNG: new Date(2026, 12, 99) wirft NICHT, sondern rollt still ins
// naechste Jahr weiter. Ohne die Rundlauf-Pruefung unten haette ein
// unsinniges Datum klaglos einen Termin ergeben - ein stiller Fehlschlag,
// der wie Erfolg aussieht. Deshalb: zurueckrechnen und vergleichen.
// ponytail: seit v117 ohne Aufrufer - der einzige war datum.onchange im
// ausgebauten Feld "Einmalig auf ein Datum legen". Bleibt stehen, weil zwei
// Tests darauf zeigen (test_kadenz + Invariante 5 im Waechter) und ein
// Ausbau hiesse, den Waechter zu beschneiden. Loeschen, sobald jemand den
// Waechter sowieso anfasst - oder wiederverwenden: pitchNachrechnen()
// braucht genau diese Datumsarithmetik.
function tageBis(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  const [j, mo, t] = String(iso).split("-").map(Number);
  const ziel = new Date(j, mo - 1, t);
  if (isNaN(ziel.getTime()) || ziel.getFullYear() !== j ||
      ziel.getMonth() !== mo - 1 || ziel.getDate() !== t) return null;
  return Math.round((ziel - heuteNull()) / 86400000);
}

function deDatum(iso) { return String(iso).split("-").reverse().join("."); }

// Namens-Schlüssel wie _schluessel in Python: nur Buchstaben/Ziffern.
// Umlaute gefaltet - sonst ist "MyMüsli" (Book) eine andere Marke als
// "myMuesli" (Excel). Muss mit _schluessel in datenstand.py identisch bleiben.
function schluessel(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function markeZuName(name) {
  const s = schluessel(name);
  return (datenstand.marken || []).find((m) => schluessel(m.name) === s) || null;
}

// Die Pitchliste kommt seit v104 ausschliesslich aus dem Datenbestand.
//
// Bis v103 war der Snapshot die Grundlage, und der Datenstand legte sich
// nur dort darüber, wo die App selbst etwas geändert hatte. Die
// Snapshot-Zeilen stammen aber aus dem Blatt "Pitchliste" der
// Brand-Übersicht — einer Excel, die Andrea seit Monaten nicht mehr
// pflegt. Am 10.09. setzte ein Snapshot-Neubau `snap.erzeugt` neuer als
// jedes `geaendert` im Datenstand und verdeckte damit auf einen Schlag
// 48 Einträge: zehn Marken standen als "überfällig" da, obwohl ihr
// Word-Dokument stimmte (Calibar 07.09./Pitch statt 13.09./Follow up).
//
// Nachgemessen am echten Bestand vom 11.09., bevor der Schnitt kam:
// 52 Pitchzeilen im Datenstand gegen 47 in der Excel, und **keine
// einzige**, die es nur in der Excel gab. Der Datenstand ist eine echte
// Obermenge — beim Kappen geht keine Marke verloren.
//
// export_snapshot.py liest das Blatt seit v104 nicht mehr; die Excel ist
// damit reine Ausgabe (Tobias 10.09.: "Die Excel soll komplett raus. Das
// einzige was wir machen ist ein Export, aber die Daten kommen aus dem
// Datenbestand.").
function pitchlisteAktuell() {
  const liste = (datenstand ? datenstand.marken || [] : [])
    .filter((m) => m.pitchliste)
    .map((m) => ({ name: m.name, ...m.pitchliste }));
  // D-Brands = inaktiv/Archiv bei Andrea (Tobias 01.09.): erscheinen nie
  // in der Pitchliste - egal ob das D aus Andreas Altbestand stammt oder
  // per Rating-Edit in der App gesetzt wurde.
  const istD = (p) => {
    if (String(p.rating || "").trim().toUpperCase() === "D") return true;
    const m = datenstand && markeZuName(p.name);
    return Boolean(m && m.brandrating &&
      String(m.brandrating.rating || "").trim().toUpperCase() === "D");
  };
  // Marken im Kundenauftrag verschwinden aus der Pitchliste (Release 6).
  // EXAKT dasselbe Muster wie istD: gefiltert wird die ANSICHT, die Daten
  // bleiben unangetastet. Deshalb ist der Rueckweg geschenkt.
  const imAuftrag = (p) => {
    const m = datenstand && markeZuName(p.name);
    return Boolean(m && m.kundenauftrag);
  };
  return liste.filter((p) => !istD(p) && !imAuftrag(p));
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

// `alsAuftrag`: dieselbe Karte, andere Quelle (Tobias, 17.09.).
//
// In der Pitchliste kommen Schritt und Termin aus der Kadenz
// (naechste_aktion / datum_naechste_aktion), im Kundenauftrag aus der
// CHECKLISTE - und statt der Follow-ups steht dort die Prio. Follow-ups
// sagen im Auftrag nichts mehr: die Kadenz liegt still, die Zahl ist nur
// noch Vorgeschichte.
//
// Ein Parameter statt einer zweiten Kartenfunktion: die Karte ist sonst
// identisch, und zwei Fassungen waeren die Stelle, an der in sechs Monaten
// die eine gepflegt wird und die andere nicht.
function pitchKarte(p, alsAuftrag) {
  const karte = el("div", "karte ampel-" + p.klasse);
  const kopf = el("div", "kopf");
  kopf.append(el("span", "pill", p.kategorie || "—"),
              el("span", null, p.rating ? "Rating " + p.rating : ""));
  const quelle = alsAuftrag ? p.naechsterTermin : p.datum_naechste_aktion;
  const datum = quelle ? deDatum(quelle) : null;
  const kontext = alsAuftrag
    ? `${p.status || "—"} · ${p.prio ? "Prio " + p.prio : "ohne Prio"}` +
      (p.naechsterCheckText
        ? ` · Nächster Schritt: ${p.naechsterCheckText}` : "") +
      (p.kooperation ? ` · Kooperation: ${p.kooperation}` : "")
    : `${p.status || "—"} · Follow-ups: ${p.zaehler || "0"}` +
      (p.naechste_aktion ? ` · Nächster Schritt: ${p.naechste_aktion}` : "") +
      (p.kooperation ? ` · Kooperation: ${p.kooperation}` : "");
  // Ohne offenen Punkt mit Datum ist nichts mehr zu tun - das sagt die Karte
  // ausdruecklich, statt "kein Termin eingetragen" zu behaupten (Tobias).
  const fuss = alsAuftrag && !datum
    ? "Alle Punkte erledigt"
    : (datum ? `${datum} — ${p.text}` : p.text);
  karte.append(kopf, el("div", "titel", p.name),
    el("div", "kontext", kontext),
    el("div", "fuss", fuss));
  karte.classList.add("tippbar");
  karte.onclick = () => sheetPitch(p);
  return karte;
}

// Laufende Anzeigen + Werbebudget einer Marke. Steht als EINE Zelle
// ("2 (350)") im Brand Rating, nicht in der Pitchliste - deshalb ueber den
// Namen aus dem Datenstand geholt. Der Spaltenname wird tolerant gesucht,
// wie in extraSpalten(). Was nicht als Zahl lesbar ist ("keine Anzeigen")
// zaehlt als 0.
function adWerte(name) {
  const m = datenstand ? markeZuName(name) : null;
  const br = (m && m.brandrating) || {};
  const key = Object.keys(br).find((k) => k.toLowerCase().includes("paid ad"))
    || PAID_AD;
  const [anzeigen, budget] = paidAdTeile(br[key]);
  return { anzeigen: Number(anzeigen) || 0, budget: Number(budget) || 0 };
}

// Filterzustand der Pitchliste - bleibt beim Navigieren erhalten (wie zi).
// faellig: "" = alle, sonst max. Rest-Tage (ueberfaellig zaehlt immer mit).
const pf = { faellig: "", rating: [], kategorie: "", ad: "", budget: "",
             suche: "", sortierung: "" };

// Passt ein Pitchlisten-Eintrag zu den gerade gesetzten Filtern? `s` ist
// der kleingeschriebene Suchtext. Steht bewusst AUSSERHALB von
// renderPitchliste: eine Bedingung, die in einer Closure eingesperrt ist,
// kann test_v98.js nur nachbauen - und ein Test, der eine Kopie prueft,
// merkt nichts, wenn sich das Original aendert.
function pitchPasst(p, s) {
  return (pf.faellig === "" || (p.tage !== null && p.tage <= pf.faellig)) &&
    (!pf.rating.length || pf.rating.includes(p.rating)) &&
    (!pf.kategorie || p.kategorie === pf.kategorie) &&
    // ZWEI getrennte Fragen (v111, Tobias 11.09.), vorher eine:
    //   pf.ad     - laufen gerade Anzeigen?  (Anzahl > 0)
    //   pf.budget - ist ueberhaupt Budget hinterlegt?
    // Eine Marke kann "0 (830)" haben: Budget da, gerade nichts am Laufen.
    // Bis v110 fielen diese 19 Marken unter "Ohne Anzeigen" und sahen aus
    // wie tot; fuer die Budget-Frage war nur die Sortierung zustaendig.
    (!pf.ad || (pf.ad === "mit") === (p.ad.anzeigen > 0)) &&
    (!pf.budget || (pf.budget === "mit") === (p.ad.budget > 0)) &&
    (!s || [p.name, p.status, p.naechste_aktion, p.kooperation, p.kategorie]
      .join(" ").toLowerCase().includes(s));
}

// Dasselbe fuers Brand Rating.
function brandPasst(m, s) {
  const br = m.brandrating;
  // Suche gewinnt ueber den Book-Filter (Tobias 31.08.): wer gezielt nach
  // einer Marke sucht, soll sie auch finden, wenn "Ohne Brand-Book" die
  // abgehakten gerade ausblendet (wie in der Excel).
  const hat = Boolean(String(br.rating || "").trim());
  return (!bf.rating.length || bf.rating.includes(br.rating)) &&
    (!bf.hatRating || (bf.hatRating === "mit") === hat) &&
    (!bf.book || s || (bf.book === "mit") === Boolean(br.brandbook)) &&
    (!bf.fit || symAnzahl(br.brandfit) >= bf.fit) &&
    (!bf.geist || symAnzahl(br.begeisterung) >= bf.geist) &&
    (!bf.chance || symAnzahl(br.erfolgschance) >= bf.chance) &&
    (!s || [m.name, br.status, br.kategorie, br.notizen]
      .join(" ").toLowerCase().includes(s));
}

// Eine Chip-Reihe fuer einen Filter: aktiven Chip nochmal antippen = aus.
// Zeichnet nur die Ergebnisliste neu (neuzeichnen), nie die ganze Ansicht -
// sonst springt die gescrollte Chip-Leiste zurueck an den Anfang.
function chipFilter(paare, aktiv, setzen, neuzeichnen, mehrfach) {
  const zeile = el("div", "chips");
  // `stand` ist die Wahrheit, solange das Sheet offen ist - der Aufrufer
  // bekommt sie ueber setzen(). Beim Umschalten wird `stand` immer NEU
  // zugewiesen (filter/spread), nie an Ort und Stelle veraendert - deshalb
  // reicht die Referenz und es braucht keine Schutzkopie. Der Mutations-
  // test hat genau das gezeigt: die Kopie war nicht zu Fall zu bringen.
  let stand = mehrfach ? (aktiv || []) : aktiv;
  const an = (w) => (mehrfach ? stand.includes(w) : w === stand);
  paare.forEach(([wert, label]) => {
    const chip = el("button", "chip" + (an(wert) ? " aktiv" : ""), label);
    chip.onclick = () => {
      stand = mehrfach
        ? (stand.includes(wert) ? stand.filter((w) => w !== wert)
                                : [...stand, wert])
        : (chip.classList.contains("aktiv") ? "" : wert);
      setzen(stand);
      [...zeile.children].forEach(
        (c, i) => c.classList.toggle("aktiv", an(paare[i][0])));
      neuzeichnen();
    };
    zeile.append(chip);
  });
  return zeile;
}

// Ist ein Filterwert gesetzt? Ein leeres Array ist truthy - ohne diese
// Funktion zaehlte ein unbenutzter Mehrfachfilter als "1 aktiv".
function gesetzt(w) {
  return Array.isArray(w) ? w.length > 0 : Boolean(w);
}

// Eine Filtergruppe: Titelzeile, die Chips klappen erst beim Antippen auf.
// Das Auf/Zu macht <details> selbst - kein eigener Zustand, kein Rerender.
// Der aktive Wert steht im Titel, damit man ihn auch zugeklappt sieht; eine
// Gruppe mit aktivem Filter startet aufgeklappt. Grund (Tobias 08.09.): das
// Filter-Sheet stapelte bis zu 5 Chip-Reihen OHNE Ueberschrift - mit den
// naechsten Filtern waeren es 7, und man haette raten muessen, welcher Chip
// zu welchem Thema gehoert.
function filterGruppe(titel, paare, holen, setzen, neuzeichnen, mehrfach) {
  const d = el("details", "fgruppe");
  const kopf = el("summary");
  // Titel und aktiver Wert in EIGENEN Spans, nicht als ein Text (v99):
  // sonst laesst sich der Wert nicht anders auszeichnen als die
  // Ueberschrift und die Zeile liest sich als ein einziger langer Titel.
  // Den Mittelpunkt setzt die CSS (.fwert:not(:empty)::before).
  const wertText = el("span", "fwert");
  kopf.append(el("span", null, titel), wertText);
  const label = (w) => (paare.find(([x]) => x === w) || [, w])[1];
  const beschriften = () => {
    const w = holen();
    const text = Array.isArray(w) ? w.map(label).join(", ") : label(w);
    wertText.textContent = gesetzt(w) && text ? text : "";
  };
  beschriften();
  // Alle Gruppen offen (v101, Tobias 09.09.: "immer noch normaler Text
  // in Zeilen"). v98 klappte sie zu, damit 7 Gruppen keine Wand aus
  // Chips ergeben - aber zugeklappt sieht man gar nicht, DASS da Chips
  // sind. Ueberschrift und Trennlinie ordnen sie auch offen zu; wer
  // aufraeumen will, klappt einzeln zu. Das Sheet scrollt ohnehin.
  d.open = true;
  d.append(kopf, chipFilter(paare, holen(),
    (w) => { setzen(w); beschriften(); }, neuzeichnen, mehrfach));
  return d;
}

// ---------------------------------------------------------- Sortierung
// Sortierbar nach denselben Kriterien, nach denen auch gefiltert wird
// (Tobias 01.09.). "" ist immer die Standard-Sortierung der Liste -
// der erste Chip ist damit gleichzeitig der Zuruecksetzen-Knopf.
const SORT_PITCH = [["", "Dringlichkeit"], ["name", "Name A–Z"],
                    ["rating", "Rating"], ["kategorie", "Kategorie"],
                    ["budget", "Werbebudget (hoch → niedrig)"],
                    ["budget_auf", "Werbebudget (niedrig → hoch)"]];
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
  // Kein Budget bekannt -> "" statt 0, damit diese Marken in BEIDE
  // Richtungen hinten landen (nachSchluessel sortiert Leeres immer ans
  // Ende). Sonst fuehrten die Marken ohne Budget die aufsteigende Liste an.
  if (art === "budget")
    return k.sort(nachSchluessel((p) => p.ad.budget || "", true));
  if (art === "budget_auf")
    return k.sort(nachSchluessel((p) => p.ad.budget || ""));
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
    .map((p) => ({ ...p, ...ampel(p.datum_naechste_aktion, heute),
                   ad: adWerte(p.name) }));
  if (!alle.length) {
    c.append(el("div", "leerzustand",
      "Noch keine Pitchlisten-Einträge im Datenbestand — "
      + "einmal Update (↻) drücken."));
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
    wrap.append(filterGruppe("Fällig",
      [["", "Alle"], [7, "≤ 7 Tage"], [14, "≤ 14 Tage"]],
      () => pf.faellig, (w) => { pf.faellig = w; }, zeichnen));
    const ratings =
      [...new Set(alle.map((p) => p.rating).filter(Boolean))].sort();
    if (ratings.length > 1) {
      wrap.append(filterGruppe("Rating", ratings.map((r) => [r, r]),
        () => pf.rating, (w) => { pf.rating = w; }, zeichnen, true));
    }
    const kategorien =
      [...new Set(alle.map((p) => p.kategorie).filter(Boolean))].sort();
    if (kategorien.length > 1) {
      wrap.append(filterGruppe("Kategorie", kategorien.map((k) => [k, k]),
        () => pf.kategorie, (w) => { pf.kategorie = w; }, zeichnen));
    }
    // Zwei Gruppen statt einer (v111). "Ad-Aktivität" sagte nicht, worueber
    // gefiltert wird - ausgewertet wird die ANZAHL laufender Anzeigen in der
    // Werbebibliothek. Beschriftung "Werbeanzeigen" (Tobias 12.09.), damit
    // sie mit "Werbebudget" ein Paar bildet. Das Budget ist eine eigene Frage und hat jetzt eine
    // eigene Gruppe; vorher war dafuer nur die Sortierung zustaendig.
    wrap.append(filterGruppe("Werbeanzeigen",
      [["mit", "Mit laufenden Anzeigen"], ["ohne", "Ohne Anzeigen"]],
      () => pf.ad, (w) => { pf.ad = w; }, zeichnen));
    wrap.append(filterGruppe("Werbebudget",
      [["mit", "Mit Budget"], ["ohne", "Ohne Budget"]],
      () => pf.budget, (w) => { pf.budget = w; }, zeichnen));
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
    const n = [pf.faellig, pf.rating, pf.kategorie, pf.ad, pf.budget]
      .filter(gesetzt).length;
    filterBtn.textContent = "⛭ Filter" + (n ? ` · ${n} aktiv` : "");
    filterBtn.classList.toggle("aktiv", n > 0);
    sortBtn.textContent = "⇅ " + sortLabel(SORT_PITCH, pf.sortierung);
    sortBtn.classList.toggle("aktiv", Boolean(pf.sortierung));
    const s = pf.suche.trim().toLowerCase();
    const gefiltert = alle.filter((p) => pitchPasst(p, s));
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

// ------------------------------------------------- Kundenauftraege (v132)
//
// Die Liste zeigt dieselben Karten wie die Pitchliste - pitchKarte() wird
// 1:1 wiederverwendet, und ein Tipp oeffnet dasselbe sheetPitch(). Das geht
// nur, weil m.pitchliste beim Verschieben STEHEN bleibt (Schritt 16); haetten
// wir sie ersetzt, braeuchte es hier eine zweite Kartenart und ein zweites
// Sheet.
//
// Bewusst OHNE Filter-Chips (Rating/Kategorie/Anzeigen/Budget): das sind
// Pitch-Fragen. Ein Kundenauftrag wird nach Name, Zeitpunkt oder Prioritaet
// gesucht, und die Liste ist kurz. Kommt der Bedarf, ist filterGruppe() da.
function kundenauftraegeAktuell() {
  return (datenstand ? datenstand.marken || [] : [])
    .filter((m) => m.kundenauftrag)
    .map((m) => {
      // Termin und Schritt werden ABGELEITET, nicht nach m.pitchliste
      // zurueckgeschrieben. Zwei Quellen fuer denselben Termin synchron zu
      // halten waere ein Zustand mehr, der auseinanderlaufen kann.
      const cp = naechsterCheckpunkt(m.kundenauftrag);
      return { name: m.name, ...m.pitchliste, ...m.kundenauftrag,
               naechsterTermin: cp ? cp.datum : "",
               naechsterCheckText: cp ? cp.text : "" };
    });
}

// EIGENER Filterzustand, nicht der `pf` der Pitchliste. Genau diese
// geteilte Variable hat am 17.09. die Auftragsliste zerlegt: ein dort
// gesetzter Anzeigen-Filter warf hier einen TypeError, ein
// Faelligkeitsfilter leerte die Liste still.
const kf = { suche: "", sortierung: "", prio: "", faellig: "" };

// EIGENE Suche statt pitchPasst() - gefunden beim Audit 17.09., zweifach
// reproduziert:
//
//   * pitchPasst liest p.ad.anzeigen. renderKundenauftraege haengt kein
//     ad-Feld an (renderPitchliste schon). Hatte Andrea in der Pitchliste
//     "Mit Anzeigen" gesetzt, warf der Filter einen TypeError mitten im
//     Zeichnen: Suchfeld und Sortierknopf blieben stehen, darunter nichts,
//     keine Meldung.
//   * pf ist MODULWEIT und ueberlebt den Ansichtswechsel. Mit "faellig <= 7"
//     verschwanden ALLE Auftraege, weil eine stillgelegte Marke
//     datum_naechste_aktion:"" hat -> ampel liefert tage:null.
//
// In den Kundenauftraegen gibt es bewusst keine Filter-Chips. Damit hatte
// Andrea keinen Bedienweg, den Filter ueberhaupt zu sehen - geschweige denn
// ihn zu loeschen. Diese Ansicht filtert deshalb NUR ueber ihr eigenes
// Suchfeld.
function kundenPasst(p, s) {
  // Prio: "1"/"2"/"3" oder "ohne". Ein Auftrag ohne Einordnung ist eine
  // eigene Gruppe, nicht "alle".
  if (kf.prio) {
    const hat = p.prio == null || p.prio === "" ? "ohne" : String(p.prio);
    if (hat !== kf.prio) return false;
  }
  // Faelligkeit rechnet auf dem CHECKLISTEN-Termin (p.tage kommt aus
  // ampel(naechsterTermin)). Ohne offenen Termin faellt der Auftrag aus
  // jedem Faelligkeitsfilter - dort ist nichts zu tun.
  if (kf.faellig !== "" && (p.tage === null || p.tage > kf.faellig)) {
    return false;
  }
  if (!s) return true;
  return [p.name, p.status, p.naechsterCheckText, p.kooperation, p.kategorie]
    .join(" ").toLowerCase().includes(s);
}
const SORT_KUNDEN = [["", "Nächster Termin"], ["verschoben", "Zuletzt verschoben"],
                     ["name", "Name A–Z"], ["prio", "Priorität"]];

// Ohne Prioritaet ans Ende (9 als Ersatzwert), nicht an den Anfang: eine
// noch nicht eingeordnete Marke ist keine wichtige Marke.
function sortiereKunden(liste, art) {
  const l = [...liste];
  if (art === "name") return l.sort((a, b) => nameVgl(a.name, b.name));
  if (art === "prio") {
    return l.sort((a, b) => (Number(a.prio) || 9) - (Number(b.prio) || 9) ||
                            nameVgl(a.name, b.name));
  }
  if (art === "verschoben") {
    const wann = (x) => (x.seit ? datumWert(x.seit) : -1);
    return l.sort((a, b) => wann(b) - wann(a) || nameVgl(a.name, b.name));
  }
  // Voreinstellung: naechster Termin aus der Checkliste, frueheste zuerst.
  // Auftraege ohne offenen Termin ans Ende - dort ist nichts zu tun.
  {
    const wann = (x) => (x.naechsterTermin ? datumWert(x.naechsterTermin) : 1e13);
    return l.sort((a, b) => wann(a) - wann(b) || nameVgl(a.name, b.name));
  }
  // datumWert() schiebt Unlesbares mit 1e12 ans Ende - bei ABSTEIGENDER
  // Sortierung landet es damit ganz vorn. Ein Auftrag ohne `seit` fuehrte
  // die Liste an (Audit 17.09., reproduziert).
  const wann = (x) => (x.seit ? datumWert(x.seit) : -1);
  return l.sort((a, b) => wann(b) - wann(a) || nameVgl(a.name, b.name));
}

function renderKundenauftraege() {
  kopfzeile("Kundenaufträge", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  const heute = heuteNull();
  // Die Ampel rechnet auf dem Checklisten-Termin, nicht auf der Kadenz -
  // die liegt im Auftrag still.
  const alle = kundenauftraegeAktuell()
    .map((p) => ({ ...p, ...ampel(p.naechsterTermin || "", heute) }));
  if (!alle.length) {
    c.append(el("div", "leerzustand",
      "Noch keine Kundenaufträge. Marken kommen hierher über " +
      "„in Kundenaufträge verschieben“ im Pitchlisten-Eintrag — erst nach " +
      "einer positiv eingetragenen Antwort."));
    return;
  }
  const suche = el("input", "suche");
  suche.type = "search";
  suche.placeholder = "Suchen (Name, Status …)";
  suche.value = kf.suche;
  suche.oninput = () => { kf.suche = suche.value; zeichnen(); };
  c.append(suche);

  const knopfZeile = el("div", "chips");
  // Filter mit denselben Groessen wie die Sortierung (Tobias, 17.09.):
  // Prio und naechster Termin. Der Name bleibt dem Suchfeld vorbehalten.
  const filterBtn = el("button", "chip");
  filterBtn.onclick = () => {
    const w = el("div");
    w.append(filterGruppe("Priorität",
      [["1", "Prio 1"], ["2", "Prio 2"], ["3", "Prio 3"], ["ohne", "ohne Prio"]],
      () => kf.prio, (x) => { kf.prio = x; }, zeichnen));
    w.append(filterGruppe("Nächster Termin",
      [[0, "fällig"], [7, "≤ 7 Tage"], [14, "≤ 14 Tage"]],
      () => kf.faellig, (x) => { kf.faellig = x; }, zeichnen));
    sheetOeffnen("Filter", w);
  };
  const sortBtn = sortierKnopf(SORT_KUNDEN, () => kf.sortierung,
    (w) => { kf.sortierung = w; }, () => zeichnen());
  knopfZeile.append(filterBtn, sortBtn);
  c.append(knopfZeile);

  const rumpf = el("div");
  c.append(rumpf);
  zeichnen();

  function zeichnen() {
    const aktiv = [kf.prio, kf.faellig].filter(gesetzt).length;
    filterBtn.textContent = "⛭ Filter" + (aktiv ? ` · ${aktiv} aktiv` : "");
    filterBtn.classList.toggle("aktiv", aktiv > 0);
    sortBtn.textContent = "⇅ " + sortLabel(SORT_KUNDEN, kf.sortierung);
    sortBtn.classList.toggle("aktiv", Boolean(kf.sortierung));
    const s = kf.suche.trim().toLowerCase();
    const liste = sortiereKunden(alle.filter((p) => kundenPasst(p, s)),
                                 kf.sortierung);
    rumpf.innerHTML = "";
    rumpf.append(el("div", "stand",
      `${liste.length} von ${alle.length} Aufträgen · sortiert nach ` +
      sortLabel(SORT_KUNDEN, kf.sortierung)));
    if (!liste.length) {
      rumpf.append(el("div", "leerzustand", aktiv
        ? "Nichts passt zu den Filtern."
        : "Nichts passt zur Suche."));
      return;
    }
    const karten = el("div", "karten");
    for (const p of liste) karten.append(pitchKarte(p, true));
    rumpf.append(karten);
  }
}

// ------------------------------------------------------------ Brand Rating

// Brand-Rating-Ansicht (Tobias 31.08., Andreas Workflow Phase A): alle
// Marken mit Brandrating-Zeile aus dem Datenstand, alphabetisch. Hier
// entstehen neue Brands ("+ Neue Brand", seit v32 hierher verlegt) und
// hier kommt in Phase 5 der "Rating abgeschlossen"-Knopf dazu.
const bf = { rating: [], hatRating: "", book: "", fit: "", geist: "",
             chance: "", suche: "", sortierung: "" };

// Skalenwert aus der Symbol-Kette des Brandrating-Blatts ("⭐⭐⭐" -> 3)
function symAnzahl(s) {
  return (String(s || "").match(/[⭐❤★]/gu) || []).length;
}

// ------------------------------------- Word gegen Excel pruefen (v92)
// Befund 06.09.: das Brand-Book haelt das Rating, das beim SCHREIBEN galt,
// die Excel das aktuelle. Aendert Andrea das Rating, laeuft das Dokument
// stumm aus dem Tritt - bei 3 von 45 Marken mit beiden Quellen war das so
// ("Besser im Glas" B/D, "Deltahub" B/D, "Greevi" A/D). Auffallen konnte
// es niemandem: es gibt keinen Abgleich zwischen den beiden Quellen.
//
// Verglichen wird NORMALISIERT: das Book schreibt "2", Excel/App "⭐⭐" -
// beides ist dieselbe Stufe. Ohne das meldete die Pruefung 45 Fehlalarme.
function ratingStufe(wert) {
  return symAnzahl(wert) || Number(String(wert).trim()) || 0;
}

// Die vier Felder, die in BEIDEN Quellen stehen. Links das Label im Book
// (= Schluessel der Kerninfos), rechts das Feld im Brandrating.
const RATING_PAARE = [["Rating (A-D)", "rating"], ["Brand Fit", "brandfit"],
                      ["Begeisterung", "begeisterung"],
                      ["Erfolgschance", "erfolgschance"]];

// Abweichungen EINER Marke. Leeres Array = in Ordnung.
// Felder, die in einer der Quellen fehlen, werden uebersprungen - ein
// leeres Book-Feld ist kein Widerspruch, sondern nur ungepflegt.
function ratingAbweichung(m) {
  const k = m.kerninfos || {}, br = m.brandrating || {};
  const raus = [];
  for (const [label, feld] of RATING_PAARE) {
    const b = String(k[label] || "").trim();
    const e = String(br[feld] || "").trim();
    if (!b || !e) continue;
    const gleich = label === "Rating (A-D)"
      ? b.toUpperCase() === e.toUpperCase()
      : ratingStufe(b) === ratingStufe(e);
    if (!gleich) raus.push({ feld: label, book: b, excel: e });
  }
  return raus;
}

// Alle Marken auf einmal - fuer die Pruefung in den Einstellungen.
function ratingAbweichungen(marken) {
  return (marken || []).map((m) => ({ marke: m, abw: ratingAbweichung(m) }))
    .filter((x) => x.abw.length);
}

// Der Bestandswaechter (v105). Bis v104 verglich "Daten pruefen" genau EINE
// Sache: den Book-Spiegel gegen das Brandrating. Am 11.09. kamen zwei echte
// Fehler ans Licht, die er beide nicht sehen konnte:
//
//   Landpark   Word B · brandrating B · pitchliste A
//   urbanjngl  Word A · brandrating A · pitchliste D
//
// Ein Rating wohnt an DREI Stellen, geprueft wurden zwei. urbanjngl war der
// teure Fall: D heisst "raus aus der Pitchliste", die A-Marke war damit
// wochenlang aus Andreas Arbeitsliste verschwunden. Gefunden habe ich das
// nur, weil ich von Hand nachgerechnet habe (Tobias 11.09.: "brand rating
// gegen pitchliste? brand book befuellt = geht in die pitchliste...").
//
// Getrennt nach Fehler und Hinweis, weil das zwei verschiedene Dinge sind:
// ein Haken ohne Datei ist kaputt, ein vorbereitetes Book ohne Pitch ist
// nur liegengeblieben. Wer beides gleich laut meldet, wird ignoriert.
//
// Pur gehalten (Marken rein, Befunde raus), damit test_v105.js das ohne
// OneDrive und ohne DOM prueft.
function bestandBefunde(marken) {
  const fehler = [], hinweise = [];
  const d = (x) => String(x || "").trim().toUpperCase() === "D";

  for (const m of marken || []) {
    const br = m.brandrating || {}, pl = m.pitchliste;
    // Archiv: D am Brandrating ODER an der Pitchzeile - dieselbe Regel wie
    // in pitchlisteAktuell(). Archivierte Marken haben zu Recht keine
    // Pitchzeile mehr; wer sie meldet, meldet jede Archivierung.
    const archiv = d(br.rating) || (pl && d(pl.rating));

    // --- 1. Word-Book gegen App (gab es schon) ---
    const abw = ratingAbweichung(m);
    if (abw.length) {
      fehler.push({ name: m.name, art: "word-app",
        text: abw.map((a) => `${a.feld}: Word ${a.book} / App ${a.excel}`)
          .join(" · ") });
    }

    // --- 2. Brandrating gegen Pitchzeile (NEU) ---
    // Lauft BEWUSST auch bei D. Gerade der Widerspruch "hier D, dort A" ist
    // der Fall, der eine Marke unsichtbar macht.
    if (pl) {
      const r = String(br.rating || "").trim().toUpperCase();
      const p = String(pl.rating || "").trim().toUpperCase();
      if (r && p && r !== p) {
        fehler.push({ name: m.name, art: "rating-pitch",
          text: `Rating ${r}, in der Pitchliste aber ${p}` +
            (p === "D" ? " — die Marke fehlt dadurch in der Pitchliste" : "") });
      }
    }

    if (archiv) continue;

    // --- 3. Der Haken "Brand Book" gegen die Wirklichkeit (NEU) ---
    const haken = String(br.brandbook || "").trim();
    if (haken && !m.quelle) {
      fehler.push({ name: m.name, art: "haken-ohne-book",
        text: "Haken „Brand Book“ gesetzt, es gibt aber keine Datei" });
    } else if (m.quelle && !pl) {
      const ereignisse = (m.events || []).length;
      if (ereignisse) {
        fehler.push({ name: m.name, art: "book-ohne-pitchzeile",
          text: `Book mit ${ereignisse} Ereignis(sen), aber keine Zeile in ` +
                "der Pitchliste — die Marke taucht in der Wiedervorlage nie auf" });
      } else {
        hinweise.push({ name: m.name, art: "nie-gepitcht",
          text: "Book liegt bereit, wurde aber nie gepitcht" });
      }
    }
  }
  return { fehler, hinweise };
}

// Spiegel an die eben geschriebene Datei angleichen (Tobias 07.09., v93).
// Gegenstueck zu bookWerte(): DIESELBEN vier Felder, DIESELBE Quelle
// (m.brandrating). Wird nur gerufen, nachdem bookErzeugen() "neu" gemeldet
// hat - dann steht im Word genau das, was hier eingetragen wird.
// Pur gehalten (keine Persistenz, kein DOM), damit test_rating.js es ohne
// OneDrive pruefen kann. Gibt die Zahl geaenderter Felder zurueck.
// ACHTUNG beim Aendern: laeuft bookWerte() und RATING_PAARE auseinander,
// behauptet der Spiegel etwas, das nicht in der Datei steht - schlimmer als
// die alte Meldung, weil dann gar nichts mehr warnt.
// LEERE Excel-Werte werden uebersprungen. Sonst landet "" im Spiegel, und
// kerninfosAktuell() ueberschreibt damit den aus dem Book gelesenen Wert -
// es ueberschreibt bei vorhandenem SCHLUESSEL, nicht erst bei Inhalt. Eine
// Marke ohne Excel-Brandfit haette so ihre Anzeige verloren. Fuer die
// Pruefung ist das ohne Belang: ratingAbweichung ueberspringt leere Seiten
// ohnehin, es gibt also nichts stillzulegen.
function kerninfosNachziehen(m) {
  const br = (m && m.brandrating) || {};
  m.kerninfos = m.kerninfos || {};
  let n = 0;
  for (const [label, feld] of RATING_PAARE) {
    const wert = String(br[feld] || "").trim();
    if (!wert) continue;
    if (m.kerninfos[label] !== wert) { m.kerninfos[label] = wert; n++; }
  }
  return n;
}

// Alter des Book-Spiegels (Tobias 07.09., v93). Die Pruefung vergleicht NICHT
// die Word-Datei, sondern m.kerninfos - deren Abbild aus dem letzten PC-Import.
// Wer direkt im Word korrigiert, sieht hier bis zum naechsten Import weiter die
// alte Meldung. Genau das kostete am 07.09. einen Abend Fehlersuche: die Books
// waren laengst richtig, die App zeigte treu den Stand von morgens 08:09.
// datenstand.geaendert taugt dafuer NICHT - das ueberschreibt die App bei jedem
// Speichern (siehe datenstandPersistieren). Deshalb ein eigenes Feld, das nur
// datenstand.py schreibt und die App nie anfasst.
function spiegelHinweis() {
  const imp = datenstand && datenstand.importiert;
  return imp
    ? "Verglichen wird der Book-Stand aus dem PC-Import vom " +
      String(imp).replace("T", " ") + ". Direkt im Word gemachte Änderungen " +
      "erscheinen erst nach einem neuen Import."
    : "Verglichen wird der Book-Stand aus dem letzten PC-Import. Direkt im " +
      "Word gemachte Änderungen erscheinen erst nach einem neuen Import.";
}

// Rating-Wechsel protokollieren. BEWUSST NICHT in m.events:
// dort haengen die KPI-Zaehlung und das Word-Book dran, ein Rating-Wechsel
// ist aber weder Kontakt noch Antwort. Eigene Liste, eigene Anzeige.
// Gibt true zurueck, wenn wirklich etwas eingetragen wurde.
function ratingWechselEintragen(m, alt, neu, datum) {
  const a = String(alt || "").trim().toUpperCase();
  const n = String(neu || "").trim().toUpperCase();
  if (!n || a === n) return false;
  (m.ratingHistorie = m.ratingHistorie || []).push(
    { datum, von: a, nach: n });
  return true;
}

// Stufe 2 erledigt = Brand hat eine Pitchzeile - eine Bedingung fuer
// Statuszeile und Knopf. Seit v104 reicht der Datenstand: der Snapshot
// fuehrt keine Pitchliste mehr.
function inPitchliste(m) {
  return Boolean(m.pitchliste);
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
  ok.onclick = async () => {
    if (!f.rating) { banner("Rating (A–D) fehlt."); return; }
    if (f.rating === "D" && String(br.rating || "").trim() !== "D" &&
        !confirm(`„${m.name}“ auf D setzen?\n` +
          "D = inaktiv/Archiv — die Brand verschwindet aus der " +
          "Pitchliste, bleibt aber im Brand Rating.")) return;
    const altRating = String(br.rating || "").trim();
    Object.assign(br, { rating: f.rating,
      brandfit: "⭐".repeat(f.fit || 0),
      begeisterung: "❤️".repeat(f.geist || 0),
      erfolgschance: "⭐".repeat(f.chance || 0) });
    if (m.pitchliste)
      Object.assign(m.pitchliste, { rating: f.rating, geaendert: lokalIso() });

    // Wechsel festhalten (v92). Vorher gab es keinerlei Rating-Historie -
    // die Frage "war das mal ein B?" war schlicht nicht beantwortbar,
    // man konnte sie nur aus dem Widerspruch Book/Excel erschliessen.
    const gewechselt =
      ratingWechselEintragen(m, altRating, f.rating, deDatum(isoInTagen(0)));

    // Book in den Ordner des neuen Ratings ziehen. bookordner wird IMMER
    // gesetzt - auch wenn das Verschieben scheitert, dann eben auf den
    // alten Ordner. Sonst wandert der berechnete Pfad mit dem Rating,
    // die Datei aber nicht, und das Book ist unauffindbar. Genau so ist
    // "Besser im Glas" entstanden (gefunden 06.09.).
    if (gewechselt && br.brandbook) {
      const alt = m.bookordner || altRating;
      const erg = await bookVerschieben(m, alt, f.rating);
      m.bookordner = erg === "verschoben" ? f.rating : alt;
      if (erg === "verschoben")
        banner(`Book nach „${f.rating} Brands“ verschoben.`);
      else if (erg === "nicht gefunden")
        banner(`Book nicht in „${alt} Brands“ gefunden — bitte von Hand ` +
               `nach „${f.rating} Brands“ schieben.`);
      else if (erg !== "gleich")
        banner("Book konnte nicht verschoben werden — es bleibt in " +
               `„${alt} Brands“.`);
    }
    listeVeraltet = true;
    datenstandPersistieren();
    // Fix B (v121): das Book verschieben allein reichte nie - im Dokument
    // stand weiter das alte Rating, und "Daten pruefen" meldete es bis in
    // alle Ewigkeit (Landpark, urbanjngl am 11.09.).
    // NACH bookVerschieben, nicht davor: bookPfad() muss den neuen Ordner
    // kennen, sonst liest der Schreibvorgang an der alten Stelle ins Leere.
    bookKerninfosMelden(m);
    fertig();
  };
  const ab = el("button", "chip", "Abbrechen");
  ab.onclick = fertig;
  okZ.append(ok, ab);
  wrap.append(okZ);
  return wrap;
}

// Domain aus einem eingetippten Website-Wert. "https://www.balolo.de/shop"
// -> "balolo.de". Leer, wenn nichts Brauchbares drinsteht.
function domainVon(wert) {
  const t = String(wert || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t) ? t : "";
}

// Suchanfrage je Kontaktfeld (pur, testbar). Kern des Ganzen (Tobias 03.09.):
// Steht die Website schon im Formular, wird die Suche per `site:` auf GENAU
// diese Domain eingegrenzt - dann durchsucht Google die Homepage der Marke
// fuer uns. Das ist der Ersatz fuer das Auslesen der Seite, das aus dem
// Browser wegen CORS nicht geht: nicht wir greifen zu, sondern Googles
// Index, den es ohnehin schon gibt.
// Ohne Website bleibt es bei einer Suche ueber den Markennamen in
// Anfuehrungszeichen - sonst findet Google irgendeine aehnliche Firma.
const SUCHE = "https://www.google.com/search?q=";

function suchAnfrage(label, name, website) {
  const d = domainVon(website);
  const marke = `"${name}"`;
  switch (label) {
    case "Website":      return `${marke} offizielle Website`;
    case "Social Media": return d ? `site:${d} instagram` : `${marke} instagram`;
    // Genau die Woerter, unter denen Firmen ihre Creator-Kontakte fuehren.
    // OR muss in Google GROSS geschrieben sein, sonst zaehlt es als Wort.
    case "Ansprechpartner": return d
      ? `site:${d} (influencer OR ugc OR kooperation OR presse OR marketing)`
      : `${marke} (influencer OR ugc OR kooperation) ansprechpartner kontakt`;
    case "E-Mail": return d
      ? `site:${d} (impressum OR kontakt OR presse) email`
      : `${marke} impressum kontakt email`;
    default: return marke;
  }
}

function suchLink(label, name, website) {
  return SUCHE + encodeURIComponent(suchAnfrage(label, name, website));
}

// Seiten, die auf Firmen-Homepages fast immer unter demselben Pfad liegen
// (Tobias 03.09.). Das Impressum ist in Deutschland sogar Pflicht (§5 DDG)
// und praktisch immer /impressum - dasselbe Muster wie bei den Domains,
// deshalb funktioniert Raten hier, waehrend es bei einem Personennamen
// scheitert. Ein Fehlversuch kostet eine Sekunde; pruefen koennen wir es
// vorher nicht (CORS), also gar nicht erst versuchen.
const MARKEN_SEITEN = [["impressum", "Impressum"], ["kontakt", "Kontakt"],
                       ["kooperation", "Kooperation"], ["presse", "Presse"]];

// "" wenn im Website-Feld keine brauchbare Domain steht.
function seitenLink(website, pfad) {
  const d = domainVon(website);
  return d ? `https://${d}/${pfad}` : "";
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
    // Such-Knopf fuer JEDES Kontaktfeld (v67; vorher nur Website und Social
    // Media). Das ist NUR ein Link auf eine Suchseite - keine API, kein
    // Schluessel, kein Kontingent. Mit der abgeschalteten Custom Search API
    // (siehe Chronik v56) hat das nichts zu tun.
    // Die Anfrage wird beim KLICK gebaut, nicht beim Zeichnen: so nutzt sie
    // eine Website, die gerade erst eingetragen wurde.
    const suche = () => suchLink(label, m.name, eingaben["Website"].value);
    {
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
          window.open(suche(), "_blank", "noopener");
          return;
        }
        b.disabled = true;
        hinweis.textContent = "Suche Domain …";
        const gefunden = await webVorschlag(m.name);
        b.disabled = false;
        if (!gefunden) {
          hinweis.textContent = "Keine passende Domain geraten — Browser-Suche geöffnet.";
          window.open(suche(), "_blank", "noopener");
          return;
        }
        i.value = gefunden;
        hinweis.textContent = "Geraten und per DNS bestätigt — bitte kurz prüfen.";
      };
      z.append(b);
      wrap.append(z, hinweis);
    }
  }

  // Direktlinks auf die ueblichen Unterseiten - ein Tipp statt Umweg ueber
  // eine Trefferliste. Immer sichtbar, auch ohne Website: sonst muesste das
  // Formular beim Tippen neu zeichnen, und der Hinweis erklaert besser, was
  // fehlt, als ein Knopf, der gar nicht erst da ist.
  //
  // Standen bis v78 im ratingFormular - dort aber ohne Website-Feld, und
  // der urspruengliche Zugriff auf eingaben["Website"] (v73: ReferenceError)
  // zeigt, dass sie von Anfang an hierher gehoerten. Sie dienen der
  // Kontaktrecherche, nicht dem Rating-Urteil (Tobias 05.09.).
  // Wie bei den Such-Knoepfen wird die Website beim KLICK gelesen: gerade
  // eingetippt und sofort ausprobierbar, ohne Speichern.
  wrap.append(el("div", "stand", "Seiten der Marke direkt öffnen"));
  const sz = el("div", "chips");
  const sHinweis = el("div", "stand");
  for (const [pfad, titel] of MARKEN_SEITEN) {
    const b = el("button", "chip", titel);
    b.onclick = () => {
      const url = seitenLink(eingaben["Website"].value, pfad);
      if (!url) {
        sHinweis.textContent = "Dafür erst die Website eintragen.";
        return;
      }
      sHinweis.textContent = "";
      window.open(url, "_blank", "noopener");
    };
    sz.append(b);
  }
  wrap.append(sz, sHinweis, el("div", "stand",
    "Geraten aus der Website — gibt es die Seite nicht, kommt eine " +
    "Fehlermeldung der Marke. Prüfen können wir das vorher nicht."));

  const okZ = el("div", "chips");
  const ok = el("button", "chip aktiv", "✓ Speichern");
  ok.onclick = () => {
    m.kerninfos = m.kerninfos || {};
    for (const [label, i] of Object.entries(eingaben))
      m.kerninfos[label] = i.value.trim();
    listeVeraltet = true;
    datenstandPersistieren();
    bookKerninfosMelden(m);                       // Fix B (v121)
    fertig();
  };
  const ab = el("button", "chip", "Abbrechen");
  ab.onclick = fertig;
  okZ.append(ok, ab);
  wrap.append(okZ, el("div", "stand",
    "Landet beim „Brand-Book erstellen“ im Word. Steht das Book schon, " +
    "wird die Änderung dort sofort nachgetragen."));
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

// ------------------------------------------------------ Sonstiges (v83)
// Vierter Reiter in beiden Brand-Sheets. Hier stehen die Excel-Spalten,
// fuer die es bisher KEIN Eingabefeld gab - sie kamen beim Import herein
// und waren in der App nur Text zum Anschauen (Tobias 06.09.).
// Abgleich Kopfzeile Vorlage <-> App, was fehlte:
//   Brand Rating: Status, Kategorie, Notizen, Paid Ad Aktivitaet,
//                 Adventskalender 2026
//   Pitchliste:   Kooperation
// Der Export braucht dafuer keine Zeile: xlsxRatingZeile/xlsxPitchZeile
// holen jeden Spaltenschluessel per Zugriff auf br/p, "extra:" ein-
// geschlossen. Feld hier gefuellt = Wert steht in der Excel.
// Alles ausser Paid Ad ist ein schlichtes Textfeld - die Excel-Spalten
// sind Freitext, ein Auswahlfeld waere geraten. Vorschlaege kommen per
// <datalist> aus den Werten, die schon im Datenstand stehen: nativ, kein
// Widget, waechst mit den Daten mit. Gegen "Selfcare"/"selfcare"-Dubletten
// beim Tippen auf dem Handy.
// Fehlt der Zweig (Marke ohne Pitchlisten-Zeile), faellt das Feld weg
// statt einen leeren Zweig anzulegen: eine erfundene Pitchlisten-Zeile
// wuerde die Marke in Liste UND Excel schwemmen.
// [Label, Zweig, Feldname, Vorschlagsliste?, volle Breite?]
// "breit" = das Feld bekommt die ganze Zeile statt einer halben Kachel.
// Kurze Werte (Status: "Kontaktiert") vertragen die halbe Breite, Freitext
// nicht. Unbekannte Excel-Spalten bekommen im Zweifel die volle Breite -
// wir wissen nicht, wie lang ihr Inhalt wird.
const SONST_FELDER = [
  ["Status", "brandrating", "status", true, false],
  ["Kategorie / Nische", "brandrating", "kategorie", true, true],
  ["Notizen", "brandrating", "notizen", false, true],
  ["Kooperation (Ja/Nein, Datum)", "pitchliste", "kooperation", true, true],
];

// Fallback-Spaltenname, falls noch keine Marke die Spalte hat (frisch in
// der App angelegt, Datenstand ohne die Spalte).
const PAID_AD = "extra:Paid Ad Aktivität";

// Die Excel-Zelle "Paid Ad Aktivität" ist EIN String "<Anzeigen> (<Budget>)"
// - "3", "2 (350)", auch "0 ( 830)" mit Leerzeichen. In der App sind es zwei
// Felder (Tobias 06.09.): laufende Anzeigen in der Werbebibliothek und
// Werbebudget der Firma. Beides traegt Andrea von Hand ein, gerechnet wird
// nichts. Zahlen sind NICHT auf 0-3 begrenzt: die Stufen aus dem Kriterien-
// Blatt sind nur Andreas erste Eintraege, kuenftig stehen dort 8, 17, 40.
// Was gar nicht ins Muster passt ("keine Anzeigen"), wandert unveraendert
// ins erste Feld und kommt unveraendert wieder heraus - lieber eine
// unschoene Zelle als ein stillschweigend geloeschter Wert.
function paidAdTeile(wert) {
  const t = String(wert == null ? "" : wert).trim();
  const m = t.match(/^(\d*)\s*(?:\(\s*(\d+)\s*\))?$/);
  return m && (m[1] || m[2]) ? [m[1], m[2] || ""] : [t, ""];
}

function paidAdText(anzeigen, budget) {
  const a = String(anzeigen == null ? "" : anzeigen).trim();
  const b = String(budget == null ? "" : budget).trim();
  return (a + (b ? " (" + b + ")" : "")).trim();
}

// Alle "extra:"-Spalten, die der Import IRGENDWO gefunden hat. Union ueber
// alle Marken, nicht nur die eine im Sheet: eine in der App angelegte Brand
// hat die Schluessel noch gar nicht, braucht die Felder aber trotzdem.
function extraSpalten() {
  const s = new Set();
  for (const x of (datenstand ? datenstand.marken : []))
    for (const k of Object.keys(x.brandrating || {}))
      if (k.startsWith("extra:")) s.add(k);
  return [...s].sort();
}

// Vorschlagswerte fuer ein Feld: was im Datenstand schon unter diesem
// Schluessel steht. Deckel bei 40, damit die Liste bedienbar bleibt.
function sonstVorschlaege(zweig, feld) {
  const werte = new Set();
  for (const x of (datenstand ? datenstand.marken : [])) {
    const w = String((x[zweig] || {})[feld] || "").trim();
    if (w) werte.add(w);
  }
  return [...werte].sort(nameVgl).slice(0, 40);
}

function bereichSonstiges(m, fertig) {
  const frag = document.createDocumentFragment();
  if (!m || !datenstand) return frag;
  const wrap = el("div");
  // Kachel-Gitter (v86, Tobias 06.09.): statt einer flachen Liste aus
  // Label+Feld. Die Spaltenzahl macht CSS per auto-fit - auf dem Handy
  // zwei schmale Kacheln, auf dem Tablet mehr. Freitext-Felder bekommen
  // die volle Zeile ("breit"), damit die Bedienung am Handy nicht
  // schlechter wird als vorher (Vorbehalt Tobias, 06.09.).
  const gitter = el("div", "sonst-gitter");
  const speichern = [];            // Funktionen, die beim Speichern schreiben

  // Eine Kachel: Beschriftung oben, Eingabefeld darunter.
  const kachel = (label, breit) => {
    const k = el("div", "sonst-kachel" + (breit ? " breit" : ""));
    k.append(el("div", "sonst-label", label));
    gitter.append(k);
    return k;
  };

  const feld = (label, zweig, name, vorschlag, breit) => {
    if (!m[zweig]) return;         // kein Zweig, kein Feld (s.o.)
    const k = kachel(label, breit);
    const i = el("input", "feld");
    const w = m[zweig][name];
    i.value = w == null ? "" : String(w);
    if (vorschlag) {
      const liste = sonstVorschlaege(zweig, name);
      if (liste.length) {
        const dl = el("datalist");
        dl.id = "vs-" + zweig + "-" + name.replace(/\W+/g, "-");
        for (const v of liste) {
          const o = el("option");
          o.value = v;
          dl.append(o);
        }
        i.setAttribute("list", dl.id);
        k.append(dl);
      }
    }
    k.append(i);
    speichern.push(() => { m[zweig][name] = i.value.trim(); });
  };

  for (const [label, zweig, name, vorschlag, breit] of SONST_FELDER)
    feld(label, zweig, name, vorschlag, breit);

  const extras = extraSpalten();
  const paidKey = extras.find((k) => k.toLowerCase().includes("paid ad")) || PAID_AD;
  if (m.brandrating) {
    const [a0, b0] = paidAdTeile(m.brandrating[paidKey]);
    // Zwei Zahlenfelder, bewusst nebeneinander: sie gehoeren zusammen und
    // sind beide kurz - genau der Fall, fuer den das Gitter gemacht ist.
    const kA = kachel(paidKey.slice(6) + " — laufende Anzeigen", false);
    const anz = el("input", "feld");
    anz.inputMode = "numeric";
    anz.value = a0;
    kA.append(anz);
    const kB = kachel("Werbebudget der Firma", false);
    const bud = el("input", "feld");
    bud.inputMode = "numeric";
    bud.value = b0;
    kB.append(bud);
    // Vorschau zeigt die fertige Zelle. Die Zusammensetzung passiert sonst
    // unsichtbar, und die Excel ist erst nach dem Export nachpruefbar.
    const vorschau = el("div", "stand sonst-vorschau");
    const zeig = () => { vorschau.textContent =
      "Kommt als eine Zelle in die Excel: „" + paidAdText(anz.value, bud.value) + "“"; };
    anz.oninput = bud.oninput = zeig;
    zeig();
    gitter.append(vorschau);
    speichern.push(() => {
      m.brandrating[paidKey] = paidAdText(anz.value, bud.value);
    });
  }

  // Restliche Excel-Spalten, die der Code nicht namentlich kennt
  // ("Adventskalender 2026", alles Kuenftige). Neue Spalte in der Excel =
  // neues Eingabefeld, ohne eine Zeile Code - gleiche Regel wie beim Import.
  for (const k of extras.filter((k) => k !== paidKey))
    feld(k.slice(6), "brandrating", k, true, true);

  wrap.append(gitter);
  const okZ = el("div", "chips");
  const ok = el("button", "chip aktiv", "✓ Speichern");
  ok.onclick = () => {
    for (const s of speichern) s();
    if (m.pitchliste) m.pitchliste.geaendert = lokalIso();
    listeVeraltet = true;
    datenstandPersistieren();
    banner("Gespeichert — steht beim nächsten „Excel erzeugen“ in der Datei.");
    fertig();
  };
  okZ.append(ok);
  wrap.append(okZ);
  frag.append(abschnitt("Sonstiges", wrap, el("div", "stand",
    "Die Excel-Spalten ohne eigenes Formular. Landet beim nächsten " +
    "„Excel erzeugen“ in der jeweiligen Spalte.")));
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
    el("div", "fuss",
      (br.brandbook ? "Brand-Book ✓" : "noch kein Brand-Book")
      + (bookGeaendert.has(m.name) ? " · ✎ in Word geändert" : "")));
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
      // Die "extra:"-Spalten (Paid Ad Aktivität, Adventskalender 2026, …)
      // standen hier seit v82 - damals der einzige Ort, an dem sie ueber-
      // haupt sichtbar waren. Seit v83 haben sie im Reiter "Sonstiges" ein
      // echtes Eingabefeld, hier waeren sie nur noch eine Dublette
      // (Tobias 06.09.). Unsichtbar werden koennen sie dadurch nicht:
      // renderBrandrating steigt ohne Datenstand vorher aus, und mit
      // Datenstand zeichnet bereichSonstiges die Felder immer.
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
    // "✎ Kontaktdaten" gehoert in den Reiter Kontakt, nicht zu den
    // Book-Knoepfen im Reiter Rating (Tobias 03.09.) - dort steht es
    // jetzt unter der Tabelle, die es bearbeitet.
    wrap.append(markenDetails(quelleZuName(m.name), true, m,
      datenstand ? formularKnopf(z, bau, "kontakt", "✎ Kontaktdaten") : null));
    wrap.append(bereichSonstiges(m, bau));
    if (m.erstellt) wrap.append(bereichLoeschen(m));
    zuReitern(wrap, "reiterRating");
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
    // Nur noch die Book-Knoepfe (Tobias 03.09.: "✎ Kontaktdaten" ist in
    // den Reiter Kontakt gewandert). Kann dadurch leer bleiben - dann
    // gar nicht erst einhaengen, sonst steht da eine leere Zeile.
    const reihe = el("div", "chips");
    const reiheRein = (...rest) => {
      if (reihe.children.length) frag.append(reihe);
      frag.append(...rest.filter(Boolean));
    };

    if (!br.brandbook) {
      // ------------------------------------------ Stufe 1: Book erstellen
      if (!abc) {
        reiheRein(el("div", "stand", rating === "D"
          ? "D-Brand = inaktiv/Archiv — kein Brand-Book, keine Pitchliste."
          : "Erst Rating (A–C) vergeben — es bestimmt Template und Ordner."));
        return frag;
      }
      if (!online) {
        reiheRein(el("div", "stand",
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
      reiheRein(el("div", "stand",
        "Stufe 1: erzeugt das Brand-Book aus dem Template, trägt die " +
        "Kerninfos ein und setzt den Haken. In die Pitchliste kommt die " +
        "Brand erst mit „Brand-Book befüllt“."));
      return frag;
    }
    // ------------------------------ Stufe 2: Book befüllt -> Pitchliste
    if (!abc || inPitchliste(m)) {          // D-Archiv-Book oder schon drin
      reiheRein();                          // ggf. gar nichts mehr zu zeigen
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
        // Spiegel nachziehen (Tobias 07.09., v93): bookWerte() hat die vier
        // Rating-Felder eben AUS DER EXCEL ins Word geschrieben - die App
        // weiss also, was jetzt in der Datei steht. Ohne diese Zeilen meldet
        // "Daten pruefen" den Widerspruch weiter, obwohl er behoben ist:
        // verglichen wird m.kerninfos, und das kam bisher nur vom PC-Import.
        // Nur bei "neu": bei "neu-leer" stehen im Word noch Platzhalter.
        if (erg === "neu") {
          kerninfosNachziehen(m);
          datenstandPersistieren();
        }
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
    reiheRein(el("div", "stand",
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
      wrap.append(filterGruppe("Rating", ratings.map((r) => [r, r]),
        () => bf.rating, (w) => { bf.rating = w; }, zeichnen, true));
    }
    // Getrennt vom Rating-Filter darueber: dort waehlt man KONKRETE
    // Ratings, hier geht es um "ueberhaupt schon bewertet?" - das ist
    // Andreas Arbeitsliste, die Brands ohne Rating.
    wrap.append(filterGruppe("Bewertet",
      [["ohne", "Ohne Rating"], ["mit", "Mit Rating"]],
      () => bf.hatRating, (w) => { bf.hatRating = w; }, zeichnen));
    wrap.append(filterGruppe("Brand-Book",
      [["ohne", "Ohne Brand-Book"], ["mit", "Brand-Book ✓"]],
      () => bf.book, (w) => { bf.book = w; }, zeichnen));
    wrap.append(filterGruppe("Brand Fit", skalenChips(),
      () => bf.fit, (w) => { bf.fit = w; }, zeichnen));
    wrap.append(filterGruppe("Begeisterung", skalenChips(),
      () => bf.geist, (w) => { bf.geist = w; }, zeichnen));
    wrap.append(filterGruppe("Erfolgschance", skalenChips(),
      () => bf.chance, (w) => { bf.chance = w; }, zeichnen));
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
    const n = [bf.rating, bf.hatRating, bf.book, bf.fit, bf.geist, bf.chance]
      .filter(gesetzt).length;
    filterBtn.textContent = "⛭ Filter" + (n ? ` · ${n} aktiv` : "");
    filterBtn.classList.toggle("aktiv", n > 0);
    sortBtn.textContent = "⇅ " + sortLabel(SORT_BRAND, bf.sortierung);
    sortBtn.classList.toggle("aktiv", Boolean(bf.sortierung));
    const s = bf.suche.trim().toLowerCase();
    const gefiltert = alle.filter((m) => brandPasst(m, s));
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
  // Auch hier, nicht nur im Dashboard: wer die App oeffnet und veraltete
  // Zahlen sieht, soll den Grund auf dem ersten Bildschirm finden.
  const warnung = pfadWarnung();
  if (warnung) c.append(warnung);
  const wolke = wolkenWarnung();
  if (wolke) c.append(wolke);
  const wahl = standWahlWarnung();
  if (wahl) c.append(wahl);
  const bef = bestandWarnung();
  if (bef) c.append(bef);

  const ugc = el("div", "karte menue-karte" + (snap ? "" : " leer"));
  ugc.append(el("div", "titel", "UGC"),
    el("div", "kontext",
      snap ? `KPI-Dashboard · ${snap.zeitraeume[0].marken.length} Marken`
           : (typeof OD !== "undefined" && OD.konto())
             ? "Angemeldet, aber keine snapshot.json im Datenbank-Ordner"
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
  // ki ueber kerninfosAktuell() statt roh aus dem Snapshot (Backlog 26,
  // 18.09.): v125 hat das fuer das RATING geradegezogen, die drei Skalen
  // daneben blieben am PC-Import haengen. Aendert Andrea "Brand Fit" in der
  // App, wandert der Wert nach m.kerninfos - der Filter sah ihn nicht.
  // DIESELBE Funktion, die die Detailansicht nutzt: eine Quelle, ein Wert.
  //
  // Zweiter Teil desselben Fundes: die Skalen wurden mit parseInt() gelesen.
  // Andrea schreibt sie in manchen Books direkt als Symbole - am 18.09. in
  // 10 von 62 Quellen. parseInt("⭐⭐⭐⭐") ist NaN, also 0: "Brand Fit >= 4"
  // hat 6 Marken uebersehen, die 4 oder 5 stehen hatten.
  // ratingStufe() (v92) rechnet Symbole und Ziffern seit jeher auf DIESELBE
  // Stufe - dort hat die Word-gegen-Excel-Pruefung denselben Fall geloest.
  // Keine zweite Zahl-Funktion daneben: genau so ist der Fehler entstanden.
  const mv = (typeof datenstand !== "undefined" && datenstand)
    ? markeZuName(m.name) : null;
  const ki = kerninfosAktuell(mv, m.quelle);
  // m.rating kommt aus der App (v125), ki nur noch als Rueckfall fuer
  // Marken, die die App nie angefasst hat.
  const rating = m.rating || String(ki["Rating (A-D)"] || "").trim();
  return (!mf.rating || rating === mf.rating) &&
    (!mf.fit || ratingStufe(ki["Brand Fit"]) >= mf.fit) &&
    (!mf.geist || ratingStufe(ki["Begeisterung"]) >= mf.geist) &&
    (!mf.chance || ratingStufe(ki["Erfolgschance"]) >= mf.chance) &&
    (!mf.antwort ||
      (mf.antwort === "positiv" ? m.positiv > 0 : m.antworten > 0));
}

// Mindestwert-Chips fuer eine 1-5-Skala ("Fit ≥ 4" heisst: 4 oder besser)
function skalenChips() {
  return [[5, "5"], [4, "≥ 4"], [3, "≥ 3"], [2, "≥ 2"]];
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
    zeilen.push(filterGruppe("Antwort",
      [["antwort", "Mit Antwort"], ["positiv", "Antwort positiv"]],
      () => mf.antwort, (w) => { mf.antwort = w; }, neuzeichnen));
    // Aus BEIDEN Quellen (v125): sonst fehlt ein Buchstabe als Knopf,
    // sobald Andrea ihn in der App neu vergibt - der Filter koennte dann
    // nach einem Rating suchen, das es laut Snapshot noch nicht gibt.
    const ratings = [...new Set([
      ...Object.values(snap.kerninfos || {})
        .map((k) => String(k["Rating (A-D)"] || "").trim()),
      ...(((snap.zeitraeume || [])[0] || {}).marken || [])
        .map((m) => String(m.rating || "").trim()),
    ].filter(Boolean))].sort();
    if (ratings.length > 1) {
      zeilen.push(filterGruppe("Rating", ratings.map((r) => [r, r]),
        () => mf.rating, (w) => { mf.rating = w; }, neuzeichnen));
    }
  }
  zeilen.push(filterGruppe("Brand Fit", skalenChips(),
    () => mf.fit, (w) => { mf.fit = w; }, neuzeichnen));
  zeilen.push(filterGruppe("Begeisterung", skalenChips(),
    () => mf.geist, (w) => { mf.geist = w; }, neuzeichnen));
  zeilen.push(filterGruppe("Erfolgschance", skalenChips(),
    () => mf.chance, (w) => { mf.chance = w; }, neuzeichnen));
  return zeilen;
}

function renderUgc() {
  kopfzeile("UGC KPI-Dashboard", true);
  const c = document.getElementById("inhalt");
  c.innerHTML = "";
  const z = zeitraum();
  const alleMarken = snap.zeitraeume[0].marken.length;

  const warnung = pfadWarnung();
  if (warnung) c.append(warnung);
  const wolke = wolkenWarnung();
  if (wolke) c.append(wolke);
  const wahl = standWahlWarnung();
  if (wahl) c.append(wahl);
  const bef = bestandWarnung();
  if (bef) c.append(bef);
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
  const aktuell = pitchlisteAktuell(); // gleiche Liste wie die Ansicht (ohne D-Brands)
  if (aktuell.length) {
    const heute = heuteNull();
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

  // Kundenauftraege (v132): aus dem Platzhalter von v86 ist ein echter
  // Zugang geworden. Die Datenquelle ist NICHT das alte Excel-Blatt
  // (Liste2346), sondern m.kundenauftrag im Datenstand - gesetzt beim
  // Verschieben aus der Pitchliste.
  //
  // Die vier KPI-Kacheln (Kennenlerngespraeche, Kooperationen,
  // Abschlussquote, Oe Auftragswert) bleiben vorerst leer: dafuer braucht es
  // Auftragswerte, die noch nirgends erfasst werden. Weiterhin keine 0 -
  // eine 0 waere eine Behauptung.
  const kunden = el("div", "karte block zugang");
  const kAnzahl = kundenauftraegeAktuell().length;
  const kKopf = el("div", "kopf");
  kKopf.append(el("span", "pill", "Aufträge"),
               el("span", "badge" + (kAnzahl ? " voll" : ""), String(kAnzahl)));
  kunden.append(kKopf, el("div", "titel", "Kundenaufträge"),
    el("div", "kontext", kAnzahl
      ? `${kAnzahl} Marke${kAnzahl === 1 ? "" : "n"} im Auftrag`
      : "Noch keine — Marken kommen über „in Kundenaufträge verschieben“ " +
        "aus der Pitchliste hierher."));
  kunden.onclick = () => { location.hash = "#/kundenauftraege"; };
  c.append(kunden);

  // Platzhalter Nutzungsrechte (v125, Ablaufplan Andrea 14.09.): steht
  // bewusst UNTER den Kundenauftraegen - die Nutzungsrechte entstehen als
  // Schritt 8 im Auftragsablauf, nicht daneben. Auf dem Blatt: "angehaengt
  // an Brand, separate Anzeige in einem Bereich wie Brandrating,
  // Pitchliste, Kundenauftrag". Wie oben: kein Knopf, keine Zahl.
  const rechte = el("div", "karte block zugang platzhalter");
  const rKopf = el("div", "kopf");
  rKopf.append(el("span", "pill", "Geplant"));
  rechte.append(rKopf, el("div", "titel", "Nutzungsrechte"),
    el("div", "kontext",
      "Noch keine Datenquelle — später Beginn, Dauer und Art " +
      "(organisch / paid ad) je Marke."));
  c.append(rechte);

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
    const az = bookAenderungZeile();
    if (az) rumpf.append(az);
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
  // Kennzahlen frisch aus dem Datenstand (v87). Hier statt an den
  // Datenquellen, weil render() nach JEDER Änderung läuft - auch nach
  // "✓ erledigt" (listeVeraltet) und nach dem OneDrive-Abgleich.
  kpiNachrechnen();
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
  } else if (h === "#/kundenauftraege") {
    renderKundenauftraege();
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
// Datenbank-Ordner in OneDrive: hier liegen snapshot.json, datenstand.json und
// die datierten Backups. Seit v71 einstellbar (Tobias 04.09.) - bei Andrea
// existiert "/Apps/Cockpit" nicht, ihre Schreibversuche liefen ins Leere und
// die App meldete trotzdem Erfolg. Graph legt fehlende Ordner beim PUT NICHT
// an, ein 404 ist endgueltig. Geraete-Einstellung wie der Book-Pfad.
const DATEN_BASIS_STD = "/UGC/App/Datenbank";

function datenBasis() {
  const roh = String(einst.datenPfad || DATEN_BASIS_STD).trim()
    .replace(/^\/+|\/+$/g, "");
  return "/me/drive/root:/" + (roh || DATEN_BASIS_STD.replace(/^\//, ""));
}
const OD_DATENSTAND = () => datenBasis() + "/datenstand.json:/content";
const OD_SNAPSHOT = () => datenBasis() + "/snapshot.json:/content";

// Sicherungs-Ordner (v105, Tobias 11.09.: "Ich will in Datenbank eigtl nur
// snapshot und datenbestand sehen"). Am 11.09. lagen dort 21 Sicherungen
// gegen 2 echte Dateien. Der Ordner /UGC/App/Backups existiert seit dem
// 06.09. und war bis dahin leer - das ist der vorgesehene Platz.
// Einstellbar wie die anderen beiden Pfade, aus demselben Grund: bei Andrea
// sieht die Ordnerstruktur anders aus als bei Tobias.
const SICHERUNG_BASIS_STD = "/UGC/App/Backups";

// Wie viele Sicherungen im Ordner bleiben (Tobias 11.09.): "Alles was
// aelter als 24 Stunden ist, ist eh veraltet, und alles was innerhalb von
// 24 Stunden passiert, daran erinnert sich Andrea." Die Versionssicherung
// der LAUFENDEN Version zaehlt nicht mit und wird nie geloescht - sie ist
// der einzige Weg zurueck aus einem missratenen Update.
const SICHERUNGEN_MAX = 4;

function sicherungBasis() {
  const roh = String(einst.sicherungsPfad || SICHERUNG_BASIS_STD).trim()
    .replace(/^\/+|\/+$/g, "");
  return "/me/drive/root:/" + (roh || SICHERUNG_BASIS_STD.replace(/^\//, ""));
}

// ------------------------------------------- Erledigt-Knopf (Phase 5)

// Kadenz (Andrea, 29.08.): Pitch→FU1 +5, FU1→FU2 +5, FU2→FU3 +10 Tage,
// nach FU3 +90 Tage Pause bis "Neuer Pitch". Standardwerte — pro Marke
// überschreibbar (m.intervalle, gesetzt beim Ändern des Abstands).
const KADENZ_STD = { fu1: 5, fu2: 5, fu3: 10, pause: 90 };

// Was wird erledigt und was folgt darauf? aktion = fällige naechste_aktion
// aus der Pitchliste, pos = Follow-ups seit dem letzten Pitch.
// Was bisher als Pitch-Herkunft in den Books steht - als Vorschlagsliste.
// Andrea hat die Texte selbst geschrieben ("Ueber Bewerberformular auf der
// Homepage", "Pitch per E-Mail"); die App soll ihre Sprache uebernehmen
// statt eine eigene zu erfinden. Deckel bei 30, damit die Liste bedienbar
// bleibt. "Pitch" und "Neuer Pitch" fliegen raus - das sind keine
// Herkuenfte, sondern der Standardfall.
function pitchHerkuenfte() {
  const werte = new Set();
  for (const m of (datenstand ? datenstand.marken : [])) {
    for (const e of (m.events || [])) {
      if (e.typ !== "Pitch") continue;
      const t = String(e.aktion || "").trim();
      if (!t || t === "Pitch" || t === "Neuer Pitch") continue;
      // Der Praefix, den die App selbst setzt, gehoert nicht in den Vorschlag
      werte.add(t.replace(/^(Neuer )?Pitch\s*[—-]\s*/i, "").trim());
    }
  }
  werte.delete("");
  return [...werte].sort(nameVgl).slice(0, 30);
}

// "follow" im Text macht aus einem Pitch beim naechsten Import einen
// Follow-up (ugc_core.klassifiziere_aktion: 'follow' im Text -> FollowUp).
// Eine Herkunft wie "nach Follow-up-Anfrage" wuerde die Kennzahlen also
// still verfaelschen. Deshalb hier abfangen statt hinterher suchen.
function herkunftUnzulaessig(text) {
  return String(text || "").toLowerCase().includes("follow");
}

function naechsterSchritt(aktion, pos) {
  const a = String(aktion || "").toLowerCase();
  if (a.includes("follow")) {
    const nr = Math.min(pos + 1, 3);
    return {
      typ: "FollowUp", aktion: "Follow up " + nr, status: "Follow up",
      zaehlt: true, kontakt: true,
      naechste: nr < 3 ? "Follow up" : "Neuer Pitch",
      key: nr === 1 ? "fu2" : nr === 2 ? "fu3" : "pause",
    };
  }
  // Creatorpool-Prüfung (16.09.): zählt als KONTAKT, aber NICHT als
  // Follow-up. Deshalb zaehlt:false - "zaehlt" erhöht weiter unten
  // pitchliste.zaehler, und das ist der Follow-up-Zähler. Mit true
  // stünde nach einer Prüfung "Follow-ups: 3", obwohl keines war.
  // Erkennung wortgleich zu klassifiziere_aktion() in ugc_core.py.
  if (a.includes("creatorpool")) {
    return { typ: "Creatorpool", aktion: "Creatorpool",
      status: "Creatorpool", zaehlt: false, kontakt: true,
      naechste: "Creatorpool", key: "fu1" };
  }
  // "Rückantworten prüfen" zählt weder in Historie noch KPI (14.09.) -
  // kontakt:false unterdrückt das Ereignis ganz.
  // ABSICHTLICH eng: nur "rückantwort", NICHT "rückmeldung". Andreas
  // Freitexte ("Warten auf Rückmeldung") verhalten sich damit wie
  // bisher; eine Umdeutung bestehender Daten wäre eine stille
  // Verhaltensänderung an 3 Marken im Bestand.
  if (a.includes("rückantwort") || a.includes("rueckantwort")) {
    return { typ: "Ruecksprache", aktion: "Rückantworten prüfen",
      status: "Rückantworten prüfen", zaehlt: false, kontakt: false,
      naechste: "Rückantworten prüfen", key: "fu1" };
  }
  return { typ: "Pitch",
    aktion: aktion === "Neuer Pitch" ? "Neuer Pitch" : "Pitch",
    status: "Pitch", zaehlt: false, kontakt: true,
    naechste: "Follow up", key: "fu1" };
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
// Der Parameter zielDatum (v95) ist mit v117 entfallen - das Feld "Einmalig
// auf ein Datum legen" ist ausgebaut. Wer einen eigenen Termin will, nimmt
// "✎ Termin ändern" (terminSetzenDaten), das denselben Zweck erfuellt und
// dabei termin_hand setzt.
// Datenteil "Termin-Dialog" (v113, Andrea 09.09.: "Naechster Schritt und
// Termin von Hand ueberschreiben"). Aendert die PENDING naechste Aktion,
// ohne etwas als erledigt einzutragen.
//
// Die Kadenz (m.intervalle) bleibt unangetastet - dieselbe Regel wie beim
// Datumsfeld aus v95: wer einmal bis nach dem Urlaub schiebt, soll sich
// damit keine neue Dauerkadenz setzen.
//
// termin_hand kennzeichnet den Termin als VON ANDREA gesetzt. Das ist der
// Unterschied zu einem Termin aus dem alten Excel-Import, und nur deshalb
// kann pitchNachrechnen() spaeter gefahrlos laufen: es laesst gekennzeichnete
// Zeilen in Ruhe. Vorher waere die Unterscheidung nur aus dem Zeitstempel
// ABLEITBAR gewesen - und Ableitungen aus Zeitstempeln haben am 11./12.09.
// dreimal danebengelegen.
function terminSetzenDaten(m, aktion, datum, jetzt) {
  const p = m && m.pitchliste;
  if (!p) return false;
  if (!aktion && !datum) return false;
  if (aktion) p.naechste_aktion = aktion;
  if (datum) {
    p.datum_naechste_aktion = datum;
    p.termin_hand = true;
  }
  p.geaendert = jetzt;
  // Ab hier beschreibt ein offener Ruecknahmepunkt einen Stand, den es nicht
  // mehr gibt (v131). Ohne diese Zeile nahm "Rueckgaengig" den Hand-Termin mit.
  ruecknahmeEntwerten(m);
  listeVeraltet = true;
  return true;
}

// Ein Ruecknahmepunkt gilt fuer GENAU den Stand, aus dem er entstanden ist.
// Wird die Marke danach weiterbearbeitet, beschreibt er einen Zustand, den es
// nicht mehr gibt - und ein Klick auf "Rueckgaengig" wirft die spaetere Arbeit
// mit weg.
//
// Gefunden am 16.09. bei der Zustandspruefung (Codex-Gegenpruefung), beide
// Auspraegungen am echten Bestand nachgemessen:
//
//   letzteAktion (aus erledigen)         wurde von terminSetzenDaten nicht
//     entwertet -> das Zurueckrollen auf la.vorher nahm den von Andrea
//     gesetzten Termin mit. 6 Marken trugen einen solchen Termin.
//   letztesBook (aus bookBefuelltDaten)  wurde von erledigen nicht entwertet
//     -> bookRueckgaengig setzte m.pitchliste = null, obwohl inzwischen ein
//     Pitch-Event dranhing. Stand scharf: Ultrahuman, ein Klick entfernt.
//
// EINE Funktion fuer beide Wege, von beiden Seiten gerufen. Zwei getrennte
// Pflaster waeren die Vorlage dafuer, dass in sechs Monaten der eine Weg
// repariert wird und der andere nicht - genau das ist diesem Projekt mit der
// v56-Regel und bookCTag passiert (v130).
function ruecknahmeEntwerten(m) {
  if (!m || !datenstand) return 0;
  const k = schluessel(m.name);
  let weg = 0;
  if (datenstand.letzteAktion &&
      schluessel(datenstand.letzteAktion.name) === k) {
    delete datenstand.letzteAktion;
    weg++;
  }
  if (datenstand.letztesBook &&
      schluessel(datenstand.letztesBook.name) === k) {
    delete datenstand.letztesBook;
    weg++;
  }
  if (weg) logZeile("ruecknahme-entwertet", { marke: m.name, punkte: weg });
  return weg;
}

function erledigen(m, s, tage, standard) {
  const jetzt = lokalIso();
  const heute = deDatum(isoInTagen(0));
  // ZUERST entwerten, dann den eigenen Punkt setzen (v131). Ein offenes
  // letztesBook dieser Marke wuerde sonst weiterhin anbieten, die Pitchliste
  // auf null zu setzen - mit dem Event, das gleich darunter entsteht.
  ruecknahmeEntwerten(m);
  datenstand.letzteAktion =
    { name: m.name, aktion: s.aktion, zeit: jetzt, vorher: { ...m.pitchliste },
      // A7 (Audit 17.09.): merkt sich, dass gleich KEIN Ereignis entsteht.
      // rueckgaengig() sucht sonst eines, findet keins und verweigert -
      // der Punkt blieb als Leiche stehen. Siehe dort.
      ohneEreignis: s.kontakt === false,
      // datum mitfuehren, weil es ohne Ereignis nirgends sonst steht:
      // rueckgaengig() braucht es, um die Zeile im Brand-Book wieder
      // herauszunehmen. Der normale Weg holt es aus dem Ereignis.
      datum: heute };
  // Kein Ereignis bei einem Nicht-Kontakt (16.09.): "Rückantworten
  // prüfen" soll weder in der Historie noch in der KPI auftauchen.
  // s.kontakt !== false statt s.kontakt: ein altes s ohne das Feld
  // (z.B. aus einem gespeicherten Rückgängig-Stand) verhält sich dann
  // wie bisher, statt still das Ereignis zu verschlucken.
  if (s.kontakt !== false) {
    (m.events = m.events || []).push(
      { typ: s.typ, datum: heute, aktion: s.aktion, positiv: "" });
  }
  // termin_hand wird hier GELOESCHT (v116/v117), und das ist zwingend:
  // Dieses Datum kommt aus der Kadenz, darf also von pitchNachrechnen()
  // nachgerechnet werden. v113 setzte den Merker, niemand loeschte ihn -
  // eine Marke waere nach EINEM Handtermin auf Dauer vom Nachrechnen
  // ausgenommen gewesen, auch nach zwanzig normalen Follow-ups.
  // Gesetzt wird er nur noch in terminSetzenDaten() ("✎ Termin ändern").
  // Kommentar steht ABSICHTLICH hier und nicht im Objekt: der
  // Stempel-Waechter in test_invarianten.js prueft "geaendert:" nur in den
  // 8 Zeilen nach dem Schreibzugriff.
  // letzter_kontakt wird nur bei echtem Kontakt fortgeschrieben (16.09.):
  // eine Rückantworten-Prüfung ist keiner, sonst behauptete die Pitchliste
  // einen Kontakt, den es nie gab. Kommentar steht hier oben und NICHT im
  // Objekt - aus demselben Grund wie der Absatz darüber: der Stempel-Wächter
  // sucht "geaendert:" nur in den 8 Zeilen nach dem Schreibzugriff.
  const kontaktDatum = s.kontakt !== false ? heute : m.pitchliste.letzter_kontakt;
  Object.assign(m.pitchliste, {
    status: s.status,
    letzter_kontakt: kontaktDatum,
    naechste_aktion: s.naechste,
    datum_naechste_aktion: isoInTagen(tage),
    termin_hand: false,
    geaendert: jetzt,
  });
  if (s.zaehlt) {
    m.pitchliste.zaehler = String(
      (parseInt(datenstand.letzteAktion.vorher.zaehler, 10) || 0) + 1);
  }
  if (tage !== standard) (m.intervalle = m.intervalle || {})[s.key] = tage;
  // A1 (Tobias, 17.09.): Nach einer Zusage haekelt der Erledigt-Knopf nur
  // die von Hand gesetzte Wiedervorlage ab - er startet KEINE neue Kadenz.
  // Das Ereignis bleibt stehen (Andrea hat ja etwas getan), aber die
  // Terminfelder werden sofort wieder geleert, sonst rechnete die Kadenz
  // munter weiter, obwohl die Marke laengst zugesagt hat.
  // Kommentar ueber dem Aufruf, nicht im Objektliteral: der Stempel-Waechter
  // sucht "geaendert:" nur in den 8 Zeilen nach dem Schreibzugriff.
  // `status` wird MIT zurueckgesetzt: erledigen() hat ihn oben auf den
  // Schritt gesetzt ("Creatorpool"), und danach stuende auf der Karte wieder
  // etwas anderes als "Zugesagt" - A2 waere ausgehebelt. Gemessen 17.09.
  if (m.pitchliste.positivBeantwortet) {
    Object.assign(m.pitchliste, {
      status: "Zugesagt",
      naechste_aktion: "",
      datum_naechste_aktion: "",
      termin_hand: false,
      geaendert: jetzt,
    });
  }
  listeVeraltet = true;
  datenstandPersistieren();
  // Punkt 4 im Brand-Book sofort mitschreiben (Andrea 02.09.)
  bookHistorieMelden(m, heute, s.aktion);
}

// Rücksprung auf Pitch nach einer Absage ODER nach dem Zurückschieben aus
// den Kundenaufträgen. EIN Handgriff, ZWEI Auslöser - sonst wird in sechs
// Monaten der eine Weg repariert und der andere nicht (wie bei der v56-Regel
// und bookCTag, v130).
//
// Ruft ABSICHTLICH NICHT ruecknahmeEntwerten(): das macht der jeweilige
// Aufrufer selbst, VOR seinem eigenen Rückgängig-Punkt. Täte es diese
// Funktion, löschte sie den Punkt, den der Aufrufer zwei Zeilen vorher
// gesetzt hat - "Rückgängig" nach einer negativen Antwort täte dann nichts,
// ohne jede Meldung.
//
// Erzeugt KEIN Pitch-Ereignis (Tobias, 16.09.): das entsteht erst, wenn
// Andrea "Pitch erledigt" drückt. Bis dahin weicht fuSeitPitch() (rechnet
// aus Ereignissen) vom Feld zaehler ab - folgenlos, weil pos nur im
// Follow-up-Zweig von naechsterSchritt() benutzt wird und hier "Pitch" steht.
// `datumIso` ist OPTIONAL und aendert nichts am Absage-Weg: ohne Angabe
// bleibt es bei "heute faellig", genau wie bisher. Nur der Rueckweg aus dem
// Kundenauftrag reicht ein gewaehltes Datum herein und markiert es als
// Handtermin (Tobias, 17.09.).
//
// Warum das hier und nicht in einer zweiten Funktion: ruecksprungAufPitch()
// ist der EINE Handgriff mit mehreren Ausloesern (v130-Regel). Eine Kopie
// "mit Datum" waere die Vorlage dafuer, dass in sechs Monaten der eine Weg
// repariert wird und der andere nicht.
function ruecksprungAufPitch(m, jetzt, datumIso) {
  if (!m || !m.pitchliste) return false;
  const termin = datumIso || isoInTagen(0);
  Object.assign(m.pitchliste, {
    status: "Pitch",
    naechste_aktion: "Pitch",
    datum_naechste_aktion: termin,
    zaehler: "0",
    termin_hand: !!datumIso,
    positivBeantwortet: false,
    geaendert: jetzt,
  });
  listeVeraltet = true;
  return true;
}

// Eine Brandantwort eintragen (Release 4, Baustein 1). `datumIso` ist der
// LETZTE KONTAKT, nicht der naechste Termin (Andrea, 16.09.): die Antwort
// ist selbst ein Kontaktereignis. Das Wiedervorlage-Datum setzt sie danach
// getrennt ueber "Termin aendern".
//
// KEIN Rueckgaengig-Punkt, anders als bei erledigen(). Korrigiert wird durch
// erneutes Eintragen am selben Tag (Tobias, 17.09.), und zwar aus drei
// nachgemessenen Gruenden:
//   1. rueckgaengig() vergleicht ev[last].aktion gegen la.aktion. Ein
//      Antwort-Ereignis hat aktion:"" - der Vergleich traefe nie.
//   2. Das Ereignis MUSS aktion:"" behalten: ugc_core.extract_events()
//      erzeugt fuer eine Antwort aus dem Word exakt dasselbe. Stuende in
//      der App "Antwort", haetten App- und Word-Ereignis verschiedene
//      historieSchluessel - historieAktuell() zeigte die Antwort DOPPELT.
//   3. rueckgaengig() endet mit bookHistorieMelden(..., true) und leert eine
//      Zeile in der HISTORIEN-Tabelle. Die Antwort steht in der
//      Antwort-Tabelle; dort faende es nichts und meldete Andrea Handarbeit
//      fuer etwas, das nie dort stand.
//
// ruecknahmeEntwerten() laeuft trotzdem, und das ist zwingend: ein offener
// Punkt dieser Marke wuerde sonst weiter anbieten, die Pitchliste auf einen
// Stand VOR der Antwort zurueckzurollen - waehrend das Antwort-Ereignis
// stehen bleibt. Genau der v131-Fehler, nur an einer neuen Stelle.
function antwortEintragen(m, datumIso, positiv, bemerkung, jetzt) {
  if (!m || !m.pitchliste) return false;
  // Antworten gehoeren in die Pitchliste (Tobias, 17.09.). Steht die Marke
  // im Kundenauftrag, ist der einzige Weg zurueck der Knopf "Zurueck in die
  // Pitchliste" - mit seinem Pflichtgrund und seinem Historien-Eintrag.
  //
  // Die Sperre steht HIER und nicht nur in der Oberflaeche: ohne sie liefe
  // der Negativ-Zweig ueber ruecksprungAufPitch() und setzte Flag, Status
  // und Zaehler zurueck, waehrend m.kundenauftrag stehen bliebe. Die Marke
  // waere dann in der Pitchliste unsichtbar und liefe dort trotzdem eine
  // Kadenz - nachgemessen am 17.09., genau so eingetreten.
  if (m.kundenauftrag) return false;
  // Ohne Datum wird NICHTS geschrieben (Pruefkriterien Fall 12). Der Guard
  // steht hier und nicht nur im Knopf: was allein im Klick-Handler haengt,
  // ist nicht pruefbar und faellt beim naechsten Umbau still weg.
  // Ohne ihn liefe deDatum(undefined) durch und die Marke bekaeme ein
  // Ereignis mit unbrauchbarem Datum - das der PC-Import spaeter einliest.
  if (!datumIso) return false;
  jetzt = jetzt || lokalIso();
  const datum = deDatum(datumIso);
  ruecknahmeEntwerten(m);
  // Ereignis ERSETZEN statt anhaengen, wenn fuer dieses Datum schon eine
  // Antwort steht - das ist die Korrektur. Ohne diesen Zweig entstuende
  // beim Umtippen ein zweites Ereignis, und die KPI zaehlte zwei Antworten.
  // Dieselbe Regel wie im Book (antwortXml) und in der Warteschlange
  // (outboxSchluessel mit art "antwort"): Marke + Datum ist die Identitaet.
  // A3 (Tobias, 17.09.): Steuert diese Antwort ueberhaupt noch den Zustand?
  // Nur die JUENGSTE tut das. Wird nachtraeglich die Bemerkung einer
  // aelteren Antwort korrigiert, sollen Ereignis und Word-Zeile stimmen -
  // aber Flag, Termin und letzter Kontakt duerfen sich nicht ruehren.
  // Vorher ueberstimmte eine Korrektur vom 15. stillschweigend die Absage
  // vom 17.: das Flag stand wieder, und die Marke war sofort verschiebbar.
  // Berechnet VOR dem Einfuegen und ohne den eigenen Eintrag.
  const neuereAntwort = (m.events || []).some(
    (e) => e && e.typ === "Antwort" && e.datum !== datum &&
           datumWert(e.datum) > datumWert(datum));
  const ereignis = { typ: "Antwort", datum, aktion: "",
                     positiv: positiv ? "X" : "", negativ: positiv ? "" : "X",
                     bemerkung: bemerkung || "" };
  m.events = m.events || [];
  const i = m.events.findIndex(
    (e) => e && e.typ === "Antwort" && e.datum === datum);
  if (i >= 0) m.events[i] = ereignis;
  else m.events.push(ereignis);
  if (neuereAntwort) {
    // Reine Korrektur an einer ueberholten Antwort: Ereignis und Book
    // aktualisieren, Zustand in Ruhe lassen.
    listeVeraltet = true;
    datenstandPersistieren();
    bookAntwortMelden(m, datum, positiv, !positiv, bemerkung);
    return true;
  }
  if (positiv) {
    // Stilllegung nach positiv, Option A (Tobias, 16.09.): die Kadenz wird
    // still gelegt, indem BEIDE Terminfelder geleert werden. Das
    // entscheidende Feld ist das DATUM - daran haengt die Faelligkeit;
    // ampel("") liefert sauber grau statt eines Fehlers (vorab geprueft).
    // termin_hand faellt mit, sonst bliebe die Marke vom Nachrechnen
    // ausgenommen (v116/v117).
    // Der Kommentar steht hier oben und NICHT im Objektliteral: der
    // Stempel-Waechter sucht "geaendert:" nur in den 8 Zeilen nach dem
    // Schreibzugriff.
    // A2 (Tobias, 17.09.): `status` sagt jetzt "Zugesagt" statt weiter
    // "Follow up" - auf der Auftragskarte stand sonst "Follow up ·
    // Follow-ups: 4", obwohl die Marke laengst zugesagt hatte.
    // `zaehler` bleibt ABSICHTLICH unberuehrt: eine Zusage kann direkt nach
    // dem Pitch kommen oder nach Follow-up 1, und genau das haelt der
    // Zaehler fest. Zuruecksetzen wuerde diese Information wegwerfen.
    Object.assign(m.pitchliste, {
      letzter_kontakt: datum,
      status: "Zugesagt",
      positivBeantwortet: true,
      naechste_aktion: "",
      datum_naechste_aktion: "",
      termin_hand: false,
      geaendert: jetzt,
    });
  } else {
    // Absage: zurueck auf Pitch. ruecksprungAufPitch() stempelt selbst und
    // setzt positivBeantwortet zurueck - es entwertet ABSICHTLICH keine
    // Ruecknahmepunkte, das ist oben schon passiert.
    Object.assign(m.pitchliste, { letzter_kontakt: datum, geaendert: jetzt });
    ruecksprungAufPitch(m, jetzt);
  }
  listeVeraltet = true;
  datenstandPersistieren();
  bookAntwortMelden(m, datum, positiv, !positiv, bemerkung);
  return true;
}

// ------------------------------------ Kundenauftraege (Release 6, v132)
//
// Ein Bereich ist ein OBJEKT, das da ist oder fehlt - dasselbe Muster wie
// m.pitchliste und m.brandrating. Kein zusaetzliches Zustandsfeld, das mit
// dem Objekt synchron gehalten werden muesste.
//
// m.pitchliste bleibt beim Verschieben STEHEN. Objekte werden addiert, nicht
// ersetzt, genau wie beim Uebergang Brand Rating -> Pitchliste. Sichtbar
// wird der Wechsel allein ueber den Filter in pitchlisteAktuell(); der
// Rueckweg muss deshalb NICHTS rekonstruieren, es faellt nur der Filtergrund
// weg.
//
// Beide Wege erzeugen KEIN Ereignis (Tobias, 16.09.): ein Bereichswechsel
// ist keine Kontaktaufnahme und darf in keiner Kennzahl auftauchen. Die
// Spur davon steht in m.kundenauftragHistorie - einem EIGENEN Feld, nicht
// in m.events, damit sie gar nicht erst in die Naehe der KPI-Rechnung
// kommt.
// Darf diese Marke in die Kundenauftraege? EINE Stelle, zwei Leser: die
// Funktion unten und die Graustellung des Knopfs (Pruefkriterien 27/29).
// Vorher stand dieselbe Bedingung zweimal da - die Vorlage dafuer, dass in
// sechs Monaten die eine Stelle gelockert wird und die andere nicht.
//
// Das Flag ist die EINZIGE Bedingung. Kein Termin, kein Mindestalter, kein
// erledigter Schritt - Pruefkriterium R7 prueft ausdruecklich, dass die
// Sperre nicht zu eng gebaut ist.
// Leere Checklisten-Zeilen werden nicht gespeichert (Pruefkriterien Fall 36).
// Eine frisch angelegte Zeile lebt nur in der Anzeige, bis Text drinsteht -
// deshalb ruft "+ Zeile" bewusst KEIN sichern(). Haken und Datum ohne Text
// sind nichts wert: die Zeile sagt dann nicht, WAS erledigt ist.
// Gibt zurueck, wie viele Zeilen verworfen wurden (fuer den Test).
function checklisteBereinigen(ka) {
  if (!ka || !Array.isArray(ka.checkliste)) return 0;
  const vorher = ka.checkliste.length;
  ka.checkliste = ka.checkliste.filter(
    (z) => z && String(z.text == null ? "" : z.text).trim());
  return vorher - ka.checkliste.length;
}

// Die naechste offene Aufgabe mit Datum - im Kundenauftrag ersetzt sie die
// Kadenz (Tobias, 17.09.). Gibt { datum, text } oder null.
//
// Nur OFFENE Punkte zaehlen: eine erledigte Aufgabe ist kein Termin mehr.
// Punkte ohne Datum bleiben aussen vor - sie sind eine Aufgabe, aber keine
// Verabredung. Sortiert wird ueber datumWert(), das auch mit deutschem und
// ISO-Format zurechtkommt.
//
// ABLEITEN, NICHT ZURUECKSCHREIBEN: der Wert wandert NICHT nach
// m.pitchliste. Zwei Quellen fuer denselben Termin synchron zu halten waere
// die Sorte Zustand, an der dieses Projekt schon zweimal haengengeblieben
// ist (Codex, 17.09.: "schafft zusaetzliche widerspruchsanfaellige Zustaende").
function naechsterCheckpunkt(ka) {
  if (!ka || !Array.isArray(ka.checkliste)) return null;
  let treffer = null;
  for (const z of ka.checkliste) {
    if (!z || z.erledigt || !z.datum || !String(z.datum).trim()) continue;
    if (!treffer || datumWert(z.datum) < datumWert(treffer.datum)) treffer = z;
  }
  return treffer ? { datum: treffer.datum, text: treffer.text || "" } : null;
}

function verschiebenErlaubt(m) {
  return Boolean(m && m.pitchliste && m.pitchliste.positivBeantwortet &&
                 !m.kundenauftrag);
}

function kundenauftragVerschieben(m, jetzt) {
  if (!verschiebenErlaubt(m)) return false;
  const heute = deDatum(isoInTagen(0));
  // geaendert: die Zeitspur AN DER MARKE (Audit A9, 17.09.). "seit" und der
  // Historien-Eintrag tragen nur ein Datum ohne Uhrzeit; beim Nachsehen, in
  // welcher Reihenfolge an einem Tag etwas passiert ist, half das nicht.
  // Der Parameter `jetzt` wurde bis dahin entgegengenommen und nirgends
  // benutzt - hier ist die Stelle, fuer die er gedacht war.
  m.kundenauftrag = { seit: heute, prio: null, checkliste: [],
                      geaendert: jetzt || lokalIso() };
  (m.kundenauftragHistorie = m.kundenauftragHistorie || [])
    .push({ richtung: "hinein", datum: heute });
  // Ab hier beschreibt ein offener Ruecknahmepunkt einen Stand, den es nicht
  // mehr gibt - dieselbe Regel wie in terminSetzenDaten() (v131). Ohne das
  // naehme "Rueckgaengig" die Marke aus dem Auftrag heraus, ohne den Auftrag
  // selbst anzufassen.
  ruecknahmeEntwerten(m);
  listeVeraltet = true;
  datenstandPersistieren();
  return true;
}

// Zurueck in die Pitchliste. `grund` ist Pflicht (Workflow): ein
// Rueckweg ohne Begruendung ist in vier Wochen nicht mehr nachvollziehbar.
// Die Pruefung sitzt am Knopf - hier wird nur festgehalten, was ankam.
// `datumIso` ist PFLICHT (Tobias, 17.09.): ohne gewaehlten Termin war jede
// zurueckgeschobene Marke sofort faellig, auch wenn gerade nichts zu tun war.
// Der Grund ist es ohnehin schon.
function kundenauftragZurueck(m, grund, jetzt, datumIso) {
  if (!m || !m.kundenauftrag) return false;
  if (!datumIso) return false;
  // Der Grund ist PFLICHT (Pruefkriterien Fall 31) - und die Pruefung gehoert
  // hierher, nicht nur an den ausgegrauten Speichern-Knopf. Ohne Grund wird
  // nichts veraendert: kein Historien-Eintrag, kein Ruecksprung, nichts.
  // Ein Rueckweg ohne Begruendung ist in vier Wochen nicht mehr
  // nachvollziehbar, und die Historie ist die einzige Spur des Wechsels.
  const text = String(grund == null ? "" : grund).trim();
  if (!text) return false;
  jetzt = jetzt || lokalIso();
  ruecknahmeEntwerten(m);
  // REIHENFOLGE (Pruefkriterien R4): erst das Flag fallen lassen, dann die
  // Historie schreiben. Andersherum entstuende - und sei es nur fuer eine
  // Anweisung lang - eine Zeile "zurueck in die Pitchliste" neben einem
  // Flag, das das Verschieben noch freigibt. Bricht irgendetwas dazwischen
  // ab, bleibt genau dieser widerspruechliche Stand stehen.
  //
  // ruecksprungAufPitch setzt status/naechste_aktion/zaehler zurueck UND
  // raeumt positivBeantwortet weg - sonst stuende die Marke wieder in der
  // Pitchliste und waere ohne neue Zusage sofort wieder verschiebbar (N2).
  // Scheitert der Ruecksprung (keine Pitchzeile), wird der Auftrag NICHT
  // entfernt - sonst stuende die Marke in keiner der beiden Listen und waere
  // nur noch ueber das Brand Rating erreichbar (Audit 17.09.).
  if (!ruecksprungAufPitch(m, jetzt, datumIso)) return false;
  // Die Checkliste wird ARCHIVIERT, nicht weggeworfen (Codex, 17.09.):
  // offene Punkte bleiben darin ausdruecklich offen. Archivieren heisst
  // nicht erledigen. Ohne das waere jede zugesagte Aufgabe mit einem Klick
  // spurlos weg - und es gibt dafuer kein Word-Gegenstueck.
  const archiv = {
    seit: m.kundenauftrag.seit || "",
    prio: m.kundenauftrag.prio == null ? null : m.kundenauftrag.prio,
    checkliste: (m.kundenauftrag.checkliste || []).map(
      (z) => ({ text: z.text || "", datum: z.datum || "",
                erledigt: !!z.erledigt })),
  };
  delete m.kundenauftrag;
  (m.kundenauftragHistorie = m.kundenauftragHistorie || [])
    .push({ richtung: "zurueck", datum: deDatum(isoInTagen(0)),
            grund: text, naechsterPitch: datumIso, archiv });
  listeVeraltet = true;
  datenstandPersistieren();
  return true;
}

function rueckgaengig(m, la) {
  // A7 (Audit 17.09.): "Rückantworten prüfen" erzeugt ABSICHTLICH kein
  // Ereignis. Bis v134 legte erledigen() trotzdem einen Rücknahmepunkt an,
  // den niemand einlösen konnte: die Suche unten fand nichts, meldete
  // "geht nicht mehr" und liess den Punkt liegen. Zurückzunehmen gibt es
  // hier trotzdem etwas - die fortgeschriebene Pitchliste.
  // Steht ZWINGEND vor dem Herausziehen unten: ein älteres Ereignis mit
  // derselben Aktion würde sonst gepoppt - ein Rückgängig, das ein fremdes
  // Ereignis löscht, waere genau der Halbe-Sachen-Fehler, den v96 abstellte.
  // Ein alter Rücknahmepunkt ohne das Feld faellt auf den bisherigen Weg
  // zurueck (ehrliche Absage) statt still etwas anderes zu tun.
  if (la.ohneEreignis) {
    m.pitchliste = { ...la.vorher, geaendert: lokalIso() };
    delete datenstand.letzteAktion;
    listeVeraltet = true;
    datenstandPersistieren();
    // Ins Brand-Book hat erledigen() TROTZDEM geschrieben - bookHistorie-
    // Melden() haengt dort nicht am Ereignis, sondern laeuft immer.
    // Ohne diese Gegenbuchung saehe die App "nie passiert" und das Word
    // weiterhin den Eintrag: zwei Stellen, die dasselbe anders sehen.
    // Das ist der Fehler, den v96 fuer den normalen Weg abgestellt hat.
    if (la.datum) bookHistorieMelden(m, la.datum, la.aktion, true);
    return;
  }
  const ev = m.events || [];
  const weg = ev.length && ev[ev.length - 1].aktion === la.aktion
    ? ev.pop() : null;
  // Kein Treffer -> GAR NICHTS zuruecknehmen (v96). Vorher wurde die
  // Pitchliste trotzdem zurueckgerollt, das Ereignis blieb aber stehen:
  // die Liste sagte "nie passiert", die KPI zaehlte es weiter. Wieder zwei
  // Stellen, die dasselbe anders sehen - die Form aller Fehler vom 07.09.
  // Ein Rueckgaengig, das nur die Haelfte zuruecknimmt, ist schlimmer als
  // eines, das ehrlich sagt, dass es nicht mehr geht.
  if (!weg) {
    banner(`„${la.aktion}“ lässt sich nicht mehr zurücknehmen — seither ` +
      "ist ein neueres Ereignis dazugekommen. Die Pitchliste bleibt, " +
      "wie sie ist.");
    return;
  }
  // geaendert NEU stempeln (v95). Ein Rueckgaengig ist selbst eine
  // Aenderung - la.vorher traegt aber den Zeitstempel von DAVOR.
  // Der urspruengliche Grund ist mit v104 entfallen (die Anzeige fiel
  // sonst auf die Snapshot-Zeile zurueck, das Rueckgaengig blieb
  // unsichtbar - Tobias 07.09.). Der Stempel bleibt trotzdem: er sagt
  // ehrlich, wann diese Zeile zuletzt angefasst wurde.
  m.pitchliste = { ...la.vorher, geaendert: lokalIso() };
  delete datenstand.letzteAktion;
  listeVeraltet = true;
  datenstandPersistieren();
  bookHistorieMelden(m, weg.datum, weg.aktion, true);
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
  // Vorschlaege aus dem Datenbestand (v104) - vorher aus den Excel-Zeilen.
  // Beide Abschnitte, damit auch eine frisch angelegte Brand ohne
  // Pitchzeile ihre Kategorie beisteuert.
  for (const k of [...new Set((datenstand ? datenstand.marken || [] : [])
      .flatMap((m) => [(m.pitchliste || {}).kategorie,
                       (m.brandrating || {}).kategorie])
      .filter(Boolean))].sort()) {
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
  //
  // m.erstellt ist die EINZIGE inhaltliche Bedingung und bleibt unangetastet:
  // importierte Books gehören Andrea, die fasst ein Klick in der App nie an.
  // m.brandrating ist nur eine Absturzsicherung - bookPfad() liest
  // m.brandrating.rating.
  //
  // Der Haken brandrating.brandbook ist als Bedingung RAUS (v110, Tobias
  // 11.09.): Er war nur eine ANNAHME darüber, ob eine Datei existiert - die
  // Datei selbst ist die Wahrheit. Am 11.09. ging der Haken beim
  // Datenverlust verloren; die Marke wurde gelöscht, das Book blieb als
  // Waise liegen ("Brand-Book 54321.docx"). Ein DELETE auf etwas, das es
  // nicht gibt, beantwortet Graph mit 404 - harmlos. Rät bookPfad() den
  // Ordner falsch, zeigt der Pfad ins Leere, also ebenfalls 404; der
  // Dateiname kommt aus dem Markennamen und ist markenspezifisch.
  if (m.erstellt && m.brandrating) {
    if (typeof OD !== "undefined" && OD.konto()) {
      OD.graphRoh(bookPfad(m), { method: "DELETE" });
    } else if (m.brandrating.brandbook) {
      // Ohne OneDrive verschwindet die Marke, die Datei bleibt liegen. Das
      // still zu tun erzeugt genau die Waise, die wir gerade abschaffen.
      banner("Brand gelöscht — das Brand-Book blieb liegen (kein OneDrive). "
        + "Datei bei Gelegenheit von Hand entfernen.");
    }
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
const BOOK_BASIS_STD = "/UGC/Brand-Books";

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
  // Der Ordner kommt aus bookOrdner() - EINE Stelle, die entscheidet, wo ein
  // Book liegt. Zwei Stellen mit derselben Fallunterscheidung sind genau das
  // Muster, aus dem der m.gruppe/m.bookordner-Fehler von v122 entstanden ist.
  return `${bookBasis()}/${bookOrdner(m)} Brands/Brand-Book ${m.name}.docx`;
}

// ---------------------------------------- Book-Waechter (v123, Backlog 23)
// Die Richtung Word -> App gibt es nur ueber den PC-Import. Bis der laeuft,
// zeigt die App treu den alten Stand - und behauptet ihn. Am 07.09. hat
// genau das einen Abend gekostet. Hier wird wenigstens SICHTBAR, dass ein
// Book inzwischen anders aussieht. Kein Parsen, kein zweiter Leser neben
// ugc_core.py: nur ein Fingerabdruck der Datei.
//
// Gemerkt wird der cTag, nicht der eTag. Der eTag zaehlt JEDE Aenderung
// mit, auch reine Metadaten; der cTag reagiert auf deutlich weniger.
// Der eTag gehoert zu If-Match beim Schreiben (Backlog 24.1), nicht hierher.
//
// ACHTUNG, am 14.09. an Tobias' echtem OneDrive NACHGEMESSEN und damit
// eine falsche Annahme aus der Graph-Doku widerlegt: Ein Verschieben
// aendert den cTag EBENFALLS. Gemessen an einer Wegwerf-Datei, die keine
// Marke hat (Word zu, App konnte sie nicht anfassen, GUID unveraendert):
// eTag +3, cTag +1 durch ein blosses Verschieben zwischen zwei Ordnern.
//
// Folge: Die Nachfuehrung des Merkers in bookVerschieben() ist NICHT
// Kosmetik, sondern das, was einen Fehlalarm bei jedem Rating-Wechsel
// verhindert. Wer sie entfernt, macht den Waechter unbrauchbar.
// tests/test_v123.js prueft sie deshalb ausdruecklich.
let bookGeaendert = new Map();   // Markenname -> aktueller cTag. Nur Anzeige.

// Die Dateiliste des letzten Ordner-Abrufs (v137, Backlog 7).
// bookAenderungenPruefen() holt sie ohnehin und warf sie bisher bis auf den
// cTag weg - genau das war der blinde Fleck: der Waechter verglich Daten
// gegen Daten, nie DATEIEN gegen Daten. Im Quelltext stand der Hinweis sogar
// schon ("keine Datei -> Backlog 7, nicht hier").
// Ordnerbuchstabe -> Map(Dateiname -> cTag).
// Nur Anzeige, wie bookGeaendert: weder Datenstand noch localStorage.
let bookDateien = new Map();

// Die vier Rating-Ordner. Bis v136 lief der Abruf nur ueber die Ordner, die
// aus den Marken abgeleitet waren - eine verwaiste Datei liegt aber gerade
// dort, wo die App keine Marke erwartet. Praktisch aendert das nichts an den
// vier Abrufen: im echten Bestand sind ohnehin alle vier Ordner belegt.
const BOOK_ORDNER = ["A", "B", "C", "D"];

// Dateiname -> Markenname. Muss zu bookPfad() passen, das genauso baut.
// ponytail: Books, die NICHT so heissen, sieht die Waisen-Suche nicht. Das
// ist die bewusste Grenze - lieber ein uebersehener Sonderfall als ein
// Fehlalarm auf jede fremde .docx im Ordner.
const BOOK_DATEI = /^Brand-Book (.+)\.docx$/i;

function bookOrdner(m) {
  return m.bookordner || String(m.brandrating.rating).trim();
}

// Merker nachziehen, NACHDEM die App selbst geschrieben hat - sonst meldet
// sie ihren eigenen Schreibvorgang als "in Word geaendert". Graph liefert
// bei jedem erfolgreichen PUT/PATCH das aktualisierte driveItem zurueck,
// es braucht also KEINEN zusaetzlichen Abruf. Wichtig: das passiert in
// derselben await-Kette wie die Auswertung der Antwort, damit das Fenster
// "geschrieben, aber noch nicht gemerkt" so klein wie moeglich bleibt.
//
// ponytail: Hat Andrea das Book veraendert, BEVOR die App hineinschrieb,
// loescht das den Hinweis, ohne dass ihre Aenderung je gemeldet wurde.
// Fenster ist klein (nur zwischen zwei Pruefungen) und der PC-Import bleibt
// die eigentliche Wahrheit. Schliessen liesse sich das nur mit einem
// zweiten Word-Leser - siehe Backlog 23 Stufe 2, Risiko hoch.
// ---------------------------- Book-Merker: GERAETESPEZIFISCH (v130, 16.09.)
// Ein cTag gehoert zu EINER Datei in EINEM OneDrive-Ordner. Der Book-Ordner
// liegt seit v56 bewusst in den Geraete-Einstellungen - im Originalton der
// Projektdatei: "nicht im Datenstand, sonst wandert der Testpfad ueber ein
// Backup zu Andrea". Der Merker hing bis v129 trotzdem im GETEILTEN
// datenstand.json.
//
// Am 16.09. an zwei echten Geraeten gemessen:
//   Andrea: \UGC\App                          -> ihre echten Books
//   Tobias: \Apps\Cockpit\Testdaten\UGC\App   -> seine Kopien
// Zwei Dateisaetze, zwei cTag-Saetze, EIN Feld. Wer zuletzt lief, hinterliess
// seine Merker - das andere Geraet meldete daraufhin JEDES Book als "in Word
// geaendert". Genau die Sorte Warnung, die nach zwei Wochen ignoriert wird;
// dieses Projekt hat den Fehler schon zweimal gemacht (4-Sekunden-Banner,
// "Word ist offen" ohne offenes Word).
//
// Der Pfad wird MITGESPEICHERT: wird der Ordner umgestellt, gelten die alten
// Merker nicht mehr und der naechste Lauf setzt die Basis still neu. Ohne das
// waere der Umbau nur eine Verlagerung desselben Fehlers.
const CTAG_KEY = "cockpit-bookctags";
let bookMerker = { pfad: "", tags: {} };
try {
  const roh = JSON.parse(localStorage.getItem(CTAG_KEY) || "{}");
  if (roh && typeof roh === "object" && roh.tags && typeof roh.tags === "object") {
    bookMerker = { pfad: String(roh.pfad || ""), tags: roh.tags };
  }
} catch (_) { /* kaputter Eintrag = kein Merker = stille Neusetzung */ }

function merkerLies(name) {
  return bookMerker.pfad === bookBasis() ? (bookMerker.tags[name] || "") : "";
}
function merkerSetz(name, wert) {
  // Pfad gewechselt? Alte Merker gehoeren zu fremden Dateien - weg damit.
  if (bookMerker.pfad !== bookBasis()) bookMerker = { pfad: bookBasis(), tags: {} };
  bookMerker.tags[name] = String(wert);
}
function merkerLoeschen(name) { delete bookMerker.tags[name]; }
function merkerSichern() {
  try { localStorage.setItem(CTAG_KEY, JSON.stringify(bookMerker)); } catch (_) {}
}

async function bookMerkerSetzen(m, antwort) {
  if (!antwort || !antwort.ok) return;
  const item = await antwort.json().catch(() => null);
  if (item && item.cTag) { merkerSetz(m.name, item.cTag); merkerSichern(); }
}

// Vier Ordner-Abrufe (A-D Brands), nicht 104 Einzelabfragen. Muster wie
// pruefeSicherungen(). NIE ueber ":/content" abfragen: darauf antwortet
// Graph mit einer 302 auf eine Download-URL, fetch folgt ihr, und das ETag
// der Endantwort gehoert dann dem Storage-Blob statt dem driveItem.
async function bookAenderungenPruefen() {
  if (!datenstand || typeof OD === "undefined" || !OD.konto()) return [];
  const marken = (datenstand.marken || [])
    .filter((m) => m.brandrating && m.brandrating.brandbook);
  // Frueher stand hier ein `if (!marken.length) return []`. Er faellt weg
  // (v137): ohne Abruf gaebe es auch keine Dateiliste - und eine verwaiste
  // Datei ist gerade der Fall, in dem KEINE Marke auf sie zeigt.

  // Ein neuer PC-Snapshot heisst: die App ist wieder auf dem Stand der
  // Books. Dann gilt der aktuelle Dateizustand als bekannt und alte
  // Markierungen sind erledigt. Ohne das blieben sie stehen, NACHDEM
  // Tobias eingelesen hat - und ein Hinweis, der nicht mehr weggeht, wird
  // nicht mehr gelesen. Der Snapshot selbst wird nie zurueckgeschrieben
  // (siehe kpiNachrechnen), er kann die Merker also nicht selbst pflegen.
  const basisNeu = !!(snap && snap.erzeugt &&
    String(snap.erzeugt) !== String(datenstand.bookBasisStand || ""));

  // `gebraucht` zaehlt weiter nur die Ordner, die die Marken brauchen - der
  // Abschluss-Check unten haengt daran. Gelesen werden aber ALLE vier.
  const gebraucht = new Set(marken.map(bookOrdner));
  const staende = new Map();
  for (const o of BOOK_ORDNER) {
    const r = await OD.graphRoh(`${bookBasis()}/${o} Brands` +
      ":/children?$select=name,cTag&$top=400");
    if (!r || !r.ok) {
      // Nicht still uebergehen. Ein weggeworfener Graph-Fehlercode hat am
      // 10.09. einen Abend gekostet - daher gibt es logFehlerCode(). Der
      // Waechter meldet nach aussen bewusst nichts (lieber schweigen als
      // raten), aber im Protokoll MUSS stehen, warum ein Ordner fehlt.
      logZeile("book-pruefen", { ordner: o, methode: "GET",
        status: r ? r.status : 0, code: await logFehlerCode(r) });
      continue;
    }
    const map = new Map();
    for (const d of ((await r.json()).value) || [])
      map.set(String(d.name), String(d.cTag || ""));
    staende.set(o, map);
  }
  // Ablegen, BEVOR irgendein return greift: bestandDateiBefunde() lebt davon,
  // und ein leerer Lauf muss die alte Liste loeschen statt sie stehenzulassen.
  bookDateien = staende;
  if (!staende.size) return [];  // gar nichts gelesen -> nichts behaupten

  const geaendert = new Map();
  let mutiert = false;      // betrifft den Datenstand (bookBasisStand)
  let merkerNeu = false;    // betrifft die Geraete-Merker (localStorage, v130)
  for (const m of marken) {
    const map = staende.get(bookOrdner(m));
    if (!map) {
      // Ordner diesmal nicht lesbar (Netz, Sperre, Drosselung). Ein schon
      // erkannter Befund darf dadurch NICHT aus der Anzeige fallen - die
      // Aenderung besteht ja weiter. Also alten Befund uebernehmen statt
      // ihn stillschweigend zu vergessen.
      const alt = bookGeaendert.get(m.name);
      if (alt) geaendert.set(m.name, alt);
      continue;
    }
    const cTag = map.get(`Brand-Book ${m.name}.docx`);
    if (!cTag) continue;                    // keine Datei -> Backlog 7, nicht hier
    if (basisNeu || !merkerLies(m.name)) {               // Basis setzen, STILL
      if (merkerLies(m.name) !== cTag) { merkerSetz(m.name, cTag); merkerNeu = true; }
      continue;
    }
    if (cTag !== merkerLies(m.name)) geaendert.set(m.name, cTag);
  }
  // Der Snapshot gilt erst dann als verarbeitet, wenn WIRKLICH jeder
  // gebrauchte Ordner gelesen wurde. Sonst waere der Reset verbraucht,
  // obwohl ein Teil der Marken ihn nie bekommen hat: die behielten dann
  // dauerhaft ihren Vor-Import-Stand als Vergleichsbasis und meldeten ab
  // da staendig falsch, waehrend der Rest der App den Import laengst als
  // geschehen ansieht. Lieber beim naechsten Lauf nochmal versuchen.
  // Ordnergenau statt ueber die Groesse (v137): seit alle vier Ordner
  // gelesen werden, ist `staende` eine Obermenge von `gebraucht` - ein
  // Groessenvergleich waere nie wieder wahr geworden, und bookBasisStand
  // haette sich nie wieder gesetzt.
  if (basisNeu && [...gebraucht].every((o) => staende.has(o))) {
    datenstand.bookBasisStand = String(snap.erzeugt);
    mutiert = true;
  }
  // Auch die REINE Basis muss sofort gespeichert werden. Sonst ist sie beim
  // naechsten Start weg, der Lauf gilt wieder als "erster" - und eine echte
  // Word-Aenderung rutscht still durch. Eine verschwiegene Aenderung ist
  // schlimmer als ein Fehlalarm.
  // Merker gehen auf DIESES Geraet (v130) - kein Cloud-Schreibvorgang, kein
  // Ping-Pong mit dem anderen Geraet.
  if (merkerNeu) merkerSichern();
  if (mutiert) datenstandPersistieren();
  bookGeaendert = geaendert;
  return [...geaendert.keys()];
}

// Dateien gegen Daten (v137, Backlog 7 + 28).
//
// REIN wie bestandBefunde(): Marken rein, Dateiliste rein, Befunde raus. Die
// Liste wird hier NICHT geholt - sie kommt aus bookAenderungenPruefen().
// Gleiches Muster und gleicher Grund wie bei sicherungenAussortieren(): so
// prueft der Test beide Faelle ohne OneDrive und ohne DOM.
//
// Zwei Befunde, mit Absicht verschieden eingestuft:
//
//   falscher Ordner -> FEHLER, mit Reparatur. `m.bookordner` ist das Feld
//     "wo die Datei liegt", NICHT das Rating - die beiden duerfen
//     auseinanderlaufen (Landpark, urbanjngl, 11.09.). Stimmt es nicht,
//     zeigt bookPfad() ins Leere und die Gruppenanzeige luegt.
//
//   verwaiste Datei -> HINWEIS, ohne Reparatur. Sie kann gewollt sein
//     (Entwurf, Zwischenstand, von Hand angelegt). Als Fehler wuerde sie die
//     Warnkarte bei JEDEM Start hochziehen und waere nach drei Tagen Tapete
//     - dieselbe Falle wie beim 4-Sekunden-Banner vom 04.09.
//
// Ein nicht gelesener Ordner fehlt in `dateien` und erzeugt deshalb gar
// nichts. Geschwiegen wird hier vom Aufbau her, nicht durch eine Sonderabfrage
// - das ist die Projektregel "lieber schweigen als raten" als Struktur.
//
// ponytail: liegt dieselbe Datei in ZWEI Ordnern, gewinnt der zuletzt
// gelesene. Aufmachen, wenn Kopien real vorkommen - dann ist "doppelt
// vorhanden" ein eigener Befund und keine stille Auswahl.
function bestandDateiBefunde(marken, dateien) {
  const fehler = [], hinweise = [];
  if (!dateien || !dateien.size) return { fehler: fehler, hinweise: hinweise };
  // Wo liegt welche Datei wirklich? Schluessel des Markennamens -> Fundort.
  const gefunden = new Map();
  for (const paar of dateien) {
    const ordner = paar[0];
    for (const datei of paar[1].keys()) {
      const t = BOOK_DATEI.exec(String(datei));
      if (t) gefunden.set(schluessel(t[1]), { ordner: ordner, datei: datei });
    }
  }
  const bekannt = new Set();
  for (const m of marken || []) {
    const s = schluessel(m.name);
    bekannt.add(s);
    const ort = gefunden.get(s);
    if (!ort) continue;                       // keine Datei -> nicht mein Fall
    const soll = String(bookOrdner(m) || "").trim().toUpperCase();
    if (!soll || soll === String(ort.ordner).toUpperCase()) continue;
    fehler.push({ name: m.name, art: "book-falscher-ordner",
      ordner: ort.ordner,
      text: "Datei liegt in \u201e" + ort.ordner + " Brands\u201c, erwartet "
            + "wurde \u201e" + soll + " Brands\u201c" });
  }
  for (const paar of gefunden) {
    if (bekannt.has(paar[0])) continue;
    hinweise.push({ name: paar[1].datei, art: "book-verwaist",
      text: "liegt in \u201e" + paar[1].ordner + " Brands\u201c, dazu gibt es "
            + "keine Marke" });
  }
  return { fehler: fehler, hinweise: hinweise };
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

// ---------------------------------------- Excel aus der Vorlage (v80)
// Dieselbe Mechanik wie docxBefuellen: die Datei ist ein ZIP mit XML,
// JSZip oeffnet sie im Browser, Graph laedt sie zurueck. Unterschied zum
// Word: dort wird ein Platzhalter ersetzt, hier werden Tabellenzeilen neu
// gebaut.
//
// Drei Entscheidungen, die das klein halten:
//   1. Die Datenzeilen werden KOMPLETT neu erzeugt, nicht einzeln
//      gepatcht. Muster ist die erste Datenzeile der Vorlage - dort steht
//      der Style je Spalte (s="12"/"13"/"40") schon drin, die App muss
//      ihn nie berechnen. Auch die Datumsformate haengen daran.
//   2. Texte gehen als t="inlineStr" direkt in die Zelle. Damit bleibt
//      xl/sharedStrings.xml unangetastet - sonst muesste jeder neue Text
//      dort angehaengt und sein Index verwaltet werden.
//   3. Formeln werden nicht angefasst. Damit Excel sie mit den neuen
//      Zahlen rechnet, setzt fullCalcOnLoad das Neuberechnen beim Oeffnen
//      an - eine Zeile statt calcChain-Pflege.
const XLSM_TYP = "application/vnd.ms-excel.sheet.macroEnabled.12";

// Spaltenindex -> Excel-Buchstabe. 0 -> "A", 25 -> "Z", 26 -> "AA".
function spalteName(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// "2026-08-17" oder "17.08.2026" -> Excel-Serienzahl (Tage seit
// 30.12.1899). null, wenn nichts Brauchbares drinsteht.
// Gerechnet wird in UTC: mit lokalen Daten verschiebt die Sommerzeit das
// Ergebnis um einen Tag. Im PC-Generator dieselbe Falle - dort deshalb
// auch eine Serienzahl statt eines datetime an Excel-COM.
function excelSerial(text) {
  const t = String(text || "").trim();
  let j, m, d, tr = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (tr) { j = tr[1]; m = tr[2]; d = tr[3]; }
  else {
    tr = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!tr) return null;
    d = tr[1]; m = tr[2]; j = tr[3];
  }
  return Math.round(Date.UTC(+j, +m - 1, +d) / 86400000) + 25569;
}

// Eine Zelle. Zahl -> <v>, Text -> inlineStr, leer -> Zelle ohne Inhalt
// (der Style muss trotzdem stehen, sonst verliert sie die Formatierung).
function xlsxZelle(ref, stil, wert) {
  const s = stil ? ' s="' + stil + '"' : "";
  if (wert === null || wert === undefined || wert === "")
    return "<c r=\"" + ref + "\"" + s + "/>";
  if (typeof wert === "number")
    return "<c r=\"" + ref + "\"" + s + "><v>" + wert + "</v></c>";
  return "<c r=\"" + ref + "\"" + s + " t=\"inlineStr\"><is><t xml:space=\"preserve\">"
    + xmlText(wert) + "</t></is></c>";
}

// Ersetzt alle Datenzeilen eines Blatts (alles unter der Kopfzeile).
// Liefert das neue XML und die letzte belegte Zeilennummer.
function xlsxBlatt(xml, kopfzeile, zeilen) {
  const alle = [...xml.matchAll(/<row r="(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)];
  const daten = alle.filter((m) => +m[1] > kopfzeile);
  if (!daten.length) throw new Error("Vorlage hat keine Datenzeile als Muster");
  // Muster: Zeilenattribute (Hoehe) und Style je Spalte aus der ersten
  // Datenzeile. spans wird neu gesetzt, es haengt an der Spaltenzahl.
  const attr = daten[0][2].replace(/ spans="[^"]*"/, "");
  const stile = {};
  for (const c of (daten[0][3] || "").matchAll(/<c r="([A-Z]+)\d+"([^>]*)>?/g)) {
    const s = c[2].match(/s="(\d+)"/);
    if (s) stile[c[1]] = s[1];
  }
  const neu = zeilen.map((werte, i) => {
    const r = kopfzeile + 1 + i;
    const zellen = werte.map((w, j) =>
      xlsxZelle(spalteName(j) + r, stile[spalteName(j)], w)).join("");
    return '<row r="' + r + '"' + attr + ' spans="1:' + werte.length + '">'
      + zellen + "</row>";
  }).join("");
  const von = daten[0].index;
  const letzte = daten[daten.length - 1];
  const bis = letzte.index + letzte[0].length;
  return { xml: xml.slice(0, von) + neu + xml.slice(bis),
           letzteZeile: kopfzeile + zeilen.length };
}

// Tabellenbereich (und der Autofilter darin) muss die neue Zeilenzahl
// abdecken - sonst stehen Zeilen ausserhalb der Tabelle und Andreas
// bedingte Formatierung greift dort nicht.
function xlsxTabelle(xml, letzteZeile) {
  return xml.replace(/ref="([A-Z]+)(\d+):([A-Z]+)\d+"/g,
    (_, a, z1, b) => 'ref="' + a + z1 + ":" + b + letzteZeile + '"');
}

// Regex-Sonderzeichen in einem Blattnamen entschaerfen ("Brand Rating
// (Entwurf)" hat Klammern, die sonst als Gruppe gelesen wuerden).
function reEscape(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Blattname -> Pfad im ZIP. Die Nummer im Dateinamen sagt NICHTS ueber
// die Reihenfolge: "Brand Rating" liegt in sheet4.xml, seine Tabelle aber
// nur zufaellig in table4.xml. Der Weg fuehrt immer ueber workbook.xml
// (Name -> r:id) und die rels-Datei (r:id -> Datei).
async function xlsxBlattPfad(zip, blattName) {
  const wb = await zip.file("xl/workbook.xml").async("string");
  const treffer = wb.match(
    new RegExp('<sheet[^>]*name="' + reEscape(blattName) + '"[^>]*>'));
  if (!treffer) throw new Error("Blatt fehlt in der Vorlage: " + blattName);
  const rid = treffer[0].match(/r:id="([^"]+)"/);
  if (!rid) throw new Error("Blatt ohne r:id: " + blattName);
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const ziel = rels.match(
    new RegExp('Id="' + rid[1] + '"[^>]*Target="([^"]+)"'));
  if (!ziel) throw new Error("Blattdatei nicht auffindbar: " + blattName);
  return "xl/" + ziel[1].replace(/^\/?xl\//, "");
}

// Die Tabellendefinitionen eines Blatts (0..n), ueber seine rels-Datei.
async function xlsxTabellenPfade(zip, blattPfad) {
  const rels = zip.file(blattPfad.replace("xl/worksheets/",
    "xl/worksheets/_rels/") + ".rels");
  if (!rels) return [];
  const text = await rels.async("string");
  return [...text.matchAll(/Target="([^"]*tables\/[^"]+)"/g)]
    .map((m) => "xl/tables/" + m[1].split("/").pop());
}

// Befuellt eine Excel-Vorlage im Speicher.
// blaetter: [{ name, kopfzeile, zeilen }] - zeilen ist eine Funktion, die
// die Kopftexte der Vorlage bekommt und die Zeilen liefert (Arrays in
// Spaltenreihenfolge: Zahl, Text oder "" fuer leer).
// Liefert einen ArrayBuffer, den Graph per PUT hochladen kann.
async function xlsxBefuellen(puffer, blaetter) {
  const zip = await JSZip.loadAsync(puffer);
  // Einmal lesen, von beiden Blatt-Arten gebraucht
  const sharedDatei = zip.file("xl/sharedStrings.xml");
  const shared = sharedDatei
    ? xlsxSharedStrings(await sharedDatei.async("string")) : [];
  for (const b of blaetter) {
    const pfad = await xlsxBlattPfad(zip, b.name);
    // Kennzahlen-Blatt: nur Zellen setzen, Zeilen und Formeln bleiben
    if (b.kennzahlen) {
      const k = xlsxKennzahlen(await zip.file(pfad).async("string"),
        shared, b.kennzahlen);
      if (!k.zeilen)
        throw new Error("Kennzahlen-Blatt: keine bekannte Beschriftung in "
          + "Spalte A gefunden");
      zip.file(pfad, k.xml);
      continue;
    }
    const tabellen = await xlsxTabellenPfade(zip, pfad);
    // Kopftexte kommen aus der Tabellendefinition, NICHT aus der Kopfzeile
    // des Blatts: dort stehen nur Verweise in xl/sharedStrings.xml. In
    // tableColumn steht der Text im Klartext.
    const namen = tabellen.length
      ? [...(await zip.file(tabellen[0]).async("string"))
          .matchAll(/<tableColumn[^>]*name="([^"]*)"/g)]
          .map((m) => m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"'))
      : [];
    const alt = await zip.file(pfad).async("string");
    const neu = xlsxBlatt(alt, b.kopfzeile, b.zeilen(namen));
    // <dimension> mitziehen: Excel liest daraus den belegten Bereich
    zip.file(pfad, neu.xml.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)\d+"\/>/,
      '<dimension ref="$1:$2' + neu.letzteZeile + '"/>'));
    for (const t of tabellen)
      zip.file(t, xlsxTabelle(await zip.file(t).async("string"),
        neu.letzteZeile));
  }
  // Formeln (die Quoten im Kennzahlen-Blatt) bleiben stehen; damit Excel
  // sie mit den neuen Zahlen rechnet, beim Oeffnen einmal alles neu
  // rechnen. Ohne das zeigte die Datei die zwischengespeicherten Altwerte.
  const wbPfad = "xl/workbook.xml";
  let wb = await zip.file(wbPfad).async("string");
  wb = wb.includes("<calcPr")
    ? wb.replace(/<calcPr[^>]*?\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1"/>')
    : wb.replace("</workbook>", '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
  zip.file(wbPfad, wb);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

// --- Kennzahlen-Blatt: einzelne Zellen setzen -------------------------
// Andere Schreibart als bei den Listen, und das mit Absicht: dort werden
// alle Datenzeilen neu gebaut, hier duerfen die Zeilen gerade NICHT
// angefasst werden - in Zeile 8 und 10 stehen Andreas Quotenformeln.
// Geschrieben werden nur die sechs gezaehlten Werte, je Monatsspalte eine
// Zelle. Wie schreibe_kennzahlen() am PC.
const KENNZAHL_LABELS = {
  marken: "Anzahl kontaktierter Marken",
  pitches: "Anzahl Pitches",
  followups: "Anzahl Follow-ups",
  antworten: "Antworten insgesamt",
  positiv: "Positive Antworten",
  nach_erstkontakt: "Antworten nach Erstkontakt",
};

// xl/sharedStrings.xml -> Array der Texte. Die Kopfzeile und die
// Beschriftungen in Spalte A stehen dort, im Blatt selbst steht nur der
// Index (t="s"). Beim Schreiben umgehen wir sharedStrings per inlineStr,
// beim LESEN fuehrt aber kein Weg daran vorbei.
function xlsxSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
}

// Klartext einer Zelle, egal ob sharedString, inlineStr oder Zahl.
function xlsxZellText(xml, ref, shared) {
  const treffer = xml.match(new RegExp(
    '<c r="' + ref + '"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)'));
  if (!treffer || !treffer[2]) return "";
  if (/t="s"/.test(treffer[1])) {
    const i = treffer[2].match(/<v>(\d+)<\/v>/);
    return i ? (shared[+i[1]] || "") : "";
  }
  const inline = treffer[2].match(/<t[^>]*>([\s\S]*?)<\/t>/);
  if (inline) return inline[1].replace(/&amp;/g, "&");
  const zahl = treffer[2].match(/<v>([\s\S]*?)<\/v>/);
  return zahl ? zahl[1] : "";
}

// Setzt eine einzelne Zelle und behaelt ihren Style. Fehlt die Zelle im
// XML, passiert nichts - besser eine Zahl fehlt, als dass die Datei
// kaputtgeht.
function xlsxZelleSetzen(xml, ref, wert) {
  const re = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
  const treffer = xml.match(re);
  if (!treffer) return xml;
  const stil = treffer[1].match(/s="(\d+)"/);
  return xml.replace(re, xlsxZelle(ref, stil ? stil[1] : null, wert));
}

// "01.06. - 30.06.2026" -> { start: "01.06.2026", ende: "30.06.2026" }
// Das Jahr steht nur einmal, am Ende - es gilt fuer beide Daten.
function xlsxZeitraumKopf(text) {
  const zahlen = String(text || "").match(/\d+/g);
  if (!zahlen || zahlen.length < 5) return null;
  const jahr = zahlen[zahlen.length - 1];
  const zwei = (z) => String(z).padStart(2, "0");
  return { start: zwei(zahlen[0]) + "." + zwei(zahlen[1]) + "." + jahr,
           ende: zwei(zahlen[2]) + "." + zwei(zahlen[3]) + "." + jahr };
}

// Traegt die Kennzahlen ins Blatt. zeitraeume sind die aus snapshot.json
// (start/ende als "TT.MM.JJJJ", Werte fertig gerechnet unter .gesamt).
// Zeilen werden ueber die Beschriftung in Spalte A gesucht, nicht ueber
// feste Nummern - dieselbe Lehre wie am PC (30.08.: Zeilenversatz beim
// Umbau der Live-Datei).
function xlsxKennzahlen(xml, shared, zeitraeume) {
  const zeilen = {};
  for (let r = 4; r <= 40; r++) {
    const text = xlsxZellText(xml, "A" + r, shared).trim();
    for (const [schluessel, label] of Object.entries(KENNZAHL_LABELS))
      if (text === label) zeilen[schluessel] = r;
  }
  let neu = xml, spalten = 0;
  for (let c = 1; c < 30; c++) {
    const sp = spalteName(c);
    const kopf = xlsxZeitraumKopf(xlsxZellText(xml, sp + "3", shared));
    if (!kopf) continue;
    const z = zeitraeume.find((x) => x.start === kopf.start &&
                                     x.ende === kopf.ende);
    if (!z || !z.gesamt) continue;
    for (const [schluessel, zeile] of Object.entries(zeilen))
      neu = xlsxZelleSetzen(neu, sp + zeile, z.gesamt[schluessel] || 0);
    spalten += 1;
  }
  return { xml: neu, spalten, zeilen: Object.keys(zeilen).length };
}

// --- Spaltenzuordnung: Kopftext der Vorlage -> Feld im Datenstand ------
// Spiegel von _rating_spalte()/_pitch_spalte() in export_snapshot.py,
// inklusive Reihenfolge: "Brand" steckt auch in "Brandfit" und
// "Brand-Book", deshalb kommt es zuletzt. Unbekannte Spalten werden zu
// "extra:<Kopftext>" - dieselben Schluessel, die der Import vergibt.
// Damit landen Andreas "Paid Ad Aktivitaet" und "Adventskalender 2026"
// ohne Sonderfall wieder in ihrer eigenen Spalte.
function ratingSpalte(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("book")) return "brandbook";
  if (t.includes("fit")) return "brandfit";
  if (t.includes("begeisterung")) return "begeisterung";
  if (t.includes("erfolg")) return "erfolgschance";
  if (t.includes("rating")) return "rating";
  if (t.includes("status")) return "status";
  if (t.includes("kategorie") || t.includes("nische")) return "kategorie";
  if (t.includes("notiz")) return "notizen";
  if (t.startsWith("brand")) return "name";
  return "extra:" + String(text).trim();
}

function pitchSpalte(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith("name")) return "name";
  if (t.includes("rating")) return "rating";
  if (t.includes("kategorie") || t.includes("nische")) return "kategorie";
  if (t.includes("status")) return "status";
  if (t.includes("kontakt")) return "letzter_kontakt";   // vor "datum"!
  if (t.includes("koop")) return "kooperation";          // vor "datum"!
  if (t.includes("follow") || t.includes("hler")) return "zaehler";
  if (t.includes("aktion"))
    return t.includes("datum") ? "datum_naechste_aktion" : "naechste_aktion";
  if (t.includes("dringlich")) return null;  // die App rechnet die Ampel live
  return "extra:" + String(text).trim();
}

// Eine Brand-Rating-Zeile in Spaltenreihenfolge. Marken ohne Rating-Zeile
// (neu aus Book/Pitchliste) bekommen vorbelegt, was der Datenstand weiss -
// gleiche Regel wie zeile_brandrating() im PC-Generator.
function xlsxRatingZeile(m, spalten) {
  const br = m.brandrating, p = m.pitchliste || {};
  return spalten.map((s) => {
    if (s === "name") return m.name;
    if (br) return br[s] === undefined || br[s] === null ? "" : br[s];
    if (s === "rating") return p.rating || "";
    if (s === "kategorie") return p.kategorie || "";
    if (s === "brandbook") return m.quelle ? "✔️" : "";
    return "";
  });
}

// Eine Pitchlisten-Zeile. Datumsfelder als Serienzahl (das Zellformat der
// Vorlage macht daraus die Anzeige), "Dringlichkeit" bekommt das feste
// Zeichen - die Farbe macht Andreas bedingte Formatierung.
function xlsxPitchZeile(m, spalten) {
  const p = m.pitchliste || {};
  return spalten.map(([s, kopf]) => {
    if (s === "name") return m.name;
    if (s === "letzter_kontakt" || s === "datum_naechste_aktion") {
      const serial = excelSerial(p[s]);
      return serial === null ? "" : serial;
    }
    if (s) return p[s] === undefined || p[s] === null ? "" : p[s];
    if (String(kopf).toLowerCase().includes("dringlich")) return "●";
    return "";
  });
}

// Name -> Sortierschluessel mit Umlaut-Faltung, identisch zu
// sortschluessel() in excel_generator.py. localeCompare("de") waere
// naheliegender, sortiert aber nach anderer Regel (ue = u statt ue = ue)
// - dann haetten App und PC-Generator bei jeder Umlaut-Marke eine andere
// Reihenfolge. Gefaltet wird wie im Namensschluessel seit v74.
function xlsxSortSchluessel(name) {
  return String(name).toLowerCase().replace(/ä/g, "ae")
    .replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

// Sortierung wie im PC-Generator: Rating alphabetisch, Pitchliste nach
// Rating und dann Name. Andreas urspruengliche Zeilenreihenfolge steht
// nicht im Datenstand, es braucht also eine feste Regel.
function xlsxSortiertRating(marken) {
  const key = (m) => xlsxSortSchluessel(m.name);
  return [...marken].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

// Rating kommt aus der PITCHLISTE, nicht aus dem Brandrating - sonst
// weicht die Reihenfolge vom PC-Generator ab. Leeres Rating ganz nach
// hinten ("~" liegt hinter allen Buchstaben).
// Trenner MUSS die Escape-Sequenz "\x00" bleiben und darf nie wieder als
// rohes NUL-Byte im Quelltext stehen (v118, 12.09.): ein einziges NUL macht
// app.js fuer Git zu einer BINAERDATEI. Dann greift "* text=auto eol=lf" aus
// .gitattributes nicht mehr - der Datei-Inhalt pendelte monatelang
// unbemerkt zwischen CRLF und LF, obwohl CRLF laut Projektregel die
// JS-Selbsttests lahmlegt (04.09. genau so passiert). Zur Laufzeit ist die
// Escape-Sequenz identisch, geprueft: charCodeAt === 0.
function xlsxSortiertPitch(marken) {
  const key = (m) => [String(m.pitchliste.rating || "~").trim(),
                      xlsxSortSchluessel(m.name)].join("\x00");
  return marken.filter((m) => m.pitchliste)
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// --- Ordner: Vorlage und Export liegen NEBEN dem Datenbank-Ordner -------
//   /UGC/App/Datenbank   <- Datenbank-Ordner (Geraete-Einstellung)
//   /UGC/App/Vorlage     <- die .xlsm-Vorlage
//   /UGC/App/Export      <- hierhin schreibt die App
// Genau die Struktur, die der PC-Generator seit 05.09. benutzt. Deshalb
// keine zweite Einstellung: wer den Datenbank-Ordner richtig gesetzt hat,
// trifft auch die anderen beiden. Graph legt fehlende Ordner beim PUT
// NICHT an - fehlt "Export", meldet die App das als Fehler.
function excelNachbar(unter) {
  return datenBasis().replace(/\/[^/]+$/, "") + "/" + unter;
}

// "Brand-Uebersicht Update Template.xlsm" + "2026-09-06"
//   -> "Brand-Uebersicht Update 2026-09-06.xlsm"
//
// Stamm und Endung getrennt behandeln: entfernt man "Template" mitten im
// Namen, bleibt sonst ein Leerzeichen stehen und der Name bekommt zwei
// davon - "Update  2026-09-06.xlsm". Gefunden am 06.09., weil dieselbe
// Excel danach doppelt im Export-Ordner lag, einmal vom PC und einmal von
// der App. Gleiche Regel wie frische_kopie() in excel_generator.py; laufen
// die beiden auseinander, entstehen wieder zwei Dateien.
function xlsxExportName(vorlageName, datum) {
  const punkt = vorlageName.lastIndexOf(".");
  const stamm = (punkt < 0 ? vorlageName : vorlageName.slice(0, punkt))
    .replace(/ ?Template ?/i, " ").replace(/\s+/g, " ").trim();
  return stamm + " " + datum + (punkt < 0 ? "" : vorlageName.slice(punkt));
}

// Erzeugt die Excel aus der Vorlage und legt sie in den Export-Ordner.
// Liefert einen Text fuer die Anzeige - jeder Fehler wird benannt, nichts
// wird still geschluckt (die Lehre aus v70/v71/v75).
async function excelErzeugen() {
  if (!datenstand || !datenstand.marken || !datenstand.marken.length)
    return "Kein Datenstand geladen.";
  if (typeof JSZip === "undefined") return "jszip.min.js fehlt.";
  const ordner = await OD.graphRoh(excelNachbar("Vorlage") + ":/children");
  if (!ordner) return "Nicht angemeldet.";
  if (!ordner.ok)
    return "Vorlage-Ordner nicht gefunden (HTTP " + ordner.status + "): " +
      excelNachbar("Vorlage").split("root:")[1];
  const liste = (await ordner.json()).value || [];
  const vorlage = liste.filter((f) => /\.xls[xm]$/i.test(f.name) &&
    !f.name.startsWith("~$")).sort((a, b) => a.name.localeCompare(b.name))[0];
  if (!vorlage) return "Keine Excel im Vorlage-Ordner.";

  const datei = await OD.graphRoh(
    excelNachbar("Vorlage") + "/" + vorlage.name + ":/content");
  if (!datei || !datei.ok) return "Vorlage nicht lesbar.";

  const marken = datenstand.marken;
  let inhalt;
  try {
    inhalt = await xlsxBefuellen(await datei.arrayBuffer(), [
      { name: "Brand Rating", kopfzeile: 3,
        zeilen: (namen) => xlsxSortiertRating(marken).map(
          (m) => xlsxRatingZeile(m, namen.map(ratingSpalte))) },
      { name: "Pitchliste", kopfzeile: 3,
        zeilen: (namen) => xlsxSortiertPitch(marken).map(
          (m) => xlsxPitchZeile(m, namen.map((k) => [pitchSpalte(k), k]))) },
      // Zahlen kommen fertig gerechnet aus dem Snapshot - die App rechnet
      // sie fuers Dashboard ohnehin. Ohne Snapshot bleibt das Blatt wie
      // es ist, statt Nullen hineinzuschreiben.
      ...(snap && snap.zeitraeume
        ? [{ name: "Kennzahlen", kennzahlen: snap.zeitraeume }] : []),
    ]);
  } catch (fehler) {
    return "Vorlage passt nicht: " + fehler.message;
  }

  // Gleicher Tag = gleicher Name = wird ersetzt. Sonst sammeln sich bei
  // jedem Probelauf Dateien an. Gleiche Regel wie im PC-Generator.
  const name = xlsxExportName(vorlage.name, lokalIso().slice(0, 10));
  const hoch = await OD.graphRoh(
    excelNachbar("Export") + "/" + name +
      ":/content?@microsoft.graph.conflictBehavior=replace",
    { method: "PUT", body: inhalt,
      headers: { "Content-Type": XLSM_TYP } });
  if (!hoch) return "Nicht angemeldet.";
  if (!hoch.ok)
    return hoch.status === 404
      ? "Export-Ordner fehlt: " + excelNachbar("Export").split("root:")[1] +
        " (Graph legt Ordner nicht selbst an)"
      : "Hochladen fehlgeschlagen (HTTP " + hoch.status + ").";
  return "✓ " + excelNachbar("Export").split("root:")[1] + "/" + name +
    " — " + xlsxSortiertRating(marken).length + " Marken, " +
    xlsxSortiertPitch(marken).length + " auf der Pitchliste";
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
//
// trenner (v121): normalerweise " ", weil wordText ueber ganze ZEILEN
// laeuft und die Zellen darin getrennt gehoeren ("06.09.2026 Follow Up 2").
// Innerhalb EINES Absatzes ist derselbe Trenner falsch: Word zerlegt einen
// Wert gern in mehrere Runs (Rechtschreibpruefung, rsid-Wechsel, ein
// kaufmaennisches Und), und aus "info@calibar.de" wird dann
// "info @ calibar.de". Gemessen am echten Bestand: 17 von 541 Wertzellen.
// Deshalb wordText(absatz, "") fuer Werte - das ist genau das, was
// python-docx (und damit ugc_core) liefert.
function wordText(s, trenner) {
  return (String(s).match(/<w:t[^>]*>[^<]*<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join(trenner === undefined ? " " : trenner)
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

// Wie zelleSetzen, aber WEITERE Absaetze der Zelle bleiben stehen.
//
// Warum das noetig ist: ugc_core.extract_kerninfos liest je Zelle nur die
// ERSTE Zeile (Briefing Abschnitt 7). Die App kennt Zeile 2 also gar nicht
// - ein zelleSetzen() wuerde sie beim Nachziehen still wegwerfen. Bei
// "Social Media" stehen bei Andrea durchaus zwei Links untereinander.
//
// <w:br/> INNERHALB des ersten Absatzes laesst sich so nicht retten: dort
// sind beide Zeilen ein Absatz, und die Formatierung eines einzelnen
// Umbruchs nachzubauen waere mehr Code als der ganze Fix. In dem Fall wird
// NICHT geschrieben (null) - der Aufrufer meldet es als Handarbeit.
// Lieber eine Meldung als eine verlorene Zeile in Andreas Word.
// Was in Zeile 1 der Zelle steht - und zwar so, wie ugc_core es liest:
// Runs ohne Trenner, nur der erste Absatz, getrimmt. Das ist die einzige
// richtige Vergleichsgrundlage fuer "steht schon so da".
//
// Zwei Fallen stecken hier drin, beide am echten Bestand gemessen:
//   * wordText(zelle) haengt ALLE Absaetze aneinander - bei einer Zelle mit
//     zwei E-Mail-Adressen kaeme "info@x.de together@x.de" heraus, was nie
//     einem App-Wert gleicht.
//   * wordText(..., " ") setzt zwischen Runs ein Leerzeichen - aus
//     "info@calibar.de" wird "info @ calibar.de".
// Zusammen betrafen die beiden 16 von 60 Books: die App haette dort bei
// JEDEM Speichern hochgeladen, ohne etwas zu aendern.
function ersteZeileText(tc) {
  const erster = (String(tc).match(/<w:p[\s>][\s\S]*?<\/w:p>/) || [tc])[0];
  return wordText(erster, "").trim();
}

function zelleErsteZeileSetzen(tc, text) {
  const absaetze = tc.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
  // <w:cr/> ist der zweite Umbruch, den Word kennt (Backlog 32, Fall 1).
  // Er verhaelt sich hier genau wie <w:br/>: beide Zeilen stehen in EINEM
  // Absatz. Ohne ihn mitzupruefen haette zelleSetzen() alles hinter dem
  // Umbruch weggeworfen - im echten Bestand am 17.09. 0 Treffer, aber das
  // gilt nur, bis Andrea die Zelle einmal mit Strg+Enter umbricht.
  if (/<w:(br|cr)[ />]/.test(absaetze[0] || tc)) return null;
  const eins = zelleSetzen(tc, text);
  return absaetze.length < 2 ? eins
    : eins.slice(0, -"</w:tc>".length) + absaetze.slice(1).join("") + "</w:tc>";
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
    //
    // ACHTUNG, hier wird EXAKT verglichen - anders als beim Anhaengen,
    // das seit v88 ueber historieSchluessel() normalisiert. Das ist
    // Absicht und kein vergessener Fall:
    // Andrea traegt Aktionen von Hand ein und schreibt "Follow Up",
    // die App schreibt "Follow up". Wuerde hier normalisiert verglichen,
    // loeschte ein Rueckgaengig in der App IHRE handgeschriebene Zeile
    // mit - die App darf aber nur zuruecknehmen, was sie selbst
    // geschrieben hat. Findet sie ihre Zeile nicht, sagt sie das
    // (bookHistorieMelden) statt auf gut Glueck etwas zu leeren.
    // Wer das hier "zur Konsistenz" normalisiert, baut genau den
    // Datenverlust ein, den v88 verhindern sollte.
    const i = zeilen.map(wordText).reduce((tr, t, j) =>
      (j > 0 && t.includes(datum) && t.includes(aktion) ? j : tr), -1);
    if (i < 0) return null;
    const leer = zeileBauen(zeilen[i], "", "");
    if (!leer) return null;
    tblNeu = tbl.replace(zeilen[i], () => leer);
  } else {
    // Steht der Eintrag schon da? Dann NICHT noch einmal anhaengen (v88).
    // Andrea traegt Aktionen auch von Hand ins Book ein; erledigt man
    // dieselbe Aktion danach in der App, stand sie zweimal drin - und
    // beide Seiten zaehlten sie doppelt (Befund 06.09.: "Coffeecycle
    // Hamburg", "Nuts and Golden"). Verglichen wird normalisiert, sonst
    // rutscht "Follow Up 2" neben "Follow up 2".
    // Beide Seiten als EIN Schluessel bilden: wordText(z) liefert die Zelle
    // "06.09.2026 Follow Up 2" am Stueck, deshalb hier auch Datum und
    // Aktion zusammen - sonst stuende links ein Trenner und rechts keiner.
    const suche = historieSchluessel(datum + " " + aktion);
    const schon = zeilen.some((z, j) =>
      j > 0 && historieSchluessel(wordText(z)) === suche);
    if (schon) return "dublette";
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

// ------------------------- Antwort ins Book (Baustein 2, Release 3, v132)
// Traegt eine Brandantwort in die Antwort-Tabelle ein: vier Spalten
// (Datum | Positiv | Negativ | Bemerkung) statt der zwei der Historie.
//
// Warum eine eigene Funktion statt historieXml mit einem Schalter:
// zeileBauen() setzt genau ZWEI Zellen und kopiert alles ab Zelle 3
// unveraendert aus der Vorlagenzeile mit. An einer vierspaltigen Tabelle
// waeren das Negativ und Bemerkung der VORLAGE - Andreas Text in einer
// fremden Zeile. Am Bestand gemessen (17.09., 64 Books): heute ist die
// letzte Zeile in 64 von 64 leer, wir kaemen damit durch. Nach der ersten
// App-Schreibung nicht mehr. Deshalb werden hier alle vier Zellen gesetzt.
//
// KEIN entfernen-Zweig, anders als historieXml. Zwei Gruende:
//   1. rueckgaengig() vergleicht ev[last].aktion gegen la.aktion; ein
//      Antwort-Ereignis hat aktion:"" - der Weg wird nie betreten
//      (Codex-Fund, nachgemessen 16.09.).
//   2. Andrea schreibt den ausfuehrlichen Text ueber "Brandbook oeffnen"
//      NACHTRAEGLICH in die Bemerkungsspalte. Ein Leeren der Zeile naehme
//      ihn mit - genau der Datenverlust, den v88 verhindern sollte.
// Wird "Antwort zuruecknehmen" gewuenscht, ist das ein eigener Auftrag mit
// eigener Frage: was passiert mit ihrem Text?

// Gegenstueck zu ugc_core._ist_antwort_tabelle - Kopfzelle 0 "Datum",
// Kopfzelle 1 "Positiv". ZELLENWEISE, nicht ueber den Zeilentext: die
// Historien-Tabelle beginnt ebenfalls mit "Datum", und ein Book, in dem
// irgendwo "positiv" im Kopf steht, wuerde sonst dort landen.
// Aendert sich die Regel, muss sie in ugc_core.py mitwandern - JS kann
// Python nicht importieren, das sind zwei Implementierungen derselben Regel.
function antwortTabelle(xml) {
  return (String(xml).match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || []).find((t) => {
    const kopf = wordZellen(wordZeilen(t)[0] || "");
    return kopf.length >= 2 &&
      wordText(kopf[0]).toLowerCase().includes("datum") &&
      wordText(kopf[1]).toLowerCase().includes("positiv");
  }) || null;
}

// Zeilenumbrueche raus, Raender weg. NICHT kosmetisch:
// Ein rohes Umbruchzeichen in <w:t> ist in OOXML KEIN Zeilenumbruch.
// Gemessen 17.09. an einer Book-Kopie: ugc_core liest es als Umbruch
// zurueck, Word zeigt EINE Zeile. App und PC-Import waeren sich einig,
// Andreas Bildschirm saehe etwas anderes - eine stille Abweichung wie die,
// die vom 06.09. bis v121 unentdeckt lief.
// Ein echter Umbruch braucht <w:br/>; das lohnt erst, wenn Andrea ihn
// verlangt - fuer den kurzen Satz in der App ist eine Zeile die Vorgabe
// (Workflow Brandantwort: "der kurze Satz in der App, der lange Text im
// Brandbook"). Bis dahin ist zusammenziehen ehrlicher als so tun als ob.
// ponytail: Umbruch wird zu Leerzeichen; <w:br/> nachruesten, falls Andrea
// mehrzeilige App-Bemerkungen will.
function antwortZelltext(s) {
  return String(s == null ? "" : s).replace(/\s*[\r\n]+\s*/g, " ").trim();
}

// Neue Antwort-Zeile aus einer Vorlagen-Zeile: alle vier Zellen werden
// gesetzt, Spalte 5+ (gibt es in keinem Book, aber kostenlos) bleibt stehen.
// `null` in werte[i] heisst: DIESE Zelle nicht anfassen, die der Vorlage
// bleibt wie sie ist. Gebraucht beim Korrigieren, wo Andreas nachgetragener
// Bemerkungstext stehen bleiben muss (siehe antwortXml).
function antwortZeileBauen(vorlage, werte) {
  const trPr = (vorlage.match(/<w:trPr>[\s\S]*?<\/w:trPr>/) || [""])[0];
  const zellen = wordZellen(vorlage);
  if (zellen.length < 4) return null;
  return "<w:tr>" + trPr +
    zellen.slice(0, 4)
      .map((z, i) => werte[i] === null
        ? z
        : zelleSetzen(z, antwortZelltext(werte[i]))).join("") +
    zellen.slice(4).join("") + "</w:tr>";
}

// Gibt die neue XML zurueck, "dublette" (steht schon da) oder null
// (Tabelle/Zeile nicht gefunden) - dann bleibt das Book unangetastet,
// statt es kaputtzuschreiben. Gleiche drei Ausgaenge wie historieXml.
function antwortXml(xml, datum, positiv, negativ, bemerkung) {
  const tbl = antwortTabelle(xml);
  if (!tbl) return null;
  const zeilen = wordZeilen(tbl);
  if (zeilen.length < 2) return null;
  // Steht die Antwort schon da? Verglichen werden NUR Datum und die beiden
  // Kreuze - die Bemerkung bleibt bewusst draussen (Tobias, 17.09.).
  // Andrea ergaenzt den langen Text nachtraeglich im Word; naehme man ihn
  // in den Vergleich auf, erkennt die App ihre eigene Zeile danach nicht
  // wieder und schriebe sie ein zweites Mal.
  // Gegenprobe am Bestand (17.09., 64 Books, 21 Antworten): keine Marke hat
  // zwei Antworten am selben Tag. Das Kreuz steht mal "X", mal "x" -
  // historieSchluessel() normalisiert Schreibweise und Leerzeichen weg.
  const suche = historieSchluessel(datum, positiv, negativ);
  const nurDatum = historieSchluessel(datum);
  // Das DATUM ist der Anker, nicht der ganze Schluessel: dieselbe Zeile ist
  // je nach Inhalt eine Dublette (nichts tun) oder eine Korrektur
  // (ersetzen). Am Bestand gemessen (17.09., 64 Books, 21 Antworten) hat
  // keine Marke zwei Antworten am selben Tag - ein Datum trifft hoechstens
  // eine Zeile.
  let treffer = -1;
  for (let j = 1; j < zeilen.length; j++) {
    const c = wordZellen(zeilen[j]);
    if (c.length < 2) continue;
    if (historieSchluessel(wordText(c[0])) !== nurDatum) continue;
    if (historieSchluessel(wordText(c[0]), wordText(c[1]),
                           wordText(c[2] || "")) === suche) {
      // Datum und Kreuze stimmen ueberein - aber steht im Book noch KEINE
      // Bemerkung und wir haben eine, ist das ein Nachtrag, keine Dublette
      // (Codex-Befund, nachgemessen 17.09.). Ohne diesen Zweig kam eine
      // nachtraeglich ergaenzte Bemerkung nie ins Word, und der wartende
      // Auftrag wurde als erledigt gestrichen.
      const bemImBook = wordText(c[3] || "").trim();
      if (bemImBook || !String(bemerkung == null ? "" : bemerkung).trim()) {
        return "dublette";
      }
    }
    treffer = j;
  }
  const werte = [datum, positiv, negativ, bemerkung];
  let tblNeu;
  if (treffer > 0) {
    // Korrektur derselben Zeile (Tobias, 17.09.: "korrigieren statt
    // zuruecknehmen"). Geaendert werden Datum und die beiden Kreuze.
    //
    // Die BEMERKUNG wird nur gesetzt, wenn die Zelle im Book leer ist.
    // Andrea schreibt den ausfuehrlichen Text ueber "Brandbook oeffnen"
    // direkt ins Word; ein Korrekturklick in der App wuerde ihn sonst durch
    // den kurzen App-Satz ersetzen - genau der Datenverlust, den v88
    // verhindern sollte, und dieselbe Regel wie bei den Kerninfos (v121,
    // "LEER ueberschreibt NIE", hier eine Stufe strenger).
    // ponytail: Book-Text gewinnt immer. Feiner unterscheiden (nur
    // ueberschreiben, wenn der Text noch der zuletzt von der App
    // geschriebene ist) erst, wenn Andrea es vermisst - dafuer muesste der
    // alte Wert mitgereicht werden.
    const alt = wordZellen(zeilen[treffer]);
    if (wordText(alt[3] || "").trim()) werte[3] = null;
    const neu = antwortZeileBauen(zeilen[treffer], werte);
    if (!neu) return null;
    tblNeu = tbl.replace(zeilen[treffer], () => neu);
  } else {
    const leer = zeilen.findIndex((z, j) => j > 0 && !wordText(z).trim());
    const neu = antwortZeileBauen(zeilen[zeilen.length - 1], werte);
    if (!neu) return null;
    tblNeu = leer > 0
      ? tbl.replace(zeilen[leer], () => neu)
      : tbl.slice(0, -"</w:tbl>".length) + neu + "</w:tbl>";
  }
  // Funktions-Ersatz wie bei historieXml: ein "$&" in Andreas Bemerkung
  // waere sonst ein Rueckverweis-Muster.
  return xml.replace(tbl, () => tblNeu);
}

// ------------------------------------- Kerninfos ins Book (Fix B, v121)
// Aendert Andrea in der App ein Feld, das AUCH in der Kerninfos-Tabelle des
// Brand-Books steht, wird es dort nachgezogen. Bis v120 passierte das nie:
// beim Rating-Wechsel wanderte nur die DATEI in den neuen Ordner
// (bookVerschieben), ihr Inhalt blieb auf dem Stand vom Erstellungstag.
// App sagt A, Word sagt B, der Ordner heisst "A Brands". "Daten pruefen"
// (v105) FINDET das seit dem 06.09., abstellen konnte es niemand.
//
// Dieselbe Mechanik wie historieXml, nur die andere Tabelle - und mit drei
// Regeln, die es dort nicht braucht:
//
//   1. LEER ueberschreibt NIE. Der App-Stand kommt aus dem letzten
//      PC-Import und kann ein Feld schlicht noch nicht kennen; leer heisst
//      "weiss ich nicht", nicht "loesch das". Ein Ansprechpartner, der nur
//      im Word steht, waere sonst nach dem ersten Rating-Wechsel weg.
//   2. GLEICHER Wert = kein Schreibvorgang. Ohne das laedt jedes Speichern
//      das Book hoch, ohne etwas zu aendern - ein Risiko ohne Nutzen.
//   3. Fremde Zeilen bleiben stehen. Eine Marke hat "Whatsapp" in der
//      Tabelle; was nicht in `werte` steht, wird nicht angefasst.
//
// Gefunden wird die Tabelle wie in ugc_core.extract_kerninfos und
// template_platzhalter.py: ueber die erste Zelle, nicht ueber die Position.
// Verglichen wird ueber historieSchluessel() - "Rating (A-D):",
// "rating (A-D)" und das mit Halbgeviertstrich getippte "Rating (A–D)"
// sind derselbe Schluessel.
//
// Rueckgabe: { xml, geaendert: [Label], handarbeit: [Label] } - oder null,
// wenn die Tabelle fehlt. null heisst "Andrea muss ran", NICHT "schreib
// trotzdem irgendwas".
function wordZeilen(x) {
  return String(x).match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
}

function wordZellen(x) {
  return String(x).match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
}

// Die Kerninfos-Tabelle eines Dokuments, oder null.
//
// Eigene Funktion, damit die Bestandsprobe (tests/probe_echte_books.js)
// GENAU DIESE Erkennung benutzt statt einer nachgebauten. Eine Probe, die
// nach einer anderen Regel sucht als die App, prueft irgendwann etwas
// anderes als das, was ausgeliefert wird.
function kerninfosTabelle(xml) {
  return (String(xml).match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || []).find((t) => {
    const erste = wordZellen(wordZeilen(t)[0] || "");
    return erste.length >= 2 &&
      historieSchluessel(wordText(erste[0])) === "name";
  }) || null;
}

function kerninfosXml(xml, werte) {
  const tbl = kerninfosTabelle(xml);
  if (!tbl) return null;
  // Nur nicht-leere Werte, auf den Vergleichsschluessel gezogen (Regel 1).
  const gesucht = new Map();
  for (const [label, wert] of Object.entries(werte)) {
    const w = String(wert == null ? "" : wert).trim();
    if (w) gesucht.set(historieSchluessel(label), [label, w]);
  }
  let tblNeu = tbl;
  const geaendert = [], handarbeit = [];
  for (const z of wordZeilen(tbl)) {
    const zellen = wordZellen(z);
    if (zellen.length < 2) continue;
    const treffer = gesucht.get(historieSchluessel(wordText(zellen[0])));
    if (!treffer) continue;                       // fremde Zeile (Regel 3)
    const [label, wert] = treffer;
    if (ersteZeileText(zellen[1]) === wert) continue;         // Regel 2
    const zelleNeu = zelleErsteZeileSetzen(zellen[1], wert);
    if (!zelleNeu) { handarbeit.push(label); continue; }
    // Funktions-Ersatz an beiden Stellen: ein "$&" im Wert (kommt in
    // Instagram-Links vor) wuerde sonst als Rueckverweis gelesen und den
    // gefundenen Text einsetzen statt den Wert.
    tblNeu = tblNeu.replace(z, () => z.replace(zellen[1], () => zelleNeu));
    geaendert.push(label);
  }
  return { xml: geaendert.length ? xml.replace(tbl, () => tblNeu) : xml,
           geaendert, handarbeit };
}

// ------------------------------------------------ Datenlogging (v103)
//
// Am 10.09. haben wir einen Abend damit verbracht, aus Andreas Saetzen zu
// erraten, was die App getan hat ("ne der frisst es nicht"). Die Antwort
// stand die ganze Zeit im Graph-Fehlercode - den hat der alte Code mit
// catch(_) weggeworfen. Das hier stellt das ab.
//
// Drei Stufen, umschaltbar in den Einstellungen:
//   aus        nichts. Standard.
//   einfach    jeder OneDrive-Zugriff: Zeit, Marke, Aktion, Pfad, Methode,
//              HTTP-Status, GRAPH-FEHLERCODE, Versuch, Dauer.
//   erweitert  zusaetzlich SOLL/IST: was wollten wir schreiben, was stand
//              schon da, welche Schutzregel hat gegriffen.
//
// Gedacht als Werkzeug auf Zeit: laufen lassen, bis die Fehler weg sind,
// danach wieder auf "aus".
const LOG_STUFEN = [["", "aus"], ["einfach", "einfach"],
                    ["erweitert", "erweitert"]];

function logStufe() { return einst.logStufe || ""; }

// Geschwisterordner der Datenbank: /UGC/App/Datenbank -> /UGC/App/Logfiles
function logBasis() {
  return datenBasis().replace(/\/[^/]+$/, "/Logfiles");
}

// EINE Datei je Tag UND GERAET. Andrea arbeitet mit Handy und PC; teilten
// sie sich eine Datei, muesste jeder Schreibvorgang lesen-aendern-schreiben
// machen - und wir haetten im Diagnosewerkzeug genau das Sync-Problem, das
// wir damit suchen. Getrennte Dateien brauchen keinen Abgleich.
function logGeraet() {
  if (!einst.geraetName) {
    const ua = navigator.userAgent || "";
    const art = /Android|iPhone|iPad/i.test(ua) ? "Handy"
      : /Windows|Macintosh|Linux/i.test(ua) ? "PC" : "Geraet";
    // Zufallsanhaengsel, damit zwei Handys sich nicht dieselbe Datei teilen.
    einst.geraetName = art + "-" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  }
  return einst.geraetName;
}

function logDatei() {
  return logBasis() + "/" + lokalIso().slice(0, 10) + " " + logGeraet() + ".jsonl";
}

let logPuffer = [];
let logGeladen = false;      // Tagesdatei in dieser Sitzung schon geholt?
let logSchreibt = false;
// Wie viele Zeilen aus dem Puffer schon IN der Datei stehen (v106).
// Bis v105 wurde der Puffer nach dem Sichern geleert - und weil jeder
// Schreibvorgang die Datei mit conflictBehavior=replace ersetzt, loeschte
// die ZWEITE Sicherung einer Sitzung alles, was die erste geschrieben
// hatte. Nachgemessen am 11.09.: von 45 Zeilen ueberlebten 25, die ersten
// 20 waren weg - ausgerechnet im Werkzeug, mit dem wir Fehler suchen.
// ponytail: der Puffer haelt jetzt die ganze Sitzung im Speicher und jede
// Sicherung schreibt die Datei neu. Bei ~300 Byte je Zeile sind das auch
// nach 10.000 Ereignissen erst 3 MB - fuer ein Werkzeug auf Zeit in
// Ordnung. Wird es je zu viel: Dateien je Stunde statt je Tag.
let logGesichert = 0;

// Nur bei "erweitert" mitschreiben. Als Streuung gedacht:
//   logZeile("book-schreiben", { ..., ...logMehr({ soll, ist }) })
function logMehr(daten) {
  return logStufe() === "erweitert" ? daten : {};
}

function logZeile(art, daten) {
  if (!logStufe()) return;
  try {
    logPuffer.push(JSON.stringify({ z: lokalIso(), art, ...daten }));
  } catch (_) {
    // Nie werfen (zirkulaere Daten o.ae.) - aber auch nicht mehr schweigen
    // (Backlog 3). Bis 17.09. stand hier ein blankes `return;`: der Logger
    // war damit blind fuer seine EIGENEN Aussetzer. Wer spaeter im Protokoll
    // nach einem Vorgang sucht, der nie angekommen ist, sucht dann an der
    // falschen Stelle.
    //
    // GENAU EINMAL je Sitzung. Steckt der Fehler in einer Schleife, wuerde
    // jede Wiederholung denselben Eintrag schreiben und den Puffer fluten -
    // das Gegenteil dessen, wofuer das Protokoll da ist.
    //
    // Der Merker haengt an der Funktion statt an einer Modul-Variablen:
    // drei Testdateien schneiden logZeile() heraus und eval-en sie einzeln;
    // eine neue Variable daneben muesste in jeder davon nachgetragen werden.
    if (!logZeile.eigenerFehler) {
      logZeile.eigenerFehler = true;
      try {
        logPuffer.push(JSON.stringify(
          { z: lokalIso(), art: "log-fehler", betraf: String(art) }));
      } catch (_) { /* dann eben nicht - hier ist wirklich Schluss */ }
    }
    return;
  }
  // Nach 40 NEUEN Zeilen sichern, nicht nach 40 im Puffer. Seit v106
  // bleibt der Puffer stehen; ein Vergleich gegen die Gesamtlaenge wuerde
  // ab der ersten Sicherung bei JEDER weiteren Zeile erneut ausloesen.
  if (logPuffer.length - logGesichert >= 40) logSichern();
}

// Graph legt seinen Grund in den Antwortkoerper - "resourceLocked",
// "resourceModified", "activityLimitReached", "itemNotFound". Genau das
// Feld, das uns heute gefehlt hat. clone() weil der Aufrufer den Koerper
// noch braucht.
async function logFehlerCode(antwort) {
  // Bei ausgeschaltetem Logging gar nicht erst in den Koerper schauen -
  // der Aufrufer baut sein Objekt trotzdem, das soll nichts kosten.
  if (!logStufe()) return "";
  if (!antwort) return "keine-antwort";
  if (antwort.ok) return "";
  try {
    const j = JSON.parse(await antwort.clone().text());
    return (j && j.error && j.error.code) || "";
  } catch (_) { return ""; }
}

// Graph legt fehlende Ordner beim PUT NICHT an, ein 404 ist endgueltig
// (dieselbe Falle wie beim Datenbank-Ordner, Vorfall 04.09.). Also einmal
// anlegen und den Schreibvorgang wiederholen.
async function logOrdnerAnlegen() {
  const teile = logBasis().split("/");
  const name = teile.pop();
  const r = await OD.graphRoh(teile.join("/") + ":/children", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {},
      "@microsoft.graph.conflictBehavior": "replace" }) });
  return !!(r && r.ok);
}

// Die ganze Tagesdatei neu schreiben statt anzuhaengen. Klingt verschwender-
// isch, ist aber der einfachste sichere Weg: die Datei gehoert genau EINEM
// Geraet an EINEM Tag, es gibt also nichts zusammenzufuehren.
// ponytail: bei sehr vielen Zeilen wird der PUT gross - dann auf eine Datei
// je Stunde umstellen. Bei Andreas Klickzahl kein Thema.
async function logSichern() {
  // Nichts Neues seit der letzten Sicherung? Dann auch nicht schreiben.
  // Seit v106 bleibt der Puffer stehen, ein Test auf "leer" traefe nie mehr
  // zu - die App wuerde bei jedem Anlass dieselbe Datei erneut hochladen.
  if (!logStufe() || logSchreibt || logPuffer.length <= logGesichert) return;
  if (typeof OD === "undefined" || !OD.konto()) return;
  logSchreibt = true;
  try {
    const datei = logDatei();
    // Beim ersten Sichern der Sitzung anhaengen statt ersetzen: sonst
    // wuerde ein App-Neustart alles ueberschreiben, was heute schon
    // dasteht - und ausgerechnet der Absturz waere nicht mehr belegt.
    if (!logGeladen) {
      logGeladen = true;
      const r = await OD.graphRoh(datei + ":/content");
      if (r && r.ok) {
        const alt = (await r.text()).trim();
        if (alt) {
          const zeilen = alt.split("\n");
          logPuffer = zeilen.concat(logPuffer);
          logGesichert = zeilen.length;   // die stehen schon in der Datei
        }
      }
    }
    const ziel = datei + ":/content?@microsoft.graph.conflictBehavior=replace";
    const senden = () => OD.graphRoh(ziel, {
      method: "PUT", body: logPuffer.join("\n") + "\n",
      headers: { "Content-Type": "text/plain" } });
    let put = await senden();
    if (put && put.status === 404 && await logOrdnerAnlegen()) put = await senden();
    // NICHT leeren (v106): die naechste Sicherung ersetzt die Datei und
    // naehme sonst alles frueher Geschriebene mit. Gemerkt wird
    // stattdessen, wie weit die Datei reicht.
    if (put && put.ok) logGesichert = logPuffer.length;
  } catch (_) {
    // Logging darf die App NIE stoeren. Geht es nicht, bleibt der Puffer
    // stehen und der naechste Versuch nimmt ihn mit.
  } finally { logSchreibt = false; }
}

// Beim Verlassen der App sichern. Auf Android ist das oft das Letzte, was
// noch laeuft, bevor der Browser die Seite einfriert.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") logSichern();
});

// ---------------------------------------------------------------- v103
// Was die Antwort auf einen Book-Zugriff bedeutet.
//
// Ausgangslage 10.09. (Andrea): sie MUSS das Book in Word offen haben, um
// den formatierten Pitch herauszukopieren - sonst ist die Formatierung in
// der Mail unbrauchbar. Eine Sperre ist damit der NORMALFALL im Moment des
// Abhakens, nicht der Unfall. Zwei Folgen:
//
//   1. "Word schliessen, dann noch einmal antippen" ist ein Rat, den ihr
//      Arbeitsablauf verbietet. Er hat sie einen ganzen Abend gekostet.
//   2. erledigtZurueck() aus v102 - das Zuruecknehmen bei Sperre - wirft
//      echte Arbeit weg. Es war richtig, solange "gesperrt" ein seltener
//      Unfall war. Ersetzt durch die Outbox weiter unten.
//
// Vier Ausgaenge statt drei:
//   ok            steht im Book
//   dublette      stand schon drin
//   wartet        geht von allein weg - Sperre, Drosselung, Netz, 5xx
//   braucht-dich  wird von allein nichts - Book weg oder Anker fehlt
function schreibStatus(antwort) {
  if (!antwort) return "wartet";                 // kein Netz, kein Token
  if (antwort.ok) return "ok";
  if (antwort.status === 404) return "braucht-dich";
  // 423 Sperre - 429 Drosselung - 409 "zwischenzeitlich geaendert" - 5xx.
  //
  // 409 stand bis v102 zusammen mit 423 auf "gesperrt" und meldete "das
  // Brand-Book ist gerade in Word geoeffnet". 409 hat mit Word aber nichts
  // zu tun: bei conflictBehavior=replace heisst es, dass die Datei sich
  // zwischen Lesen und Schreiben geaendert hat. Die Falschmeldung schickte
  // Andrea auf die Suche nach einem Word, das nie offen war ("es ist keine
  // fucking word instanz offen, das Cockpit spinnt gerade total", 10.09.).
  //
  // 412 kam mit If-Match dazu (v123, Backlog 24.1): "die Datei hat sich
  // zwischen eTag-Lesen und Schreiben geaendert" - also genau der Fall, vor
  // dem If-Match schuetzen soll. Als "wartet" eingestuft, weil die
  // Wiederholung in bookHistorie()/bookKerninfos() den GANZEN Durchgang
  // neu faehrt: frischer eTag, frischer Inhalt, Aenderung neu angewendet.
  // Genau das beschreibt der Kommentar ueber bookHistorie() seit v102 -
  // bisher fehlte nur der Ausloeser dafuer.
  if (antwort.status === 423 || antwort.status === 429 ||
      antwort.status === 409 || antwort.status === 412 ||
      antwort.status >= 500) return "wartet";
  return "braucht-dich";
}

// ------------------------------------ If-Match beim Book-PUT (v123, 24.1)
// Ein eTag von Microsoft Graph steht immer in Anfuehrungszeichen, schwache
// eTags zusaetzlich mit W/ davor. Genau daran unterscheidet der Aufrufer
// einen echten eTag von einem Status-Wort (Audit A4) - siehe bookETagLesen().
const ETAG_MUSTER = /^(W\/)?"/;

// Seit v121 gibt es ZWEI Schreiber auf denselben .docx: die App und Andreas
// Word. Der Rundlauf GET -> aendern -> PUT lief bisher ohne jede
// Versionspruefung, und conflictBehavior=replace fragt nicht nach. Speichert
// sie waehrenddessen in Word, ist ihre Aenderung weg - nicht nur in den
// Kerninfos, sondern im GANZEN Dokument, weil die App die komplette Datei
// hochlaedt.
//
// Der eTag kommt NUR aus einem Metadaten-Abruf, nie aus ":/content": darauf
// antwortet Graph mit einer 302 auf eine Download-URL, fetch folgt ihr, und
// das ETag der Endantwort gehoert dem Storage-Blob statt der Datei.
//
// REIHENFOLGE ist der Kern: erst den eTag holen, DANN den Inhalt lesen.
// Andersherum waere die Absicherung wertlos - man haette alten Inhalt mit
// neuem eTag in der Hand und wuerde Andreas Aenderung sauber ueberschreiben,
// mit gueltigem If-Match und ohne jede Fehlermeldung.
//
// Rueckgabe: der eTag als String - oder ein Status-String fuer den Aufrufer,
// der ihn unveraendert durchreicht. Ohne eTag wird NICHT geschrieben.
//
// WIE der Aufrufer die beiden auseinanderhaelt (Audit A4, 17.09.): am
// Anfuehrungszeichen. Ein eTag von Graph steht IMMER in Anfuehrungszeichen -
// "{GUID},3" oder W/"..." -, schreibStatus() liefert dagegen nackte Woerter
// ("wartet", "braucht-dich"). Bis 17.09. stand an den drei Aufrufstellen
// `typeof etag !== "string"`, und das konnte NIE zutreffen: diese Funktion
// gibt in jedem Fall einen String zurueck. Ein Status wanderte dadurch als
// If-Match-Header mit, der Server antwortete 412, und der Auftrag wiederholte
// sich endlos - ohne Knopf, mit dem Andrea ihn haette abhaken koennen.
async function bookETagLesen(m, grund) {
  const meta = await OD.graphRoh(bookPfad(m) + "?$select=eTag");
  logZeile("book-etag", { ...grund, methode: "GET",
    status: meta ? meta.status : 0, code: await logFehlerCode(meta) });
  if (!meta) return "wartet";
  if (!meta.ok) return schreibStatus(meta);
  const j = await meta.json().catch(() => null);
  const etag = j && j.eTag;
  // Kein eTag = keine Absicherung. Dann lieber gar nicht schreiben und es
  // spaeter nochmal versuchen, als blind ueber Andreas Arbeit zu buegeln.
  // "Kein eTag" heisst auch: etwas, das nicht wie ein eTag aussieht. Sonst
  // gaebe diese Funktion einen Wert heraus, den der Aufrufer fuer einen
  // Status halten muesste - und dann passiert gar nichts, still.
  return ETAG_MUSTER.test(String(etag || "")) ? String(etag) : "wartet";
}

const pause = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

// Drei Wiederholungen mit festem Abstand. Deckt den OneDrive-Sync-Lock ab,
// der noch ein paar Sekunden steht, nachdem Word geschlossen wurde. Eine
// echte Word-Sitzung ueberlebt das nicht - dafuer ist die Outbox da.
// ponytail: fester Abstand statt Exponential mit Jitter. Jitter schuetzt
// vor dem gleichzeitigen Ansturm vieler Clients; hier tippt eine Person.
const BOOK_WARTEN_MS = [2000, 5000, 15000];

// Beschriftung eines Kerninfos-Auftrags in der Warteliste (v121). Steht
// dort, wo bei einem Historien-Eintrag die Aktion steht ("Follow up 2") -
// damit zeigt wartelisteZeile() beide Arten ohne eine Zeile Sonderfall.
const KERNINFOS_AKTION = "Kerninfos ins Book";

// EIN Durchgang: lesen, aendern, schreiben.
async function bookHistorieEinmal(m, datum, aktion, entfernen, versuch) {
  const pfad = bookPfad(m);
  const t0 = Date.now();
  const grund = { marke: m.name, aktion, datum, entfernen: !!entfernen,
                  pfad, versuch: versuch || 1 };
  try {
    const etag = await bookETagLesen(m, grund);
    if (!ETAG_MUSTER.test(etag)) return etag;    // Status statt eTag (A4)
    const r = await OD.graphRoh(pfad + ":/content");
    logZeile("book-lesen", { ...grund, methode: "GET",
      status: r ? r.status : 0, code: await logFehlerCode(r),
      ms: Date.now() - t0 });
    // Bis v102 lief JEDER Lesefehler hier als "kein-book" heraus - und
    // "kein-book" hatte in bookHistorieMelden() keinen Zweig, also passierte
    // GAR NICHTS: kein Banner, kein Nachtrag, nichts. Der Datenstand hatte
    // das Ereignis, das Word nicht, und Andrea sah keinerlei Hinweis. Genau
    // dieses stille Auseinanderlaufen steckte hinter den zehn Marken, die
    // sie am 10.09. gemeldet hat. "kein-book" heisst jetzt nur noch: die
    // Datei gibt es wirklich nicht. Alles andere ist "wartet".
    if (!r) return "wartet";
    if (!r.ok) return schreibStatus(r);
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const d = zip.file("word/document.xml");
    if (!d) { logZeile("book-abbruch", { ...grund, warum: "keine document.xml" });
             return "braucht-dich"; }
    const xml = historieXml(await d.async("string"), datum, aktion, entfernen);
    if (xml === "dublette") {                     // steht schon im Book
      // Der haeufigste gute Ausgang: Andrea hat es von Hand eingetragen.
      logZeile("book-dublette", { ...grund,
        ...logMehr({ soll: datum + " " + aktion, ist: "stand schon da" }) });
      return "dublette";
    }
    if (!xml) {                                   // Anker/Tabelle fehlt
      logZeile("book-abbruch", { ...grund, warum: entfernen
        ? "Zeile nicht gefunden" : "Historien-Tabelle nicht gefunden" });
      return "braucht-dich";
    }
    zip.file("word/document.xml", xml);
    const put = await OD.graphRoh(
      pfad + ":/content?@microsoft.graph.conflictBehavior=replace",
      { method: "PUT",
        body: await zip.generateAsync(
          { type: "arraybuffer", compression: "DEFLATE" }),
        headers: { "Content-Type": DOCX_TYP, "If-Match": etag } });
    logZeile("book-schreiben", { ...grund, methode: "PUT",
      status: put ? put.status : 0, code: await logFehlerCode(put),
      ms: Date.now() - t0, ergebnis: schreibStatus(put),
      ...logMehr({ soll: datum + " " + aktion, bytes: xml.length }) });
    await bookMerkerSetzen(m, put);   // sonst meldet die App sich selbst
    return schreibStatus(put);
  } catch (fehler) {
    logZeile("book-ausnahme", { ...grund, warum: String(fehler),
      ms: Date.now() - t0 });
    // Netzabbruch mitten im Rundlauf. NICHT wegwerfen - Andrea hat ihr
    // Follow-up gemacht, der Eintrag gehoert in die Warteschlange.
    return "wartet";
  }
}

// Mit Wiederholung. Wiederholt wird der GANZE Durchgang, nicht nur der
// PUT: nach einer Sperre kann Andrea in Word gespeichert haben, und ein
// zweiter Versuch mit dem alten Dokumentinhalt wuerde ihre Aenderung
// ueberschreiben (conflictBehavior=replace fragt nicht nach).
async function bookHistorie(m, datum, aktion, entfernen) {
  // "kein-book" heisst NUR: die Marke hat gar keins. Das ist ein Dauerzustand
  // und darf in der Outbox als erledigt gelten. Nicht angemeldet oder JSZip
  // noch nicht geladen ist dagegen VORUEBERGEHEND und bekommt einen eigenen
  // Rueckgabewert - sonst loescht outboxAbarbeiten() den wartenden Auftrag
  // und zaehlt ihn als getan, ohne dass je etwas ins Book geschrieben wurde.
  // Gefunden von Codex am 13.09. als zweite Instanz; galt fuer beide Wege.
  if (!m.brandrating || !m.brandrating.brandbook) return "kein-book";
  if (typeof OD === "undefined" || !OD.konto() ||
      typeof JSZip === "undefined") return "nicht-bereit";
  for (let i = 0; ; i++) {
    const s = await bookHistorieEinmal(m, datum, aktion, entfernen, i + 1);
    if (s !== "wartet" || i >= BOOK_WARTEN_MS.length) { logSichern(); return s; }
    await pause(BOOK_WARTEN_MS[i]);
  }
}

// ------------------------- Antwort ins Book schreiben (Release 3, v132)
// Aufbau Zeile fuer Zeile wie bookHistorieEinmal - absichtlich, nicht aus
// Bequemlichkeit: derselbe Lesefehler-Zweig, dieselben Rueckgabewerte,
// dieselbe Warteschlange. Eine zweite, leicht andere Fehlerbehandlung am
// selben Dateityp waere die Stelle, an der die naechste stille Abweichung
// entsteht (Begruendung von v121, gilt hier unveraendert).

// Beschriftung in der Warteliste - steht dort, wo bei einem
// Historien-Eintrag die Aktion steht ("Follow up 2"). Damit zeigt
// wartelisteZeile() alle drei Arten ohne eine Zeile Sonderfall.
function antwortAktion(positiv) {
  return "Antwort " + (positiv ? "positiv" : "negativ");
}

async function bookAntwortEinmal(m, datum, positiv, negativ, bemerkung, versuch) {
  const pfad = bookPfad(m);
  const t0 = Date.now();
  const aktion = antwortAktion(positiv);
  const grund = { marke: m.name, aktion, datum, entfernen: false,
                  pfad, versuch: versuch || 1 };
  try {
    const etag = await bookETagLesen(m, grund);
    if (!ETAG_MUSTER.test(etag)) return etag;    // Status statt eTag (A4)
    const r = await OD.graphRoh(pfad + ":/content");
    logZeile("book-lesen", { ...grund, methode: "GET",
      status: r ? r.status : 0, code: await logFehlerCode(r),
      ms: Date.now() - t0 });
    // Wie bei der Historie: nur eine wirklich fehlende Datei ist
    // "kein-book", alles andere wartet. Ein Lesefehler, der als
    // "kein-book" durchrutscht, verschwindet spurlos (Befund v102).
    if (!r) return "wartet";
    if (!r.ok) return schreibStatus(r);
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const d = zip.file("word/document.xml");
    if (!d) { logZeile("book-abbruch", { ...grund, warum: "keine document.xml" });
             return "braucht-dich"; }
    // negativ wird BENUTZT, nicht aus positiv abgeleitet (Audit 17.09.):
    // die Signatur versprach eine Unabhaengigkeit, die es nicht gab. Ein
    // Outbox-Auftrag mit {positiv:false, negativ:false} waere sonst als
    // negativ ins Book gegangen.
    const xml = antwortXml(await d.async("string"), datum,
                           positiv ? "X" : "", negativ ? "X" : "", bemerkung);
    if (xml === "dublette") {                     // steht schon im Book
      logZeile("book-dublette", { ...grund,
        ...logMehr({ soll: datum + " " + aktion, ist: "stand schon da" }) });
      return "dublette";
    }
    if (!xml) {                                   // Tabelle/Zeile fehlt
      logZeile("book-abbruch", { ...grund,
        warum: "Antwort-Tabelle nicht gefunden" });
      return "braucht-dich";
    }
    zip.file("word/document.xml", xml);
    const put = await OD.graphRoh(
      pfad + ":/content?@microsoft.graph.conflictBehavior=replace",
      { method: "PUT",
        body: await zip.generateAsync(
          { type: "arraybuffer", compression: "DEFLATE" }),
        headers: { "Content-Type": DOCX_TYP, "If-Match": etag } });
    logZeile("book-schreiben", { ...grund, methode: "PUT",
      status: put ? put.status : 0, code: await logFehlerCode(put),
      ms: Date.now() - t0, ergebnis: schreibStatus(put),
      ...logMehr({ soll: datum + " " + aktion, bytes: xml.length }) });
    await bookMerkerSetzen(m, put);   // sonst meldet die App sich selbst
    return schreibStatus(put);
  } catch (fehler) {
    logZeile("book-ausnahme", { ...grund, warum: String(fehler),
      ms: Date.now() - t0 });
    // Netzabbruch mitten im Rundlauf. NICHT wegwerfen - Andrea hat ihre
    // Antwort eingetragen, der Eintrag gehoert in die Warteschlange.
    return "wartet";
  }
}

// Mit Wiederholung. Wiederholt wird der GANZE Durchgang, nicht nur der PUT:
// nach einer Sperre kann Andrea in Word gespeichert haben, und ein zweiter
// Versuch mit dem alten Dokumentinhalt wuerde ihre Aenderung ueberschreiben
// (conflictBehavior=replace fragt nicht nach).
async function bookAntwort(m, datum, positiv, negativ, bemerkung) {
  if (!m.brandrating || !m.brandrating.brandbook) return "kein-book";
  if (typeof OD === "undefined" || !OD.konto() ||
      typeof JSZip === "undefined") return "nicht-bereit";
  for (let i = 0; ; i++) {
    const s = await bookAntwortEinmal(m, datum, positiv, negativ, bemerkung,
                                      i + 1);
    if (s !== "wartet" || i >= BOOK_WARTEN_MS.length) { logSichern(); return s; }
    await pause(BOOK_WARTEN_MS[i]);
  }
}

// Schreiben und nur dann etwas sagen, wenn es etwas zu sagen gibt.
// Laeuft NEBEN dem Speichern (kein await): das Antwort-Fenster soll nicht
// auf einen Word-Upload warten - genauso wie beim Erledigt-Knopf.
function bookAntwortMelden(m, datum, positiv, negativ, bemerkung) {
  const aktion = antwortAktion(positiv);
  const daten = { positiv: !!positiv, negativ: !!negativ,
                  bemerkung: bemerkung || "" };
  const k = outboxSchluessel(m, datum, aktion, false, "antwort");
  bookKettig(m, async () => {
    const s = await bookAntwort(m, datum, positiv, negativ, bemerkung);
    if (s === "ok") {
      outboxWeg(k);
      banner("Antwort auch in die Antwort-Tabelle im Brand-Book eingetragen.");
      outboxAbarbeiten();        // Book war frei - Rest gleich mitnehmen
    } else if (s === "dublette") {
      // Bewusst gemeldet statt still uebergangen: Andrea soll wissen, dass
      // ihr Klick nichts geschrieben hat - und warum. Der haeufigste gute
      // Ausgang ist, dass sie die Zeile selbst ins Word getippt hat.
      outboxWeg(k);
      banner("Die Antwort vom " + datum + " stand schon im Brand-Book — " +
        "nicht doppelt eingetragen.");
    } else if (s === "wartet" || s === "nicht-bereit") {
      // Es wird NICHTS zurueckgenommen (Kern von v103). Die Antwort steht
      // im Datenstand und wartet auf ihren Weg ins Book.
      outboxAufnehmen(m, datum, aktion, false, "wartet", "antwort", daten);
      banner(s === "nicht-bereit"
        ? "Antwort ist eingetragen. Keine Verbindung zum Brand-Book — "
          + "wird nachgetragen, sobald du wieder angemeldet bist."
        : "Antwort ist eingetragen. Das Brand-Book ist gerade belegt — "
          + "wird automatisch nachgetragen.");
    } else if (s === "braucht-dich") {
      outboxAufnehmen(m, datum, aktion, false, "braucht-dich", "antwort", daten);
      if (wartelisteZeigen()) return;
      banner("Brand-Book konnte nicht nachgetragen werden — " +
             "die Antwort-Tabelle dort bitte von Hand ergänzen.");
    }
    // "kein-book": die Marke hat gar keins. Normaler Zustand, still.
  });
}

// ------------------------------- Kerninfos-Tabelle schreiben (Fix B, v121)
// Aufbau Zeile fuer Zeile wie bookHistorieEinmal - absichtlich, nicht aus
// Bequemlichkeit: derselbe Lesefehler-Zweig, dieselben Rueckgabewerte,
// dieselbe Warteschlange. Eine zweite, leicht andere Fehlerbehandlung am
// selben Dateityp waere die Stelle, an der die naechste stille Abweichung
// entsteht.
//
// Ein Zustand mehr als bei der Historie: "gleich" - im Book steht schon
// alles richtig, es gibt nichts hochzuladen.
async function bookKerninfosEinmal(m, versuch) {
  const pfad = bookPfad(m);
  const t0 = Date.now();
  // "Name" bleibt draussen: der Name steckt AUCH im Dateinamen, und ein
  // Book, in dem ein anderer Name steht als auf der Datei, ist schlimmer
  // als eins mit altem Namen. Umbenennen ist ein eigener Punkt, der beides
  // zusammen macht - dann wird hier nur das Weglassen entfernt.
  const { Name, ...werte } = bookWerte(m);
  const grund = { marke: m.name, aktion: KERNINFOS_AKTION, pfad,
                  versuch: versuch || 1 };
  try {
    const etag = await bookETagLesen(m, grund);
    if (!ETAG_MUSTER.test(etag)) return etag;    // Status statt eTag (A4)
    const r = await OD.graphRoh(pfad + ":/content");
    logZeile("kerninfos-lesen", { ...grund, methode: "GET",
      status: r ? r.status : 0, code: await logFehlerCode(r),
      ms: Date.now() - t0 });
    if (!r) return "wartet";
    // 404 beim ERSTEN Versuch heisst hier nicht zwingend "Book weg":
    // geschrieben wird direkt nach bookVerschieben(), und Graph braucht
    // nach einem Verschieben manchmal einen Moment, bis die Datei unter
    // dem neuen Pfad auftaucht. Ab dem zweiten Versuch gilt 404 wie
    // ueberall sonst.
    if (r.status === 404 && (versuch || 1) <= 1) return "wartet";
    if (!r.ok) return schreibStatus(r);
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const d = zip.file("word/document.xml");
    if (!d) {
      logZeile("kerninfos-abbruch", { ...grund, warum: "keine document.xml" });
      return "braucht-dich";
    }
    const erg = kerninfosXml(await d.async("string"), werte);
    if (!erg) {
      logZeile("kerninfos-abbruch", { ...grund,
        warum: "Kerninfos-Tabelle nicht gefunden" });
      return "braucht-dich";
    }
    if (!erg.geaendert.length) {
      // KEIN Upload ohne Aenderung. Ein PUT, der nichts aendert, ist ein
      // Schreibzugriff auf Andreas Word ohne jeden Gegenwert - und jeder
      // Schreibzugriff kann schiefgehen.
      logZeile("kerninfos-gleich", { ...grund,
        ...logMehr({ handarbeit: erg.handarbeit.join(", ") }) });
      return erg.handarbeit.length ? "braucht-dich" : "gleich";
    }
    zip.file("word/document.xml", erg.xml);
    const put = await OD.graphRoh(
      pfad + ":/content?@microsoft.graph.conflictBehavior=replace",
      { method: "PUT",
        body: await zip.generateAsync(
          { type: "arraybuffer", compression: "DEFLATE" }),
        headers: { "Content-Type": DOCX_TYP, "If-Match": etag } });
    logZeile("kerninfos-schreiben", { ...grund, methode: "PUT",
      status: put ? put.status : 0, code: await logFehlerCode(put),
      ms: Date.now() - t0, ergebnis: schreibStatus(put),
      ...logMehr({ soll: erg.geaendert.join(", "),
                   handarbeit: erg.handarbeit.join(", "),
                   bytes: erg.xml.length }) });
    const s = schreibStatus(put);
    await bookMerkerSetzen(m, put);   // sonst meldet die App sich selbst
    // Geschrieben ist geschrieben - aber wenn eine Zelle stehen bleiben
    // musste, ist das Book eben NICHT auf Stand. Dann lieber in die
    // Warteliste unter "Braucht dich", als Erfolg zu melden.
    return s === "ok" && erg.handarbeit.length ? "braucht-dich" : s;
  } catch (fehler) {
    logZeile("kerninfos-ausnahme", { ...grund, warum: String(fehler),
      ms: Date.now() - t0 });
    return "wartet";
  }
}

// Mit Wiederholung, wie bookHistorie - und mit dem Spiegel-Nachzug.
//
// Warum der Spiegel HIER gepflegt wird und nicht beim Aufrufer: es gibt
// zwei Aufrufer (Klick und Nacharbeit aus der Warteschlange). Stuende es
// dort, muesste es zweimal stehen - und beim naechsten Aufrufer wieder.
// Die Funktion, die weiss, dass die Datei jetzt stimmt, zieht ihn nach.
async function bookKerninfos(m) {
  // "kein-book" heisst NUR: die Marke hat gar keins. Das ist ein Dauerzustand
  // und darf in der Outbox als erledigt gelten. Nicht angemeldet oder JSZip
  // noch nicht geladen ist dagegen VORUEBERGEHEND und bekommt einen eigenen
  // Rueckgabewert - sonst loescht outboxAbarbeiten() den wartenden Auftrag
  // und zaehlt ihn als getan, ohne dass je etwas ins Book geschrieben wurde.
  // Gefunden von Codex am 13.09. als zweite Instanz; galt fuer beide Wege.
  if (!m.brandrating || !m.brandrating.brandbook) return "kein-book";
  if (typeof OD === "undefined" || !OD.konto() ||
      typeof JSZip === "undefined") return "nicht-bereit";
  for (let i = 0; ; i++) {
    const s = await bookKerninfosEinmal(m, i + 1);
    if (s === "wartet" && i < BOOK_WARTEN_MS.length) {
      await pause(BOOK_WARTEN_MS[i]);
      continue;
    }
    logSichern();
    // Im Book steht jetzt, was der Datenstand sagt - m.kerninfos darf
    // mitziehen. Ohne das meldet "Daten pruefen" weiter rot, obwohl nichts
    // mehr falsch ist: die Pruefung vergleicht den PC-Import-Spiegel, nicht
    // die Datei (Abend vom 07.09.).
    if ((s === "ok" || s === "gleich") && kerninfosNachziehen(m)) {
      listeVeraltet = true;
      datenstandPersistieren();
    }
    return s;
  }
}

// Nachziehen und nur dann etwas sagen, wenn es etwas zu sagen gibt.
// Laeuft NEBEN dem Speichern (kein await): der Speichern-Knopf soll nicht
// auf einen Word-Upload warten - genauso wie beim Erledigt-Knopf.
function bookKerninfosMelden(m) {
  bookKettig(m, async () => {
    const s = await bookKerninfos(m);
    const k = outboxSchluessel(m, "", KERNINFOS_AKTION, false, "kerninfos");
    if (s === "ok") {
      outboxWeg(k);
      banner("Änderung auch im Brand-Book nachgetragen.");
      outboxAbarbeiten();          // Book war frei - Rest gleich mitnehmen
    } else if (s === "gleich") {
      outboxWeg(k);                // im Book stand es schon richtig
    } else if (s === "wartet" || s === "nicht-bereit") {
      // Beide Male gilt: nichts zurueckrollen, der Auftrag wartet. `grund`
      // ist bewusst "wartet" - das ist der Wert, den outboxAbarbeiten()
      // aufgreift.
      outboxAufnehmen(m, deDatum(isoInTagen(0)), KERNINFOS_AKTION, false,
                      "wartet", "kerninfos");
      banner(s === "wartet"
        ? "Gespeichert. Das Brand-Book ist gerade belegt — " +
          "die Änderung wird automatisch nachgetragen."
        : "Gespeichert. Keine Verbindung zum Brand-Book — die Änderung " +
          "wird nachgetragen, sobald du wieder angemeldet bist.");
    } else if (s === "braucht-dich") {
      outboxAufnehmen(m, deDatum(isoInTagen(0)), KERNINFOS_AKTION, false,
                      "braucht-dich", "kerninfos");
      if (wartelisteZeigen()) return;
      banner("Brand-Book konnte nicht nachgetragen werden — " +
             "die Kerninfos dort bitte von Hand ändern.");
    }
    // "kein-book": die Marke hat gar keins. Normaler Zustand, still.
  });
}

// ------------------------------------------------------- Outbox (v103)
//
// Was nicht ins Book kam, wird gemerkt statt zurueckgerollt, und die App
// traegt es spaeter von allein nach. Aus einem Fehler wird ein Termin.
//
// Sie liegt IM Datenstand, nicht im Speicher: sonst waere sie beim ersten
// Schliessen der App weg - und Andrea schliesst die App, um Word zu oeffnen.
function outbox() {
  if (!datenstand.ausstehend) datenstand.ausstehend = [];
  return datenstand.ausstehend;
}

// art: undefined/"historie" = ein Ereignis (Pitch, Follow up, Ruecknahme)
//      "kerninfos"           = "bring die Kerninfos-Tabelle auf Stand" (v121)
//
// Fuer Kerninfos gehen Datum und Aktion BEWUSST nicht in den Schluessel
// ein: es gibt genau EINEN offenen Auftrag je Marke. Ein Feld-Update ist
// idempotent ("setze auf den aktuellen Stand"), anders als ein Ereignis,
// das sich anhaeuft. Zwei Eintraege waeren zweimal dieselbe Arbeit - und
// der aeltere wuerde beim Abarbeiten nichts Aelteres schreiben, sondern
// nur ein zweites Mal hochladen.
// Fuer eine Antwort geht die BEMERKUNG bewusst nicht in den Schluessel ein,
// nur Marke und Datum: es gibt hoechstens eine Antwort je Marke und Tag
// (am Bestand gemessen 17.09.: 21 Antworten, kein einziger Doppeltag).
// Traegt Andrea am selben Tag eine Korrektur nach, soll sie denselben
// Auftrag aktualisieren statt einen zweiten anzulegen - sonst stuenden
// beide Fassungen nacheinander in ihrem Word.
function outboxSchluessel(m, datum, aktion, entfernen, art) {
  if (art === "kerninfos") return schluessel(m.name) + "|kerninfos";
  if (art === "antwort") return schluessel(m.name) + "|antwort|" + datum;
  return [schluessel(m.name), datum, aktion, entfernen ? "weg" : "hin"].join("|");
}

// grund: "wartet" (still weiterversuchen) | "braucht-dich" (Andrea muss ran)
// art:   siehe outboxSchluessel
// `daten` (nur bei art "antwort"): positiv/negativ/bemerkung. Ein Ereignis
// ist durch Datum und Aktion vollstaendig beschrieben, eine Antwort nicht -
// ohne diese Nutzlast wuesste outboxAbarbeiten() spaeter nicht, WAS es
// nachzutragen hat.
function outboxAufnehmen(m, datum, aktion, entfernen, grund, art, daten) {
  const k = outboxSchluessel(m, datum, aktion, entfernen, art);
  // Schreiben-dann-Entfernen ist zusammen ein Nichts (v107).
  //
  // Die Warteschlange kennt keine Reihenfolge zwischen einem Eintrag und
  // seiner Ruecknahme: beide standen drin und wurden unabhaengig
  // abgearbeitet. Lief das Entfernen zuerst, fand es die nie geschriebene
  // Zeile nicht (-> "braucht-dich"), und DANACH trug der urspruengliche
  // Schreibvorgang sie doch noch ins Word ein. Andrea hatte
  // zurueckgenommen, im Book stand es trotzdem - und die Kennzahlen
  // kommen aus den Books.
  //
  // Gefunden 11.09., Athena --seed 42 --sperrquote 75: Athena_08
  // ("Follow up 2", 08.09.) und Athena_11 ("Follow up 1", 31.08.).
  //
  // Verglichen wird EXAKT (Marke, Datum, Aktion) - ein groeberes Muster
  // naehme Andrea Auftraege weg, die sie erledigt haben will. Dieselbe
  // Falle wie bei der Aufraeumregel in v105.
  if (entfernen) {
    const hin = outboxSchluessel(m, datum, aktion, false);
    if (outbox().some((e) => e.k === hin)) {
      logZeile("warteliste-aufgehoben", { marke: m.name, aktion, datum,
        warum: "Ruecknahme traf den noch offenen Schreibvorgang" });
      outboxWeg(hin);          // persistiert bereits
      return;                  // ... und das Entfernen kommt gar nicht rein
    }
  }
  const da = outbox().find((e) => e.k === k);
  // da.datum mitziehen: bei einem Historien-Eintrag steckt das Datum im
  // Schluessel und aendert sich nie - bei einem Kerninfos-Auftrag zeigt die
  // Warteliste sonst den Tag der ERSTEN Aenderung statt der letzten.
  // da.daten mitziehen wie da.datum: korrigiert Andrea ihre Antwort am
  // selben Tag, soll der wartende Auftrag den NEUEN Stand tragen, nicht
  // den ersten.
  // da.aktion MITZIEHEN (Codex-Befund, nachgemessen 17.09.): bei einer
  // Korrektur von positiv auf negativ blieb die Beschriftung stehen, und
  // die Warteliste zeigte "Antwort positiv", waehrend die Nutzlast laengst
  // negativ war - also genau das Gegenteil des ausstehenden Auftrags.
  if (da) { da.versuche = (da.versuche || 1) + 1; da.grund = grund;
            da.datum = datum; da.aktion = aktion;
            if (daten) da.daten = daten; }
  else outbox().push({ k, marke: m.name, datum, aktion,
                       entfernen: !!entfernen, art, seit: lokalIso(),
                       versuche: 1, grund, ...(daten ? { daten } : {}) });
  logZeile("warteliste-auf", { marke: m.name, aktion, datum,
    entfernen: !!entfernen, grund, versuche: (da && da.versuche) || 1 });
  datenstandPersistieren();
}

function outboxWeg(k) {
  const i = outbox().findIndex((e) => e.k === k);
  if (i >= 0) {
    logZeile("warteliste-ab", { eintrag: outbox()[i] });
    outbox().splice(i, 1);
    datenstandPersistieren();
  }
}

// Nacharbeiten. Laeuft bei der Rueckkehr in die App - also genau dann,
// wenn Andrea aus Word zurueckkommt und die Sperre gefallen ist.
// Nur "wartet"-Eintraege; "braucht-dich" wird nicht endlos wiederholt.
let outboxLaeuft = false;
// Einmal je App-Sitzung mahnen, nicht bei jeder Rueckkehr - sonst
// wird aus der Meldung Rauschen und Andrea liest sie nicht mehr.
let outboxGemahnt = false;
async function outboxAbarbeiten(still) {
  if (outboxLaeuft) return 0;
  const offen = outbox().filter((e) => e.grund === "wartet");
  if (!offen.length) return 0;
  outboxLaeuft = true;
  let fertig = 0;
  try {
    for (const e of offen) {
      const m = markeZuName(e.marke);
      if (!m) { outboxWeg(e.k); continue; }   // Marke inzwischen geloescht
      // Durch DIESELBE Kette wie ein Klick (v107): lief die Nacharbeit
      // daneben, konnte ein Retry genau dann ins Book schreiben, wenn
      // outboxAufnehmen() das Paar gerade strich - Zeile im Word,
      // Warteliste leer. Gleicher Schaden, nur seltener.
      // Abzweig nach Art (v121). OHNE ihn liefe ein Kerninfos-Auftrag durch
      // bookHistorie() und schriebe "Kerninfos ins Book" als ZEILE in
      // Andreas Pitch-Historie - ein erfundenes Ereignis, und die
      // Kennzahlen kommen aus den Books. Alte Eintraege ohne `art` sind
      // Historien-Eintraege; deshalb wird auf "kerninfos" geprueft und
      // nicht auf das Fehlen.
      const s = await bookKettig(m, () => {
        // `offen` ist ein SCHNAPPSCHUSS von vor der Schleife. Waehrend wir
        // auf eine andere Marke warten, kann Andrea genau diesen Auftrag
        // zurueckgenommen haben - outboxAufnehmen() streicht das Paar dann
        // aus der echten Liste (v107-Regel), unser `e` weiss davon nichts.
        // Ohne diese Pruefung schriebe die Nacharbeit die Zeile wieder ins
        // Word, die Andrea gerade entfernt hat: Zeile im Book, Warteliste
        // leer - derselbe Schaden, den v107 schon einmal behoben hat, nur
        // ueber den Schnappschuss statt ueber die Verschraenkung.
        // Die Pruefung steht IN der Kette, nicht davor: zwischen Einreihen
        // und Ausfuehren liegt die Wartezeit, in der die Ruecknahme passiert.
        // Gefunden von Codex als zweite Instanz, 13.09.
        if (!outbox().some((x) => x.k === e.k)) return "zurueckgenommen";
        if (e.art === "kerninfos") return bookKerninfos(m);
        if (e.art === "antwort") {
          // Ohne Nutzlast NICHT schreiben. Ein Auftrag ohne `daten` kann
          // nur aus einem aelteren Datenstand stammen; blind ausgefuehrt
          // schriebe er eine LEERE Antwort-Zeile in Andreas Book - und die
          // Kennzahlen kommen aus den Books.
          if (!e.daten) return "braucht-dich";
          return bookAntwort(m, e.datum, e.daten.positiv, e.daten.negativ,
                             e.daten.bemerkung);
        }
        return bookHistorie(m, e.datum, e.aktion, e.entfernen);
      });
      // Schon aus der Liste - nichts geschrieben, nichts zu loeschen,
      // nichts anzurechnen.
      if (s === "zurueckgenommen") continue;
      if (s === "ok" || s === "dublette" || s === "kein-book" ||
          s === "gleich") {
        outboxWeg(e.k); fertig++;
      } else if (s === "nicht-bereit") {
        // Nicht angemeldet: an diesem Eintrag ist nichts passiert, und am
        // Rest der Schlange wird genauso nichts passieren. Abbrechen statt
        // durchlaufen - und `grund` BLEIBT "wartet", sonst holt der
        // naechste Lauf den Eintrag nie wieder (Filter oben).
        break;
      } else {
        e.versuche = (e.versuche || 1) + 1;
        e.grund = s;                          // ggf. jetzt "braucht-dich"
        datenstandPersistieren();
      }
    }
  } finally { outboxLaeuft = false; }
  if (fertig && !still) {
    banner(fertig === 1
      ? "Ein wartender Eintrag wurde ins Brand-Book nachgetragen."
      : fertig + " wartende Einträge wurden ins Brand-Book nachgetragen.");
    listeVeraltet = true;
  }
  // Eskalation: Wiederholen allein ist kein Fortschritt. Ein Eintrag,
  // der einen Tag lang nicht durchkommt, hat meist einen Grund, den
  // nur Andrea kennt (Book umbenannt, in Word offen gelassen, Ordner
  // verschoben). Ohne diese Meldung liefe er still weiter im Kreis.
  if (!outboxGemahnt) {
    const lange = outbox().filter(
      (e) => wartelisteAlterStd(e) >= OUTBOX_MAHNUNG_STD);
    if (lange.length) {
      outboxGemahnt = true;
      if (!wartelisteZeigen())
        banner(lange.length === 1
          ? "Ein Eintrag wartet seit über einem Tag aufs Brand-Book."
          : lange.length + " Einträge warten seit über einem Tag "
            + "aufs Brand-Book.");
    }
  }
  return fertig;
}

// ---------------------------------------------------- Warteliste (v103)
//
// Sichtbar machen, was noch nicht im Brand-Book steht. Banner sind nach
// vier Sekunden weg - wenn ein Eintrag Andreas Zutun braucht, muss sie ihn
// wiederfinden koennen.
//
// WANN sich das Fenster von allein oeffnet, ist die entscheidende Frage:
// bei Andrea ist "Book belegt" der Normalfall, nicht die Ausnahme (sie MUSS
// Word offen haben, um den Pitch zu kopieren). Ein Fenster bei jeder Sperre
// spraenge bei JEDEM Klick auf. Deshalb:
//
//   wartet        nur ein Banner. Das erledigt sich von allein.
//   braucht-dich  Fenster auf. Von allein wird das nichts.
function wartelisteDatum(iso) {
  const t = String(iso || "").slice(0, 10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : "?";
}

// Wie lange ein Eintrag still warten darf, bevor er gemeldet wird.
// Ohne diese Grenze koennte einer wochenlang im Kreis laufen, ohne dass es
// jemandem auffaellt - die Wiederholung allein ist kein Fortschritt.
const OUTBOX_MAHNUNG_STD = 24;

function wartelisteAlterStd(e) {
  const t = Date.parse(String(e.seit || ""));
  return isNaN(t) ? 0 : (Date.now() - t) / 3600000;
}

// abhaken=true nur im Abschnitt "Braucht dich". Im Abschnitt "Wartet" waere
// der Knopf gefaehrlich: dort wuerde Andrea einen Eintrag wegwerfen, der von
// allein durchgegangen waere - genau das stille Auseinanderlaufen, das v103
// abstellt.
function wartelisteZeile(e, abhaken) {
  const d = el("div", "block");
  d.append(el("div", "abschnitt",
    `${e.marke} — ${e.entfernen ? "entfernen: " : ""}${e.aktion}`));
  const alt = wartelisteAlterStd(e);
  d.append(el("div", "stand",
    `${e.datum} · seit ${wartelisteDatum(e.seit)} · ` +
    `${e.versuche} Versuch${e.versuche === 1 ? "" : "e"}` +
    (alt >= OUTBOX_MAHNUNG_STD ? ` · ⚠ wartet seit über ${Math.floor(alt / 24)} Tag(en)` : "")));
  if (abhaken) {
    const knoepfe = el("div", "chips");
    // Die einzige Aussage, die Andrea hier ehrlich treffen kann: nicht
    // "ist erledigt", sondern "ich habe es selbst ins Word geschrieben".
    // Die App kann das nicht sehen - ohne diesen Knopf bliebe der Eintrag
    // fuer immer stehen.
    const weg = el("button", "chip", "Hab ich im Word eingetragen");
    weg.onclick = () => {
      if (!confirm(`„${e.aktion}“ vom ${e.datum} bei „${e.marke}“` +
          "\naus der Warteliste nehmen?\n\n" +
          "Nur bestätigen, wenn die Zeile wirklich im Brand-Book steht. " +
          "Die App kann das nicht nachprüfen.")) return;
      outboxWeg(e.k);
      sheetWarteliste();
    };
    knoepfe.append(weg);
    d.append(knoepfe);
  }
  return d;
}

function sheetWarteliste() {
  const alle = outbox();
  const dringend = alle.filter((e) => e.grund === "braucht-dich");
  const wartend = alle.filter((e) => e.grund !== "braucht-dich");
  const wrap = el("div");

  if (!alle.length) {
    wrap.append(abschnitt("Nichts offen",
      el("div", "stand",
        "Alle Einträge stehen im Brand-Book. Hier taucht nur auf, was noch "
        + "nicht angekommen ist.")));
  }
  if (dringend.length) {
    wrap.append(abschnitt("Braucht dich",
      el("div", "stand",
        "Das trägt sich nicht von allein nach — meistens fehlt das "
        + "Brand-Book oder die Pitch-Historie-Tabelle darin. Bitte im Word "
        + "von Hand eintragen und hier abhaken."),
      ...dringend.map((e) => wartelisteZeile(e, true))));
  }
  if (wartend.length) {
    const nachtragen = el("button", "chip", "Jetzt nachtragen");
    nachtragen.onclick = async () => {
      nachtragen.disabled = true;
      await outboxAbarbeiten(true);
      sheetWarteliste();
    };
    const zeile = el("div", "chips");
    zeile.append(nachtragen);
    wrap.append(abschnitt("Wartet aufs Brand-Book",
      el("div", "stand",
        "Das Brand-Book ist gerade in Word geöffnet oder nicht erreichbar. "
        + "Die App trägt es automatisch nach, sobald es frei ist — beim "
        + "nächsten Wechsel zurück in die App. Nichts geht verloren."),
      zeile, ...wartend.map((e) => wartelisteZeile(e, false))));
  }
  sheetOeffnen("Warteliste", wrap);
}

// Fenster nur aufmachen, wenn gerade kein anderes Sheet offen ist.
// sheetOeffnen() raeumt das vorhandene weg - mitten in einem Formular waere
// das genau der Griff, den v95 fuer render() schon unterbunden hat.
function wartelisteZeigen() {
  if (document.getElementById("schleier")) return false;
  sheetWarteliste();
  return true;
}

// Eine Warteschlange JE BOOK-DATEI (v96). bookHistorie() macht Lesen ->
// Aendern -> Schreiben; ueberlappen zwei Aufrufe, lesen beide denselben
// Ausgangsstand und der letzte Schreiber gewinnt.
//
// Das ist kein Randfall: "Erledigt" zeichnet das Sheet an Ort und Stelle neu
// und blendet "Rueckgaengig" direkt darunter ein - zwei Taps im Abstand von
// einer Sekunde, ohne den Bildschirm zu verlassen. Auf Andreas Mobilnetz
// dauert ein docx-Rundlauf laenger als das. Dann suchte das Entfernen die
// Zeile in einer Datei, in der sie noch gar nicht stand, meldete
// "bitte von Hand entfernen" - und der erste Upload schrieb sie hinterher
// doch hinein. Datenstand richtig, Word mit Geisterzeile, und der naechste
// PC-Import holte das zurueckgenommene Ereignis wieder herein.
// Gefunden im Athena-Lauf 08.09.: von vier Ereignissen blieb eines im Book.
//
// Kein Lock, nur eine Kette: der Klick wird weiterhin SOFORT quittiert
// (kein await), die Schreibvorgaenge laufen nur nicht mehr gleichzeitig.
// Gekettet wird pro Pfad, nicht global - zwei verschiedene Marken sollen
// sich nicht gegenseitig ausbremsen.
const bookKette = new Map();

// Der EINZIGE Weg, an einer Marke am Book zu schreiben. Klicks
// (bookHistorieMelden) und Nacharbeit (outboxAbarbeiten) laufen beide
// hier durch, sonst haelt die Kette nur die Haelfte zusammen.
//
// Geschluesselt auf den MARKENNAMEN, nicht auf bookPfad(). Zwei Gruende:
//   1. bookPfad() liest m.brandrating.rating und knallt bei einer Marke,
//      die nur in der Pitchliste steht und kein Brandrating hat - Andreas
//      "Onelife" ist genau so eine. Die Schutzpruefung dagegen sitzt in
//      bookHistorie(); ein bookPfad() DAVOR springt ueber sie hinweg.
//      (Gefunden 08.09. beim Gegenlesen von v96, vor dem Ausliefern.)
//   2. Der Pfad aendert sich beim Rating-Wechsel, die Marke nicht. Auf den
//      Pfad geschluesselt wuerde die Kette dabei aufreissen und genau die
//      zwei Schreibvorgaenge entkoppeln, die sie zusammenhalten soll.
//
// .catch: ein Fehlschlag darf die Kette nicht abreissen lassen, sonst
// wuerde jeder weitere Schreibvorgang auf diese Marke still verschluckt.
function bookKettig(m, tun) {
  const kette = schluessel(m.name);
  const lauf = (bookKette.get(kette) || Promise.resolve()).then(tun);
  bookKette.set(kette, lauf.catch(() => {}));
  return lauf;
}

// Ereignis nachtragen und nur dann etwas sagen, wenn es etwas zu sagen
// gibt. Laeuft absichtlich NEBEN dem Speichern (kein await): der Erledigt-
// Knopf soll nicht auf den Word-Upload warten.
function bookHistorieMelden(m, datum, aktion, entfernen) {
  bookKettig(m, async () => {
    const s = await bookHistorie(m, datum, aktion, entfernen);
    if (s === "ok") {
      outboxWeg(outboxSchluessel(m, datum, aktion, entfernen));
      banner(entfernen
        ? "„" + aktion + "“ auch im Brand-Book wieder entfernt."
        : "„" + aktion + "“ auch in die Pitch-Historie im Brand-Book eingetragen.");
      // Das Book war frei - guter Moment, den Rest der Warteschlange
      // gleich mit abzuarbeiten.
      outboxAbarbeiten();
    } else if (s === "dublette") {
      // Bewusst gemeldet statt still uebergangen: der Nutzer soll wissen,
      // dass sein Klick nichts geschrieben hat - und warum.
      outboxWeg(outboxSchluessel(m, datum, aktion, entfernen));
      banner("„" + aktion + "“ stand am " + datum + " schon im Brand-Book — " +
        "nicht doppelt eingetragen.");
    } else if (s === "wartet" || s === "nicht-bereit") {
      // Kern von v103: es wird NICHTS zurueckgenommen. Der Eintrag steht im
      // Datenstand und wartet auf seinen Weg ins Book. Andrea muss nichts
      // von Hand machen und nichts noch einmal antippen.
      outboxAufnehmen(m, datum, aktion, entfernen, "wartet");
      banner(s === "nicht-bereit"
        ? "„" + aktion + "“ ist eingetragen. Keine Verbindung zum Brand-Book — "
          + "wird nachgetragen, sobald du wieder angemeldet bist."
        : entfernen
        ? "„" + aktion + "“ wird aus dem Brand-Book entfernt, sobald es frei ist."
        : "„" + aktion + "“ ist eingetragen. Das Brand-Book ist gerade belegt — "
          + "wird automatisch nachgetragen.");
    } else if (s === "braucht-dich") {
      // Von allein wird das nichts: Book geloescht, umbenannt, oder die
      // erwartete Tabelle fehlt (Andreas handgepflegte Books).
      // Richtungsabhaengig (v88): beim Entfernen "ergaenzen" zu sagen war
      // genau verkehrt herum.
      outboxAufnehmen(m, datum, aktion, entfernen, "braucht-dich");
      // Fenster auf, wenn moeglich - sonst haette sie genau einen
      // Banner lang Zeit, das mitzubekommen.
      if (wartelisteZeigen()) return;
      banner(entfernen
        ? "„" + aktion + "“ wurde im Brand-Book nicht gefunden — " +
          "dort bitte von Hand entfernen."
        : "Brand-Book konnte nicht nachgetragen werden — " +
          "die Pitch-Historie dort bitte von Hand ergänzen.");
    }
    // "kein-book": die Marke hat gar kein Book. Weiter still - das ist
    // ein normaler Zustand, kein Fehler.
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
// Book in den Ordner des neuen Ratings schieben (v92).
// Graph-PATCH auf parentReference - kein Download/Upload, die Datei-ID
// bleibt und damit auch Andreas Freigaben und Versionsverlauf.
//
// Warum das sein MUSS und nicht nur nett ist: bookPfad() rechnet den
// Ordner aus `bookordner || rating`. Bei Andreas gewachsenen Books ist
// bookordner nicht gesetzt - ein Rating-Wechsel liess den berechneten
// Pfad also mitwandern, die Datei aber nicht. Danach fanden "Book
// oeffnen", "aktualisieren" und "loeschen" nichts mehr, ohne jede
// Meldung. Genau so ist "Besser im Glas" entstanden (gefunden 06.09.).
async function bookVerschieben(m, vonOrdner, nachOrdner) {
  if (String(vonOrdner) === String(nachOrdner)) return "gleich";
  const datei = `${bookBasis()}/${vonOrdner} Brands/Brand-Book ${m.name}.docx`;
  const zielPfad = "/drive/root:" + bookBasis().split("root:")[1] +
    "/" + nachOrdner + " Brands";
  const r = await OD.graphRoh(datei, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentReference: { path: zielPfad } }),
  });
  if (!r) return "offline";
  // TRAGEND, nicht Kosmetik: Ein Verschieben erhoeht bei OneDrive auch den
  // cTag (nachgemessen 14.09.). Ohne diese Zeile meldet der Waechter nach
  // JEDEM Rating-Wechsel "in Word geaendert" - und eine Warnung, die falsch
  // anschlaegt, wird nach zwei Wochen ignoriert.
  await bookMerkerSetzen(m, r);
  return r.ok ? "verschoben" : r.status === 404 ? "nicht gefunden" : "fehler";
}

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
  await bookMerkerSetzen(m, neu);
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
  logZeile("book-stufe1", { marke: m.name, ...logMehr({ bookNeu }) });
  // Ordner festhalten, in dem die Datei jetzt liegt - ein spaeteres
  // Rating-Update darf den Zugriff darauf nicht verlieren (siehe bookPfad)
  m.bookordner = String(m.brandrating.rating).trim();
  // quelle mitsetzen (v127, gefunden 15.09. an Andreas echtem Stand):
  // Bis hierher fuellte NUR der PC-Import dieses Feld. Der Bestandswaechter
  // in "Daten pruefen" liest aber `haken && !m.quelle` als "es gibt keine
  // Datei" - also meldete die App jedes Book, das sie SELBST angelegt hatte,
  // als Abweichung, bis der naechste PC-Import lief. Am 15.09. waren das
  // fuenf Marken (Blaupunkt Smart Ring, Omoria, Renpho, Ultrahuman,
  // ringconn); die Dateien lagen alle sauber im OneDrive.
  //
  // Format ohne Endung wie beim Import ("Brand-Book Landpark") - so trifft
  // auch der kerninfos-Zugriff in markenFilter().
  m.quelle = "Brand-Book " + m.name;
  listeVeraltet = true;
}

// Datenteil Stufe 2 "Brand-Book befüllt": Pitchlisten-Eintrag OHNE
// Termin (Andreas Workflow Schritt 7: Startdatum vergibt Andrea manuell,
// erst dann laeuft die 5/5/10/90-Kadenz).
function bookBefuelltDaten(m, jetzt) {
  datenstand.letztesBook = { name: m.name, zeit: jetzt, stufe: 2,
    pitchNeu: !m.pitchliste };
  // Verwaiste Marke? Dann steht hier "haengt: false" - und genau das war
  // der Verlust vom 11.09. (v108). Ohne diese Zeile blieb er unbelegbar.
  logZeile("book-stufe2", { marke: m.name,
    ...logMehr({ haengt: (datenstand.marken || []).includes(m) }) });
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
  logZeile("book-rueckgaengig", { marke: m.name, stufe: lb.stufe,
    ...logMehr({ haengt: (datenstand.marken || []).includes(m) }) });
  if (lb.stufe === 2) {
    if (lb.pitchNeu) m.pitchliste = null;
  } else {
    if (lb.bookNeu) {
      OD.graphRoh(bookPfad(m), { method: "DELETE" }); // erst loeschen ...
      delete m.bookordner;                            // ... dann den Merker
      delete m.quelle;          // Gegenstueck zu bookErstelltDaten (v127):
                                // ohne das behauptet die App weiter, es gebe
                                // eine Datei, die sie gerade geloescht hat
      merkerLoeschen(m.name);   // sonst meldet der naechste Lauf eine Datei,
      merkerSichern();          // die der Nutzer selbst gerade entfernt hat
                                // (v130: Merker liegt jetzt am Geraet)
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
//
// SERIALISIERT (v128, Backlog 5). Vorher konnten 23 Aufrufer gleichzeitig
// loslaufen; zwei PUTs unterwegs, und wenn die Antworten vertauscht
// ankommen, steht in der Cloud der ÄLTERE Stand - während das Gerät den
// neueren hat und beide sich für aktuell halten. Die Kette laesst immer nur
// einen Lauf zu. `.catch` davor: ein Fehlschlag darf die Kette nicht
// dauerhaft blockieren, sonst sichert die App nach dem ersten Offline-Moment
// nie wieder.
let persistKette = Promise.resolve();

// Jeder Schreiber auf datenstand.json muss hier durch - sonst ist es keine
// Serialisierung, sondern nur eine halbe. Zweiter Schreiber ist der
// Auto-Abgleich in datenstandLaden() ("Geraet neuer als Cloud"), der bis
// v127 ganz ohne await danebenherlief.
function persistKettenLauf(fn) {
  // Der Aufrufer bekommt SEINEN Lauf zurueck, die Kette bekommt eine
  // beruhigte Fassung davon. Ohne die Trennung (Codex 16.09., Fund 3) blieb
  // die Rejection des AKTUELLEN Laufs unbehandelt, wenn kein weiterer Aufruf
  // mehr kam - das vorgeschaltete .catch deckt nur den VORHERIGEN ab.
  const lauf = persistKette.catch(() => {}).then(fn);
  persistKette = lauf.catch(() => {});
  return lauf;
}

function datenstandPersistieren() {
  return persistKettenLauf(datenstandSchreibenEinmal);
}

// Backlog 33b (Tobias, 18.09.): *"Ich gehe mal davon aus, dass wenn wir Daten
// auf OneDrive schreiben, es eine Art Handshake gibt, wo Informationen
// getauscht werden. Das gleiche wie bei eTag und cTag."* Stimmt - MSAL haelt
// das angemeldete Konto ohnehin, wir haben es nur nie mitgeschrieben.
//
// Genommen wird die homeAccountId, NICHT die Mailadresse: sie ist stabil,
// auch wenn das Konto umbenannt wird. Der Name faehrt nur mit, damit die
// Warnung unten sagen kann, WESSEN Stand da angetippt wurde - "gehoert zu
// einem anderen Konto" ohne Namen laesst einen ratlos zurueck.
function kontoKennung() {
  const k = typeof OD !== "undefined" && OD.konto();
  return k ? { id: k.homeAccountId, name: k.username || k.name || "" } : null;
}

// Setzt den Stempel auf den GLOBALEN Datenstand, nicht auf eine Kopie.
// Zwei Aufrufer: der normale Schreibweg und "Jetzt sichern" - der geht an
// datenstandSchreibenEinmal() vorbei und haette sonst ungestempelt
// geschrieben. Ein Stempel, den nur einer der beiden Wege setzt, ist
// schlechter als keiner: dann heisst "kein Stempel" mal alt und mal fremd.
//
// NICHT angemeldet -> alter Stempel bleibt stehen. Die Daten gehoeren
// weiterhin dem, dem sie vorher gehoert haben; ihn hier zu loeschen wuerde
// die Herkunft vernichten, genau wenn man sie am noetigsten braucht.
// Gehoert ein geladener Datenstand zu einem FREMDEN Konto?
// Gibt das fremde Konto zurueck, sonst null. Eigene Funktion, damit die
// Entscheidung pruefbar ist - in backupLaden() steckt sie in einem
// Dateidialog-Callback und liesse sich nur ueber den Quelltext erahnen.
//
// null (= durchlassen) in drei Faellen, und alle drei mit Absicht:
//   1. nicht angemeldet       -> keine Vergleichsbasis. Eine Warnung, die
//                                nur "weiss nicht" heisst, erzieht zum
//                                Wegklicken.
//   2. Datei ohne Stempel     -> vom PC-Werkzeug geschrieben oder aelter
//                                als v135. Ein Abbruch wuerde hier JEDES
//                                heute existierende Backup entwerten.
//   3. gleiche Kennung        -> der Normalfall.
// Verglichen wird die homeAccountId, nicht der Name: der kann sich aendern,
// ohne dass es ein anderes Konto waere.
function kontoFremd(d) {
  const meins = kontoKennung();
  const dessen = d && d.konto && d.konto.id ? d.konto : null;
  if (!meins || !dessen) return null;
  return dessen.id === meins.id ? null : dessen;
}

function kontoStempeln() {
  const k = kontoKennung();
  if (k && datenstand) datenstand.konto = k;
}

async function datenstandSchreibenEinmal() {
  // EINE Referenz für beide Schreibwege (Backlog 5, Codex 11.09.). Vorher
  // stand hier zweimal die globale `datenstand`, mit einem `await`
  // dazwischen - taucht backupLaden() in diesem Fenster ein anderes Objekt
  // unter, bekommt das Geraet den alten und die Cloud den neuen Stand.
  // Zeitstempel ZUERST aufs globale Objekt - datenstandUebernehmen()
  // vergleicht dagegen und wuerde sonst einen fremden Stand durchlassen.
  datenstand.geaendert = lokalIso();
  datenstand.geaendert_von = "Cockpit-App";
  kontoStempeln();
  // Dann eine KOPIE, nicht nur dieselbe Referenz (Codex 16.09., Fund 1):
  // `const` haelt die Referenz fest, nicht den Inhalt. Mutiert ein Aufrufer
  // das Objekt waehrend des Graph-PUT, hat IndexedDB laengst eine Kopie von
  // vorher - Geraet und Cloud liefen doch wieder auseinander. Der Klon ist
  // die einzige Art, "beide bekommen dasselbe" wirklich zu garantieren.
  //
  // JSON-Rundlauf statt structuredClone, aus zwei Gruenden:
  //  1. Es ist die EHRLICHERE Kopie. Der Datenstand geht als JSON raus und
  //     wird als JSON gespeichert - der Rundlauf klont genau das, was
  //     ankommt. structuredClone wuerde z.B. ein Date-Objekt als Date
  //     erhalten, im PUT stuende trotzdem ein String.
  //  2. structuredClone waere die EINZIGE moderne API in dieser Datei
  //     (nachgezaehlt 16.09.: kein ?., kein ??, kein replaceAll). Der Code
  //     ist bewusst konservativ - Andreas Geraet ist nicht ausgemessen.
  // ~100 KB, das kostet rund eine Millisekunde.
  const stand = JSON.parse(JSON.stringify(datenstand));
  // Was tatsächlich rausgeht (v108). Die Markenzahl ist der billigste
  // Hinweis auf einen Objekttausch: sie ändert sich, wenn ein anderer
  // Stand untergeschoben wurde.
  logZeile("stand-gespeichert", { marken: (stand.marken || []).length,
    ...logMehr({ geaendert: stand.geaendert,
                 sheet: Boolean(document.getElementById("schleier")) }) });
  // Ob das GERAET den Stand hat, muss man wissen - bisher wurde der Fehler
  // verschluckt und die App meldete trotzdem "gesichert auf Gerät"
  // (Codex 16.09., Fund 2; kein v128-Fehler, der stand vorher schon drin).
  let aufGeraet = true;
  try { await idbSchreib("datenstand", stand); } catch (_) { aufGeraet = false; }
  const ok = typeof OD !== "undefined" &&
    await OD.graphPutLeise(OD_DATENSTAND(), stand);
  // Ehrlich melden (Tobias 04.09.): "folgt beim naechsten Abgleich" war eine
  // beruhigende Unwahrheit - fehlt der Ordner, folgt nie etwas. Andreas
  // Eintraege lagen wochenlang nur im Geraetespeicher.
  // Der Banner bleibt (sofortige Rueckmeldung), die KARTE ist das Gedaechtnis
  // dazu: vier Sekunden reichen nicht, das hat der 04.09. gezeigt.
  wolkeMerken(ok);
  // Ehrlich melden (Tobias 04.09.) - jetzt auch für den Fall, dass der
  // GERÄTESPEICHER versagt hat. "Nur auf dem Gerät" war dann eine
  // beruhigende Unwahrheit: in Wahrheit lag der Eintrag NIRGENDWO.
  banner(ok && aufGeraet
    ? "Eingetragen — gesichert auf Gerät + OneDrive."
    : ok ? "⚠ Nur in OneDrive! Gerätespeicher hat abgelehnt — "
           + "bei schlechtem Netz kann der Eintrag fehlen."
    : aufGeraet ? "⚠ Nur auf dem Gerät! OneDrive-Ordner nicht erreichbar — "
                  + "Datenbank-Ordner in den Einstellungen prüfen."
    : "⚠ NICHT gespeichert — weder auf dem Gerät noch in OneDrive. "
      + "Bitte den Eintrag merken und die App neu laden.");
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
// Der Tausch des globalen datenstand-Objekts - die gefährlichste Zuweisung
// der App. Ein offenes Sheet hält seine Marke per Closure aus dem ALTEN
// Objekt; wird hier getauscht, verändert der nächste Klick eine verwaiste
// Marke, und datenstandPersistieren() schreibt sie nicht mit.
//
// v95 (07.09.) hatte die Prüfung am ANFANG von abgleichBeiRueckkehr().
// Das deckt den Fall nicht ab, dass das Sheet ERST WÄHREND des Ladens
// aufgeht - laden() hängt am Netz, das Fenster ist sekundenlang offen.
// Am 11.09. um 16:25 (Brand "54321") genau so passiert: Erfolgsmeldung aus
// dem neuen Objekt, Pitchlisten-Eintrag in der verwaisten Marke, beim
// Speichern verloren. Deshalb steht die Prüfung jetzt UNMITTELBAR vor der
// Zuweisung - hinter jedem await und damit für ALLE Aufrufer zugleich
// (abgleichBeiRueckkehr, update/↻, Start). Test: tests/test_v108.js
// ---------------------------------- Markenverlust beim Laden (v136)
// Der Zeitstempel entscheidet, welcher Stand gewinnt - er sagt aber nichts
// darueber, ob der Gewinner auch ALLES enthaelt. Ein Stand, der zwei Marken
// weniger kennt, aber zehn Minuten juenger ist, hat die beiden bisher still
// geschluckt. Ab v136 wird in genau diesem Fall gefragt.
//
// Ausloeser ist bewusst eng (Tobias 18.09.): NUR fehlende Marken, kein
// Schwellwert, kein "irgendein Unterschied". Zwei Staende mit denselben
// Marken, aber verschiedenen Ereignissen, werden NICHT erkannt - das ist die
// bekannte Luecke, kein Versehen. Es wird auch nicht gemerged.

// Welche Marken hat `b`, die `a` nicht hat? Zurueck kommen NAMEN, nicht
// Schluessel: die Frage muss lesbar sein ("Kena, Onelife"). Verglichen wird
// ueber schluessel() wie ueberall sonst - sonst ist "MyMüsli" eine andere
// Marke als "myMuesli".
function markenFehlen(a, b) {
  const hat = new Set(((a && a.marken) || []).map((m) => schluessel(m.name)));
  return ((b && b.marken) || []).map((m) => m.name)
    .filter((n) => !hat.has(schluessel(n)));
}

// Gibt es unter den Verlierern einen, der dem Gewinner Marken voraus hat?
// Rein (Liste rein, Befund raus), damit test_v136.js das ohne OneDrive und
// ohne DOM pruefen kann.
//
// `verworfen` ist die Liste der Stempel, die schon einmal bewusst abgelehnt
// wurden (einst.standVerworfen). Ohne sie faengt die Frage an zu pingpongen:
// waehlt sie den aelteren Stand, wird der neu gestempelt und gewinnt - und
// der eben verworfene taucht beim naechsten Laden als Verlierer mit eigenen
// Marken wieder auf. Der Stempel ist der richtige Schluessel, nicht der
// Dateiname: aendert sich der Stand wirklich, hat er einen neuen und die
// Frage kommt von selbst zurueck.
//
// ponytail: es wird nur EIN Verlierer zurueckgegeben (der mit den meisten
// fehlenden Marken), nicht alle. Zwei Fragen beim Start hintereinander sind
// schlimmer als zwei Starts - der naechste Ladevorgang fragt nach dem
// naechsten. Erst aufbohren, wenn drei Quellen wirklich dreifach auseinander
// laufen.
function verlustKandidat(kandidaten, verworfen) {
  const weg = new Set(verworfen || []);
  const gewinner = kandidaten && kandidaten[0];
  if (!gewinner) return null;
  const alle = [];
  for (const paar of kandidaten.slice(1)) {
    if (weg.has(String(paar[0].geaendert || ""))) continue;
    const fehlt = markenFehlen(gewinner[0], paar[0]);
    if (fehlt.length) alle.push({ verlierer: paar, fehlt: fehlt });
  }
  if (!alle.length) return null;
  alle.sort((a, b) => b.fehlt.length - a.fehlt.length);
  // Gefragt wird zur groessten Luecke - gesichert wird spaeter JEDER
  // ungewaehlte Stand. Die erste Fassung gab nur den groessten Verlierer
  // zurueck, in der Annahme, der naechste Ladevorgang frage nach dem
  // naechsten. Falsch (Codex 18.09., Fund 1): nach dem Persistieren sind
  // Geraet und Cloud schon ueberschrieben - der dritte Stand waere dann weg,
  // ohne je gezeigt worden zu sein. Deshalb `alle`.
  return { verlierer: alle[0].verlierer, fehlt: alle[0].fehlt, alle: alle };
}

// ponytail: der ZEIT-GEWINNER wird nie uebersprungen, auch wenn er schon
// einmal abgelehnt wurde (Codex 18.09., Fund 3). Geht die PC-Uhr vor, bleibt
// die Heimnetz-Datei ewig Gewinner und dieselbe Frage kommt bei jedem Laden
// wieder - die App stempelt diese Datei ja nie neu. Erreichbar nur auf
// Tobias' PC (Andreas Geraet hat gar keine Heimnetz-Datei) und nur bei
// echtem Uhr-Versatz. Aufmachen, wenn es real auftritt: dann muss der
// gewaehlte Stand auf gewinnerStempel+1s gestempelt werden, nicht auf jetzt.

// Liegt eine unbeantwortete Frage an? Traegt die Warnkarte.
let standWahlOffen = false;

// Die Frage selbst. Rueckgabe: true = weiter im normalen Weg,
// false = hier ist Schluss (uebernommen oder abgebrochen).
//
// BLOCKIEREND, und das ist der ganze Trick (Entwurf A): datenstandLaden()
// wird von laden() awaited, laden() vom Start und von abgleichBeiRueckkehr().
// Solange hier gewartet wird, ist noch nichts gezeichnet - es gibt also kein
// render(), das der Nutzerin die Frage unter den Fingern wegreisst, und es
// braucht keine Wache an drei Stellen.
//
// confirm() statt eigenem Sheet (Tobias 18.09.): derselbe Weg wie beim
// Zurueckspielen eines Backups, und er blockiert von sich aus. Ein Sheet
// koennte drei Staende auf einmal anbieten - der Fall ist bisher nie
// aufgetreten.
async function standWahlKlaeren(kandidaten) {
  const fall = verlustKandidat(kandidaten, einst.standVerworfen);
  if (!fall) { standWahlOffen = false; return true; }
  const gewinner = kandidaten[0], aelter = fall.verlierer;
  const standStempelVorher = String((datenstand && datenstand.geaendert) || "");
  const zeile = (p) => p[1] + ", " +
    String(p[0].geaendert || "?").replace("T", " ") + " · " +
    ((p[0].marken || []).length) + " Marken";
  // BEIDE Richtungen nennen (Codex 18.09., Fund 2). Die erste Fassung
  // versprach "den AELTEREN mit allen Marken" - das stimmt nur, wenn der
  // Unterschied einseitig ist. Hat der neuere Stand eigene Marken, nimmt
  // die Wahl sie mit weg, und der Text haette das Gegenteil behauptet.
  const fehltImAelteren = markenFehlen(aelter[0], gewinner[0]);
  // Ein dritter Stand mit eigenen Marken wird nicht zur Wahl gestellt -
  // aber er wird GENA"\n\n"T und gesichert, damit er nicht stillschweigend
  // verschwindet.
  const dritte = fall.alle.slice(1).map((x) =>
    x.verlierer[1] + " (" + x.fehlt.join(", ") + ")");
  logZeile("stand-verlust-gefragt", { quelle: aelter[1],
    ...logMehr({ fehlt: fall.fehlt.join(", "), weitere: dritte.join(" · ") }) });
  const nimmAelteren = confirm(
    "Die Datenstände unterscheiden sich in den Marken." + "\n\n" +
    "NEUER — " + zeile(gewinner) + "\n" +
    "   hier fehlen: " + fall.fehlt.join(", ") + "\n\n" +
    "ÄLTER — " + zeile(aelter) + "\n" +
    "   hier fehlen: " +
      (fehltImAelteren.length ? fehltImAelteren.join(", ") : "keine") + "\n\n" +
    (dritte.length ? "Ein weiterer Stand hat eigene Marken: " +
       dritte.join(" · ") + " — er wird gesichert, aber nicht übernommen." +
       "\n\n" : "") +
    "OK = den ÄLTEREN nehmen (" + aelter[1] + ")" + "\n" +
    "Abbrechen = jetzt nicht entscheiden");
  // Drei moegliche Antworten, aber confirm() kennt nur zwei - deshalb die
  // zweite Frage NUR im Abbruchfall. Der haeufige Fall ("nimm den
  // vollstaendigen") ist damit ein Fingertipp; wer nicht entscheiden will,
  // wird einmal mehr gefragt, und das ist die richtige Richtung herum.
  let gewaehlt = null;
  if (nimmAelteren) {
    gewaehlt = aelter;
  } else if (confirm(
      "Es wurde nichts übernommen." + "\n\n" +
      "OK = den NEUEREN Stand behalten (" + zeile(gewinner) + ") und " +
      "nicht mehr danach fragen" + "\n" +
      "Abbrechen = später noch einmal fragen")) {
    gewaehlt = gewinner;
  } else {
    // Vertagt: NICHTS uebernehmen, NICHTS schreiben (Tobias 18.09.). Die
    // Warnkarte haelt die Frage offen, bis entschieden ist - ein stilles
    // Weiterladen waere genau das Verhalten, das diese Frage abschaffen soll.
    logZeile("stand-verlust-vertagt", { quelle: aelter[1] });
    standWahlOffen = true;
    return false;
  }
  // JEDER nicht gewaehlte Stand wird gesichert, BEVOR er ueberschrieben
  // wird - ueber denselben Weg wie die Sicherheitskopie in backupLaden()
  // (Backlog 33). Scheitert eine davon, wird nichts uebernommen: keine
  // Entscheidung ohne Rueckfahrkarte (Tobias 18.09.).
  //
  // Sekunden UND Quelle im Dateinamen (Codex 18.09., Fund 5). Mit
  // Minuten-Aufloesung allein haetten sich die Kopien dieses einen Laufs
  // GEGENSEITIG ueberschrieben - eine Sicherung, die die vorige vernichtet,
  // ist schlechter als keine.
  const andere = kandidaten.filter((p) => p !== gewaehlt);
  const zeitteil = lokalIso().slice(0, 19).replace("T", "-").replace(/:/g, "");
  for (const p of andere) {
    const kopie = "cockpit-verworfen-" + schluessel(p[1]) + "-" + zeitteil + ".json";
    const ok = typeof OD !== "undefined" && await OD.graphPutLeise(
      datenBasis() + "/" + kopie + ":/content", p[0]);
    if (!ok) {
      logZeile("stand-verlust-ungesichert", { quelle: p[1] });
      banner("Der Stand „" + p[1] + "“ konnte nicht in OneDrive gesichert "
             + "werden — es wurde NICHTS übernommen. Erst wieder verbinden.");
      standWahlOffen = true;
      return false;
    }
  }
  // Ist waehrend der Uploads etwas eingetippt worden? (Codex 18.09., Fund 6)
  // Dieselbe Frage, die datenstandUebernehmen() als Bremse 1 stellt - der
  // Weg hier geht bewusst daran vorbei und muss sie deshalb selbst stellen.
  // Ohne das ueberschreibt eine Wahl, die vor dem Upload getroffen wurde,
  // eine Eingabe, die waehrend des Uploads kam.
  if (String((datenstand && datenstand.geaendert) || "") !== standStempelVorher) {
    logZeile("stand-verlust-abgebrochen",
      { grund: "waehrend der Sicherung getippt" });
    banner("Während der Sicherung wurde etwas eingetragen — es wurde nichts "
           + "übernommen. Die Frage kommt gleich wieder.");
    standWahlOffen = true;
    return false;
  }
  const vorStempel = String(gewaehlt[0].geaendert || "");
  if (nimmAelteren) {
    // Den aelteren nehmen heisst: an Bremse 1 vorbei. datenstandUebernehmen()
    // wuerde ihn wegen "nicht neuer" STILL ablehnen - die Wahl waere
    // wirkungslos und niemand saehe warum. Deshalb hier direkt setzen und
    // sofort neu stempeln (Entwurf B), damit der gewaehlte Stand auch
    // gegenueber Geraet und Cloud gewinnt.
    [datenstand, datenstandQuelle] = aelter;
    await datenstandPersistieren();
  }
  // Gemerkt werden die Stempel ALLER abgelehnten Staende - aber niemals der
  // eigene (Codex 18.09., Fund 4). lokalIso() loest nur auf Sekunden auf:
  // faellt das Persistieren in dieselbe Sekunde wie ein abgelehnter Stempel,
  // wuerde die Wahl sich selbst auf die Verworfen-Liste setzen und die
  // Warnung beim naechsten Mal STILL ausfallen lassen.
  const eigen = [vorStempel, String((datenstand && datenstand.geaendert) || "")];
  einst.standVerworfen =
    (Array.isArray(einst.standVerworfen) ? einst.standVerworfen : [])
      .concat(andere.map((p) => String(p[0].geaendert || "")))
      .filter((x) => x && eigen.indexOf(x) < 0)
      .slice(-20);   // ponytail: Deckel bei 20 Stempeln
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  standWahlOffen = false;
  logZeile("stand-verlust-entschieden", { quelle: gewaehlt[1],
    ...logMehr({ verworfen: andere.map((p) => p[1]).join(" · ") }) });
  if (nimmAelteren) { versionsSicherung(); autoBackupPruefen(); }
  // Gewinner bleibt Gewinner: der normale Weg macht weiter, er tut ohnehin
  // genau das Richtige.
  return !nimmAelteren;
}

function datenstandUebernehmen(paar) {
  const alt = datenstand && datenstand.geaendert;
  // Zweite Frage, gefunden vom Lasttest am 11.09. (Seed 31337, v109):
  // Ist das, was hier eingesetzt werden soll, ueberhaupt NEUER?
  //
  // datenstandLaden() vergleicht Heimnetz, OneDrive und Geraet miteinander -
  // aber nie gegen den Stand, der GERADE IM SPEICHER liegt. Alle drei
  // Kandidaten werden vor dem Vergleich geholt. Wird waehrenddessen etwas
  // eingetragen, sind hinterher alle drei veraltet, und der aelteste
  // Gewinner ueberschreibt den frischen Eintrag.
  //
  // Die Sheet-Sperre allein deckt das nicht ab: sie greift, solange das
  // Sheet offen ist. Wird es vor dem Ende des Ladevorgangs geschlossen,
  // laeuft der veraltete Stand ungehindert durch. Genau diese Reihenfolge
  // hat der Lasttest getroffen - Eintrag sauber geschrieben, kein
  // verwaistes Objekt, und trotzdem am Ende weg.
  //
  // "<=" und nicht "<" (v109, Codex-Gegenpruefung 11.09.): lokalIso() loest
  // nur auf SEKUNDEN auf. Holt der Ladevorgang einen Stand mit 16:00:01 und
  // wird in derselben Sekunde etwas eingetragen - ebenfalls 16:00:01 -, dann
  // ist der Kandidat nicht aelter, aber eben auch nicht neuer. Mit "<" liefe
  // er durch und naehme den frischen Eintrag mit.
  //
  // Gleichstand wird deshalb abgelehnt. Die Richtung ist die sichere: was im
  // Speicher steht, hat die Nutzerin gerade getippt; ein gleich alter Stand
  // von aussen bringt im besten Fall dasselbe mit. Aendert ein zweites Geraet
  // in derselben Sekunde etwas, wird es nicht verworfen, sondern vertagt -
  // der naechste Abgleich hat einen spaeteren Stempel und kommt durch.
  //
  // ponytail: die Sekunden-Aufloesung ist die eigentliche Schwaeche. Sauber
  // waere ein Stempel mit Millisekunden - der steckt aber in datenstand.json,
  // im Snapshot-Vergleich und in den Python-Werkzeugen. Erst umstellen, wenn
  // der Gleichstand real weh tut; bis dahin kostet die Ablehnung nur eine
  // verzoegerte Uebernahme.
  if (alt && String(paar[0] && paar[0].geaendert || "") <= String(alt)) {
    logZeile("stand-verworfen", { grund: "nicht neuer als der laufende Stand",
      quelle: paar[1], ...logMehr({ soll: paar[0] && paar[0].geaendert,
                                    ist: alt }) });
    return false;
  }
  if (document.getElementById("schleier")) {
    logZeile("stand-verworfen", { grund: "Sheet offen", quelle: paar[1],
      ...logMehr({ soll: paar[0] && paar[0].geaendert, ist: alt }) });
    abgleichNachholen = true;   // popstate holt es nach, sobald das Sheet zu ist
    return false;
  }
  logZeile("stand-uebernommen", { quelle: paar[1],
    ...logMehr({ soll: paar[0] && paar[0].geaendert, ist: alt }) });
  [datenstand, datenstandQuelle] = paar;
  return true;
}

async function datenstandLaden() {
  let lokal = null;
  try {
    const a = await fetch("daten/datenstand.json", { cache: "no-store" });
    if (a.ok) lokal = await a.json();
  } catch (_) {}
  const cloud = typeof OD !== "undefined"
    ? await OD.graphLeise(OD_DATENSTAND())
    : null;
  let geraet = null;
  try { geraet = await idbLies("datenstand"); } catch (_) {}
  const kandidaten = [[lokal, "Heimnetz"], [cloud, "OneDrive"],
                      [geraet, "Gerät"]].filter(([d]) => d);
  if (!kandidaten.length) return;
  kandidaten.sort((a, b) =>
    String(b[0].geaendert || "").localeCompare(String(a[0].geaendert || "")));
  // Wuerde der Zeit-Gewinner Marken verschlucken? Dann fragen, bevor
  // irgendetwas angefasst wird (v136). Gibt false zurueck, wenn hier Schluss
  // ist - entweder weil die Wahl schon umgesetzt wurde oder weil sie vertagt
  // wurde. In beiden Faellen darf der normale Weg NICHT weiterlaufen.
  if (!(await standWahlKlaeren(kandidaten))) return;
  // Ab hier wird das globale Objekt angefasst - erst fragen, ob das gerade
  // erlaubt ist (v108). Wird abgelehnt, NICHTS weiter tun: ein idbSchreib()
  // wuerde sonst den alten Stand als den neuen wegschreiben.
  if (!datenstandUebernehmen(kandidaten[0])) {
    // Abgelehnt heisst: der Kandidat wird nicht eingesetzt. Die Sicherungen
    // haengen aber am VORHANDENEN Stand, nicht am abgelehnten - sie duerfen
    // nicht mit ausfallen (Codex-Gegenpruefung 11.09.). Sonst liefe bei
    // wiederholter Ablehnung wiederholt keine Rueckfahrkarte und kein
    // Tagesbackup, und genau die braucht man, wenn etwas klemmt.
    // Der faellige Rueck-Upload haengt ebenfalls am VORHANDENEN Stand und
    // faellt sonst mit aus (v131). Der `return` hier lag VOR dem Auto-Abgleich
    // weiter unten - wer offline etwas eintrug und spaeter neu lud, OHNE etwas
    // Neues zu tippen, dessen Aenderung blieb auf dem Geraet liegen. Erst die
    // naechste Eingabe stiess ueber datenstandPersistieren() wieder einen
    // Upload an.
    //
    // Der Kommentar in datenstandUebernehmen() behauptete an der
    // Gleichstands-Ablehnung, sie koste "nur eine verzoegerte Uebernahme".
    // Sie kostete auch den Weg zurueck zu OneDrive - und das ist der Weg, auf
    // dem Andreas Arbeit ueberhaupt bei Tobias ankommt. Gefunden 16.09.
    if (datenstand && cloud &&
        String(cloud.geaendert || "") < String(datenstand.geaendert || "")) {
      logZeile("stand-nachgereicht", { grund: "Cloud aelter trotz Ablehnung",
        ...logMehr({ soll: datenstand.geaendert, ist: cloud.geaendert }) });
      persistKettenLauf(() => OD.graphPutLeise(OD_DATENSTAND(), datenstand));
    }
    if (datenstand) { versionsSicherung(); autoBackupPruefen(); }
    return;
  }
  if (datenstandQuelle !== "Gerät") {
    // Auch dieser Schreiber gehoert in die Kette (Codex 16.09., Fund 5).
    // Direkt davor hat datenstandUebernehmen() das globale Objekt ERSETZT
    // ([datenstand, datenstandQuelle] = paar) - der zweite Objekttausch
    // neben backupLaden(). Laeuft gleichzeitig ein Persistieren, schreibt
    // diese Zeile den neuen Stand aufs Geraet, waehrend der alte noch zur
    // Cloud unterwegs ist: genau das Auseinanderlaufen aus Backlog 5.
    await persistKettenLauf(
      () => idbSchreib("datenstand", datenstand).catch(() => {}));
  } else if (cloud &&
             String(cloud.geaendert || "") < String(datenstand.geaendert || "")) {
    // Auto-Abgleich: Geraet ist neuer als OneDrive -> still zuruecksichern.
    // ponytail: keine WLAN-Erkennung (koennen Browser nicht zuverlaessig),
    // die Datei ist winzig - Abgleich laeuft einfach bei jedem Laden.
    // Durch die Kette (v128): das hier ist der ZWEITE Schreiber auf
    // datenstand.json. Lief er gleichzeitig mit einem Persistieren, konnten
    // sich die beiden PUTs ueberholen - genau der Fall aus Backlog 5.
    persistKettenLauf(() => OD.graphPutLeise(OD_DATENSTAND(), datenstand));
  }
  // Rueckfahrkarte fuer ein missratenes Release ZUERST, dann das taegliche
  // Backup. Beide bewusst OHNE await: der Start soll nicht auf einen
  // Upload warten.
  versionsSicherung();
  autoBackupPruefen();
}

// ------------------------------- Sicherung vor dem Versionswechsel (v97)
// Die Rueckfahrkarte fuer ein missratenes Update. Die Software rollt man
// ueber git zurueck (revert + neue Versionsnummer, nicht zurueck auf die
// alte - die App zeigt APP_VERSION an, und "v95" muss "v95" heissen).
// Der Datenstand braucht aber eine eigene Kopie, und zwar von VOR dem
// ersten Lauf der neuen Fassung.
//
// Genau EINE Kopie je Version, nicht je Tag - und mit eigenem Dateinamen.
// Haette sie denselben Namen wie das taegliche Auto-Backup
// (cockpit-datenstand-<datum>.json), wuerde sie es am selben Tag
// ueberschreiben und damit eine Sicherung vernichten statt eine anzulegen.
//
// Der Stand wird SOFORT eingefroren, nicht erst beim Upload: erledigen()
// und Co. veraendern datenstand an Ort und Stelle. Ohne den Klon koennte
// ein Tipp waehrend des laufenden Uploads in die Sicherung durchschlagen -
// eine Sicherung mit dem Zustand DANACH ist wertlos.
//
// Rueckgabewert nur fuer den Selbsttest; der Aufrufer wertet ihn nicht aus.
// Sicherung schreiben und dabei SAGEN, was schiefging (v105).
//
// graphPutLeise() gibt nur true/false zurueck. Fuer eine Sicherung ist das
// zu wenig: "Ordner fehlt" braucht eine andere Antwort als "offline".
// Tobias 11.09.: "Wenn der Graph leise ist, dann machen wir ihn laut."
//
// Der Ordner wird BEWUSST NICHT angelegt - gleiche Regel wie beim
// Datenbank-Pfad. Ein Ordner, den die App still erzeugt, versteckt einen
// falsch eingestellten Pfad; dann liegen die Sicherungen irgendwo und
// niemand merkt es. Stattdessen: klare Meldung und der Pruefen-Knopf in
// den Einstellungen.
async function sicherungSchreiben(pfad, daten) {
  // conflictBehavior=replace ausdruecklich dazusagen. Eine Sicherung mit
  // gleichem Namen (gleiche Version bzw. gleicher Tag) SOLL die alte
  // ersetzen - sonst blieben zwei Staende mit demselben Datum stehen, und
  // beim Zurueckholen waere nicht klar, welcher gilt. Ohne den Parameter
  // antwortet Graph auf eine vorhandene Datei je nach Weg mit 409.
  const r = await OD.graphRoh(pfad + "?@microsoft.graph.conflictBehavior=replace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(daten),
  });
  if (!r) return { ok: false, text: "nicht angemeldet oder offline" };
  if (r.ok) return { ok: true };
  if (r.status === 404) {
    return { ok: false, fehlt: true,
      text: "Sicherungs-Ordner nicht gefunden — in den Einstellungen unter " +
            "„Pfad Sicherungen“ prüfen. Es wurde NICHTS gesichert." };
  }
  return { ok: false, text: "Sichern fehlgeschlagen (Fehler " + r.status + ")" };
}

// Welche Sicherungen fliegen raus? Pur gehalten (Liste rein, Liste raus),
// damit test_v105.js das ohne OneDrive prueft - wie backupFaellig().
//
// Zwei Regeln, die aus echten Daten kommen:
//  - Geloescht wird NUR, was die App selbst schreibt. Der Ordner ist
//    einstellbar; zeigt er versehentlich auf einen Dokumente-Ordner, darf
//    dort nichts verschwinden.
//  - Die Versionssicherung der laufenden Version bleibt immer. Sie ist die
//    Rueckfahrkarte fuer genau die Version, die gerade laeuft.
function sicherungenAussortieren(dateien, version, max = SICHERUNGEN_MAX) {
  // Der Name muss GANZ passen, nicht nur vorne. Ein Praefix-Muster fing
  // auch "cockpit-datenstand-alt.json.bak" - eine Datei, die die App nie
  // geschrieben hat und trotzdem geloescht haette (test_v105 Fall 5).
  const unsere = (dateien || []).filter((d) =>
    /^cockpit-datenstand-\d{4}-\d{2}-\d{2}\.json$/.test(String(d.name || "")) ||
    /^cockpit-vor-v\d+-\d{4}-\d{2}-\d{2}\.json$/.test(String(d.name || "")));
  const geschuetzt = "cockpit-vor-" + version + "-";
  const bleibt = [], rest = [];
  for (const d of unsere) {
    (String(d.name).startsWith(geschuetzt) ? bleibt : rest).push(d);
  }
  rest.sort((a, b) => String(b.lastModifiedDateTime || "")
    .localeCompare(String(a.lastModifiedDateTime || "")));
  return rest.slice(max);
}

// Aufraeumen nach dem Schreiben. Ein Fehlschlag hier ist kein Drama - die
// Sicherung steht ja schon -, deshalb leise. Graph-DELETE landet im
// OneDrive-Papierkorb, nichts ist endgueltig weg.
async function sicherungenAufraeumen() {
  const r = await OD.graphRoh(sicherungBasis() +
    ":/children?$select=id,name,lastModifiedDateTime&$top=200");
  if (!r || !r.ok) return 0;
  const weg = sicherungenAussortieren(((await r.json()).value) || [],
                                      APP_VERSION);
  let n = 0;
  for (const d of weg) {
    const a = await OD.graphRoh("/me/drive/items/" + d.id, { method: "DELETE" });
    if (a && a.ok) n++;
  }
  return n;
}

async function versionsSicherung() {
  if (!datenstand || einst.appStand === APP_VERSION) return "uebersprungen";
  if (typeof OD === "undefined" || !OD.konto()) return "kein-konto";
  const stand = JSON.parse(JSON.stringify(datenstand));
  const ziel = `${sicherungBasis()}/cockpit-vor-${APP_VERSION}-` +
               `${lokalIso().slice(0, 10)}.json:/content`;
  // Fehlschlag (offline): Merker NICHT setzen, dann versucht es der
  // naechste Start erneut. Lieber eine Sicherung zu spaet als keine.
  const erg = await sicherungSchreiben(ziel, stand);
  if (!erg.ok) {
    // Laut werden (v105): ein fehlender Ordner ist ein Einrichtungsfehler
    // und bleibt sonst unsichtbar, bis jemand die Sicherung braucht.
    if (erg.fehlt) banner(erg.text);
    return "fehler";
  }
  einst.appStand = APP_VERSION;
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  sicherungenAufraeumen();   // ohne await: der Start wartet nicht aufs Aufraeumen
  return "gesichert";
}

// Sichtbar machen, ob die Rueckfahrkarte wirklich existiert. Ohne diese
// Zeile waere ein dauerhaft fehlschlagender Upload ein stiller Fehlschlag,
// der wie Erfolg aussieht - das Muster, das dieses Projekt fuenfmal
// gekostet hat (v70, v71, v90, v93, und der Word-Rueckweg am 08.09.).
function versionsSicherungText() {
  return einst.appStand === APP_VERSION
    ? `Sicherung vor ${APP_VERSION}: liegt in OneDrive`
    : `Sicherung vor ${APP_VERSION}: steht noch aus`;
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
  `${sicherungBasis()}/cockpit-datenstand-${datum}.json:/content`;

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
  const erg = await sicherungSchreiben(OD_BACKUP(heute), datenstand);
  if (!erg.ok) {
    // v105: frueher endete der Versuch hier still. Ein Backup, das
    // stillschweigend ausbleibt, ist nicht von einem erfolgreichen zu
    // unterscheiden - genau das Muster, das dieses Projekt fuenfmal
    // gekostet hat (v70, v71, v90, v93, Word-Rueckweg am 08.09.).
    if (erg.fehlt) banner(erg.text);
    return;
  }
  einst.autoStand = heute;
  localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  const weg = await sicherungenAufraeumen();
  banner("Automatisches Backup in OneDrive angelegt." +
         (weg ? ` ${weg} alte in den Papierkorb.` : ""));
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
  // Dritter Schreiber, auch er durch die Kette (v128). Andrea kann "Jetzt
  // sichern" druecken, waehrend ein Persistieren noch laeuft - dann waren es
  // bis v127 zwei PUTs auf dieselbe Datei.
  kontoStempeln();
  const ok = typeof OD !== "undefined" &&
    await persistKettenLauf(() => OD.graphPutLeise(OD_DATENSTAND(), datenstand));
  if (ok) {
    einst.gesichert = new Date().toISOString().slice(0, 16).replace("T", " ");
    localStorage.setItem(EINST_KEY, JSON.stringify(einst));
  }
  wolkeMerken(ok);
  statusEl.textContent = sicherungsText();
  banner(ok ? "Datenstand nach OneDrive gesichert."
            : "Sichern fehlgeschlagen — bei OneDrive angemeldet?");
}

// Backup-Datei in den Download-Ordner (Phase 4): ueberlebt auch das
// Loeschen der Browserdaten. Wiederherstellen bei Bedarf von Hand
// (Datei zurueck nach OneDrive/Apps/Cockpit legen).
// praefix (optional): eigener Dateiname-Anfang. Gebraucht von
// backupLaden() fuer die Sicherheitskopie vor dem Zurueckspielen.
// ACHTUNG typeof-Pruefung: der Knopf haengt als onclick direkt an dieser
// Funktion und reicht ein MouseEvent als ersten Parameter durch. Ohne die
// Pruefung stuende "[object MouseEvent]" im Dateinamen.
// Gibt zurueck, OB die Kopie zustande kam. backupLaden() haengt daran:
// dort ist sie die einzige Rueckfahrkarte, und ein stilles "hat nicht
// geklappt" waere schlimmer als gar kein Versprechen.
function datenstandBackup(praefix) {
  if (!datenstand) { banner("Kein Datenstand geladen."); return false; }
  const name = typeof praefix === "string" ? praefix : "cockpit-datenstand-";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(
    [JSON.stringify(datenstand, null, 2)], { type: "application/json" }));
  // Uhrzeit MIT im Namen: zwei Rueckspielungen am selben Tag duerfen sich
  // nicht gegenseitig ueberschreiben - sonst ist die Sicherheitskopie im
  // zweiten Anlauf genau der Stand, vor dem sie schuetzen sollte.
  // lokalIso() statt toISOString(): der Rest der App stempelt in Lokalzeit.
  // Um 00:30 truege die Datei sonst das Datum von gestern - und man sucht
  // im Ernstfall unter dem falschen Tag.
  a.download = name +
    lokalIso().slice(0, 16).replace("T", "-").replace(":", "") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  banner("Backup liegt im Download-Ordner.");
  return true;
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
  // Warum die OneDrive-Quelle fehlt, wird jetzt AUSGEWERTET (v90).
  // Vorher: graphLeise() lieferte bei jedem Problem null, die App fiel
  // still auf die Geraetekopie zurueck und zeigte veraltete Zahlen -
  // ohne ein Wort. Genau so hat Tobias am 06.09. nach dem Umzug auf
  // "Datenbank" weiter 62 Follow-ups gesehen, obwohl im frischen
  // Snapshot 60 standen: sein Handy zeigte noch auf den alten Pfad,
  // bekam einen 404 und nahm klaglos seinen eigenen alten Stand.
  // Dieselbe Klasse Fehler wie v70/v71 - stiller Rueckfall statt Ansage.
  let cloud = null;
  datenPfadFehler = null;
  if (typeof OD !== "undefined") {
    const r = await OD.graphRoh(OD_SNAPSHOT());
    if (r && r.ok) {
      try { cloud = await r.json(); } catch (_) { /* kaputtes JSON */ }
    } else if (r && r.status === 404) {
      datenPfadFehler = "Der eingestellte Ordner existiert in OneDrive nicht "
        + "(" + datenBasis().split("root:")[1] + "). Die App zeigt gerade den "
        + "zuletzt auf diesem Gerät gespeicherten Stand.";
    } else if (r) {
      datenPfadFehler = "OneDrive antwortet mit Fehler " + r.status
        + ". Die App zeigt den zuletzt auf diesem Gerät gespeicherten Stand.";
    }
    // r === null: nicht angemeldet oder offline. Das ist kein Fehlpfad -
    // dafuer gibt es die OneDrive-Karte im Hauptmenue.
  }
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
    // Bis v88 ging hier ein POST /update an server.py, der die Books am PC
    // neu einlas. Der Heimserver ist seit dem Umzug auf GitHub Pages
    // (29.08.) ueberfluessig und am 06.09. geloescht worden - der Aufruf
    // schlug seither ohnehin immer fehl und lief in genau diesen Zweig.
    // Books neu einlesen macht jetzt der PC (datenstand.py /
    // export_snapshot.py), das Ergebnis kommt ueber OneDrive hier an.
    await laden();
    render();
    banner("Aktueller Stand aus OneDrive: " +
      String(snap.erzeugt || "?").replace("T", " "));
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
  // Stiller Bestandslauf (v137). Hier und nicht in laden(): vorher ist
  // OneDrive nicht verbunden, die Ordner waeren nicht lesbar und der Lauf
  // muesste schweigen. BEWUSST ohne await - der Start wartet nicht darauf,
  // bei Befund zeichnet er selbst nach.
  bestandStillPruefen().then((neu) => {
    if (neu && !document.getElementById("schleier")) render();
  });
});

// Persistenter Speicher (Phase 4): sonst darf der Browser IndexedDB bei
// Platzmangel still wegraeumen. Bei installierter PWA meist auto-genehmigt.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// Eine fertig geladene, aber noch nicht uebernommene Version meldet sich
// hier. Der Wartestand ist ein PLATZ, keine Warteschlange: kommt waehrend
// des Wartens noch ein Release, ersetzt es das wartende - ein Druck landet
// also immer auf der NEUESTEN Version, nie auf einer Zwischenstufe.
// Deshalb reicht eine Leiste und ein Knopf, ohne Zaehler.
let wartenderWorker = null;
let swRegistrierung = null; // fuer "Nach Update suchen" in den Einstellungen

// Handbetrieb fuer den Fall, dass der automatische Weg wieder klemmt
// (v125, Tobias 15.09.). Sucht auf Zuruf und zeigt die Leiste, wenn eine
// Version wartet. Der Weg ueber updateBereit() ist Absicht: eine Stelle
// baut die Leiste, nicht zwei.
function updateSuchKnopf() {
  const knopf = el("button", "chip", "↻ Nach Update suchen");
  knopf.onclick = async () => {
    if (!swRegistrierung) { banner("Update-Prüfung nicht verfügbar"); return; }
    knopf.disabled = true;
    knopf.textContent = "Suche …";
    try { await swRegistrierung.update(); } catch (e) { /* offline: unten melden */ }
    knopf.disabled = false;
    knopf.textContent = "↻ Nach Update suchen";
    const wartend = swRegistrierung.waiting;
    if (wartend) {
      wartenderWorker = null; // vorheriges "Später" darf nicht blockieren
      updateBereit(wartend);
      banner("Neue Version bereit");
    } else {
      banner("Kein Update bereit · " + APP_VERSION);
    }
  };
  return knopf;
}

function updateBereit(sw) {
  if (!sw || sw === wartenderWorker) return;
  wartenderWorker = sw;
  if (document.getElementById("updateleiste")) return;
  const leiste = el("div", "updateleiste");
  leiste.id = "updateleiste";
  leiste.append(el("span", null, "Neue Version bereit"));
  const jetzt = el("button", "chip aktiv", "Jetzt laden");
  // Kein eigener reload hier: der Worker uebernimmt, dadurch feuert
  // controllerchange - und DORT wird neu geladen. Eine Stelle, nicht zwei.
  jetzt.onclick = () => {
    jetzt.disabled = true;
    jetzt.textContent = "Lädt …";
    wartenderWorker.postMessage("uebernehmen");
  };
  const spaeter = el("button", "chip", "Später");
  // wartenderWorker MUSS hier zurueckgesetzt werden (v125, Andrea 14.09.):
  // sonst greift oben "sw === wartenderWorker" und die Leiste kann in
  // dieser Seitensitzung nie wieder erscheinen. Andrea drueckte "Später",
  // wischte die App weg, oeffnete sie neu - Android WECKT die PWA meist nur
  // auf, also lief kein Startcode, die Variable blieb gesetzt und das
  // Update blieb unsichtbar. "Später" heisst spaeter, nicht nie.
  spaeter.onclick = () => {
    leiste.remove();
    wartenderWorker = null;
  };
  leiste.append(jetzt, spaeter);
  document.body.append(leiste);
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
      swRegistrierung = reg;
      reg.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        reg.update();
        // Erneut anbieten (v125): reg.update() loest KEIN "updatefound" aus,
        // wenn die neue Version schon installiert wartet. Ohne diese Zeile
        // fragt nach einem "Später" niemand mehr nach.
        updateBereit(reg.waiting);
      });
      // Schon einer da (App war zu, als das Release kam)?
      updateBereit(reg.waiting);
      // ... oder es kommt gerade einer rein.
      reg.addEventListener("updatefound", () => {
        const neu = reg.installing;
        if (!neu) return;
        neu.addEventListener("statechange", () => {
          // "installed" MIT vorhandenem controller = Update. Ohne
          // controller ist es die Erstinstallation - da gibt es nichts
          // zu fragen, die App laeuft ja schon mit diesen Dateien.
          if (neu.state === "installed" && navigator.serviceWorker.controller)
            updateBereit(reg.waiting || neu);
        });
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

// Rueckkehr in die App: Daten frisch holen (Tobias 03.09., v69).
// VORHER wurde der Datenstand NUR beim Start geladen. Android weckt PWAs
// meist nur auf, statt sie neu zu starten - ein Geraet, das stundenlang
// im Hintergrund lag, hielt also einen alten Stand und ueberschrieb beim
// naechsten Eintrag den neueren des anderen Geraets (datenstandPersistieren
// schreibt die GANZE Datei, es gibt keinen Merge). Genau der Fall
// "Andrea arbeitet mit Handy UND Tablet".
// Gefahrlos: jede Aenderung wird sofort persistiert, es gibt keine
// ungespeicherten Eingaben, die ein Neuladen verlieren koennte.
// ponytail: schliesst das Fenster, nicht den Grenzfall - sind beide
// Geraete GLEICHZEITIG offen und werden bearbeitet, gewinnt weiter der
// letzte Schreiber. Dagegen haelt nur ein Abgleich je Marke oder ein
// If-Match/eTag beim PUT; erst bauen, wenn das real vorkommt.
let abgleichLaeuft = false;
let abgleichNachholen = false;      // Abgleich wartet auf ein leeres Sheet

async function abgleichBeiRueckkehr() {
  if (abgleichLaeuft) return;         // Doppelaufrufe beim Aufwachen
  // Bei OFFENEM Sheet gar nicht erst laden (v95, Tobias 07.09.).
  // datenstandLaden() ERSETZT das globale datenstand-Objekt - ein offenes
  // Sheet haelt seine Marke aber per Closure aus dem alten Objekt. Der
  // naechste Klick veraenderte dann eine verwaiste Marke, und
  // datenstandPersistieren() schrieb den neuen Stand OHNE die Aenderung
  // nach OneDrive. Gemeldet als: "Brand-Book befuellt" abgehakt, Brand
  // kam nicht in die Pitchliste, Rating sah aus wie frisch angelegt.
  // Das passiert bei JEDER Rueckkehr, nicht nur im Konfliktfall: beim
  // Parsen entsteht immer ein neues Objekt, egal ob der Inhalt gleich ist.
  // Bis v95 schuetzte die Klausel unten nur das NEUZEICHNEN - die Daten
  // wurden trotzdem ausgetauscht. Genau diese Luecke.
  if (document.getElementById("schleier")) { abgleichNachholen = true; return; }
  abgleichLaeuft = true;
  const vorher = datenstand && datenstand.geaendert;
  try {
    await laden();     // zieht den Datenstand selbst mit (siehe dort)
  } catch (_) {
    // offline oder OneDrive nicht erreichbar: alter Stand bleibt stehen
  } finally {
    abgleichLaeuft = false;
  }
  // Wartende Book-Eintraege nachtragen (v103). Der richtige Moment:
  // Andrea kommt gerade aus Word zurueck, die Sperre ist gefallen.
  outboxAbarbeiten();
  // Vier Ordner-Abrufe, kein Download. BEWUSST ohne await: die Rueckkehr
  // soll nicht darauf warten, das Ergebnis zeichnet sich selbst nach.
  // Seit v137 laeuft hier der ganze Bestandslauf, nicht nur der
  // Book-Waechter: er holt dieselbe Dateiliste, und die Warnkarte waere
  // sonst bis zum naechsten echten Neustart veraltet - behebt Andrea etwas,
  // waehrend die App offen bleibt, saehe man es nicht.
  bestandStillPruefen().then((neu) => {
    if (document.getElementById("schleier")) return;
    if (!bookGeaendert.size && !neu) return;
    listeVeraltet = false;
    render();
  });
  if (datenstand && datenstand.geaendert !== vorher) {
    listeVeraltet = true;
    banner("Neuerer Stand von einem anderen Gerät geladen.");
  }
  // Nur neu zeichnen, wenn KEIN Sheet offen ist - sonst zieht man der
  // Nutzerin die Ansicht unter einem gerade offenen Formular weg.
  // Ist eines offen, zeichnet popstate beim Schliessen neu (listeVeraltet).
  if (!document.getElementById("schleier")) {
    listeVeraltet = false;
    render();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") abgleichBeiRueckkehr();
});

einstAnwenden(); // gespeicherten Stil sofort anwenden, vor dem ersten Rendern
(async () => {
  try {
    await laden();
  } catch (fehler) {
    ladefehler = fehler.message;
  }
  render();
})();
